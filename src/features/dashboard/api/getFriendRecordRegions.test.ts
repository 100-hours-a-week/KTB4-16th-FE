import { describe, expect, it, vi } from 'vitest';

import { getFriendRecordRegions } from './getFriendRecordRegions';

describe('getFriendRecordRegions', () => {
  it('parses friend dashboard metadata and asks the friend-specific route', async () => {
    const fetchAuthenticatedJson = vi.fn().mockResolvedValue({
      message: '친구 자물쇠 지역 그룹 조회 성공',
      data: {
        userId: 22,
        nickname: '친구',
        recordsCount: 4,
        regions: [{ legalDongCode: '1111010100', legalDongName: '청운동', recordsCount: 4 }],
      },
    });
    const signal = new AbortController().signal;

    await expect(getFriendRecordRegions(22, fetchAuthenticatedJson, signal)).resolves.toEqual({
      userId: 22,
      nickname: '친구',
      recordsCount: 4,
      regions: [{ legalDongCode: '1111010100', legalDongName: '청운동', recordsCount: 4 }],
    });
    expect(fetchAuthenticatedJson).toHaveBeenCalledWith('/users/22/records/regions', { signal });
  });

  it('rejects a profile response for a different user', async () => {
    const fetchAuthenticatedJson = vi.fn().mockResolvedValue({
      message: '친구 자물쇠 지역 그룹 조회 성공',
      data: { userId: 23, nickname: '친구', recordsCount: 0, regions: [] },
    });

    await expect(
      getFriendRecordRegions(22, fetchAuthenticatedJson, new AbortController().signal),
    ).rejects.toThrow('친구 대시보드 응답 형식이 올바르지 않습니다.');
  });
});
