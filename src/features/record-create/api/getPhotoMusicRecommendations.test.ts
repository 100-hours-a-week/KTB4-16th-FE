import { afterEach, describe, expect, it, vi } from 'vitest';

import { getCsrfToken } from '../../../shared/api/csrf';
import { getPhotoMusicRecommendations } from './getPhotoMusicRecommendations';

vi.mock('../../../shared/api/csrf', () => ({ getCsrfToken: vi.fn() }));

afterEach(() => vi.clearAllMocks());

const response = {
  message: '사진 기반 음악 추천 성공',
  data: Array.from({ length: 5 }, (_, index) => ({
    externalTrackId: `spotify-track-${index + 1}`,
    title: index === 0 ? 'REALLY REALLY' : `추천곡 ${index + 1}`,
    artistName: index === 0 ? 'WINNER' : '테스트 아티스트',
    albumImageUrl: 'https://image.test/really-really.jpg',
    externalUrl: `https://music.test/really-really-${index + 1}`,
  })),
};

describe('getPhotoMusicRecommendations', () => {
  it('posts the upload ID through the authenticated client with CSRF', async () => {
    vi.mocked(getCsrfToken).mockResolvedValue('csrf');
    const fetchAuthenticatedJson = vi.fn().mockResolvedValue(response);
    const controller = new AbortController();

    await expect(
      getPhotoMusicRecommendations(77, fetchAuthenticatedJson, controller.signal),
    ).resolves.toEqual(response.data);

    expect(fetchAuthenticatedJson).toHaveBeenCalledWith('/recommendations/photo', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': 'csrf' },
      body: JSON.stringify({ uploadId: 77 }),
      signal: controller.signal,
    });
  });

  it.each([4, 6])(
    'rejects a success response with %i tracks instead of exactly five',
    async (count) => {
      vi.mocked(getCsrfToken).mockResolvedValue('csrf');
      const fetchAuthenticatedJson = vi.fn().mockResolvedValue({
        ...response,
        data: Array.from({ length: count }, (_, index) => response.data[index % 5]),
      });

      await expect(getPhotoMusicRecommendations(77, fetchAuthenticatedJson)).rejects.toThrow(
        '음악 추천 응답 형식이 올바르지 않습니다.',
      );
    },
  );

  it('rejects malformed recommendation items in an otherwise five-track response', async () => {
    vi.mocked(getCsrfToken).mockResolvedValue('csrf');
    const fetchAuthenticatedJson = vi
      .fn()
      .mockResolvedValueOnce({
        ...response,
        data: response.data.map((track, index) =>
          index === 0 ? { ...track, albumImageUrl: undefined } : track,
        ),
      })
      .mockResolvedValueOnce({
        ...response,
        data: response.data.map((track, index) =>
          index === 0 ? { ...track, albumImageUrl: null } : track,
        ),
      })
      .mockResolvedValueOnce({
        ...response,
        data: response.data.map((track, index) =>
          index === 0 ? { ...track, albumImageUrl: '   ' } : track,
        ),
      })
      .mockResolvedValueOnce({
        ...response,
        data: response.data.map((track, index) =>
          index === 0 ? { title: 'missing fields' } : track,
        ),
      });

    await expect(getPhotoMusicRecommendations(77, fetchAuthenticatedJson)).rejects.toThrow(
      '음악 추천 항목 형식이 올바르지 않습니다.',
    );
    await expect(getPhotoMusicRecommendations(77, fetchAuthenticatedJson)).rejects.toThrow(
      '음악 추천 항목 형식이 올바르지 않습니다.',
    );
    await expect(getPhotoMusicRecommendations(77, fetchAuthenticatedJson)).rejects.toThrow(
      '음악 추천 항목 형식이 올바르지 않습니다.',
    );
    await expect(getPhotoMusicRecommendations(77, fetchAuthenticatedJson)).rejects.toThrow(
      '음악 추천 항목 형식이 올바르지 않습니다.',
    );
  });
});
