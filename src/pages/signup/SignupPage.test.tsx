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
  const state = location.state as { signupMessage?: unknown } | null;
  const message = typeof state?.signupMessage === 'string' ? state.signupMessage : '';

  return <p role="status">{message}</p>;
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
  it('shows mockup helpers and changes them to success feedback for valid input', async () => {
    const user = userEvent.setup();
    renderSignupPage();

    expect(screen.getByLabelText('닉네임')).toHaveAttribute('placeholder', '닉네임 입력');
    expect(screen.getByLabelText('비밀번호')).toHaveAccessibleDescription(
      '영문 대소문자, 숫자, 특수문자를 포함해 8~16자로 입력해주세요.',
    );

    await user.type(screen.getByLabelText('닉네임'), '뮤로');
    await user.type(screen.getByLabelText('비밀번호'), 'Password1!');

    expect(screen.getByLabelText('닉네임')).toHaveAccessibleDescription(
      '사용할 수 있는 닉네임입니다.',
    );
    expect(screen.getByLabelText('비밀번호')).toHaveAccessibleDescription(
      '사용할 수 있는 비밀번호입니다.',
    );
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

  it('moves to login with a success message after signup', async () => {
    const user = userEvent.setup();
    vi.mocked(signup).mockResolvedValue({ message: '가입 완료' });
    renderSignupPage();
    await fillValidSignupForm(user);

    await user.click(screen.getByRole('button', { name: '가입 완료' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      '가입이 완료되었습니다. 로그인해 주세요.',
    );
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
