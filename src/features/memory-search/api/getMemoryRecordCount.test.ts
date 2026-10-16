import { describe, expect, it, vi } from 'vitest';

import { getMemoryRecordCount } from './getMemoryRecordCount';

describe('getMemoryRecordCount', () => {
  it('위치 미확인 그룹을 포함해 활성 자물쇠 수를 합산한다', async () => {
    const request = vi.fn().mockResolvedValue({
      message: '성공',
      data: [
        { legalDongCode: null, legalDongName: null, recordsCount: 2 },
        { legalDongCode: '123', legalDongName: '서교동', recordsCount: 3 },
      ],
    });
    const signal = new AbortController().signal;

    await expect(getMemoryRecordCount(request, signal)).resolves.toBe(5);
    expect(request).toHaveBeenCalledWith('/records/regions', { signal });
  });

  it('그룹이 비어 있으면 0개로 판별한다', async () => {
    await expect(
      getMemoryRecordCount(
        vi.fn().mockResolvedValue({
          message: '성공',
          data: [],
        }),
        new AbortController().signal,
      ),
    ).resolves.toBe(0);
  });

  it('계약과 다른 응답을 0개로 위장하지 않는다', async () => {
    await expect(
      getMemoryRecordCount(
        vi.fn().mockResolvedValue({
          message: '성공',
          data: [{ recordsCount: '0' }],
        }),
        new AbortController().signal,
      ),
    ).rejects.toThrow();
  });
});
