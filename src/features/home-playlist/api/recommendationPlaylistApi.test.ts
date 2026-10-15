import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../../shared/api/apiError';
import { getCsrfToken } from '../../../shared/api/csrf';
import {
  createRecommendationPlaylist,
  getRecommendationPlaylist,
} from './recommendationPlaylistApi';

vi.mock('../../../shared/api/csrf', () => ({ getCsrfToken: vi.fn() }));

const playlist = {
  recommendationPlaylistId: 71,
  tracks: [
    {
      musicTrackId: 3,
      title: '비 오는 날엔',
      artistName: '헤이즈',
      albumImageUrl: 'https://i.scdn.co/image/example',
      externalUrl: 'https://open.spotify.com/track/example',
    },
    ...Array.from({ length: 4 }, (_, index) => ({
      musicTrackId: index + 4,
      title: `추천곡 ${index + 2}`,
      artistName: '테스트 아티스트',
      albumImageUrl: 'https://i.scdn.co/image/example',
      externalUrl: `https://open.spotify.com/track/example-${index + 2}`,
    })),
  ],
};

beforeEach(() => vi.clearAllMocks());

describe('recommendationPlaylistApi', () => {
  it('저장된 플레이리스트가 없으면 null을 정상 반환한다', async () => {
    const request = vi.fn().mockResolvedValue({
      message: '현재 추천 플레이리스트 조회 성공',
      data: { playlist: null },
    });

    await expect(getRecommendationPlaylist(request)).resolves.toBeNull();
    expect(request).toHaveBeenCalledWith('/recommendations/playlists', { signal: undefined });
  });

  it('저장된 플레이리스트를 화면용 트랙 목록으로 변환한다', async () => {
    const request = vi.fn().mockResolvedValue({
      message: '현재 추천 플레이리스트 조회 성공',
      data: { playlist },
    });

    await expect(getRecommendationPlaylist(request)).resolves.toEqual(playlist);
  });

  it.each([4, 6])('곡이 정확히 5개가 아닌 %i개인 플레이리스트 응답을 거부한다', async (count) => {
    const request = vi.fn().mockResolvedValue({
      message: '현재 추천 플레이리스트 조회 성공',
      data: {
        playlist: {
          ...playlist,
          tracks: Array.from({ length: count }, (_, index) => ({
            ...playlist.tracks[index % playlist.tracks.length],
            musicTrackId: index + 3,
          })),
        },
      },
    });

    await expect(getRecommendationPlaylist(request)).rejects.toMatchObject({
      status: 502,
      code: 'INVALID_RESPONSE',
    } satisfies Partial<ApiError>);
  });

  it('CSRF와 좌표 JSON을 사용해 새 플레이리스트를 요청한다', async () => {
    vi.mocked(getCsrfToken).mockResolvedValue('csrf-token');
    const request = vi.fn().mockResolvedValue({
      message: '추천 플레이리스트 생성 성공',
      data: { playlist },
    });

    await expect(
      createRecommendationPlaylist({ latitude: 37.5665, longitude: 126.978 }, request),
    ).resolves.toEqual(playlist);
    expect(request).toHaveBeenCalledWith('/recommendations/playlists', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': 'csrf-token' },
      body: JSON.stringify({ latitude: 37.5665, longitude: 126.978 }),
    });
  });

  it('잘못된 트랙 응답을 INVALID_RESPONSE 오류로 거부한다', async () => {
    const request = vi.fn().mockResolvedValue({
      message: '현재 추천 플레이리스트 조회 성공',
      data: {
        playlist: {
          ...playlist,
          tracks: playlist.tracks.map((track, index) =>
            index === 0 ? { ...track, title: null } : track,
          ),
        },
      },
    });

    await expect(getRecommendationPlaylist(request)).rejects.toMatchObject({
      status: 502,
      code: 'INVALID_RESPONSE',
    } satisfies Partial<ApiError>);
  });

  it('유효하지 않은 좌표에는 CSRF와 생성 요청을 보내지 않는다', async () => {
    const request = vi.fn();

    await expect(
      createRecommendationPlaylist({ latitude: 91, longitude: 127 }, request),
    ).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_COORDINATES',
    } satisfies Partial<ApiError>);
    expect(getCsrfToken).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });
});
