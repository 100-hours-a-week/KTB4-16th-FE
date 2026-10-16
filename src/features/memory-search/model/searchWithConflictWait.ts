import { ApiError } from '../../../shared/api/apiError';

const RETRY_INTERVAL_MS = 1_000;
const MAX_WAIT_MS = 40_000;

/** 질문이 시작되지 않은 409에 한해서만 최대 40초 동안 순차 재시도한다. */
export async function searchWithConflictWait<T>(
  request: () => Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  let firstConflictAt: number | null = null;
  while (true) {
    if (signal.aborted) throw new DOMException('요청이 취소됐습니다.', 'AbortError');
    try {
      return await request();
    } catch (error: unknown) {
      if (
        !(error instanceof ApiError) ||
        error.status !== 409 ||
        error.code !== 'MEMORY_SEARCH_IN_PROGRESS'
      ) {
        throw error;
      }
      firstConflictAt ??= Date.now();
      if (Date.now() - firstConflictAt >= MAX_WAIT_MS) throw error;
      await waitForNextAttempt(signal);
    }
  }
}

/** 대화 종료 시 남은 재시도 타이머를 즉시 정리할 수 있게 기다린다. */
function waitForNextAttempt(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('요청이 취소됐습니다.', 'AbortError'));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('요청이 취소됐습니다.', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, RETRY_INTERVAL_MS);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
