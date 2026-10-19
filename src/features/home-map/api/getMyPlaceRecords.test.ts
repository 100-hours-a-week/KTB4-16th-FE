import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCsrfToken } from '../../../shared/api/csrf';
import { getMyPlaceRecords } from './getMyPlaceRecords';

vi.mock('../../../shared/api/csrf', () => ({ getCsrfToken: vi.fn() }));

const fetchAuthenticatedJson = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCsrfToken).mockResolvedValue('csrf-token');
  fetchAuthenticatedJson.mockResolvedValue({
    message: 'ok',
    data: { records: [], nextCursor: null },
  });
});

describe('getMyPlaceRecords', () => {
  it('sends the first request without cursor or size', async () => {
    const controller = new AbortController();

    await expect(
      getMyPlaceRecords([222, 223], null, fetchAuthenticatedJson, controller.signal),
    ).resolves.toEqual({ records: [], nextCursor: null });

    expect(fetchAuthenticatedJson).toHaveBeenCalledWith('/users/me/records/search', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': 'csrf-token' },
      body: JSON.stringify({ placeIds: [222, 223] }),
      signal: controller.signal,
    });
  });

  it('sends only the cursor needed for a following page', async () => {
    await getMyPlaceRecords(
      [225],
      'next-page',
      fetchAuthenticatedJson,
      new AbortController().signal,
    );

    expect(fetchAuthenticatedJson).toHaveBeenCalledWith(
      '/users/me/records/search',
      expect.objectContaining({ body: JSON.stringify({ placeIds: [225], cursor: 'next-page' }) }),
    );
  });

  it('validates response records and accepts an empty page', async () => {
    fetchAuthenticatedJson.mockResolvedValueOnce({
      message: 'ok',
      data: {
        records: [
          {
            recordId: 585,
            placeId: 222,
            musicTrackId: 122,
            title: '테스트 곡',
            artistName: '테스트 아티스트',
            createdAt: '2026-09-24T11:30:43',
          },
        ],
        nextCursor: 'cursor-value',
      },
    });

    await expect(
      getMyPlaceRecords([222], null, fetchAuthenticatedJson, new AbortController().signal),
    ).resolves.toMatchObject({
      nextCursor: 'cursor-value',
      records: [{ recordId: 585, albumImageUrl: null }],
    });
  });

  it('parses an album cover URL when the expanded response provides one', async () => {
    fetchAuthenticatedJson.mockResolvedValueOnce({
      message: 'ok',
      data: {
        records: [
          {
            recordId: 586,
            placeId: 222,
            musicTrackId: 123,
            title: 'REALLY REALLY',
            artistName: 'WINNER',
            albumImageUrl: 'https://image.test/really-really.jpg',
            createdAt: '2026-09-26T11:30:43',
          },
        ],
        nextCursor: null,
      },
    });

    await expect(
      getMyPlaceRecords([222], null, fetchAuthenticatedJson, new AbortController().signal),
    ).resolves.toMatchObject({
      records: [{ albumImageUrl: 'https://image.test/really-really.jpg' }],
    });
  });

  it('preserves the Spotify link supplied for preview', async () => {
    fetchAuthenticatedJson.mockResolvedValueOnce({
      message: 'ok',
      data: {
        recordCount: 1,
        nextCursor: null,
        records: [
          {
            rank: 1,
            count: 1,
            recordId: 1,
            placeId: 10,
            musicTrackId: 7,
            title: '곡',
            artistName: '가수',
            createdAt: '2026-10-19T12:00:00',
            externalUrl: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
          },
        ],
      },
    });
    const result = await getMyPlaceRecords(
      [10],
      null,
      fetchAuthenticatedJson,
      new AbortController().signal,
    );
    expect(result.records[0]).toMatchObject({
      externalUrl: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
    });
  });
});
