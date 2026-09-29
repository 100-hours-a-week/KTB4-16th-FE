import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';

/** 현재 사용자의 임시 업로드 사진을 표시할 Signed URL을 조회한다. */
export async function getUploadSignedUrl(
  uploadId: number,
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
): Promise<string> {
  if (!Number.isSafeInteger(uploadId) || uploadId <= 0) {
    throw new Error('유효한 사진 업로드 정보가 필요합니다.');
  }

  const response = await fetchAuthenticatedJson<unknown>(`/uploads/${uploadId}/signed-url`);
  if (
    !isRecord(response) ||
    !isRecord(response.data) ||
    !isNonEmptyString(response.data.signedUrl)
  ) {
    throw new Error('사진 미리보기 URL 응답 형식이 올바르지 않습니다.');
  }

  return response.data.signedUrl;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
