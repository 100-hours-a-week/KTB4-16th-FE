import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { getCsrfToken } from '../../../shared/api/csrf';
import type { RecordCreatePayload } from '../model/recordCreate.types';

/** 확정된 위치·사진·음악 입력을 하나의 자물쇠 Record로 생성한다. */
export async function createRecord(
  payload: RecordCreatePayload,
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
): Promise<number> {
  const csrfToken = await getCsrfToken();
  const value = await fetchAuthenticatedJson<unknown>('/records', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrfToken },
    body: JSON.stringify(payload),
  });
  if (!isRecord(value) || !isRecord(value.data) || !isPositiveNumber(value.data.recordId))
    throw new Error('자물쇠 생성 응답 형식이 올바르지 않습니다.');
  return value.data.recordId;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
