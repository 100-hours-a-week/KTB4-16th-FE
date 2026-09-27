import { afterEach, describe, expect, it, vi } from 'vitest';

import { getCsrfToken } from '../../../shared/api/csrf';
import { getPhotoMusicRecommendations } from './getPhotoMusicRecommendations';

vi.mock('../../../shared/api/csrf', () => ({ getCsrfToken: vi.fn() }));

afterEach(() => vi.clearAllMocks());

const response = {
  message: '사진 기반 음악 추천 성공',
  data: [
    {
      externalTrackId: 'spotify-track',
      title: 'REALLY REALLY',
      artistName: 'WINNER',
      albumImageUrl: 'https://image.test/really-really.jpg',
      externalUrl: 'https://music.test/really-really',
    },
  ],
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

  it('accepts an empty result', async () => {
    vi.mocked(getCsrfToken).mockResolvedValue('csrf');
    const fetchAuthenticatedJson = vi.fn().mockResolvedValue({
      message: '사진 기반 음악 추천 성공',
      data: [],
    });

    await expect(getPhotoMusicRecommendations(77, fetchAuthenticatedJson)).resolves.toEqual([]);
  });

  it('rejects missing, nullable, blank, malformed, or over-limit recommendation responses', async () => {
    vi.mocked(getCsrfToken).mockResolvedValue('csrf');
    const fetchAuthenticatedJson = vi
      .fn()
      .mockResolvedValueOnce({
        ...response,
        data: [{ ...response.data[0], albumImageUrl: undefined }],
      })
      .mockResolvedValueOnce({ ...response, data: [{ ...response.data[0], albumImageUrl: null }] })
      .mockResolvedValueOnce({ ...response, data: [{ ...response.data[0], albumImageUrl: '   ' }] })
      .mockResolvedValueOnce({ ...response, data: [{ title: 'missing fields' }] })
      .mockResolvedValueOnce({
        ...response,
        data: Array.from({ length: 4 }, () => response.data[0]),
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
    await expect(getPhotoMusicRecommendations(77, fetchAuthenticatedJson)).rejects.toThrow(
      '음악 추천 응답 형식이 올바르지 않습니다.',
    );
  });
});
