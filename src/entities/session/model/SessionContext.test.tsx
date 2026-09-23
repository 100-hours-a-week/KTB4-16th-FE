import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SessionProvider } from './SessionProvider';
import { useSession } from './useSession';

/** 세션 공개 인터페이스를 사용자 동작으로 관찰한다. */
function SessionProbe() {
  const { accessToken, isAuthenticated, setAccessToken, clearSession, fetchAuthenticatedJson } =
    useSession();

  return (
    <>
      <output>
        {accessToken ?? 'empty'}:{String(isAuthenticated)}
      </output>
      <button type="button" onClick={() => setAccessToken('token')}>
        login
      </button>
      <button type="button" onClick={clearSession}>
        logout
      </button>
      <button type="button" onClick={() => void fetchAuthenticatedJson('/users/me')}>
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
  it('keeps token only for the provider lifetime without persistent storage', async () => {
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
    const user = userEvent.setup();
    const view = render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );

    expect(screen.getByText('empty:false')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'login' }));
    expect(screen.getByText('token:true')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'logout' }));
    expect(screen.getByText('empty:false')).toBeInTheDocument();

    view.unmount();
    render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );
    expect(screen.getByText('empty:false')).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: 'login' }));

    await user.click(screen.getByRole('button', { name: '보호 요청' }));
    expect(fetchMock).toHaveBeenCalledWith('/api/users/me', {
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
