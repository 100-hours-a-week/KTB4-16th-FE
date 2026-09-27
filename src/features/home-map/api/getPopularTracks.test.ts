import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCsrfToken } from '../../../shared/api/csrf';
import { fetchJson } from '../../../shared/api/fetchJson';
import { getPopularTracks } from './getPopularTracks';

vi.mock('../../../shared/api/csrf', () => ({ getCsrfToken: vi.fn() }));
vi.mock('../../../shared/api/fetchJson', () => ({ fetchJson: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCsrfToken).mockResolvedValue('csrf-token');
  vi.mocked(fetchJson).mockResolvedValue({
    message: '인기 음악 조회 성공',
    data: {
      recordCount: 3,
      music: [{ rank: 1, musicTrackId: 7, title: '밤편지', artistName: '아이유', count: 3 }],
    },
  });
});

describe('getPopularTracks', () => {
  it('uses the public API with CSRF and no authenticated client', async () => {
    const controller = new AbortController();

    await expect(getPopularTracks([10, 20], controller.signal)).resolves.toEqual({
      recordCount: 3,
      music: [{ rank: 1, musicTrackId: 7, title: '밤편지', artistName: '아이유', count: 3 }],
    });

    expect(getCsrfToken).toHaveBeenCalledOnce();
    expect(fetchJson).toHaveBeenCalledWith('/places/popular-tracks/search', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': 'csrf-token' },
      body: JSON.stringify({ placeIds: [10, 20] }),
      signal: controller.signal,
    });
  });

  it('accepts an empty result as a normal response', async () => {
    vi.mocked(fetchJson).mockResolvedValueOnce({
      message: '인기 음악 조회 성공',
      data: { recordCount: 0, music: [] },
    });

    await expect(getPopularTracks([10], new AbortController().signal)).resolves.toEqual({
      recordCount: 0,
      music: [],
    });
  });

  it.each([{ placeIds: [] }, { placeIds: [0] }, { placeIds: [-1] }, { placeIds: [1.5] }])(
    'rejects invalid place IDs: $placeIds',
    async ({ placeIds }) => {
      await expect(getPopularTracks(placeIds, new AbortController().signal)).rejects.toThrow(
        '하나 이상의 올바른 장소 ID가 필요합니다.',
      );
      expect(fetchJson).not.toHaveBeenCalled();
    },
  );
});
