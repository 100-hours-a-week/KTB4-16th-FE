import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '../../../entities/session/model/SessionProvider';
import { useSession } from '../../../entities/session/model/useSession';
import { withdrawAccount } from '../../../features/user-profile/api/userProfileApi';
import { WithdrawalPage } from './WithdrawalPage';

vi.mock('../../../features/user-profile/api/userProfileApi', () => ({ withdrawAccount: vi.fn() }));

/** 탈퇴 완료 후 현재 경로와 인증 상태를 관찰한다. */
function SessionState() {
  const { isAuthenticated, isSessionRestoring, setAccessToken } = useSession();
  const location = useLocation();
  return (
    <>
      <button type="button" onClick={() => setAccessToken('access-token')}>
        세션 시작
      </button>
      <div data-testid="session-state">
        {String(isAuthenticated)}:{String(isSessionRestoring)}
      </div>
      <div data-testid="current-path">{location.pathname}</div>
    </>
  );
}

/** 실제 Provider에서 탈퇴 화면을 열고 로그인 이동까지 관찰한다. */
function renderWithdrawalPage() {
  return render(
    <MemoryRouter initialEntries={['/mypage/withdrawal']}>
      <SessionProvider>
        <SessionState />
        <Routes>
          <Route path="/mypage/withdrawal" element={<WithdrawalPage />} />
          <Route path="/login" element={<h1>로그인</h1>} />
        </Routes>
      </SessionProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('WithdrawalPage', () => {
  it('주요 메뉴 대신 기존 마이페이지 뒤로 가기 링크를 제공한다', () => {
    renderWithdrawalPage();
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '‹ 마이페이지' })).toHaveAttribute('href', '/mypage');
  });

  it('탈퇴로 이용할 수 없게 되는 계정과 기록을 안내하고 비밀번호를 받는다', () => {
    renderWithdrawalPage();

    expect(screen.getByRole('heading', { name: '회원 탈퇴' })).toBeInTheDocument();
    expect(
      screen.getByText(/계정과 내가 만든 기록을 더 이상 이용할 수 없어요/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('현재 비밀번호')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '‹ 마이페이지' })).toHaveAttribute('href', '/mypage');
  });

  it('탈퇴 성공 후 메모리 세션을 지우고 로그인 화면으로 이동한다', async () => {
    const user = userEvent.setup();
    vi.mocked(withdrawAccount).mockResolvedValue();
    renderWithdrawalPage();

    await screen.findByText('false:false');
    await user.click(screen.getByRole('button', { name: '세션 시작' }));
    expect(screen.getByTestId('session-state')).toHaveTextContent('true:false');

    await user.type(screen.getByLabelText('현재 비밀번호'), 'Current123!');
    await user.click(screen.getByRole('button', { name: '회원 탈퇴하기' }));

    expect(await screen.findByRole('heading', { name: '로그인' })).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent('/login');
    expect(screen.getByTestId('session-state')).toHaveTextContent('false:false');
  });
});
