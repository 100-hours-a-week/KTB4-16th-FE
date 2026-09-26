import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '../../../entities/session/model/SessionProvider';
import { getMyProfile } from '../../../features/user-profile/api/userProfileApi';
import { ApiError } from '../../../shared/api/apiError';
import { MyPage } from './MyPage';

vi.mock('../../../features/user-profile/api/userProfileApi', () => ({ getMyProfile: vi.fn() }));

/** 실제 SessionProvider와 라우터 안에서 마이페이지의 비동기 상태를 렌더링한다. */
function renderMyPage() {
  return render(
    <MemoryRouter>
      <SessionProvider>
        <MyPage />
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
});
