import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import type { RegionRecordsPage } from './getRegionRecords';

/** 친구 대시보드에서 선택한 지역의 cursor 페이지를 조회한다. */
export async function getFriendRegionRecords(
  friendUserId: number,
  legalDongCode: string,
  cursor: string | null,
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
  signal: AbortSignal,
): Promise<RegionRecordsPage> {
  if (!Number.isSafeInteger(friendUserId) || friendUserId <= 0) {
    throw new Error('올바른 친구 ID가 필요합니다.');
  }
  if (!legalDongCode.trim()) throw new Error('자물쇠 지역이 필요합니다.');
  const query = new URLSearchParams({ legalDongCode });
  if (cursor !== null) query.set('cursor', cursor);
  const response = await fetchAuthenticatedJson<unknown>(
    `/users/${encodeURIComponent(String(friendUserId))}/records?${query.toString()}`,
    { signal },
  );
  return parseFriendRegionPage(response);
}

/** 친구 지역 페이지 envelope와 각 자물쇠 필드를 런타임에서 검증한다. */
function parseFriendRegionPage(value: unknown): RegionRecordsPage {
  if (!isRecord(value) || typeof value.message !== 'string' || !isRecord(value.data)) {
    throw new Error('친구 자물쇠 목록 응답 형식이 올바르지 않습니다.');
  }
  const data = value.data;
  if (
    !isNonEmptyString(data.legalDongCode) ||
    !isNullableString(data.legalDongName) ||
    !isNonNegativeInteger(data.recordsCount) ||
    !Array.isArray(data.records) ||
    !isNullableString(data.nextCursor)
  ) {
    throw new Error('친구 자물쇠 목록 응답 형식이 올바르지 않습니다.');
  }
  return {
    legalDongCode: data.legalDongCode,
    legalDongName: data.legalDongName,
    recordsCount: data.recordsCount,
    records: data.records.map((item) => {
      if (
        !isRecord(item) ||
        !isPositiveInteger(item.recordId) ||
        !isPositiveInteger(item.placeId) ||
        !isPositiveInteger(item.musicTrackId) ||
        !isNonEmptyString(item.title) ||
        !isNonEmptyString(item.artistName) ||
        !isOptionalNullableString(item.albumImageUrl) ||
        !isNonEmptyString(item.createdAt)
      ) {
        throw new Error('친구 자물쇠 항목 형식이 올바르지 않습니다.');
      }
      return {
        recordId: item.recordId,
        placeId: item.placeId,
        musicTrackId: item.musicTrackId,
        title: item.title,
        artistName: item.artistName,
        albumImageUrl: item.albumImageUrl ?? null,
        createdAt: item.createdAt,
      };
    }),
    nextCursor: data.nextCursor,
  };
}

/** 외부 응답 값이 객체인지 검사한다. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 자물쇠·장소·음악 ID가 양의 정수인지 검사한다. */
function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/** 해당 지역의 활성 자물쇠 수가 유효한 정수인지 검사한다. */
function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** 표시 문자열이 비어 있지 않은지 검사한다. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** 지역명과 cursor의 nullable 문자열 여부를 검사한다. */
function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/** 전환 호환을 위해 앨범 URL 누락·null·문자열을 허용한다. */
function isOptionalNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || isNonEmptyString(value);
}
