import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { ApiError } from '../../../shared/api/apiError';
import type {
  MonthlyPhotoScene,
  MonthlyReportAiRecap,
  MonthlyReportDetail,
  MonthlyReportStats,
  MonthlyReportSummary,
  MonthlyReportTopPlace,
} from '../model/monthlyReport.types';

/** 로그인한 사용자의 생성된 월별 리포트 목록을 조회하고 응답 계약을 검증한다. */
export async function getMonthlyReports(
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
  signal?: AbortSignal,
): Promise<MonthlyReportSummary[]> {
  const response = await fetchAuthenticatedJson<unknown>('/monthly-reports', { signal });
  return parseMonthlyReportsResponse(response);
}

/** 지정한 월별 리포트 ID의 저장된 상세 스냅샷을 조회하고 응답 계약을 검증한다. */
export async function getMonthlyReportDetail(
  monthlyReportId: number,
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
  signal?: AbortSignal,
): Promise<MonthlyReportDetail> {
  if (!isPositiveInteger(monthlyReportId)) {
    throw new ApiError(400, '올바른 월간 리포트 ID를 입력해 주세요.', 'INVALID_MONTHLY_REPORT_ID');
  }

  const response = await fetchAuthenticatedJson<unknown>(
    `/monthly-reports/${encodeURIComponent(String(monthlyReportId))}`,
    { signal },
  );
  return parseMonthlyReportDetailResponse(response);
}

/** 목록 API의 신뢰할 수 없는 JSON을 화면이 사용할 요약 배열로 좁힌다. */
function parseMonthlyReportsResponse(value: unknown): MonthlyReportSummary[] {
  if (!isRecord(value) || typeof value.message !== 'string' || !isRecord(value.data)) {
    throw invalidResponse();
  }

  const { reports } = value.data;
  if (!Array.isArray(reports)) {
    throw invalidResponse();
  }

  return reports.map(parseMonthlyReportSummary);
}

/** 목록의 개별 월 리포트가 필수 식별자와 집계 값을 가졌는지 검증한다. */
function parseMonthlyReportSummary(value: unknown): MonthlyReportSummary {
  if (
    !isRecord(value) ||
    !isPositiveInteger(value.monthlyReportId) ||
    !isYear(value.year) ||
    !isMonth(value.month) ||
    !isNonNegativeInteger(value.recordCount) ||
    !isNonEmptyString(value.aiRecapStatus)
  ) {
    throw invalidResponse();
  }

  return {
    monthlyReportId: value.monthlyReportId,
    year: value.year,
    month: value.month,
    recordCount: value.recordCount,
    aiRecapStatus: value.aiRecapStatus,
  };
}

/** 상세 API의 신뢰할 수 없는 JSON을 리포트 화면 전용 상세 계약으로 좁힌다. */
function parseMonthlyReportDetailResponse(value: unknown): MonthlyReportDetail {
  if (!isRecord(value) || typeof value.message !== 'string' || !isRecord(value.data)) {
    throw invalidResponse();
  }

  const data = value.data;
  if (
    !isPositiveInteger(data.monthlyReportId) ||
    !isYear(data.year) ||
    !isMonth(data.month) ||
    !isRecord(data.stats) ||
    !Array.isArray(data.photoScenes) ||
    !isRecord(data.aiRecap)
  ) {
    throw invalidResponse();
  }

  return {
    monthlyReportId: data.monthlyReportId,
    year: data.year,
    month: data.month,
    stats: parseMonthlyReportStats(data.stats),
    photoScenes: data.photoScenes.map(parseMonthlyPhotoScene),
    aiRecap: parseMonthlyReportAiRecap(data.aiRecap),
  };
}

/** 상세 리포트의 선택 통계를 null 보존 규칙으로 검증한다. */
function parseMonthlyReportStats(value: Record<string, unknown>): MonthlyReportStats {
  if (
    !isNonNegativeInteger(value.recordCount) ||
    !isNullableRecord(value.topPlace) ||
    !isNullableString(value.topArtistName) ||
    !isNullableFiniteNumber(value.averageMoodScore)
  ) {
    throw invalidResponse();
  }

  return {
    recordCount: value.recordCount,
    topPlace: value.topPlace === null ? null : parseMonthlyReportTopPlace(value.topPlace),
    topArtistName: value.topArtistName,
    averageMoodScore: value.averageMoodScore,
  };
}

/** 대표 장소가 존재할 때 장소 ID와 표시 가능한 행정동을 검증한다. */
function parseMonthlyReportTopPlace(value: Record<string, unknown>): MonthlyReportTopPlace {
  if (!isPositiveInteger(value.placeId) || !isNullableString(value.legalDongName)) {
    throw invalidResponse();
  }

  return { placeId: value.placeId, legalDongName: value.legalDongName };
}

/** 사진 장면 집계의 태그·개수·백분율 값을 검증한다. */
function parseMonthlyPhotoScene(value: unknown): MonthlyPhotoScene {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.sceneTag) ||
    !isNonNegativeInteger(value.count) ||
    !isPercentage(value.ratio)
  ) {
    throw invalidResponse();
  }

  return { sceneTag: value.sceneTag, count: value.count, ratio: value.ratio };
}

/** AI 회고의 상태와 아직 완료되지 않은 null 텍스트를 함께 검증한다. */
function parseMonthlyReportAiRecap(value: Record<string, unknown>): MonthlyReportAiRecap {
  if (!isNonEmptyString(value.status) || !isNullableString(value.text)) {
    throw invalidResponse();
  }

  return { status: value.status, text: value.text };
}

/** 외부 API 응답이 객체인지 판별해 안전한 필드 접근을 보장한다. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** null 또는 객체만 허용하는 선택 객체 필드를 판별한다. */
function isNullableRecord(value: unknown): value is Record<string, unknown> | null {
  return value === null || isRecord(value);
}

/** 양의 안전 정수 ID를 판별한다. */
function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/** 0 이상인 안전 정수 집계 값을 판별한다. */
function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** 리포트가 생성 가능한 연도 정수인지 판별한다. */
function isYear(value: unknown): value is number {
  return isPositiveInteger(value);
}

/** 1월부터 12월 사이의 월 정수인지 판별한다. */
function isMonth(value: unknown): value is number {
  return isPositiveInteger(value) && value <= 12;
}

/** 비어 있지 않은 문자열인지 판별한다. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** null 또는 문자열인 선택 텍스트 필드를 판별한다. */
function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/** null 또는 유한한 숫자인 선택 통계 값을 판별한다. */
function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

/** 0에서 100 사이의 정수 비율인지 판별한다. */
function isPercentage(value: unknown): value is number {
  return isNonNegativeInteger(value) && value <= 100;
}

/** 계약과 다른 서버 응답을 공통 API 오류로 변환한다. */
function invalidResponse(): ApiError {
  return new ApiError(502, '서버 응답 형식을 확인할 수 없습니다.', 'INVALID_RESPONSE');
}
