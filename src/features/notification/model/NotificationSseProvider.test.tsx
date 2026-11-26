import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  SessionContext,
  type SessionContextValue,
} from '../../../entities/session/model/sessionContext';
import { ApiError } from '../../../shared/api/apiError';
import { NotificationSseProvider } from './NotificationSseProvider';
import { useNotificationSse } from './notificationSseContext';

function createSession(overrides: Partial<SessionContextValue> = {}): SessionContextValue {
  const fetchAuthenticatedJson: SessionContextValue['fetchAuthenticatedJson'] = async <T,>() =>
    ({
      message: '미읽음 알림 여부 조회 성공',
      data: { hasUnread: false },
    }) as T;
  return {
    accessToken: 'access-token',
    sessionVersion: 1,
    isAuthenticated: true,
    isSessionRestoring: false,
    setAccessToken: vi.fn(),
    clearSession: vi.fn(),
    fetchAuthenticatedJson,
    getAccessToken: () => 'access-token',
    refreshAccessToken: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function StatusProbe() {
  const { hasUnread, subscribeToNotificationUpdates } = useNotificationSse();
  const [notificationRevision, setNotificationRevision] = useState(0);
  useEffect(
    () => subscribeToNotificationUpdates(() => setNotificationRevision((current) => current + 1)),
    [subscribeToNotificationUpdates],
  );
  return (
    <div>
      <span data-testid="unread-state">{String(hasUnread)}</span>
      <span data-testid="notification-revision">{notificationRevision}</span>
    </div>
  );
}

function createOpenStream() {
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } },
  );
  return {
    response,
    emit(value: string) {
      streamController?.enqueue(new TextEncoder().encode(value));
    },
    close() {
      streamController?.close();
    },
  };
}

function createJwtToken(expiresAt: number) {
  return `header.${btoa(JSON.stringify({ exp: expiresAt }))}.signature`;
}

