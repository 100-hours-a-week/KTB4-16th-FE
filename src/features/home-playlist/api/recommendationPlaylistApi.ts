import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { ApiError } from '../../../shared/api/apiError';
import { getCsrfToken } from '../../../shared/api/csrf';
import type {
  RecommendationCoordinates,
  RecommendationPlaylist,
  RecommendationPlaylistRequest,
  RecommendationTrack,
} from '../model/recommendationPlaylist.types';

const REQUIRED_RECOMMENDATION_TRACK_COUNT = 5;

/** 확인된 위치와 CSRF 토큰으로 새 추천을 생성하고 반환 계약을 검증한다. */
export async function createRecommendationPlaylist(
  request: RecommendationPlaylistRequest,
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
  signal?: AbortSignal,
): Promise<RecommendationPlaylist> {
  if (!isCoordinates(request)) {
    throw new ApiError(400, '현재 위치 정보를 확인할 수 없습니다.', 'INVALID_COORDINATES');
  }

  const csrfToken = await getCsrfToken();
  const response = await fetchAuthenticatedJson<unknown>('/recommendations/playlists', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrfToken },
    body: JSON.stringify(request),
    signal,
  });
  if (
    !isRecord(response) ||
    !isRecord(response.data) ||
    typeof response.data.replaced !== 'boolean'
  ) {
    throw invalidResponse();
  }
  // 새 추천이 아닌 degraded 응답은 기존 화면 목록·이유를 유지하고 횟수를 차감하지 않는다.
  if (!response.data.replaced) {
    throw new ApiError(
      503,
      '새 추천을 만들지 못했습니다. 다시 시도해 주세요.',
      'RECOMMENDATION_NOT_CREATED',
    );
  }
  const playlist = parseRecommendationPlaylistResponse(response);

  if (playlist.tracks.some((track) => request.excludeTrackIds.includes(track.externalTrackId))) {
    throw invalidResponse();
  }
  return playlist;
}

/** 생성 응답을 현재 화면에서 사용할 곡·평가 ID·추천 이유로 검증한다. */
function parseRecommendationPlaylistResponse(value: unknown): RecommendationPlaylist {
  if (!isRecord(value) || typeof value.message !== 'string' || !isRecord(value.data)) {
    throw invalidResponse();
  }

  const { playlist } = value.data;
  if (!isRecord(playlist)) {
    throw invalidResponse();
  }

  const recommendationId = parseRecommendationId(value.recommendationId);
  return parseRecommendationPlaylist(
    playlist,
    recommendationId,
    parseRecommendReason(value.recommendReason),
  );
}

/** 저장용 플레이리스트 ID 없이 정확히 다섯 곡과 독립적인 평가 정보를 반환한다. */
function parseRecommendationPlaylist(
  value: Record<string, unknown>,
  recommendationId: number | null,
  recommendReason: string | null,
): RecommendationPlaylist {
  if (!Array.isArray(value.tracks) || value.tracks.length !== REQUIRED_RECOMMENDATION_TRACK_COUNT) {
    throw invalidResponse();
  }

  const tracks = value.tracks.map(parseRecommendationTrack);
  if (new Set(tracks.map((track) => track.externalTrackId)).size !== tracks.length) {
    throw invalidResponse();
  }
  return {
    recommendReason,
    ...(recommendationId === null ? {} : { recommendationId }),
    tracks,
  };
}

/** 선택적인 평가 결과 ID를 검증하고 누락은 null로 처리한다. */
function parseRecommendationId(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (isPositiveInteger(value)) return value;
  throw invalidResponse();
}

/** AI 문구를 가공하지 않고 보존하며 누락만 null로 통일한다. */
function parseRecommendReason(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  throw invalidResponse();
}

/** 추천 음악의 식별자·표시 문자열·앨범 이미지 URL·외부 링크 문자열을 검증한다. */
function parseRecommendationTrack(value: unknown): RecommendationTrack {
  if (
    !isRecord(value) ||
    !isPositiveInteger(value.musicTrackId) ||
    !isNonEmptyString(value.externalTrackId) ||
    !isNonEmptyString(value.title) ||
    !isNonEmptyString(value.artistName) ||
    !isNonEmptyString(value.albumImageUrl) ||
    !isNonEmptyString(value.externalUrl)
  ) {
    throw invalidResponse();
  }

  return {
    musicTrackId: value.musicTrackId,
    externalTrackId: value.externalTrackId,
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
