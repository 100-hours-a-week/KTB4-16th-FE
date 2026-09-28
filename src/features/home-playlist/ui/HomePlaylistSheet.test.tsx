import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createRecommendationPlaylist,
  getRecommendationPlaylist,
} from '../api/recommendationPlaylistApi';
import { HomePlaylistSheet } from './HomePlaylistSheet';

const mocks = vi.hoisted(() => ({ isAuthenticated: false, fetchAuthenticatedJson: vi.fn() }));

vi.mock('../../../entities/session/model/useSession', () => ({
  useSession: () => ({ ...mocks }),
}));
vi.mock('../api/recommendationPlaylistApi', () => ({
  getRecommendationPlaylist: vi.fn(),
  createRecommendationPlaylist: vi.fn(),
}));

const playlist = {
  recommendationPlaylistId: 71,
  tracks: [
    {
      musicTrackId: 3,
      title: '비 오는 날엔',
      artistName: '헤이즈',
      externalUrl: 'https://open.spotify.com/track/example',
    },
  ],
};

/** 홈 시트가 독립적으로 확인할 수 있게 라우터 안에서 렌더링한다. */
function renderSheet(props?: Partial<Parameters<typeof HomePlaylistSheet>[0]>) {
  return render(
    <MemoryRouter>
      <HomePlaylistSheet
        currentLocation={{ latitude: 37.5, longitude: 127.03 }}
        selectedPopularPlaceIds={[]}
        isOpen
        onExited={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isAuthenticated = false;
});

describe('HomePlaylistSheet', () => {
  it('비로그인 사용자는 API 호출 없이 로그인 경로를 제공한다', () => {
    renderSheet();

    expect(screen.getByRole('link', { name: '로그인하기' })).toHaveAttribute('href', '/login');
    expect(getRecommendationPlaylist).not.toHaveBeenCalled();
  });

  it('로그인 사용자가 열면 저장된 추천을 불러와 트랙을 표시한다', async () => {
    mocks.isAuthenticated = true;
    vi.mocked(getRecommendationPlaylist).mockResolvedValue(playlist);

    renderSheet();

    expect(screen.getByRole('status')).toHaveTextContent('추천을 불러오는 중');
    expect(await screen.findByText('비 오는 날엔')).toBeInTheDocument();
    expect(screen.getByText('헤이즈')).toBeInTheDocument();
  });

  it('저장된 추천이 없고 위치가 없으면 생성 요청을 보내지 않는다', async () => {
    mocks.isAuthenticated = true;
    vi.mocked(getRecommendationPlaylist).mockResolvedValue(null);

    renderSheet({ currentLocation: null });

    expect(
      await screen.findByText('현재 위치를 확인한 뒤 추천을 만들 수 있어요.'),
    ).toBeInTheDocument();
    expect(createRecommendationPlaylist).not.toHaveBeenCalled();
  });

  it('저장된 추천이 없을 때 실제 위치로 새 추천을 생성한다', async () => {
    const user = userEvent.setup();
    mocks.isAuthenticated = true;
    vi.mocked(getRecommendationPlaylist).mockResolvedValue(null);
    vi.mocked(createRecommendationPlaylist).mockResolvedValue(playlist);

    renderSheet();
    await user.click(await screen.findByRole('button', { name: '새 추천 만들기' }));

    expect(createRecommendationPlaylist).toHaveBeenCalledWith(
      { latitude: 37.5, longitude: 127.03 },
      mocks.fetchAuthenticatedJson,
      expect.any(AbortSignal),
    );
    expect(await screen.findByText('비 오는 날엔')).toBeInTheDocument();
  });

  it('선택한 인기 장소가 있으면 추천 생성에 placeIds를 포함한다', async () => {
    const user = userEvent.setup();
    mocks.isAuthenticated = true;
    vi.mocked(getRecommendationPlaylist).mockResolvedValue(null);
    vi.mocked(createRecommendationPlaylist).mockResolvedValue(playlist);

    renderSheet({ selectedPopularPlaceIds: [10, 20] });
    await user.click(await screen.findByRole('button', { name: '새 추천 만들기' }));

    expect(createRecommendationPlaylist).toHaveBeenCalledWith(
      { latitude: 37.5, longitude: 127.03, placeIds: [10, 20] },
      mocks.fetchAuthenticatedJson,
      expect.any(AbortSignal),
    );
  });

  it('생성 실패 후 재시도로 같은 위치 요청을 다시 보낸다', async () => {
    const user = userEvent.setup();
    mocks.isAuthenticated = true;
    vi.mocked(getRecommendationPlaylist).mockResolvedValue(null);
    vi.mocked(createRecommendationPlaylist)
      .mockRejectedValueOnce(new Error('추천 생성 실패'))
      .mockResolvedValueOnce(playlist);

    renderSheet();
    await user.click(await screen.findByRole('button', { name: '새 추천 만들기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('추천을 만들지 못했습니다.');
    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByText('비 오는 날엔')).toBeInTheDocument();
    expect(createRecommendationPlaylist).toHaveBeenCalledTimes(2);
  });

  it('닫힘 transition이 끝나면 전달받은 종료 함수를 호출한다', () => {
    const onExited = vi.fn();
    renderSheet({ isOpen: false, onExited });

    fireEvent.transitionEnd(screen.getByLabelText('AI 추천 플레이리스트'), {
      propertyName: 'transform',
    });

    expect(onExited).toHaveBeenCalledOnce();
  });
});
