import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../../shared/api/apiError';
import { searchWithConflictWait } from './searchWithConflictWait';

const conflict = new ApiError(409, '진행 중', 'MEMORY_SEARCH_IN_PROGRESS');

describe('searchWithConflictWait', () => {
  it('409 뒤 1초를 기다렸다가 같은 질문을 다시 요청한다', async () => {
    vi.useFakeTimers();
    try {
      const request = vi.fn().mockRejectedValueOnce(conflict).mockResolvedValueOnce('success');
      const result = searchWithConflictWait(request, new AbortController().signal);
      await vi.advanceTimersByTimeAsync(1000);
      await expect(result).resolves.toBe('success');
      expect(request).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('40초 동안 계속 409이면 자동 재시도를 멈춘다', async () => {
    vi.useFakeTimers();
    try {
      const request = vi.fn().mockRejectedValue(conflict);
      const result = searchWithConflictWait(request, new AbortController().signal);
      const rejection = expect(result).rejects.toMatchObject({ status: 409 });
      await vi.advanceTimersByTimeAsync(40_000);
      await rejection;
      expect(request).toHaveBeenCalledTimes(41);
    } finally {
      vi.useRealTimers();
    }
  });

  it('409 외 실패는 자동 재시도하지 않는다', async () => {
    const request = vi.fn().mockRejectedValue(new ApiError(502, 'AI 실패', 'AI_SERVICE_ERROR'));
    await expect(
      searchWithConflictWait(request, new AbortController().signal),
    ).rejects.toMatchObject({ status: 502 });
    expect(request).toHaveBeenCalledOnce();
  });

  it('대화 나가기 시 재시도 타이머를 취소한다', async () => {
    vi.useFakeTimers();
    try {
      const controller = new AbortController();
      const request = vi.fn().mockRejectedValue(conflict);
      const result = searchWithConflictWait(request, controller.signal);
      const rejection = expect(result).rejects.toMatchObject({ name: 'AbortError' });
      await vi.advanceTimersByTimeAsync(0);
      controller.abort();
      await rejection;
      await vi.advanceTimersByTimeAsync(2_000);
      expect(request).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
