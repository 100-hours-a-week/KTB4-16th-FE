import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { getCsrfToken } from '../../../shared/api/csrf';

type RecordCommentUpdateResponse = {
  recordId: number;
  comment: string | null;
};

/** 로그인 사용자가 소유한 자물쇠의 코멘트를 수정하고 서버에 저장된 값을 반환한다. */
export async function updateRecordComment(
  recordId: number,
  comment: string | null,
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
): Promise<string | null> {
  if (!Number.isSafeInteger(recordId) || recordId <= 0) {
    throw new Error('올바른 자물쇠 ID가 필요합니다.');
  }

  const csrfToken = await getCsrfToken();
  const response = await fetchAuthenticatedJson<unknown>(
    `/records/${encodeURIComponent(String(recordId))}/comment`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrfToken },
      body: JSON.stringify({ comment }),
    },
  );

  const data = parseRecordCommentUpdateResponse(response);
  if (data.recordId !== recordId) {
    throw new Error('코멘트 수정 응답의 자물쇠 ID가 일치하지 않습니다.');
  }

  return data.comment;
}

/** 신뢰할 수 없는 코멘트 수정 응답을 BE 계약으로 검증한다. */
function parseRecordCommentUpdateResponse(value: unknown): RecordCommentUpdateResponse {
  if (!isRecord(value) || typeof value.message !== 'string' || !isRecord(value.data)) {
    throw new Error('코멘트 수정 응답 형식이 올바르지 않습니다.');
  }

  const { data } = value;
  if (!isPositiveInteger(data.recordId) || !isNullableComment(data.comment)) {
    throw new Error('코멘트 수정 데이터 형식이 올바르지 않습니다.');
  }

  return { recordId: data.recordId, comment: data.comment };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isNullableComment(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && value.length <= 80);
}
