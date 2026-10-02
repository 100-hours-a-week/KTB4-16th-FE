import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { signup } from '../../features/auth/api/authApi';
import { ApiError } from '../../shared/api/apiError';
import { SignupPage } from './SignupPage';

vi.mock('../../features/auth/api/authApi', () => ({ signup: vi.fn() }));

/** 회원가입 완료 이동과 route state 안내를 실제 Router에서 관찰한다. */
function LoginDestination() {
  const location = useLocation();
  const state = location.state as { email?: unknown; signupMessage?: unknown } | null;
  const message = typeof state?.signupMessage === 'string' ? state.signupMessage : '';
  const email = typeof state?.email === 'string' ? state.email : '';

  return (
    <>
      <p role="status">{message}</p>
      <p data-testid="login-email-state">{email}</p>
    </>
  );
}

/** 회원가입 페이지와 성공 목적지를 실제 메모리 라우터로 렌더링한다. */
function renderSignupPage() {
  return render(
    <MemoryRouter initialEntries={['/signup']}>
      <Routes>
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginDestination />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** 서버 요청이 가능한 유효한 회원가입 값을 입력한다. */
async function fillValidSignupForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('닉네임'), '뮬로');
  await user.type(screen.getByLabelText('이메일'), 'user@example.com');
  await user.type(screen.getByLabelText('비밀번호'), 'Password1!');
  await user.type(screen.getByLabelText('비밀번호 확인'), 'Password1!');
}

beforeEach(() => vi.clearAllMocks());

