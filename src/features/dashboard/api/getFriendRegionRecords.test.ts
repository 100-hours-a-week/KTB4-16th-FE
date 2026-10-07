import { describe, expect, it, vi } from 'vitest';

import { getFriendRegionRecords } from './getFriendRegionRecords';

describe('getFriendRegionRecords', () => {
  it('requests a friend region cursor page from the friend route', async () => {
    const page = {
      legalDongCode: 'UNKNOWN',
      legalDongName: '위치 정보 없음',
      recordsCount: 1,
      records: [
        {
          recordId: 15,
          placeId: 4,
          musicTrackId: 8,
          title: '노래',
          artistName: '가수',
          albumImageUrl: null,
          createdAt: '2026-10-06T12:00:00',
        },
      ],
      nextCursor: null,
    };
    const fetchAuthenticatedJson = vi.fn().mockResolvedValue({
      message: '친구 지역 자물쇠 목록 조회 성공',
      data: page,
    });

    await expect(
      getFriendRegionRecords(
        22,
        'UNKNOWN',
        'next cursor',
        fetchAuthenticatedJson,
        new AbortController().signal,
      ),
    ).resolves.toEqual(page);
    expect(fetchAuthenticatedJson).toHaveBeenCalledWith(
      '/users/22/records?legalDongCode=UNKNOWN&cursor=next+cursor',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
