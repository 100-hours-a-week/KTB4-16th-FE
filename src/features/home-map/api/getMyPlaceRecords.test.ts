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
    ).resolves.toMatchObject({ nextCursor: 'cursor-value', records: [{ recordId: 585 }] });
  });
});
