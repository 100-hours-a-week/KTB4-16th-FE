import { describe, expect, it, vi } from 'vitest';

import { getDailySongDetail } from './dailySongApi';

const detail = {
  message: '오늘의 노래 조회 성공',
  data: {
    jobId: 42,
    recommendationDate: '2026-11-11',
    track: {
      externalTrackId: 'track-42',
      title: '오늘의 노래',
      artistName: '가수',
      albumImageUrl: 'https://example.com/cover.jpg',
      externalUrl: 'https://example.com/track',
    },
  },
};

describe('getDailySongDetail', () => {
  it('loads the completed song by job ID without changing notification state', async () => {
    const request = vi.fn().mockResolvedValue(detail);
    const signal = new AbortController().signal;

    await expect(getDailySongDetail(42, request, signal)).resolves.toEqual(detail.data);
    expect(request).toHaveBeenCalledWith('/daily-songs/42', { signal });
  });

  it.each([
    { ...detail, data: { ...detail.data, jobId: 43 } },
    { ...detail, data: { ...detail.data, track: null } },
    { ...detail, data: { ...detail.data, track: { ...detail.data.track, title: '' } } },
  ])('rejects an invalid or mismatched detail response', async (response) => {
    await expect(
      getDailySongDetail(42, vi.fn().mockResolvedValue(response), new AbortController().signal),
    ).rejects.toThrow('오늘의 노래 응답 형식');
  });

  it('does not request an invalid job ID', async () => {
    const request = vi.fn();
    await expect(getDailySongDetail(0, request, new AbortController().signal)).rejects.toThrow(
      '오늘의 노래 ID',
    );
    expect(request).not.toHaveBeenCalled();
  });
});
