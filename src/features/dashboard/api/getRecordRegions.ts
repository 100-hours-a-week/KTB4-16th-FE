import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';

export type RecordRegion = {
  legalDongCode: string;
  legalDongName: string;
  recordsCount: number;
};

type RecordRegionsResponse = {
  message: string;
  data: RecordRegion[];
};

/** 현재 사용자의 활성 자물쇠를 법정동별 목록으로 조회한다. */
export async function getRecordRegions(
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
  signal: AbortSignal,
): Promise<RecordRegion[]> {
  const response = await fetchAuthenticatedJson<unknown>('/records/regions', { signal });

  return parseRecordRegionsResponse(response).data;
}

/** 신뢰할 수 없는 지역 목록 응답을 대시보드 계약으로 검증한다. */
function parseRecordRegionsResponse(value: unknown): RecordRegionsResponse {
  if (!isRecord(value) || typeof value.message !== 'string' || !Array.isArray(value.data)) {
    throw new Error('내 대시보드 지역 목록 응답 형식이 올바르지 않습니다.');
  }

  return {
    message: value.message,
    data: value.data.map(parseRecordRegion),
  };
}

function parseRecordRegion(value: unknown): RecordRegion {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.legalDongCode) ||
    !isNonEmptyString(value.legalDongName) ||
    !isNonNegativeInteger(value.recordsCount)
  ) {
    throw new Error('내 대시보드 지역 항목 형식이 올바르지 않습니다.');
  }

  return {
    legalDongCode: value.legalDongCode,
    legalDongName: value.legalDongName,
    recordsCount: value.recordsCount,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
