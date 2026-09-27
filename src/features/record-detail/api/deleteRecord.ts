import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { getCsrfToken } from '../../../shared/api/csrf';

/** 로그인 사용자가 소유한 활성 자물쇠를 soft delete한다. */
export async function deleteRecord(
  recordId: number,
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
): Promise<void> {
  if (!Number.isSafeInteger(recordId) || recordId <= 0) {
    throw new Error('올바른 자물쇠 ID가 필요합니다.');
  }

  const csrfToken = await getCsrfToken();
  const response = await fetchAuthenticatedJson<unknown>(
    `/records/${encodeURIComponent(String(recordId))}`,
    {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'X-XSRF-TOKEN': csrfToken },
    },
  );

  if (!isRecord(response) || typeof response.message !== 'string') {
    throw new Error('자물쇠 삭제 응답 형식이 올바르지 않습니다.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
