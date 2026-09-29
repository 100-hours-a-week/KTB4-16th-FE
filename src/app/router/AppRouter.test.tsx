import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '../../entities/session/model/SessionProvider';
import { useSession } from '../../entities/session/model/useSession';
import { AppRouter } from './AppRouter';

/** 라우팅 테스트에서 실제 세션 공개 API를 통해 로그인 상태를 만든다. */
function SessionActivator() {
  const { setAccessToken } = useSession();

  return (
    <button type="button" onClick={() => setAccessToken('access-token')}>
      테스트 로그인
    </button>
  );
}

afterEach(() => {
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; Path=/';
});

/** 실제 세션 Provider와 메모리 라우터로 지정한 URL을 렌더링한다. */
function renderRoute(path: string) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));

  return render(
    <MemoryRouter initialEntries={[path]}>
      <SessionProvider>
        <SessionActivator />
        <AppRouter />
      </SessionProvider>
    </MemoryRouter>,
  );
}

describe('AppRouter', () => {
  it('shows home to an anonymous visitor', () => {
    renderRoute('/');

    expect(screen.getByRole('heading', { name: 'MULO' })).toBeInTheDocument();
  });

  it('sends an unknown path to the public home page', () => {
    renderRoute('/unknown');

    expect(screen.getByRole('heading', { name: 'MULO' })).toBeInTheDocument();
  });

  it('does not expose the removed group route', () => {
    renderRoute('/group');

    expect(screen.getByRole('heading', { name: 'MULO' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '그룹' })).not.toBeInTheDocument();
  });

  it.each(['/login', '/signup'])('sends an authenticated visitor from %s to home', async (path) => {
    const user = userEvent.setup();
    renderRoute(path);

    await user.click(screen.getByRole('button', { name: '테스트 로그인' }));

    expect(screen.getByRole('heading', { name: 'MULO' })).toBeInTheDocument();
  });

  it.each(['/mypage', '/mypage/nickname', '/mypage/password', '/records/1'])(
    'sends an anonymous visitor from %s to login',
    async (path) => {
      renderRoute(path);

      expect(await screen.findByRole('heading', { name: '로그인' })).toBeInTheDocument();
    },
  );

  it('keeps a protected route pending until session restoration succeeds', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-token';
    let resolveRefresh: (response: Response) => void;
    const refreshResponse = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('', { status: 200 }))
        .mockImplementationOnce(() => refreshResponse)
        .mockResolvedValue(
          new Response('{"nickname":"MULO","email":"mulo@example.com"}', { status: 200 }),
        ),
    );

    render(
      <MemoryRouter initialEntries={['/mypage']}>
        <SessionProvider>
          <AppRouter />
        </SessionProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('status', { name: '세션 확인 중' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '로그인' })).not.toBeInTheDocument();

    resolveRefresh!(new Response('{"accessToken":"restored-token"}', { status: 200 }));

    expect(await screen.findByRole('heading', { name: '마이페이지' })).toBeInTheDocument();
  });

  it('keeps the login form pending until session restoration finishes', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-token';
    let resolveRefresh: (response: Response) => void;
    const refreshResponse = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('', { status: 200 }))
        .mockImplementationOnce(() => refreshResponse),
    );

    render(
      <MemoryRouter initialEntries={['/login']}>
        <SessionProvider>
          <AppRouter />
        </SessionProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('status', { name: '세션 확인 중' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '로그인' })).not.toBeInTheDocument();

    resolveRefresh!(
      new Response('{"message":"유효한 Refresh Token이 없습니다."}', { status: 401 }),
    );

    expect(await screen.findByRole('heading', { name: '로그인' })).toBeInTheDocument();
  });
});
