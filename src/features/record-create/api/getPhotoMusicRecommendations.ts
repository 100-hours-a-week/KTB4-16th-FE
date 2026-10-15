import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { getCsrfToken } from '../../../shared/api/csrf';

export type PhotoMusicRecommendation = {
  externalTrackId: string;
  title: string;
  artistName: string;
  albumImageUrl: string;
  externalUrl: string;
};

type PhotoMusicRecommendationsResponse = {
  message: string;
  data: PhotoMusicRecommendation[];
};

const REQUIRED_PHOTO_RECOMMENDATION_COUNT = 5;

/** 업로드된 사진에 대한 정확히 다섯 곡의 추천 응답만 성공으로 처리한다. */
export async function getPhotoMusicRecommendations(
  uploadId: number,
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
  signal?: AbortSignal,
): Promise<PhotoMusicRecommendation[]> {
  if (!Number.isSafeInteger(uploadId) || uploadId <= 0) {
    throw new Error('유효한 사진 업로드 정보가 필요합니다.');
  }

  const csrfToken = await getCsrfToken();
  const response = await fetchAuthenticatedJson<unknown>('/recommendations/photo', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrfToken },
    body: JSON.stringify({ uploadId }),
    signal,
  });

  return parsePhotoMusicRecommendationsResponse(response).data;
}

/** 신뢰할 수 없는 사진 추천 응답을 작성 화면에서 사용할 음악 목록으로 검증한다. */
function parsePhotoMusicRecommendationsResponse(value: unknown): PhotoMusicRecommendationsResponse {
  if (!isRecord(value) || typeof value.message !== 'string' || !Array.isArray(value.data)) {
    throw new Error('음악 추천 응답 형식이 올바르지 않습니다.');
  }
  if (value.data.length !== REQUIRED_PHOTO_RECOMMENDATION_COUNT) {
    throw new Error('음악 추천 응답 형식이 올바르지 않습니다.');
  }

  return { message: value.message, data: value.data.map(parsePhotoMusicRecommendation) };
}

function parsePhotoMusicRecommendation(value: unknown): PhotoMusicRecommendation {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.externalTrackId) ||
    !isNonEmptyString(value.title) ||
    !isNonEmptyString(value.artistName) ||
    !isNonEmptyString(value.albumImageUrl) ||
    !isNonEmptyString(value.externalUrl)
  ) {
    throw new Error('음악 추천 항목 형식이 올바르지 않습니다.');
  }

  return {
    externalTrackId: value.externalTrackId,
    title: value.title,
    artistName: value.artistName,
    albumImageUrl: value.albumImageUrl,
    externalUrl: value.externalUrl,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
