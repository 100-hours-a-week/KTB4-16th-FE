import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';

export type RegionRecord = {
  recordId: number;
  placeId: number;
  musicTrackId: number;
  title: string;
  artistName: string;
  createdAt: string;
};

export type RegionRecordsPage = {
  legalDongCode: string;
  legalDongName: string | null;
  recordsCount: number;
  records: RegionRecord[];
  nextCursor: string | null;
};

type RegionRecordsResponse = {
  message: string;
  data: RegionRecordsPage;
};

/** 선택한 지역의 내 자물쇠를 서버 고정 크기 Cursor 페이지로 조회한다. */
export async function getRegionRecords(
  legalDongCode: string,
  cursor: string | null,
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
  signal: AbortSignal,
): Promise<RegionRecordsPage> {
  const query = new URLSearchParams({ legalDongCode });

  if (cursor !== null) {
    query.set('cursor', cursor);
  }

  const response = await fetchAuthenticatedJson<unknown>(`/records?${query.toString()}`, {
    signal,
  });

  return parseRegionRecordsResponse(response).data;
}

/** 신뢰할 수 없는 지역별 목록 응답을 대시보드 Cursor 계약으로 검증한다. */
function parseRegionRecordsResponse(value: unknown): RegionRecordsResponse {
  if (!isRecord(value) || typeof value.message !== 'string' || !isRecord(value.data)) {
    throw new Error('내 대시보드 자물쇠 목록 응답 형식이 올바르지 않습니다.');
  }

  const { data } = value;
  if (
    !isNonEmptyString(data.legalDongCode) ||
    !isNullableString(data.legalDongName) ||
    !isNonNegativeInteger(data.recordsCount) ||
    !Array.isArray(data.records) ||
    !isNullableString(data.nextCursor)
  ) {
    throw new Error('내 대시보드 자물쇠 목록 페이지 형식이 올바르지 않습니다.');
  }

  return {
    message: value.message,
    data: {
      legalDongCode: data.legalDongCode,
      legalDongName: data.legalDongName,
      recordsCount: data.recordsCount,
      records: data.records.map(parseRegionRecord),
      nextCursor: data.nextCursor,
    },
  };
}

function parseRegionRecord(value: unknown): RegionRecord {
  if (
    !isRecord(value) ||
    !isPositiveInteger(value.recordId) ||
    !isPositiveInteger(value.placeId) ||
    !isPositiveInteger(value.musicTrackId) ||
    !isNonEmptyString(value.title) ||
    !isNonEmptyString(value.artistName) ||
    !isNonEmptyString(value.createdAt)
  ) {
    throw new Error('내 대시보드 자물쇠 항목 형식이 올바르지 않습니다.');
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

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}
