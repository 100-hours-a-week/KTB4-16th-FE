import { env } from '../../../shared/config/env';

export type NotificationSseEventName = 'connected' | 'notification-created' | 'auth-expired';
export type NotificationSseResult =
  'ended' | 'unauthorized' | 'forbidden' | 'auth-expired' | 'token-expired';

type NotificationSseEventHandler = (event: NotificationSseEventName) => void;

export async function connectNotificationSse(
  accessToken: string,
  signal: AbortSignal,
  onEvent: NotificationSseEventHandler,
): Promise<NotificationSseResult> {
  const connectionController = new AbortController();
  const abortConnection = () => connectionController.abort();
  let tokenExpired = false;
  const expiresAt = getJwtExpirationMs(accessToken);
  const refreshLeadTime = 30_000;
  const expiryDelay =
    expiresAt === null ? null : Math.max(0, expiresAt - Date.now() - refreshLeadTime);
  const expiryTimer =
    expiryDelay === null
      ? null
      : globalThis.setTimeout(() => {
          tokenExpired = true;
          connectionController.abort();
        }, expiryDelay);

  signal.addEventListener('abort', abortConnection, { once: true });
  if (signal.aborted) connectionController.abort();

  try {
    const response = await fetch(`${env.apiBaseUrl}/notifications/stream`, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${accessToken}`,
      },
      signal: connectionController.signal,
    });

    if (response.status === 401) return 'unauthorized';
    if (response.status === 403) return 'forbidden';
    if (!response.ok) throw new Error('알림 실시간 연결에 실패했습니다.');
    if (!response.headers.get('content-type')?.toLowerCase().includes('text/event-stream')) {
      throw new Error('알림 실시간 연결 응답 형식이 올바르지 않습니다.');
    }
    if (!response.body) throw new Error('알림 실시간 연결을 시작할 수 없습니다.');

    const authExpired = await consumeSseEvents(response.body, connectionController.signal, onEvent);
    return authExpired ? 'auth-expired' : 'ended';
  } catch (error: unknown) {
    if (signal.aborted) throw error;
    if (tokenExpired) return 'token-expired';
    throw error;
  } finally {
    if (expiryTimer !== null) globalThis.clearTimeout(expiryTimer);
    signal.removeEventListener('abort', abortConnection);
  }
}

export function getJwtExpirationMs(accessToken: string): number | null {
  const payload = accessToken.split('.')[1];
  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!isRecord(parsed) || typeof parsed.exp !== 'number' || !Number.isFinite(parsed.exp)) {
      return null;
    }
    return parsed.exp * 1000;
  } catch {
    return null;
  }
}

async function consumeSseEvents(
  stream: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  onEvent: NotificationSseEventHandler,
): Promise<boolean> {
  const reader = stream.getReader();
  const cancelReader = () => {
    void reader.cancel().catch(() => undefined);
  };
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = '';
  let data: string[] = [];
  signal.addEventListener('abort', cancelReader, { once: true });
  if (signal.aborted) cancelReader();

  const dispatch = () => {
    const currentEventName = eventName;
    eventName = '';
    data = [];
    if (isNotificationSseEventName(currentEventName)) {
      onEvent(currentEventName);
      return currentEventName === 'auth-expired';
    }
    return false;
  };

  const processLine = (line: string) => {
    if (line === '') return dispatch();
    if (line.startsWith(':')) return false;

    const separator = line.indexOf(':');
    const field = separator === -1 ? line : line.slice(0, separator);
    const value = separator === -1 ? '' : line.slice(separator + 1).replace(/^ /, '');
    if (field === 'event') eventName = value;
    if (field === 'data') data.push(value);
    return false;
  };

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (signal.aborted)
        throw new DOMException('알림 실시간 연결이 종료되었습니다.', 'AbortError');
      buffer += decoder.decode(value, { stream: !done });

      let boundary = findLineBoundary(buffer);
      while (boundary !== -1) {
        const line = buffer.slice(0, boundary);
        const delimiterLength = buffer[boundary] === '\r' && buffer[boundary + 1] === '\n' ? 2 : 1;
        buffer = buffer.slice(boundary + delimiterLength);
        if (processLine(line)) {
          await reader.cancel();
          return true;
        }
        boundary = findLineBoundary(buffer);
      }

      if (done) {
        if (buffer) processLine(buffer);
        processLine('');
        return false;
      }
    }
    throw new DOMException('알림 실시간 연결이 종료되었습니다.', 'AbortError');
  } finally {
    signal.removeEventListener('abort', cancelReader);
    reader.releaseLock();
  }
}

function findLineBoundary(value: string): number {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '\n') return index;
    if (value[index] === '\r') {
      if (index === value.length - 1) return -1;
      return index;
    }
  }
  return -1;
}

function isNotificationSseEventName(value: string): value is NotificationSseEventName {
  return value === 'connected' || value === 'notification-created' || value === 'auth-expired';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
