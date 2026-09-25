import { describe, expect, it, vi } from 'vitest';

import { getRecordRegions } from './getRecordRegions';

describe('getRecordRegions', () => {
  it('uses the authenticated client without query parameters', async () => {
    const fetchAuthenticatedJson = vi.fn().mockResolvedValue({
      message: '내 자물쇠 지역 그룹 조회 성공',
      data: [
        { legalDongCode: '4111710100', legalDongName: '영통동', recordsCount: 5 },
        { legalDongCode: 'UNKNOWN', legalDongName: '위치 정보 없음', recordsCount: 2 },
      ],
    });
    const controller = new AbortController();

    await expect(getRecordRegions(fetchAuthenticatedJson, controller.signal)).resolves.toEqual([
      { legalDongCode: '4111710100', legalDongName: '영통동', recordsCount: 5 },
      { legalDongCode: 'UNKNOWN', legalDongName: '위치 정보 없음', recordsCount: 2 },
    ]);

    expect(fetchAuthenticatedJson).toHaveBeenCalledWith('/records/regions', {
      signal: controller.signal,
    });
  });

  it('rejects a malformed region item', async () => {
    const fetchAuthenticatedJson = vi.fn().mockResolvedValue({
      message: '내 자물쇠 지역 그룹 조회 성공',
      data: [{ legalDongCode: '4111710100', legalDongName: '영통동' }],
    });

    await expect(
      getRecordRegions(fetchAuthenticatedJson, new AbortController().signal),
    ).rejects.toThrow('내 대시보드 지역 항목 형식이 올바르지 않습니다.');
  });
});