describe('SignupPage', () => {
  it('shows nickname and email format success only after blur', async () => {
    const user = userEvent.setup();
    renderSignupPage();

    expect(screen.getByLabelText('닉네임')).toHaveAttribute('placeholder', '닉네임 입력');
    expect(screen.getByLabelText('닉네임')).toHaveAccessibleDescription(
      '한글, 영문, 숫자로 2~10자까지 입력해 주세요.',
    );
    expect(screen.queryByText('올바른 이메일 형식으로 입력해 주세요.')).not.toBeInTheDocument();
    expect(document.getElementById('email-message')).toHaveAttribute('aria-hidden', 'true');
    expect(document.getElementById('email-message')).toHaveClass('form-field-message');
    expect(screen.getByLabelText('비밀번호')).toHaveAccessibleDescription(
      '영문 대·소문자, 숫자, 특수문자를 포함해 8~16자로 입력해 주세요.',
    );

    const nickname = screen.getByLabelText('닉네임');
    const email = screen.getByLabelText('이메일');
    await user.type(nickname, '뮤로');
    expect(screen.queryByText('닉네임 형식을 통과하였습니다.')).not.toBeInTheDocument();
    await user.tab();

    expect(nickname).toHaveAccessibleDescription('닉네임 형식을 통과하였습니다.');

    await user.type(email, 'ji@gm.com');
    expect(screen.queryByText('이메일 형식을 통과하였습니다.')).not.toBeInTheDocument();
    expect(screen.queryByText('이메일 형식이 올바르지 않습니다.')).not.toBeInTheDocument();
    await user.tab();

    expect(email).toHaveAccessibleDescription('이메일 형식을 통과하였습니다.');
  });

  it('shows existing nickname and email validation errors after blur', async () => {
    const user = userEvent.setup();
    renderSignupPage();

    const nickname = screen.getByLabelText('닉네임');
    await user.type(nickname, '!');
    expect(
      screen.queryByText('닉네임은 한글, 영문, 숫자로 2~10자까지 입력해 주세요.'),
    ).not.toBeInTheDocument();
    await user.tab();
    expect(nickname).toHaveAccessibleDescription(
      '닉네임은 한글, 영문, 숫자로 2~10자까지 입력해 주세요.',
    );

    const email = screen.getByLabelText('이메일');
    await user.type(email, 'invalid');
    expect(screen.queryByText('이메일 형식이 올바르지 않습니다.')).not.toBeInTheDocument();
    await user.tab();
    expect(email).toHaveAccessibleDescription('이메일 형식이 올바르지 않습니다.');
  });

  it('keeps signup password guidance identical in helper and validation error styling', async () => {
    const user = userEvent.setup();
    renderSignupPage();

    const password = screen.getByLabelText('비밀번호');
    const message = document.getElementById('password-message');
    const guidance = '영문 대·소문자, 숫자, 특수문자를 포함해 8~16자로 입력해 주세요.';

    expect(password).toHaveAccessibleDescription(guidance);
    await user.type(password, 'weak');

    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(password).toHaveAccessibleDescription(guidance);
    expect(message).toHaveClass('form-field-message--error');
  });

  it('resets nickname and email blur feedback when their values change', async () => {
    const user = userEvent.setup();
    renderSignupPage();

    const nickname = screen.getByLabelText('닉네임');
    await user.type(nickname, '뮤로');
    await user.tab();
    expect(nickname).toHaveAccessibleDescription('닉네임 형식을 통과하였습니다.');

    await user.click(nickname);
    await user.type(nickname, '2');
    expect(nickname).toHaveAccessibleDescription('한글, 영문, 숫자로 2~10자까지 입력해 주세요.');
    await user.tab();
    expect(nickname).toHaveAccessibleDescription('닉네임 형식을 통과하였습니다.');

    const email = screen.getByLabelText('이메일');
    await user.type(email, 'ji@gm.com');
    await user.tab();
    expect(email).toHaveAccessibleDescription('이메일 형식을 통과하였습니다.');

    await user.click(email);
    await user.clear(email);
    await user.type(email, 'invalid');
    expect(email).not.toHaveAccessibleDescription('이메일 형식이 올바르지 않습니다.');
    expect(screen.queryByText('올바른 이메일 형식으로 입력해 주세요.')).not.toBeInTheDocument();
    await user.tab();
    expect(email).toHaveAccessibleDescription('이메일 형식이 올바르지 않습니다.');

    await user.click(email);
    await user.clear(email);
    await user.type(email, 'again@example.com');
    expect(screen.queryByText('이메일 형식이 올바르지 않습니다.')).not.toBeInTheDocument();
    expect(screen.queryByText('이메일 형식을 통과하였습니다.')).not.toBeInTheDocument();
    expect(document.getElementById('email-message')).toHaveAttribute('aria-hidden', 'true');
    await user.tab();
    expect(email).toHaveAccessibleDescription('이메일 형식을 통과하였습니다.');
  });

  it('shows all client field errors without calling the API', async () => {
    const user = userEvent.setup();
    renderSignupPage();

    await user.type(screen.getByLabelText('닉네임'), '!');
    await user.type(screen.getByLabelText('이메일'), 'invalid');
    await user.type(screen.getByLabelText('비밀번호'), 'weak');
    await user.type(screen.getByLabelText('비밀번호 확인'), 'different');
    await user.click(screen.getByRole('button', { name: '가입 완료' }));

    expect(screen.getByLabelText('닉네임')).toHaveAccessibleDescription();
    expect(screen.getByLabelText('이메일')).toHaveAccessibleDescription();
    expect(screen.getByLabelText('비밀번호')).toHaveAccessibleDescription();
    expect(screen.getByLabelText('비밀번호 확인')).toHaveAccessibleDescription();
    expect(signup).not.toHaveBeenCalled();
  });

  it('moves to login with a success message and normalized signup email after signup', async () => {
    const user = userEvent.setup();
    vi.mocked(signup).mockResolvedValue({ message: '가입 완료' });
    renderSignupPage();
    await user.type(screen.getByLabelText('닉네임'), '뮬로');
    await user.type(screen.getByLabelText('이메일'), 'User@Example.COM');
    await user.type(screen.getByLabelText('비밀번호'), 'Password1!');
    await user.type(screen.getByLabelText('비밀번호 확인'), 'Password1!');

    await user.click(screen.getByRole('button', { name: '가입 완료' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      '가입이 완료되었습니다. 로그인해 주세요.',
    );
    expect(screen.getByTestId('login-email-state')).toHaveTextContent('user@example.com');
  });

  it('shows server validation on the matching field', async () => {
    const user = userEvent.setup();
    vi.mocked(signup).mockRejectedValue(
      new ApiError(400, '입력값을 확인해 주세요.', 'VALIDATION_ERROR', {
        email: '이미 사용 중인 형식입니다.',
      }),
    );
    renderSignupPage();
    await fillValidSignupForm(user);

    await user.click(screen.getByRole('button', { name: '가입 완료' }));

    expect(await screen.findByLabelText('이메일')).toHaveAccessibleDescription(
      '이미 사용 중인 형식입니다.',
    );
  });

  it('shows both duplicate nickname and email errors', async () => {
    const user = userEvent.setup();
    vi.mocked(signup).mockRejectedValue(
      new ApiError(409, '중복된 정보입니다.', 'DUPLICATE_RESOURCE', {
        nickname: '이미 사용 중인 닉네임입니다.',
        email: '이미 사용 중인 이메일입니다.',
      }),
    );
    renderSignupPage();
    await fillValidSignupForm(user);

    await user.click(screen.getByRole('button', { name: '가입 완료' }));

    expect(await screen.findByLabelText('닉네임')).toHaveAccessibleDescription(
      '이미 사용 중인 닉네임입니다.',
    );
    expect(screen.getByLabelText('이메일')).toHaveAccessibleDescription(
      '이미 사용 중인 이메일입니다.',
    );
  });

  it('shows a network message when the server cannot be reached', async () => {
    const user = userEvent.setup();
    vi.mocked(signup).mockRejectedValue(
      new ApiError(0, '서버에 연결할 수 없습니다.', 'NETWORK_ERROR'),
    );
    renderSignupPage();
    await fillValidSignupForm(user);

    await user.click(screen.getByRole('button', { name: '가입 완료' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    );
  });

  it('disables submission and sends only one request while pending', async () => {
    const user = userEvent.setup();
    vi.mocked(signup).mockReturnValue(new Promise(() => undefined));
    renderSignupPage();
    await fillValidSignupForm(user);

    const submitButton = screen.getByRole('button', { name: '가입 완료' });
    await user.dblClick(submitButton);

    expect(signup).toHaveBeenCalledTimes(1);
    expect(submitButton).toBeDisabled();
  });
});
