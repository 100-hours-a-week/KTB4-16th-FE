import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '../../../entities/session/model/SessionProvider';
import { changeNickname, getMyProfile } from '../../../features/user-profile/api/userProfileApi';
import { ApiError } from '../../../shared/api/apiError';
import { NicknameChangePage } from './NicknameChangePage';

vi.mock('../../../features/user-profile/api/userProfileApi', () => ({
  changeNickname: vi.fn(),
  getMyProfile: vi.fn(),
}));

/** 실제 세션과 라우터 안에서 닉네임 변경 페이지의 비동기 계약을 검증한다. */
function renderNicknameChangePage() {
  return render(
    <MemoryRouter>
      <SessionProvider>
        <NicknameChangePage />
      </SessionProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getMyProfile).mockResolvedValue({
    userId: 35,
    nickname: '현재닉네임',
    email: 'me@mulo.com',
  });
});

describe('NicknameChangePage', () => {
  it('검증된 현재 프로필을 받은 뒤에 변경 폼을 표시한다', async () => {
    renderNicknameChangePage();

    expect(screen.getByRole('status')).toHaveTextContent('내 정보를 불러오는 중');
    expect(await screen.findByText('현재 닉네임: 현재닉네임')).toBeInTheDocument();
    expect(screen.getByLabelText('새 닉네임')).toBeInTheDocument();
  });

  it('중복 닉네임 오류를 새 닉네임 입력칸에 연결한다', async () => {
    const user = userEvent.setup();
    vi.mocked(changeNickname).mockRejectedValue(
      new ApiError(409, '이미 사용 중인 닉네임입니다.', 'NICKNAME_DUPLICATED'),
    );
    renderNicknameChangePage();

    await user.type(await screen.findByLabelText('새 닉네임'), '새닉네임');
    await user.click(screen.getByRole('button', { name: '닉네임 변경' }));

    expect(await screen.findByLabelText('새 닉네임')).toHaveAccessibleDescription(
      '이미 사용 중인 닉네임입니다.',
    );
  });
});
