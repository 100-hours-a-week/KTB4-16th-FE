import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '../../../entities/session/model/SessionProvider';
import { changePassword, getMyProfile } from '../../../features/user-profile/api/userProfileApi';
import { ApiError } from '../../../shared/api/apiError';
import { PasswordChangePage } from './PasswordChangePage';

vi.mock('../../../features/user-profile/api/userProfileApi', () => ({
  changePassword: vi.fn(),
  getMyProfile: vi.fn(),
}));

/** 실제 세션과 라우터 안에서 비밀번호 변경 페이지의 비동기 계약을 검증한다. */
function renderPasswordChangePage() {
  return render(
    <MemoryRouter>
      <SessionProvider>
        <PasswordChangePage />
      </SessionProvider>
    </MemoryRouter>,
  );
}

/** 서버 오류를 확인할 수 있는 유효한 비밀번호 입력을 채운다. */
async function fillValidPasswordForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('현재 비밀번호'), 'OldPassword1!');
  await user.type(screen.getByLabelText('새 비밀번호'), 'NewPassword1!');
  await user.type(screen.getByLabelText('새 비밀번호 확인'), 'NewPassword1!');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getMyProfile).mockResolvedValue({
    userId: 35,
    nickname: '현재닉네임',
    email: 'me@mulo.com',
  });
});

describe('PasswordChangePage', () => {
  it('프로필 조회가 완료되기 전에는 비밀번호 폼을 표시하지 않는다', async () => {
    let resolveProfile:
      ((value: { userId: number; nickname: string; email: string }) => void) | undefined;
    vi.mocked(getMyProfile).mockReturnValue(
      new Promise((resolve) => {
        resolveProfile = resolve;
      }),
    );
    renderPasswordChangePage();

    expect(screen.getByRole('status')).toHaveTextContent('내 정보를 불러오는 중');
    expect(screen.queryByLabelText('현재 비밀번호')).not.toBeInTheDocument();

    resolveProfile?.({ userId: 35, nickname: '현재닉네임', email: 'me@mulo.com' });

    expect(await screen.findByLabelText('현재 비밀번호')).toBeInTheDocument();
  });

  it('SAME_PASSWORD 오류를 새 비밀번호 입력칸에 연결한다', async () => {
    const user = userEvent.setup();
    vi.mocked(changePassword).mockRejectedValue(
      new ApiError(409, '새 비밀번호는 현재 비밀번호와 달라야 합니다.', 'SAME_PASSWORD'),
    );
    renderPasswordChangePage();

    await fillValidPasswordForm(user);
    await user.click(screen.getByRole('button', { name: '비밀번호 변경' }));

    expect(await screen.findByLabelText('새 비밀번호')).toHaveAccessibleDescription(
      '새 비밀번호는 현재 비밀번호와 달라야 합니다.',
    );
  });
});
