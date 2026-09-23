import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '../../entities/session/model/SessionProvider';
import { useSession } from '../../entities/session/model/useSession';
import { login } from '../../features/auth/api/authApi';
import { ApiError } from '../../shared/api/apiError';
import { LoginPage } from './LoginPage';

vi.mock('../../features/auth/api/authApi', () => ({ login: vi.fn() }));

/** 로그인 성공 후 실제 메모리 세션에 저장된 토큰을 관찰한다. */
function SessionDestination() {
  const { accessToken } = useSession();
  return <h1>홈 세션: {accessToken}</h1>;
}

/** 로그인 화면을 실제 세션 Provider와 이동 목적지까지 포함해 렌더링한다. */
function renderLoginPage(signupMessage?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state: { signupMessage } }]}>
      <SessionProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<SessionDestination />} />
        </Routes>
      </SessionProvider>
    </MemoryRouter>,
  );
}

/** 서버 요청이 가능한 유효한 로그인 값을 입력한다. */
async function fillValidLoginForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('이메일'), 'user@example.com');
  await user.type(screen.getByLabelText('비밀번호'), 'Password1!');
}

beforeEach(() => vi.clearAllMocks());

describe('LoginPage', () => {
  it('uses the mockup brand copy and field placeholders', () => {
    renderLoginPage();

    expect(screen.getByRole('heading', { name: 'mulo' })).toBeInTheDocument();
    expect(screen.getByText('장소에 음악을 걸어두는 앱')).toBeInTheDocument();
    expect(screen.getByLabelText('이메일')).toHaveAttribute('placeholder', 'example@mulo.com');
    expect(screen.getByLabelText('비밀번호')).toHaveAttribute('placeholder', '비밀번호 입력');
  });

  it('shows both client errors without calling the API', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText('이메일'), 'invalid');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(screen.getByLabelText('이메일')).toHaveAccessibleDescription();
    expect(screen.getByLabelText('비밀번호')).toHaveAccessibleDescription();
    expect(login).not.toHaveBeenCalled();
  });

  it('announces a signup message only when route state contains a string', () => {
    renderLoginPage('가입이 완료되었습니다. 로그인해 주세요.');

    expect(screen.getByRole('status')).toHaveTextContent('가입이 완료되었습니다. 로그인해 주세요.');
  });

  it('stores the access token in session and moves home', async () => {
    const user = userEvent.setup();
    vi.mocked(login).mockResolvedValue({ message: '로그인 성공', accessToken: 'access-token' });
    renderLoginPage();
    await fillValidLoginForm(user);

    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(
      await screen.findByRole('heading', { name: '홈 세션: access-token' }),
    ).toBeInTheDocument();
  });

  it.each([
    [
      new ApiError(401, '인증 실패', 'INVALID_CREDENTIALS'),
      '이메일 또는 비밀번호가 일치하지 않습니다.',
    ],
    [
      new ApiError(403, 'CSRF 실패', 'CSRF_TOKEN_MISSING'),
      '보안 정보를 확인하지 못했습니다. 다시 시도해 주세요.',
    ],
    [
      new ApiError(0, '연결 실패', 'NETWORK_ERROR'),
      '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    ],
    [new ApiError(500, '서버 실패'), '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'],
  ])('shows the mapped API error for %s', async (error, message) => {
    const user = userEvent.setup();
    vi.mocked(login).mockRejectedValue(error);
    renderLoginPage();
    await fillValidLoginForm(user);

    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('disables submission and sends only one request while pending', async () => {
    const user = userEvent.setup();
    vi.mocked(login).mockReturnValue(new Promise(() => undefined));
    renderLoginPage();
    await fillValidLoginForm(user);

    const submitButton = screen.getByRole('button', { name: '로그인' });
    await user.dblClick(submitButton);

    expect(login).toHaveBeenCalledTimes(1);
    expect(submitButton).toBeDisabled();
  });
});
