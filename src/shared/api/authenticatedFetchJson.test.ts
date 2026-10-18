import { afterEach, describe, expect, it, vi } from 'vitest';

import { env } from '../config/env';
import { createAuthenticatedApi } from './authenticatedFetchJson';

const createApiUrl = (path: string) => `${env.apiBaseUrl}${path}`;

afterEach(() => {
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/';
  vi.unstubAllGlobals();
});

/** 보호 API 테스트마다 메모리 세션의 읽기·교체·삭제 동작을 관찰한다. */
function createSessionAdapter(initialAccessToken: string | null) {
  let accessToken = initialAccessToken;
  let sessionVersion = 0;
  const setAccessToken = vi.fn((nextAccessToken: string) => {
    accessToken = nextAccessToken;
  });
  const clearSession = vi.fn(() => {
    accessToken = null;
    sessionVersion += 1;
  });

  return {
    adapter: {
      getAccessToken: () => accessToken,
      getSessionVersion: () => sessionVersion,
      setAccessToken,
      clearSession,
    },
    setAccessToken,
    clearSession,
    login: (token: string) => {
      sessionVersion += 1;
      accessToken = token;
    },
  };
}

describe('fetchAuthenticatedJson', () => {
  it('shares refresh between an HTTP 401 and explicit STOMP recovery', async () => {
    const session = createSessionAdapter('expired-token');
    const client = createAuthenticatedApi(session.adapter);
    document.cookie = 'XSRF-TOKEN=csrf-token; path=/';
    let completeRefresh!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      completeRefresh = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockImplementationOnce(() => pending)
      .mockResolvedValueOnce(new Response('{"message":"ok"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const request = client.fetchJson('/users/me');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const recovery = client.refreshAccessToken();
    completeRefresh(new Response('{"accessToken":"new-token"}', { status: 200 }));
    await expect(Promise.all([request, recovery])).resolves.toEqual([{ message: 'ok' }, undefined]);
    expect(
      fetchMock.mock.calls.filter(([url]) => url === createApiUrl('/auth/refresh')),
    ).toHaveLength(1);
    expect(session.adapter.getAccessToken()).toBe('new-token');
  });

  it.each([0, 403, 500])('retains the current token on refresh failure %s', async (status) => {
    const session = createSessionAdapter('current-token');
    document.cookie = 'XSRF-TOKEN=csrf-token; path=/';
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 }));
    if (status === 0) fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    else fetchMock.mockResolvedValueOnce(new Response('{}', { status }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(createAuthenticatedApi(session.adapter).restoreSession()).rejects.toMatchObject({
      status,
    });
    expect(session.adapter.getAccessToken()).toBe('current-token');
    expect(session.clearSession).not.toHaveBeenCalled();
  });

  it.each(['logout', 'login', 'old-401'] as const)(
    'ignores stale refresh after %s',
    async (change) => {
      const session = createSessionAdapter('old-token');
      const client = createAuthenticatedApi(session.adapter);
      document.cookie = 'XSRF-TOKEN=csrf-token; path=/';
      let completeRefresh!: (response: Response) => void;
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
        .mockImplementationOnce(
          () =>
            new Promise<Response>((resolve) => {
              completeRefresh = resolve;
            }),
        );
      vi.stubGlobal('fetch', fetchMock);
      const result = client.restoreSession().catch((error: unknown) => error);
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      if (change === 'logout') session.clearSession();
      else session.login('other-account-token');
      completeRefresh(
        new Response('{"accessToken":"stale-token"}', { status: change === 'old-401' ? 401 : 200 }),
      );
      await expect(result).resolves.toMatchObject({ code: 'SESSION_CHANGED' });
      expect(session.adapter.getAccessToken()).toBe(
        change === 'logout' ? null : 'other-account-token',
      );
    },
  );

  it('does not replay an old request as another logged-in account', async () => {
    const session = createSessionAdapter('old-token');
    let completeRequest!: (response: Response) => void;
    const fetchMock = vi.fn().mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          completeRequest = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const result = createAuthenticatedApi(session.adapter)
      .fetchJson('/users/me')
      .catch((error: unknown) => error);
    session.login('other-account-token');
    completeRequest(new Response('{}', { status: 401 }));
    await expect(result).resolves.toMatchObject({ code: 'SESSION_CHANGED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('adds the current access token as a Bearer authorization header', async () => {
    const session = createSessionAdapter('access-token');
    const { fetchJson: fetchAuthenticatedJson } = createAuthenticatedApi(session.adapter);
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"message":"ok"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAuthenticatedJson<{ message: string }>('/users/me')).resolves.toEqual({
      message: 'ok',
    });

    expect(fetchMock).toHaveBeenCalledWith(createApiUrl('/users/me'), {
      headers: new Headers({ Authorization: 'Bearer access-token' }),
    });
  });

  it('refreshes once and retries the failed protected request with the new token', async () => {
    const session = createSessionAdapter('expired-token');
    const { fetchJson: fetchAuthenticatedJson } = createAuthenticatedApi(session.adapter);
    document.cookie = 'XSRF-TOKEN=csrf-token; path=/';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"message":"만료됨"}', { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response('{"message":"재발급 완료","accessToken":"new-access-token"}', { status: 200 }),
      )
      .mockResolvedValueOnce(new Response('{"message":"ok"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAuthenticatedJson<{ message: string }>('/users/me')).resolves.toEqual({
      message: 'ok',
    });

    expect(session.setAccessToken).toHaveBeenCalledWith('new-access-token');
    expect(fetchMock).toHaveBeenNthCalledWith(1, createApiUrl('/users/me'), {
      headers: new Headers({ Authorization: 'Bearer expired-token' }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, createApiUrl('/csrf'), { credentials: 'include' });
    expect(fetchMock).toHaveBeenNthCalledWith(3, createApiUrl('/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-XSRF-TOKEN': 'csrf-token' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, createApiUrl('/users/me'), {
      headers: new Headers({ Authorization: 'Bearer new-access-token' }),
    });
  });

  it('clears the session and does not refresh again when refresh returns 401', async () => {
    const session = createSessionAdapter('expired-token');
    const { fetchJson: fetchAuthenticatedJson } = createAuthenticatedApi(session.adapter);
    document.cookie = 'XSRF-TOKEN=csrf-token; path=/';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"message":"만료됨"}', { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('{"message":"재로그인이 필요합니다."}', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAuthenticatedJson('/users/me')).rejects.toMatchObject({ status: 401 });

    expect(session.clearSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retains the session when refresh returns a malformed success response', async () => {
    const session = createSessionAdapter('expired-token');
    const { fetchJson: fetchAuthenticatedJson } = createAuthenticatedApi(session.adapter);
    document.cookie = 'XSRF-TOKEN=csrf-token; path=/';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"message":"만료됨"}', { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('{"message":"재발급 완료"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAuthenticatedJson('/users/me')).rejects.toMatchObject({
      status: 502,
      code: 'INVALID_RESPONSE',
    });

    expect(session.clearSession).not.toHaveBeenCalled();
  });

  it('does not refresh again when the retried protected request returns 401', async () => {
    const session = createSessionAdapter('expired-token');
    const { fetchJson: fetchAuthenticatedJson } = createAuthenticatedApi(session.adapter);
    document.cookie = 'XSRF-TOKEN=csrf-token; path=/';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"message":"만료됨"}', { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response('{"message":"재발급 완료","accessToken":"new-access-token"}', { status: 200 }),
      )
      .mockResolvedValueOnce(new Response('{"message":"권한 없음"}', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAuthenticatedJson('/users/me')).rejects.toMatchObject({ status: 401 });

    expect(
      fetchMock.mock.calls.filter(([url]) => url === createApiUrl('/auth/refresh')),
    ).toHaveLength(1);
  });

  it('retains the session without refreshing when the CSRF Cookie is missing', async () => {
    const session = createSessionAdapter('expired-token');
    const { fetchJson: fetchAuthenticatedJson } = createAuthenticatedApi(session.adapter);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"message":"만료됨"}', { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchAuthenticatedJson('/users/me')).rejects.toMatchObject({
      status: 403,
      code: 'CSRF_TOKEN_MISSING',
    });

    expect(session.clearSession).not.toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.filter(([url]) => url === createApiUrl('/auth/refresh')),
    ).toHaveLength(0);
  });

  it('shares one refresh request when protected requests receive 401 together', async () => {
    const session = createSessionAdapter('expired-token');
    const { fetchJson: fetchAuthenticatedJson } = createAuthenticatedApi(session.adapter);
    document.cookie = 'XSRF-TOKEN=csrf-token; path=/';
    let resolveRefresh: ((response: Response) => void) | undefined;
    const refreshResponse = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"message":"만료됨"}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"message":"만료됨"}', { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockImplementationOnce(() => refreshResponse)
      .mockResolvedValueOnce(new Response('{"message":"첫 요청"}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{"message":"둘째 요청"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const firstRequest = fetchAuthenticatedJson<{ message: string }>('/users/first');
    const secondRequest = fetchAuthenticatedJson<{ message: string }>('/users/second');

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    resolveRefresh?.(
      new Response('{"message":"재발급 완료","accessToken":"new-access-token"}', { status: 200 }),
    );

    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      { message: '첫 요청' },
      { message: '둘째 요청' },
    ]);
    expect(
      fetchMock.mock.calls.filter(([url]) => url === createApiUrl('/auth/refresh')),
    ).toHaveLength(1);
  });

  it('retries a delayed 401 with the newer token without starting a second refresh', async () => {
    const session = createSessionAdapter('expired-token');
    const { fetchJson: fetchAuthenticatedJson } = createAuthenticatedApi(session.adapter);
    document.cookie = 'XSRF-TOKEN=csrf-token; path=/';
    let resolveDelayedUnauthorized: ((response: Response) => void) | undefined;
    const delayedUnauthorized = new Promise<Response>((resolve) => {
      resolveDelayedUnauthorized = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => delayedUnauthorized)
      .mockResolvedValueOnce(new Response('{"message":"만료됨"}', { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response('{"message":"재발급 완료","accessToken":"new-access-token"}', { status: 200 }),
      )
      .mockResolvedValueOnce(new Response('{"message":"둘째 요청"}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{"message":"첫 요청"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const delayedRequest = fetchAuthenticatedJson<{ message: string }>('/users/first');
    const refreshedRequest = fetchAuthenticatedJson<{ message: string }>('/users/second');

    await expect(refreshedRequest).resolves.toEqual({ message: '둘째 요청' });
    resolveDelayedUnauthorized?.(new Response('{"message":"만료됨"}', { status: 401 }));

    await expect(delayedRequest).resolves.toEqual({ message: '첫 요청' });
    expect(
      fetchMock.mock.calls.filter(([url]) => url === createApiUrl('/auth/refresh')),
    ).toHaveLength(1);
    expect(fetchMock).toHaveBeenLastCalledWith(createApiUrl('/users/first'), {
      headers: new Headers({ Authorization: 'Bearer new-access-token' }),
    });
  });
});
