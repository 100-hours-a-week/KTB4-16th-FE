import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, useEffect, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { env } from '../../../shared/config/env';
import { SessionProvider } from './SessionProvider';
import { useSession } from './useSession';

const createApiUrl = (path: string) => `${env.apiBaseUrl}${path}`;

afterEach(() => {
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; Path=/';
});

/** 세션 공개 인터페이스를 사용자 동작으로 관찰한다. */
function SessionProbe() {
  const {
    accessToken,
    isAuthenticated,
    isSessionRestoring,
    setAccessToken,
    clearSession,
    fetchAuthenticatedJson,
  } = useSession();

  return (
    <>
      <output>
        {accessToken ?? 'empty'}:{String(isAuthenticated)}:{String(isSessionRestoring)}
      </output>
      <button type="button" onClick={() => setAccessToken('token')}>
        login
      </button>
      <button type="button" onClick={clearSession}>
        logout
      </button>
      <button
        type="button"
        onClick={() => void fetchAuthenticatedJson('/users/me').catch(() => undefined)}
      >
        보호 요청
      </button>
    </>
  );
}

/** 마운트 직후 보호 API를 호출하는 화면도 Provider가 제공한 클라이언트를 쓰는지 확인한다. */
function ProtectedRequestOnMount() {
  const { fetchAuthenticatedJson } = useSession();
  const [result, setResult] = useState('pending');

  useEffect(() => {
    void fetchAuthenticatedJson<{ message: string }>('/users/me').then(
      () => setResult('success'),
      () => setResult('failure'),
    );
  }, [fetchAuthenticatedJson]);

  return <output>{result}</output>;
}

describe('SessionProvider', () => {
  it('restores the in-memory access token from the refresh Cookie when it mounts', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-token';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(new Response('{"accessToken":"restored-token"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );

    expect(await screen.findByText('restored-token:true:false')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(1, createApiUrl('/csrf'), { credentials: 'include' });
    expect(fetchMock).toHaveBeenNthCalledWith(2, createApiUrl('/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-XSRF-TOKEN': 'csrf-token' },
    });
  });

  it('finishes restoring as anonymous when refresh fails', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-token';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(
        new Response('{"message":"유효한 Refresh Token이 없습니다."}', { status: 401 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );

    expect(await screen.findByText('empty:false:false')).toBeInTheDocument();
  });

  it('shares one refresh request when StrictMode restarts the mount effect', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-token';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(new Response('{"accessToken":"restored-token"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <StrictMode>
        <SessionProvider>
          <SessionProbe />
        </SessionProvider>
      </StrictMode>,
    );

    expect(await screen.findByText('restored-token:true:false')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps token only for the provider lifetime without persistent storage', async () => {
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    const view = render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );

    expect(await screen.findByText('empty:false:false')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'login' }));
    expect(screen.getByText('token:true:false')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'logout' }));
    expect(screen.getByText('empty:false:false')).toBeInTheDocument();

    view.unmount();
    render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );
    expect(await screen.findByText('empty:false:false')).toBeInTheDocument();
    expect(storageSpy).not.toHaveBeenCalled();
  });

  it('reports a clear error when used outside its provider', () => {
    expect(() => render(<SessionProbe />)).toThrow(
      'useSession은 SessionProvider 안에서 사용해야 합니다.',
    );
  });

  it('supplies the current memory token to protected API requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"message":"ok"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );

    await screen.findByText('empty:false:false');
    await user.click(screen.getByRole('button', { name: 'login' }));

    await user.click(screen.getByRole('button', { name: '보호 요청' }));
    expect(fetchMock).toHaveBeenCalledWith(createApiUrl('/users/me'), {
      headers: new Headers({ Authorization: 'Bearer token' }),
    });
  });

  it('makes the protected API client available to a child mount effect', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"message":"ok"}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <SessionProvider>
        <ProtectedRequestOnMount />
      </SessionProvider>,
    );

    expect(await screen.findByText('success')).toBeInTheDocument();
  });
});
