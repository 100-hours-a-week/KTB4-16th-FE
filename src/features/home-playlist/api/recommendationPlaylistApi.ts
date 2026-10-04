import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { ApiError } from '../../../shared/api/apiError';
import { getCsrfToken } from '../../../shared/api/csrf';
import type {
  RecommendationCoordinates,
  RecommendationPlaylist,
  RecommendationTrack,
} from '../model/recommendationPlaylist.types';

const REQUIRED_RECOMMENDATION_TRACK_COUNT = 5;

/** 로그인 사용자의 저장된 현재 추천 플레이리스트를 조회하고 계약을 검증한다. */
export async function getRecommendationPlaylist(
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
  signal?: AbortSignal,
): Promise<RecommendationPlaylist | null> {
  const response = await fetchAuthenticatedJson<unknown>('/recommendations/playlists', { signal });
  return parseRecommendationPlaylistResponse(response);
}

/** 확인된 위치와 CSRF 토큰으로 새 추천을 생성하고 반환 계약을 검증한다. */
export async function createRecommendationPlaylist(
  coordinates: RecommendationCoordinates,
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
  signal?: AbortSignal,
): Promise<RecommendationPlaylist> {
  if (!isCoordinates(coordinates)) {
    throw new ApiError(400, '현재 위치 정보를 확인할 수 없습니다.', 'INVALID_COORDINATES');
  }

  const csrfToken = await getCsrfToken();
  const response = await fetchAuthenticatedJson<unknown>('/recommendations/playlists', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrfToken },
    body: JSON.stringify(coordinates),
    signal,
  });
  const playlist = parseRecommendationPlaylistResponse(response);

  if (playlist === null) {
    throw invalidResponse();
  }

  return playlist;
}

/** 조회·생성 API의 신뢰할 수 없는 JSON을 현재 플레이리스트 또는 null로 좁힌다. */
function parseRecommendationPlaylistResponse(value: unknown): RecommendationPlaylist | null {
  if (!isRecord(value) || typeof value.message !== 'string' || !isRecord(value.data)) {
    throw invalidResponse();
  }

  const { playlist } = value.data;
  if (playlist === null) {
    return null;
  }
  if (!isRecord(playlist)) {
    throw invalidResponse();
  }

  return parseRecommendationPlaylist(playlist);
}

/** 플레이리스트 ID와 트랙 배열이 화면 계약을 만족하는지 검증한다. */
function parseRecommendationPlaylist(value: Record<string, unknown>): RecommendationPlaylist {
  if (
    !isPositiveInteger(value.recommendationPlaylistId) ||
    !Array.isArray(value.tracks) ||
    value.tracks.length !== REQUIRED_RECOMMENDATION_TRACK_COUNT
  ) {
    throw invalidResponse();
  }

  return {
    recommendationPlaylistId: value.recommendationPlaylistId,
    tracks: value.tracks.map(parseRecommendationTrack),
  };
}

/** 추천 음악의 식별자·표시 문자열·앨범 이미지 URL·외부 링크 문자열을 검증한다. */
function parseRecommendationTrack(value: unknown): RecommendationTrack {
  if (
    !isRecord(value) ||
    !isPositiveInteger(value.musicTrackId) ||
    !isNonEmptyString(value.title) ||
    !isNonEmptyString(value.artistName) ||
    !isNonEmptyString(value.albumImageUrl) ||
    !isNonEmptyString(value.externalUrl)
  ) {
    throw invalidResponse();
  }

  return {
    musicTrackId: value.musicTrackId,
    title: value.title,
    artistName: value.artistName,
    albumImageUrl: value.albumImageUrl,
    externalUrl: value.externalUrl,
  };
}

/** 위도·경도가 공개 API의 유효 범위 안에 있는지 확인한다. */
function isCoordinates(value: RecommendationCoordinates): boolean {
  return (
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    value.longitude >= -180 &&
    value.longitude <= 180
  );
}

/** 외부 JSON 값이 안전하게 필드를 읽을 수 있는 객체인지 판별한다. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 양의 안전 정수 식별자인지 판별한다. */
function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/** 공백만 있는 값을 제외한 문자열인지 판별한다. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** 계약과 다른 추천 API 응답을 공통 오류로 전환한다. */
function invalidResponse(): ApiError {
  return new ApiError(502, '서버 응답 형식을 확인할 수 없습니다.', 'INVALID_RESPONSE');
}
