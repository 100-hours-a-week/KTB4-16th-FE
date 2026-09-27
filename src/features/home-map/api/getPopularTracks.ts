import { getCsrfToken } from '../../../shared/api/csrf';
import { fetchJson } from '../../../shared/api/fetchJson';

export type PopularTrack = {
  rank: number;
  musicTrackId: number;
  title: string;
  artistName: string;
  count: number;
};

export type PopularTracksResult = {
  recordCount: number;
  music: PopularTrack[];
};

type PopularTracksResponse = {
  message: string;
  data: PopularTracksResult;
};

/** 선택한 인기 Place들의 최근 7일 음악 집계를 public API로 조회한다. */
export async function getPopularTracks(
  placeIds: number[],
  signal: AbortSignal,
): Promise<PopularTracksResult> {
  if (placeIds.length === 0 || placeIds.some((placeId) => !isPositiveInteger(placeId))) {
    throw new Error('하나 이상의 올바른 장소 ID가 필요합니다.');
  }

  const csrfToken = await getCsrfToken();
  const response = await fetchJson<unknown>('/places/popular-tracks/search', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': csrfToken,
    },
    body: JSON.stringify({ placeIds }),
    signal,
  });

  return parsePopularTracksResponse(response).data;
}

/** 신뢰할 수 없는 인기 음악 집계 응답을 화면용 계약으로 검증한다. */
function parsePopularTracksResponse(value: unknown): PopularTracksResponse {
  if (
    !isRecord(value) ||
    typeof value.message !== 'string' ||
    !isRecord(value.data) ||
    !isNonNegativeInteger(value.data.recordCount) ||
    !Array.isArray(value.data.music)
  ) {
    throw new Error('인기 음악 응답 형식이 올바르지 않습니다.');
  }

  return {
    message: value.message,
    data: {
      recordCount: value.data.recordCount,
      music: value.data.music.map((track) => parsePopularTrack(track)),
    },
  };
}

/** 인기 음악 항목의 순위·표시 텍스트·집계 횟수를 검증한다. */
function parsePopularTrack(value: unknown): PopularTrack {
  if (
    !isRecord(value) ||
    !isPositiveInteger(value.rank) ||
    !isPositiveInteger(value.musicTrackId) ||
    !isNonEmptyString(value.title) ||
    !isNonEmptyString(value.artistName) ||
    !isNonNegativeInteger(value.count)
  ) {
    throw new Error('인기 음악 항목 형식이 올바르지 않습니다.');
  }

  return {
    rank: value.rank,
    musicTrackId: value.musicTrackId,
    title: value.title,
    artistName: value.artistName,
    count: value.count,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
