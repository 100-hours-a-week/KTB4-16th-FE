import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { getCsrfToken } from '../../../shared/api/csrf';

export type MyPlaceRecord = {
  recordId: number;
  placeId: number;
  musicTrackId: number;
  title: string;
  artistName: string;
  createdAt: string;
};

export type MyPlaceRecordsPage = {
  records: MyPlaceRecord[];
  nextCursor: string | null;
};

type MyPlaceRecordsResponse = {
  message: string;
  data: MyPlaceRecordsPage;
};

/** 선택한 Place들의 내 자물쇠를 최신순 Cursor 페이지로 조회한다. */
export async function getMyPlaceRecords(
  placeIds: number[],
  cursor: string | null,
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
  signal: AbortSignal,
): Promise<MyPlaceRecordsPage> {
  const csrfToken = await getCsrfToken();
  const body = cursor === null ? { placeIds } : { placeIds, cursor };
  const response = await fetchAuthenticatedJson<unknown>('/users/me/records/search', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': csrfToken,
    },
    body: JSON.stringify(body),
    signal,
  });

  return parseMyPlaceRecordsResponse(response).data;
}

/** 신뢰할 수 없는 HTTP 응답을 내 자물쇠 목록 Cursor 페이지 계약으로 검증한다. */
function parseMyPlaceRecordsResponse(value: unknown): MyPlaceRecordsResponse {
  if (!isRecord(value) || typeof value.message !== 'string' || !isRecord(value.data)) {
    throw new Error('내 자물쇠 목록 응답 형식이 올바르지 않습니다.');
  }

  if (!Array.isArray(value.data.records) || !isNullableString(value.data.nextCursor)) {
    throw new Error('내 자물쇠 목록 페이지 형식이 올바르지 않습니다.');
  }

  return {
    message: value.message,
    data: {
      records: value.data.records.map((record) => parseMyPlaceRecord(record)),
      nextCursor: value.data.nextCursor,
    },
  };
}

/** 목록에 표시할 Record·Music DTO 필드를 검증한다. */
function parseMyPlaceRecord(value: unknown): MyPlaceRecord {
  if (
    !isRecord(value) ||
    !isFiniteNumber(value.recordId) ||
    !isFiniteNumber(value.placeId) ||
    !isFiniteNumber(value.musicTrackId) ||
    !isNonEmptyString(value.title) ||
    !isNonEmptyString(value.artistName) ||
    !isNonEmptyString(value.createdAt)
  ) {
    throw new Error('내 자물쇠 목록 항목 형식이 올바르지 않습니다.');
  }

  return {
    recordId: value.recordId,
    placeId: value.placeId,
    musicTrackId: value.musicTrackId,
    title: value.title,
    artistName: value.artistName,
    createdAt: value.createdAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}
