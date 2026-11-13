import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';

export type DailySongDetail = {
  jobId: number;
  recommendationDate: string;
  track: {
    externalTrackId: string;
    title: string;
    artistName: string;
    albumImageUrl: string;
    externalUrl: string;
  };
};

/** 알림의 Job ID로 본인에게 완료된 오늘의 노래 한 곡을 조회한다. */
export async function getDailySongDetail(
  jobId: number,
  request: AuthenticatedApiClient['fetchJson'],
  signal: AbortSignal,
): Promise<DailySongDetail> {
  if (!Number.isSafeInteger(jobId) || jobId <= 0) {
    throw new Error('오늘의 노래 ID가 올바르지 않습니다.');
  }
  const response = await request<unknown>(`/daily-songs/${jobId}`, { signal });
  if (!isRecord(response) || typeof response.message !== 'string' || !isRecord(response.data)) {
    throw new Error('오늘의 노래 응답 형식이 올바르지 않습니다.');
  }
  const { jobId: responseJobId, recommendationDate, track } = response.data;
  if (
    responseJobId !== jobId ||
    typeof recommendationDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(recommendationDate) ||
    !isRecord(track) ||
    !isNonEmptyString(track.externalTrackId) ||
    !isNonEmptyString(track.title) ||
    !isNonEmptyString(track.artistName) ||
    typeof track.albumImageUrl !== 'string' ||
    typeof track.externalUrl !== 'string'
  ) {
    throw new Error('오늘의 노래 응답 형식이 올바르지 않습니다.');
  }
  return {
    jobId,
    recommendationDate,
    track: {
      externalTrackId: track.externalTrackId,
      title: track.title,
      artistName: track.artistName,
      albumImageUrl: track.albumImageUrl,
      externalUrl: track.externalUrl,
    },
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