function renderProvider(session: SessionContextValue, strict = false) {
  const tree = (
    <SessionContext value={session}>
      <NotificationSseProvider>
        <StatusProbe />
      </NotificationSseProvider>
    </SessionContext>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('NotificationSseProvider', () => {
  it('connects with authentication and syncs unread status for connected and notification events', async () => {
    const stream = createOpenStream();
    const requestCalls = vi.fn();
    const request: SessionContextValue['fetchAuthenticatedJson'] = async <T,>(
      path: string,
      init?: RequestInit,
    ) => {
      requestCalls(path, init);
      return {
        message: '미읽음 알림 여부 조회 성공',
        data: { hasUnread: true },
      } as T;
    };
    const session = createSession({ fetchAuthenticatedJson: request });
    const fetchMock = vi.fn().mockResolvedValue(stream.response);
    vi.stubGlobal('fetch', fetchMock);

    renderProvider(session);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: { Authorization: 'Bearer access-token', Accept: 'text/event-stream' },
    });
    await waitFor(() => expect(screen.getByTestId('unread-state')).toHaveTextContent('true'));

    await act(async () => {
      stream.emit(
        'event: ignored\ndata: {}\n\nevent: connected\ndata: {}\n\nevent: notification-created\ndata: {"notificationId":22}\n\nevent: notification-created\ndata: {"notificationId":23}\n\nevent: notification-created\ndata: {"notificationId":24}\n\n',
      );
    });
    await waitFor(() => expect(screen.getByTestId('notification-revision')).toHaveTextContent('1'));
    await waitFor(() => expect(requestCalls).toHaveBeenCalledTimes(2));
    expect(requestCalls).toHaveBeenLastCalledWith(
      '/notifications/unread-status',
      expect.anything(),
    );
  });

  it('does not request notification pages when the list is not mounted on the first connection', async () => {
    const stream = createOpenStream();
    const requestCalls = vi.fn();
    const request: SessionContextValue['fetchAuthenticatedJson'] = async <T,>(
      path: string,
      init?: RequestInit,
    ) => {
      requestCalls(path, init);
      if (path === '/notifications/unread-status') {
        return {
          message: '미읽음 알림 여부 조회 성공',
          data: { hasUnread: false },
        } as T;
      }
      throw new Error(`예상하지 못한 요청: ${path}`);
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream.response));

    renderProvider(createSession({ fetchAuthenticatedJson: request }));
    await waitFor(() =>
      expect(requestCalls).toHaveBeenCalledWith('/notifications/unread-status', expect.anything()),
    );
    await act(async () => stream.emit('event: connected\ndata: {}\n\n'));
    await new Promise((resolve) => globalThis.setTimeout(resolve, 180));

    expect(requestCalls).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/notifications\?/),
      expect.anything(),
    );
  });

  it('ignores an older unread response when a newer synchronization is pending', async () => {
    const stream = createOpenStream();
    let resolveFirstRequest: ((value: unknown) => void) | undefined;
    const requestCalls = vi.fn();
    const request: SessionContextValue['fetchAuthenticatedJson'] = async <T,>(path: string) => {
      requestCalls(path);
      if (requestCalls.mock.calls.length === 1) {
        return (await new Promise<unknown>((resolve) => {
          resolveFirstRequest = resolve;
        })) as T;
      }
      return {
        message: '미읽음 알림 여부 조회 성공',
        data: { hasUnread: true },
      } as T;
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream.response));

    renderProvider(createSession({ fetchAuthenticatedJson: request }));
    await waitFor(() => expect(requestCalls).toHaveBeenCalledOnce());
    await act(async () => stream.emit('event: connected\ndata: {}\n\n'));
    await act(async () => {
      resolveFirstRequest?.({
        message: '미읽음 알림 여부 조회 성공',
        data: { hasUnread: false },
      });
    });

    await waitFor(() => expect(screen.getByTestId('unread-state')).toHaveTextContent('true'));
    expect(requestCalls).toHaveBeenCalledTimes(2);
  });

  it('closes the active stream and clears the badge after logout', async () => {
    const stream = createOpenStream();
    const fetchMock = vi.fn().mockResolvedValue(stream.response);
    vi.stubGlobal('fetch', fetchMock);
    const activeSession = createSession();
    const view = renderProvider(activeSession);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const requestSignal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal;
    expect(requestSignal.aborted).toBe(false);

    view.rerender(
      <SessionContext
        value={createSession({
          accessToken: null,
          isAuthenticated: false,
          sessionVersion: 2,
        })}
      >
        <NotificationSseProvider>
          <StatusProbe />
        </NotificationSseProvider>
      </SessionContext>,
    );

    expect(requestSignal.aborted).toBe(true);
    expect(screen.getByTestId('unread-state')).toHaveTextContent('false');
  });

  it('closes the prior account stream before connecting with a new account token', async () => {
    const previousStream = createOpenStream();
    const nextStream = createOpenStream();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(previousStream.response)
      .mockResolvedValueOnce(nextStream.response);
    vi.stubGlobal('fetch', fetchMock);
    const view = renderProvider(createSession({ getAccessToken: () => 'previous-token' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const previousSignal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal;
    view.rerender(
      <SessionContext
        value={createSession({
          accessToken: 'next-token',
          sessionVersion: 2,
          getAccessToken: () => 'next-token',
        })}
      >
        <NotificationSseProvider>
          <StatusProbe />
        </NotificationSseProvider>
      </SessionContext>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(previousSignal.aborted).toBe(true);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: { Authorization: 'Bearer next-token' },
    });
  });

  it('reconnects after a stream ends and syncs again when the page becomes visible', async () => {
    const firstStream = createOpenStream();
    const secondStream = createOpenStream();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(firstStream.response)
      .mockResolvedValue(secondStream.response);
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const requestCalls = vi.fn();
    const request: SessionContextValue['fetchAuthenticatedJson'] = async <T,>(
      path: string,
      init?: RequestInit,
    ) => {
      requestCalls(path, init);
      return { message: '성공', data: { hasUnread: false } } as T;
    };

    renderProvider(createSession({ fetchAuthenticatedJson: request }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await act(async () => firstStream.close());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const callsBeforeVisible = requestCalls.mock.calls.length;
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(requestCalls.mock.calls.length).toBeGreaterThan(callsBeforeVisible));
  });

  it('creates only one active stream connection in StrictMode', async () => {
    const stream = createOpenStream();
    const fetchMock = vi.fn().mockResolvedValue(stream.response);
    vi.stubGlobal('fetch', fetchMock);

    renderProvider(createSession(), true);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const requestSignal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal;
    expect(requestSignal.aborted).toBe(false);
  });

  it('refreshes the access token after a 401 and retries the stream with the updated token', async () => {
    const stream = createOpenStream();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValue(stream.response);
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    let currentToken = 'expired-token';
    const refreshAccessToken = vi.fn().mockImplementation(async () => {
      currentToken = 'refreshed-token';
    });
    const session = createSession({
      accessToken: 'expired-token',
      getAccessToken: () => currentToken,
      refreshAccessToken,
    });

    renderProvider(session);

    await waitFor(() => expect(refreshAccessToken).toHaveBeenCalledOnce());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: { Authorization: 'Bearer refreshed-token' },
    });
  });

  it('allows one reconnect when refresh succeeds with the same unexpired token', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const stream = createOpenStream();
    const validToken = createJwtToken(Math.floor(Date.now() / 1000) + 3_600);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValue(stream.response);
    vi.stubGlobal('fetch', fetchMock);
    const refreshAccessToken = vi.fn().mockResolvedValue(undefined);
    const session = createSession({
      accessToken: validToken,
      getAccessToken: () => validToken,
      refreshAccessToken,
    });

    renderProvider(session);

    await waitFor(() => expect(refreshAccessToken).toHaveBeenCalledOnce());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: { Authorization: `Bearer ${validToken}` },
    });
  });

  it('retries refresh twice but never reconnects with the same expired token', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const expiredToken = createJwtToken(Math.floor(Date.now() / 1000) - 3_600);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    const refreshAccessToken = vi.fn().mockResolvedValue(undefined);

    renderProvider(
      createSession({
        accessToken: expiredToken,
        getAccessToken: () => expiredToken,
        refreshAccessToken,
      }),
    );

    await waitFor(() => expect(refreshAccessToken).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => globalThis.setTimeout(resolve, 50));
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('stops after a repeated authentication failure with the unchanged token', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const validToken = createJwtToken(Math.floor(Date.now() / 1000) + 3_600);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    const refreshAccessToken = vi.fn().mockResolvedValue(undefined);

    renderProvider(
      createSession({
        accessToken: validToken,
        getAccessToken: () => validToken,
        refreshAccessToken,
      }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => globalThis.setTimeout(resolve, 50));
    expect(refreshAccessToken).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a transient refresh failure with backoff before reconnecting the stream', async () => {
    const stream = createOpenStream();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValue(stream.response);
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    let currentToken = 'expired-token';
    const refreshAccessToken = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockImplementationOnce(async () => {
        currentToken = 'refreshed-token';
      });

    renderProvider(
      createSession({
        accessToken: 'expired-token',
        getAccessToken: () => currentToken,
        refreshAccessToken,
      }),
    );

    await waitFor(() => expect(refreshAccessToken).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledOnce();
    await waitFor(() => expect(refreshAccessToken).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: { Authorization: 'Bearer refreshed-token' },
    });
  });

  it('stops reconnecting when refresh is rejected with an authentication error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    const refreshAccessToken = vi
      .fn()
      .mockRejectedValue(new ApiError(401, '인증이 만료되었습니다.'));

    renderProvider(createSession({ refreshAccessToken }));

    await waitFor(() => expect(refreshAccessToken).toHaveBeenCalledOnce());
    await new Promise((resolve) => globalThis.setTimeout(resolve, 300));
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each(['logout', 'account change', 'unmount'] as const)(
    'cancels a pending refresh retry on %s',
    async (change) => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const stream = createOpenStream();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValue(stream.response);
      vi.stubGlobal('fetch', fetchMock);
      const refreshAccessToken = vi.fn().mockRejectedValue(new TypeError('offline'));
      const view = renderProvider(
        createSession({
          accessToken: 'expired-token',
          getAccessToken: () => 'expired-token',
          refreshAccessToken,
        }),
      );

      await waitFor(() => expect(refreshAccessToken).toHaveBeenCalledOnce());
      if (change === 'logout') {
        view.rerender(
          <SessionContext
            value={createSession({
              accessToken: null,
              isAuthenticated: false,
              sessionVersion: 2,
              getAccessToken: () => null,
            })}
          >
            <NotificationSseProvider>
              <StatusProbe />
            </NotificationSseProvider>
          </SessionContext>,
        );
      } else if (change === 'account change') {
        view.rerender(
          <SessionContext
            value={createSession({
              accessToken: 'next-account-token',
              sessionVersion: 2,
              getAccessToken: () => 'next-account-token',
            })}
          >
            <NotificationSseProvider>
              <StatusProbe />
            </NotificationSseProvider>
          </SessionContext>,
        );
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
        expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
          headers: { Authorization: 'Bearer next-account-token' },
        });
      } else {
        view.unmount();
      }

      await new Promise((resolve) => globalThis.setTimeout(resolve, 300));
      expect(refreshAccessToken).toHaveBeenCalledOnce();
      expect(fetchMock).toHaveBeenCalledTimes(change === 'account change' ? 2 : 1);
    },
  );
});
