import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '../../../entities/session/model/SessionProvider';
import { useSession } from '../../../entities/session/model/useSession';
import { logout } from '../../../features/auth/api/authApi';
import { getMyProfile } from '../../../features/user-profile/api/userProfileApi';
import { ApiError } from '../../../shared/api/apiError';
import { MyPage } from './MyPage';

vi.mock('../../../features/user-profile/api/userProfileApi', () => ({ getMyProfile: vi.fn() }));
vi.mock('../../../features/auth/api/authApi', () => ({ logout: vi.fn() }));

/** 라우터 이동 결과를 검증할 현재 경로를 표시한다. */
function CurrentPath() {
  return <div data-testid="current-path">{useLocation().pathname}</div>;
}

/** 실제 Provider 세션이 로그아웃 후 비인증 상태가 되는지 관찰한다. */
function SessionState() {
  const { isAuthenticated, setAccessToken } = useSession();

  return (
    <>
      <button type="button" onClick={() => setAccessToken('access-token')}>
        세션 시작
      </button>
      <div data-testid="session-state">{String(isAuthenticated)}</div>
    </>
  );
}

/** 실제 SessionProvider와 라우터 안에서 마이페이지의 비동기 상태를 렌더링한다. */
function renderMyPage() {
  return render(
    <MemoryRouter>
      <SessionProvider>
        <MyPage />
        <CurrentPath />
        <SessionState />
      </SessionProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('MyPage', () => {
  it('프로필 로딩 뒤 API 닉네임과 이메일을 표시한다', async () => {
    vi.mocked(getMyProfile).mockResolvedValue({
      userId: 35,
      nickname: '뮤로',
      email: 'me@mulo.com',
    });

    renderMyPage();

    expect(screen.getByRole('status')).toHaveTextContent('내 정보를 불러오는 중');
    expect(await screen.findByText('뮤로')).toBeInTheDocument();
    expect(screen.getByText('me@mulo.com')).toBeInTheDocument();
  });

  it('네트워크 오류에서는 목업 프로필 없이 재시도를 제공한다', async () => {
    const user = userEvent.setup();
    vi.mocked(getMyProfile)
      .mockRejectedValueOnce(new ApiError(0, 'network', 'NETWORK_ERROR'))
      .mockResolvedValueOnce({ userId: 35, nickname: '뮤로', email: 'me@mulo.com' });

    renderMyPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('내 정보를 불러오지 못했습니다.');
    expect(screen.queryByText('mulo유저')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByText('뮤로')).toBeInTheDocument();
    expect(getMyProfile).toHaveBeenCalledTimes(2);
  });

  it('V1 범위 밖인 회원탈퇴 메뉴를 표시하지 않는다', async () => {
    vi.mocked(getMyProfile).mockResolvedValue({
      userId: 35,
      nickname: '뮤로',
      email: 'me@mulo.com',
    });

    renderMyPage();

    await screen.findByText('뮤로');
    expect(screen.queryByRole('button', { name: /회원탈퇴/ })).not.toBeInTheDocument();
  });

  it('로그아웃 요청 실패와 관계없이 로그인 화면으로 이동한다', async () => {
    const user = userEvent.setup();
    vi.mocked(getMyProfile).mockResolvedValue({
      userId: 35,
      nickname: '뮤로',
      email: 'me@mulo.com',
    });
    vi.mocked(logout).mockRejectedValue(new ApiError(500, '서버 오류', 'SERVER_ERROR'));

    renderMyPage();

    await user.click(screen.getByRole('button', { name: '세션 시작' }));
    expect(screen.getByTestId('session-state')).toHaveTextContent('true');

    await user.click(await screen.findByRole('button', { name: /로그아웃/ }));

    expect(logout).toHaveBeenCalledOnce();
    expect(await screen.findByTestId('current-path')).toHaveTextContent('/login');
    expect(screen.getByTestId('session-state')).toHaveTextContent('false');
  });
});
