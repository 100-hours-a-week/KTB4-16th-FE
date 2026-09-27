import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { getCsrfToken } from '../../../shared/api/csrf';

/** 사진 한 장을 임시 업로드하고 최종 생성에 사용할 uploadId를 반환한다. */
export async function uploadPhoto(
  photo: File,
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
): Promise<number> {
  const csrfToken = await getCsrfToken();
  const formData = new FormData();
  formData.append('photo', photo);
  const value = await fetchAuthenticatedJson<unknown>('/uploads', {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-XSRF-TOKEN': csrfToken },
    body: formData,
  });
  if (!isRecord(value) || !isRecord(value.data) || !isPositiveNumber(value.data.uploadId)) {
    throw new Error('사진 업로드 응답 형식이 올바르지 않습니다.');
  }
  return value.data.uploadId;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
