import { describe, expect, it, vi } from 'vitest';

import { getRegionRecords } from './getRegionRecords';

const validPage = {
  message: '내 자물쇠 목록 조회 성공',
  data: {
    legalDongCode: '4111710100',
    legalDongName: '영통동',
    recordsCount: 21,
    records: [
      {
        recordId: 101,
        placeId: 12,
        musicTrackId: 44,
        title: '밤편지',
        artistName: '아이유',
        createdAt: '2026-09-25T12:30:00',
      },
    ],
    nextCursor: 'next-cursor',
  },
};

describe('getRegionRecords', () => {
  it('sends the first page with legalDongCode only and no size parameter', async () => {
    const fetchAuthenticatedJson = vi.fn().mockResolvedValue(validPage);
    const controller = new AbortController();

    await expect(
      getRegionRecords('4111710100', null, fetchAuthenticatedJson, controller.signal),
    ).resolves.toMatchObject({ recordsCount: 21, nextCursor: 'next-cursor' });

    expect(fetchAuthenticatedJson).toHaveBeenCalledWith('/records?legalDongCode=4111710100', {
      signal: controller.signal,
    });
  });

  it('sends the cursor only for a following page', async () => {
    const fetchAuthenticatedJson = vi.fn().mockResolvedValue(validPage);

    await getRegionRecords(
      'UNKNOWN',
      'next cursor',
      fetchAuthenticatedJson,
      new AbortController().signal,
    );

    expect(fetchAuthenticatedJson).toHaveBeenCalledWith(
      '/records?legalDongCode=UNKNOWN&cursor=next+cursor',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('rejects a malformed record response', async () => {
    const fetchAuthenticatedJson = vi.fn().mockResolvedValue({
      ...validPage,
      data: { ...validPage.data, records: [{ recordId: 101 }] },
    });

    await expect(
      getRegionRecords('4111710100', null, fetchAuthenticatedJson, new AbortController().signal),
    ).rejects.toThrow('내 대시보드 자물쇠 항목 형식이 올바르지 않습니다.');
  });
});
