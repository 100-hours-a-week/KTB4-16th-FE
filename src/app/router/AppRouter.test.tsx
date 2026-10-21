import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getMyProfile: vi.fn() }));

vi.mock('../../features/user-profile/api/userProfileApi', () => ({
  getMyProfile: mocks.getMyProfile,
}));

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

beforeEach(() => {
  mocks.getMyProfile.mockResolvedValue({
    userId: 9,
    nickname: '뮤로',
    email: 'mulo@example.com',
    preferredGenres: ['재즈'],
    genreOnboardingDone: true,
    createdAt: '2024-01-01T00:00:00',
  });
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
  it('shows home to an anonymous visitor after session restoration', async () => {
    renderRoute('/');

    expect(await screen.findByRole('heading', { name: 'MULO' })).toBeInTheDocument();
  });

  it.each(['/unknown', '/chat/'])(
    'sends an unknown or incomplete path %s to the public home page',
    async (path) => {
      renderRoute(path);

      expect(await screen.findByRole('heading', { name: 'MULO' })).toBeInTheDocument();
    },
  );

  it('does not expose the removed group route', async () => {
    renderRoute('/group');

    expect(await screen.findByRole('heading', { name: 'MULO' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '그룹' })).not.toBeInTheDocument();
  });

  it('shows the development-only preference vote result preview without opening matching', async () => {
    renderRoute('/__dev/preference-vote-result');

    expect(
      await screen.findByRole('heading', { name: '취향 투표 결과 미리보기' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '투표 결과: A 60%, B 40%' })).toBeInTheDocument();
    expect(
      screen.getByText('화면 확인용 예시입니다. 실제 투표나 매칭 요청은 전송되지 않습니다.'),
    ).toBeInTheDocument();
  });

  it.each(['/login', '/signup'])('sends an authenticated visitor from %s to home', async (path) => {
    const user = userEvent.setup();
    renderRoute(path);

    await user.click(screen.getByRole('button', { name: '테스트 로그인' }));

    expect(await screen.findByRole('heading', { name: 'MULO' })).toBeInTheDocument();
  });

  it.each([
    '/mypage',
    '/mypage/nickname',
    '/mypage/password',
    '/mypage/withdrawal',
    '/matching',
    '/chat/1',
    '/records/1',
    '/friends',
    '/friends/2/dashboard',
    '/friends/2/dashboard/records/1',
    '/notifications',
  ])('sends an anonymous visitor from %s to login', async (path) => {
    renderRoute(path);

    expect(await screen.findByRole('heading', { name: '로그인' })).toBeInTheDocument();
  });

  it('allows an authenticated visitor to open matching and return home', async () => {
    const user = userEvent.setup();
    renderRoute('/');

    await user.click(screen.getByRole('button', { name: '테스트 로그인' }));
    await user.click(screen.getByRole('button', { name: /취향 투표로 랜덤 채팅/ }));
    expect(await screen.findByRole('heading', { name: '취향 투표' })).toBeInTheDocument();
    expect(screen.getByText('취향 투표 질문을 준비하고 있어요.')).toBeInTheDocument();

    await user.click(screen.getAllByRole('link', { name: '홈으로 돌아가기' })[0]);
    expect(await screen.findByRole('heading', { name: 'MULO' })).toBeInTheDocument();
  });

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
