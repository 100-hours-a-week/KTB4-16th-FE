import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { ApiError } from '../../../shared/api/apiError';
import { getCsrfToken } from '../../../shared/api/csrf';
import type {
  MemoryRecordCard,
  MemorySearchResult,
  SuggestedMemoryRecordCard,
} from '../model/memorySearch.types';

/** 기억 검색 질문을 전송하고 공개 응답을 해석한다. */
export async function searchMemory(
  conversationId: string,
  query: string,
  request: AuthenticatedApiClient['fetchJson'],
  signal?: AbortSignal,
): Promise<MemorySearchResult> {
  const csrfToken = await getCsrfToken();
  const response = await request<unknown>('/memories/search', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrfToken },
    body: JSON.stringify({ conversationId, query }),
    ...(signal ? { signal } : {}),
  });
  if (!isObject(response) || typeof response.message !== 'string' || !isObject(response.data)) {
    throw invalidResponse();
  }
  return parseMemorySearchResult(response.data);
}

/** 외부 JSON의 검색 결과를 공개 카드 계약에 맞춰 검증한다. */
export function parseMemorySearchResult(value: unknown): MemorySearchResult {
  if (
    !isObject(value) ||
    typeof value.answer !== 'string' ||
    !Array.isArray(value.records) ||
    value.records.length > 50 ||
    !Array.isArray(value.suggestedRecords)
  ) {
    throw invalidResponse();
  }
  return {
    answer: value.answer,
    records: value.records.map(parseCard),
    suggestedRecords: value.suggestedRecords.map(parseSuggestedCard),
  };
}

/** 카드와 제안 카드가 공유하는 DB 필드를 검증한다. */
function parseCard(value: unknown): MemoryRecordCard {
  if (
    !isObject(value) ||
    !isPositiveId(value.recordId) ||
    !isPositiveId(value.musicTrackId) ||
    typeof value.title !== 'string' ||
    typeof value.artistName !== 'string' ||
    !isPositiveId(value.placeId) ||
    !(value.placeName === null || typeof value.placeName === 'string') ||
    typeof value.date !== 'string' ||
    !/^\d{4}\.\d{2}\.\d{2}$/.test(value.date) ||
    !(value.weatherCondition === null || typeof value.weatherCondition === 'string') ||
    typeof value.albumImageUrl !== 'string'
  ) {
    throw invalidResponse();
  }
  return {
    recordId: value.recordId,
    musicTrackId: value.musicTrackId,
    title: value.title,
    artistName: value.artistName,
    placeId: value.placeId,
    placeName: value.placeName,
    date: value.date,
    weatherCondition: value.weatherCondition,
    albumImageUrl: value.albumImageUrl,
  };
}

/** 제안 카드의 일부 일치 조건을 문자열 배열로 검증한다. */
function parseSuggestedCard(value: unknown): SuggestedMemoryRecordCard {
  const card = parseCard(value);
  if (
    !isObject(value) ||
    !Array.isArray(value.matchedConditions) ||
    !value.matchedConditions.every((condition) => typeof condition === 'string')
  ) {
    throw invalidResponse();
  }
  return { ...card, matchedConditions: value.matchedConditions };
}

/** 계약 위반을 일반 AI 호출 실패와 구별할 오류로 바꾼다. */
function invalidResponse(): ApiError {
  return new ApiError(502, '서버 응답 형식을 확인할 수 없습니다.', 'INVALID_RESPONSE');
}

/** 외부 값이 필드 접근 가능한 객체인지 판별한다. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 상세 경로에 사용할 수 있는 양의 정수 ID인지 확인한다. */
function isPositiveId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
