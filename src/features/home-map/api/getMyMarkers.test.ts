import { describe, expect, it, vi } from 'vitest';

import { getMyMarkers } from './getMyMarkers';

const mapBounds = {
  swLat: 37.1,
  swLng: 127.1,
  neLat: 37.2,
  neLng: 127.2,
};

describe('getMyMarkers', () => {
  it('uses the authenticated client with viewport query parameters', async () => {
    const fetchAuthenticatedJson = vi.fn().mockResolvedValue({
      message: '내 자물쇠 마커 조회 성공',
      data: [
        {
          placeId: 10,
          legalDongName: '오산동',
          myRecordsCount: 3,
          latitude: 37.2002,
          longitude: 127.095,
        },
      ],
    });
    const controller = new AbortController();

    await expect(
      getMyMarkers(mapBounds, fetchAuthenticatedJson, controller.signal),
    ).resolves.toEqual([
      {
        placeId: 10,
        legalDongName: '오산동',
        myRecordsCount: 3,
        latitude: 37.2002,
        longitude: 127.095,
      },
    ]);

    expect(fetchAuthenticatedJson).toHaveBeenCalledWith(
      '/users/me/places?swLat=37.1&swLng=127.1&neLat=37.2&neLng=127.2',
      { signal: controller.signal },
    );
  });

  it('rejects a response that omits myRecordsCount', async () => {
    const fetchAuthenticatedJson = vi.fn().mockResolvedValue({
      message: '내 자물쇠 마커 조회 성공',
      data: [{ placeId: 10, legalDongName: null, latitude: 37.2, longitude: 127.1 }],
    });

    await expect(
      getMyMarkers(mapBounds, fetchAuthenticatedJson, new AbortController().signal),
    ).rejects.toThrow('내 자물쇠 마커 항목 형식이 올바르지 않습니다.');
  });

  it('accepts an empty marker list as a valid response', async () => {
    const fetchAuthenticatedJson = vi.fn().mockResolvedValue({
      message: '내 자물쇠 마커 조회 성공',
      data: [],
    });

    await expect(
      getMyMarkers(mapBounds, fetchAuthenticatedJson, new AbortController().signal),
    ).resolves.toEqual([]);
  });
});
