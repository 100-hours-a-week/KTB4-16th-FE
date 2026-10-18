import { Client, ReconnectionTimeMode, TickerStrategy } from '@stomp/stompjs';

import { ApiError } from '../../../shared/api/apiError';
import {
  CHAT_DESTINATIONS,
  type ChatConnection,
  type ChatConnectionOptions,
  type ChatConnectionSnapshot,
  type ChatConnectionStopReason,
} from '../model/chatConnection.types';

interface ConnectionLifetime {
  client: Client;
  valid: boolean;
  attempts: number;
  authRecovered: boolean;
  needsRefresh: boolean;
  lastToken: string | null;
  releaseOnlineWait: (() => void) | null;
  removeListeners: () => void;
  shutdown?: Promise<void>;
}

/** 현재 페이지의 보안 방식과 host를 유지하며 채팅 연결 주소를 만든다. */
export function createChatWebSocketUrl(origin: string): string {
  const url = new URL('/ws', origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}

/** 화면 하나의 STOMP 연결·인증 복구·사용자 큐 구독을 같은 수명으로 관리한다. */
export function createChatConnection(options: ChatConnectionOptions): ChatConnection {
  let current: ConnectionLifetime | null = null;
  let commandVersion = 0;
  let restarting: Promise<void> | null = null;
  let snapshot: ChatConnectionSnapshot = {
    state: 'idle',
    retryCount: 0,
    stopReason: null,
    isOffline: !navigator.onLine,
    isRefreshingToken: false,
  };

  /** 상태 원본을 교체해 이전 비동기 콜백의 객체 변경이 화면에 섞이지 않게 한다. */
  function report(patch: Partial<ChatConnectionSnapshot>): void {
    snapshot = { ...snapshot, ...patch };
    options.onStateChange(snapshot);
  }

  /** 연결 의도를 먼저 무효화하고 영수증을 기다리되 끊긴 소켓의 종료에도 상한을 둔다. */
  function retire(lifetime: ConnectionLifetime, force = false): Promise<void> {
    if (lifetime.shutdown) return lifetime.shutdown;
    lifetime.valid = false;
    lifetime.removeListeners();
    lifetime.releaseOnlineWait?.();
    const closing = lifetime.client.deactivate({ force });
    lifetime.shutdown = force
      ? closing
      : new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            void lifetime.client.deactivate({ force: true }).then(resolve);
          }, 6000);
          void closing.then(() => {
            clearTimeout(timeout);
            resolve();
          });
        });
    return lifetime.shutdown;
  }

  /** 자동 복구로 해결되지 않는 실패를 화면에 알리고 재시도를 중단한다. */
  function halt(lifetime: ConnectionLifetime, reason: ChatConnectionStopReason): void {
    if (!lifetime.valid) return;
    report({ state: 'disconnected', stopReason: reason, isRefreshingToken: false });
    void retire(lifetime, true);
  }

  /** 오프라인에서는 연결 예산을 소모하지 않고 online 또는 수명 종료를 기다린다. */
  async function waitUntilOnline(lifetime: ConnectionLifetime): Promise<void> {
    while (lifetime.valid && !navigator.onLine) {
      report({ isOffline: true });
      await new Promise<void>((resolve) => {
        lifetime.releaseOnlineWait = resolve;
      });
      lifetime.releaseOnlineWait = null;
    }
  }

  /** 새 연결 구간을 시작하며 라이브러리의 재연결 스케줄러 하나만 사용한다. */
  function launch(): void {
    const client = new Client({
      brokerURL: createChatWebSocketUrl(window.location.origin),
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
      reconnectDelay: 2000,
      maxReconnectDelay: 30000,
      connectionTimeout: 10000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      heartbeatStrategy:
        typeof Worker === 'undefined' ? TickerStrategy.Interval : TickerStrategy.Worker,
    });
    const lifetime: ConnectionLifetime = {
      client,
      valid: true,
      attempts: 0,
      authRecovered: false,
      needsRefresh: false,
      lastToken: null,
      releaseOnlineWait: null,
      removeListeners: () => undefined,
    };
    current = lifetime;

    /** 브라우저 네트워크 상태만 반영하며 새 재시도 타이머를 만들지 않는다. */
    const onNetworkChange = () => {
      if (!lifetime.valid) return;
      report({ isOffline: !navigator.onLine });
      if (navigator.onLine) lifetime.releaseOnlineWait?.();
    };
    window.addEventListener('online', onNetworkChange);
    window.addEventListener('offline', onNetworkChange);
    lifetime.removeListeners = () => {
      window.removeEventListener('online', onNetworkChange);
      window.removeEventListener('offline', onNetworkChange);
    };
    report({
      state: 'connecting',
      retryCount: 0,
      stopReason: null,
      isOffline: !navigator.onLine,
      isRefreshingToken: false,
    });

    client.beforeConnect = async () => {
      await waitUntilOnline(lifetime);
      if (!lifetime.valid) return;
      if (lifetime.attempts >= 6) {
        halt(lifetime, 'retry-exhausted');
        return;
      }
      report({
        state: lifetime.attempts === 0 ? 'connecting' : 'reconnecting',
        retryCount: lifetime.attempts,
      });
      lifetime.attempts += 1;
      if (lifetime.needsRefresh && options.getAccessToken() !== lifetime.lastToken) {
        lifetime.needsRefresh = false;
      }
      if (lifetime.needsRefresh) {
        lifetime.needsRefresh = false;
        report({ isRefreshingToken: true });
        try {
          await options.refreshAccessToken();
        } catch (error: unknown) {
          if (lifetime.valid)
            halt(
              lifetime,
              error instanceof ApiError &&
                (error.status === 401 || error.code === 'SESSION_CHANGED')
                ? 'authentication'
                : 'temporary',
            );
          return;
        }
        if (!lifetime.valid) return;
        report({ isRefreshingToken: false });
        await waitUntilOnline(lifetime);
      }
      if (!lifetime.valid) return;
      lifetime.lastToken = options.getAccessToken();
      if (!lifetime.lastToken) {
        halt(lifetime, 'authentication');
        return;
      }
      client.connectHeaders = { Authorization: `Bearer ${lifetime.lastToken}` };
    };

    client.onConnect = () => {
      if (!lifetime.valid) return;
      for (const destination of CHAT_DESTINATIONS) {
        client.subscribe(destination, (message) => {
          if (lifetime.valid) options.onFrame?.(destination, message.body);
        });
      }
      lifetime.attempts = 0;
      lifetime.authRecovered = false;
      report({ state: 'connected', retryCount: 0, stopReason: null });
    };

    client.onStompError = (frame) => {
      if (!lifetime.valid) return;
      if (frame.headers.message === 'UNAUTHORIZED') {
        if (lifetime.authRecovered) {
          halt(lifetime, 'authentication');
          return;
        }
        lifetime.authRecovered = true;
        lifetime.needsRefresh = options.getAccessToken() === lifetime.lastToken;
      } else if (frame.headers.message !== 'AUTH_SERVICE_UNAVAILABLE') {
        halt(lifetime, 'protocol');
      }
    };

    client.onWebSocketClose = () => {
      if (!lifetime.valid) return;
      if (lifetime.attempts >= 6) {
        halt(lifetime, 'retry-exhausted');
        return;
      }
      // 연결 성공 뒤 장애가 생기면 최초 재시도부터 새 예산을 계산한다.
      if (lifetime.attempts === 0) lifetime.attempts = 1;
      report({ state: 'reconnecting', isRefreshingToken: false });
    };
    client.activate();
  }

  /** 중복 시작을 막고 아직 생성되지 않은 화면 연결만 연다. */
  function start(): void {
    if (current) return;
    commandVersion += 1;
    launch();
  }

  /** 이전 연결 종료 후 새 예산으로 시작하며 중복 클릭과 종료 중 재시작을 막는다. */
  function retry(): Promise<void> {
    if (restarting) return restarting;
    const version = ++commandVersion;
    const old = current;
    restarting = (old ? retire(old) : Promise.resolve())
      .then(() => {
        if (version === commandVersion) launch();
      })
      .finally(() => {
        restarting = null;
      });
    return restarting;
  }

  /** 화면 종료 의도를 즉시 반영하고 이전 인증·온라인 대기까지 해제한다. */
  function stop(): Promise<void> {
    commandVersion += 1;
    const old = current;
    current = null;
    return old ? retire(old) : Promise.resolve();
  }

  return { start, retry, stop };
}
