import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';

import { createRecommendationPlaylist } from '../../../features/home-playlist/api/recommendationPlaylistApi';
import { HomePage } from './HomePage';

vi.mock('../../../entities/session/model/useSession', () => ({
  useSession: () => ({
    isAuthenticated: true,
    isSessionRestoring: false,
    fetchAuthenticatedJson: async () => ({ data: { notifications: [], nextCursor: null } }),
  }),
}));
vi.mock('../../../features/home-playlist/api/recommendationPlaylistApi', () => ({
  createRecommendationPlaylist: vi.fn(),
}));
vi.mock('../../../features/home-weather/ui/HomeWeather', () => ({ HomeWeather: () => null }));
vi.mock('../../../features/home-map/ui/HomeMap', () => ({
  /** 지도 SDK만 대체하고 실제 페이지와 추천 시트의 열기·닫기 연결을 검증한다. */
  HomeMap: ({
    children,
    overview,
    primaryAction,
    isPlaylistRequested,
    onPlaylistReady,
    onCurrentLocationResolved,
  }: {
    children?: ReactNode;
    overview?: ReactNode;
    primaryAction?: ReactNode;
    isPlaylistRequested: boolean;
    onPlaylistReady: () => void;
    onCurrentLocationResolved: (location: { latitude: number; longitude: number }) => void;
  }) => {
    useEffect(() => {
      onCurrentLocationResolved({ latitude: 37.5, longitude: 127 });
    }, [onCurrentLocationResolved]);
    useEffect(() => {
      if (isPlaylistRequested) onPlaylistReady();
    }, [isPlaylistRequested, onPlaylistReady]);
    return (
      <section aria-label="홈 지도">
        {overview}
        {children}
        {primaryAction}
      </section>
    );
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

it('추천을 지도 밖에서 열고 닫은 뒤 다시 열면 빈 세션으로 시작한다', async () => {
  const user = userEvent.setup();
  vi.mocked(createRecommendationPlaylist).mockResolvedValue({
    recommendationPlaylistId: 1,
    tracks: Array.from({ length: 5 }, (_, index) => ({
      musicTrackId: index + 1,
      externalTrackId: `track-${index}`,
      title: `이번 세션 곡 ${index}`,
      artistName: '아티스트',
      albumImageUrl: 'https://example.com/album.jpg',
      externalUrl: 'https://example.com/track',
    })),
  });
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
  const open = screen.getByRole('button', { name: /지금 나를 위한 음악/ });
  await user.click(open);
  const sheet = await screen.findByRole('dialog', { name: 'AI 추천 플레이리스트' });
  expect(document.querySelector('[aria-label="홈 지도"]')?.contains(sheet)).toBe(false);
  await user.click(screen.getByRole('button', { name: '추천 받기' }));
  expect(await screen.findByText('이번 세션 곡 0')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '플레이리스트 안내 닫기' }));
  fireEvent.transitionEnd(sheet, { propertyName: 'transform' });
  await waitFor(() => expect(document.querySelector('.home-playlist-sheet')).toBeNull());
  await user.click(open);
  expect(await screen.findByRole('button', { name: '추천 받기' })).toBeEnabled();
  expect(screen.queryByText('이번 세션 곡 0')).not.toBeInTheDocument();
});
