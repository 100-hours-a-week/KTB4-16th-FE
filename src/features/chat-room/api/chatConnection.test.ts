import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatConnection, ChatConnectionSnapshot } from '../model/chatConnection.types';
import { FakeStompSocket } from '../test/fakeStompTransport';
import { createChatConnection, createChatWebSocketUrl } from './chatConnection';

const controllers: ChatConnection[] = [];

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  });
  vi.stubGlobal('WebSocket', FakeStompSocket);
  FakeStompSocket.connections = [];
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
});

afterEach(async () => {
  await Promise.all(controllers.splice(0).map((controller) => controller.stop()));
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** 최신 토큰과 관측 상태를 실제 연결 컨트롤러에 전달한다. */
function setup() {
  let token = 'first-token';
  const states: ChatConnectionSnapshot[] = [];
  const refresh = vi.fn(async () => {
    token = 'fresh-token';
  });
  const onFrame = vi.fn();
  const controller = createChatConnection({
    getAccessToken: () => token,
    refreshAccessToken: refresh,
    onStateChange: (snapshot) => states.push(snapshot),
    onFrame,
  });
  controllers.push(controller);
  return {
    controller,
    states,
    refresh,
    onFrame,
    setToken: (next: string) => {
      token = next;
    },
  };
}

/** beforeConnect의 비동기 경계를 진행하고 생성된 연결을 반환한다. */
async function latestSocket() {
  await vi.advanceTimersByTimeAsync(0);
  return FakeStompSocket.connections.at(-1)!;
}

/** 서버의 STOMP ERROR와 이어지는 전송 연결 종료를 재현한다. */
function serverError(socket: FakeStompSocket, code: string) {
  socket.receive(`ERROR\nmessage:${code}\n\n\u0000`);
  socket.close(1002);
}

describe('chat connection', () => {
  it.each([
    ['http://localhost:3000', 'ws://localhost:3000/ws'],
    ['https://mulo.example', 'wss://mulo.example/ws'],
  ])('uses the current origin %s', (origin, expected) => {
    expect(createChatWebSocketUrl(origin)).toBe(expected);
  });

  it('authenticates with the latest token and subscribes only after CONNECTED', async () => {
    const { controller, states, setToken } = setup();
    controller.start();
    const first = await latestSocket();
    first.open();
    expect(first.sentFrames[0]).toContain('Authorization:Bearer first-token');
    expect(first.sentFrames[0]).toContain('heart-beat:10000,10000');
    expect(first.sentFrames).toHaveLength(1);
    first.connected();
    const destinations = first.sentFrames
      .filter((frame) => frame.startsWith('SUBSCRIBE'))
      .map((frame) => frame.match(/destination:([^\n]+)/)?.[1]);
    expect(destinations).toEqual([
      '/user/queue/chat-messages',
      '/user/queue/chat-events',
      '/user/queue/chat-errors',
    ]);
    expect(states.at(-1)?.state).toBe('connected');
    setToken('newer-token');
    first.close(1006);
    await vi.advanceTimersByTimeAsync(2000);
    const second = await latestSocket();
    second.open();
    expect(second.sentFrames[0]).toContain('Authorization:Bearer newer-token');
    second.connected();
    expect(second.sentFrames.filter((frame) => frame.startsWith('SUBSCRIBE'))).toHaveLength(3);
  });

  it('uses exponential delays and never starts a seventh connection', async () => {
    const { controller, states } = setup();
    controller.start();
    let socket = await latestSocket();
    for (const delay of [2000, 4000, 8000, 16000, 30000]) {
      const count = FakeStompSocket.connections.length;
      socket.close(1006);
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(FakeStompSocket.connections).toHaveLength(count);
      await vi.advanceTimersByTimeAsync(1);
      expect(FakeStompSocket.connections).toHaveLength(count + 1);
      socket = await latestSocket();
    }
    socket.close(1006);
    await vi.advanceTimersByTimeAsync(60000);
    expect(FakeStompSocket.connections).toHaveLength(6);
    expect(states.at(-1)).toMatchObject({ state: 'disconnected', stopReason: 'retry-exhausted' });
  });

  it('terminates a connection without CONNECTED after ten seconds', async () => {
    const { controller } = setup();
    controller.start();
    const socket = await latestSocket();
    socket.open();
    await vi.advanceTimersByTimeAsync(9999);
    expect(socket.readyState).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(socket.readyState).toBe(3);
  });

  it('refreshes once and stops if the refreshed CONNECT is also unauthorized', async () => {
    const { controller, refresh, states } = setup();
    controller.start();
    const first = await latestSocket();
    first.open();
    serverError(first, 'UNAUTHORIZED');
    await vi.advanceTimersByTimeAsync(2000);
    const second = await latestSocket();
    second.open();
    expect(second.sentFrames[0]).toContain('Authorization:Bearer fresh-token');
    serverError(second, 'UNAUTHORIZED');
    await vi.advanceTimersByTimeAsync(60000);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(FakeStompSocket.connections).toHaveLength(2);
    expect(states.at(-1)?.stopReason).toBe('authentication');
  });

  it('reuses a token already refreshed by HTTP', async () => {
    const { controller, setToken, refresh } = setup();
    controller.start();
    const first = await latestSocket();
    first.open();
    setToken('http-refreshed');
    serverError(first, 'UNAUTHORIZED');
    await vi.advanceTimersByTimeAsync(2000);
    const second = await latestSocket();
    second.open();
    expect(second.sentFrames[0]).toContain('Authorization:Bearer http-refreshed');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('does not refresh twice when HTTP replaces the token during reconnect delay', async () => {
    const { controller, setToken, refresh } = setup();
    controller.start();
    const first = await latestSocket();
    first.open();
    serverError(first, 'UNAUTHORIZED');
    setToken('http-refreshed-during-delay');
    await vi.advanceTimersByTimeAsync(2000);
    const second = await latestSocket();
    second.open();
    expect(second.sentFrames[0]).toContain('Authorization:Bearer http-refreshed-during-delay');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('resumes an offline wait without consuming retry attempts', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { controller, states } = setup();
    controller.start();
    await vi.advanceTimersByTimeAsync(60000);
    expect(FakeStompSocket.connections).toHaveLength(0);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    const socket = await latestSocket();
    socket.open();
    socket.connected();
    expect(states.at(-1)).toMatchObject({ state: 'connected', retryCount: 0, isOffline: false });
  });

  it('starts a fresh retry budget after success and manual retry', async () => {
    const { controller, states } = setup();
    controller.start();
    const first = await latestSocket();
    first.open();
    first.connected();
    first.close(1006);
    await vi.advanceTimersByTimeAsync(2000);
    const second = await latestSocket();
    second.open();
    second.connected();
    second.close(1006);
    await vi.advanceTimersByTimeAsync(2000);
    expect(FakeStompSocket.connections).toHaveLength(3);
    await controller.retry();
    const manual = await latestSocket();
    manual.open();
    expect(states.at(-1)?.retryCount).toBe(0);
  });

  it('stops authentication recovery after a transient refresh failure', async () => {
    const { controller, states, refresh } = setup();
    refresh.mockRejectedValueOnce(new Error('offline'));
    controller.start();
    const socket = await latestSocket();
    socket.open();
    serverError(socket, 'UNAUTHORIZED');
    await vi.advanceTimersByTimeAsync(60000);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(FakeStompSocket.connections).toHaveLength(1);
    expect(states.at(-1)?.stopReason).toBe('temporary');
  });

  it('bounds shutdown when a server does not return the DISCONNECT receipt', async () => {
    const { controller } = setup();
    controller.start();
    const socket = await latestSocket();
    socket.open();
    socket.connected();
    socket.autoReceipt = false;
    const stopped = controller.stop();
    await vi.advanceTimersByTimeAsync(6000);
    await stopped;
    expect(socket.readyState).toBe(3);
  });

  it.each(['STOMP_DESTINATION_FORBIDDEN', 'COMMAND_NOT_ALLOWED', 'UNKNOWN'])(
    'does not retry %s',
    async (code) => {
      const { controller, states } = setup();
      controller.start();
      const socket = await latestSocket();
      socket.open();
      serverError(socket, code);
      await vi.advanceTimersByTimeAsync(60000);
      expect(FakeStompSocket.connections).toHaveLength(1);
      expect(states.at(-1)?.stopReason).toBe('protocol');
    },
  );

  it('retries auth-service outage without refreshing credentials', async () => {
    const { controller, refresh } = setup();
    controller.start();
    const socket = await latestSocket();
    socket.open();
    serverError(socket, 'AUTH_SERVICE_UNAVAILABLE');
    await vi.advanceTimersByTimeAsync(2000);
    expect(FakeStompSocket.connections).toHaveLength(2);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('routes domain errors without terminating the connection', async () => {
    const { controller, onFrame, states } = setup();
    controller.start();
    const socket = await latestSocket();
    socket.open();
    socket.connected();
    const subId = socket.sentFrames
      .find((frame) => frame.includes('destination:/user/queue/chat-errors'))!
      .match(/\nid:([^\n]+)/)![1];
    socket.receive(
      `MESSAGE\nsubscription:${subId}\nmessage-id:1\ndestination:/user/queue/chat-errors\n\n{"code":"MESSAGE_TOO_LONG"}\u0000`,
    );
    expect(onFrame).toHaveBeenCalledWith('/user/queue/chat-errors', '{"code":"MESSAGE_TOO_LONG"}');
    expect(states.at(-1)?.state).toBe('connected');
  });

  it('sends DISCONNECT without UNSUBSCRIBE and stops reconnecting', async () => {
    const { controller } = setup();
    controller.start();
    const socket = await latestSocket();
    socket.open();
    socket.connected();
    await controller.stop();
    expect(socket.sentFrames.some((frame) => frame.startsWith('DISCONNECT'))).toBe(true);
    expect(socket.sentFrames.some((frame) => frame.startsWith('UNSUBSCRIBE'))).toBe(false);
    await vi.advanceTimersByTimeAsync(60000);
    expect(FakeStompSocket.connections).toHaveLength(1);
  });

  it('does not connect when online arrives after an offline stop', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { controller, states } = setup();
    controller.start();
    await latestSocket();
    expect(states.at(-1)?.isOffline).toBe(true);
    await controller.stop();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    await latestSocket();
    expect(FakeStompSocket.connections).toHaveLength(0);
  });

  it('does not reconnect after a pending refresh completes following stop', async () => {
    const { controller, refresh } = setup();
    let complete!: () => void;
    refresh.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    controller.start();
    const socket = await latestSocket();
    socket.open();
    serverError(socket, 'UNAUTHORIZED');
    await vi.advanceTimersByTimeAsync(2000);
    await controller.stop();
    complete();
    await latestSocket();
    expect(FakeStompSocket.connections).toHaveLength(1);
  });
});
