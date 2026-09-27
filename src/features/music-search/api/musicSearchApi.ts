import { ApiError } from '../../../shared/api/apiError';
import type { MusicSearchRequest, MusicSearchResult } from '../model/musicSearch.types';

/** 음악 검색 API 응답을 화면에서 사용할 결과 배열로 검증한다. */
function parseMusicSearchResponse(value: unknown): MusicSearchResult[] {
  if (!isRecord(value) || typeof value.message !== 'string' || !Array.isArray(value.data)) {
    throw invalidResponseError();
  }

  return value.data.map((item) => {
    if (
      !isRecord(item) ||
      item.provider !== 'SPOTIFY' ||
      !isNonEmptyString(item.externalTrackId) ||
      !isNonEmptyString(item.title) ||
      !isNonEmptyString(item.artistName) ||
      !isNonEmptyString(item.albumImageUrl) ||
      !isNonEmptyString(item.externalUrl)
    ) {
      throw invalidResponseError();
    }

    return {
      provider: 'SPOTIFY',
      externalTrackId: item.externalTrackId,
      title: item.title,
      artistName: item.artistName,
      albumImageUrl: item.albumImageUrl,
      externalUrl: item.externalUrl,
    };
  });
}

/** 신뢰할 수 없는 외부 값이 키-값 객체인지 확인한다. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 음악 정보에 필요한 문자열이 빈값 없이 존재하는지 확인한다. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** 형식이 잘못된 외부 응답을 공통 API 오류로 바꾼다. */
function invalidResponseError(): ApiError {
  return new ApiError(502, '서버 응답 형식을 확인할 수 없습니다.', 'INVALID_RESPONSE');
}

/** 검색어 길이 계약을 요청 전 검증해 불필요한 보호 API 호출을 막는다. */
function normalizeQuery(query: string): string {
  const normalizedQuery = query.trim();

  if (normalizedQuery.length < 2 || normalizedQuery.length > 255) {
    throw new ApiError(400, '검색어는 2~255자로 입력해 주세요.', 'INVALID_SEARCH_QUERY');
  }

  return normalizedQuery;
}

/** 정규화한 검색어를 q query parameter로 보내고 검증된 음악 결과를 반환한다. */
export async function searchMusic(
  request: MusicSearchRequest,
  query: string,
): Promise<MusicSearchResult[]> {
  const params = new URLSearchParams({ q: normalizeQuery(query) });
  const response = await request<unknown>(`/music/search?${params.toString()}`);

  return parseMusicSearchResponse(response);
}
