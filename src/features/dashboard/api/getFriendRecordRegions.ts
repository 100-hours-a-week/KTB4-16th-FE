import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import type { RecordRegion } from './getRecordRegions';

export type FriendRecordDashboard = {
  userId: number;
  nickname: string;
  recordsCount: number;
  regions: RecordRegion[];
};

/** 친구의 대시보드 프로필과 지역 요약을 조회하고 현재 경로의 사용자 ID를 확인한다. */
export async function getFriendRecordRegions(
  friendUserId: number,
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
  signal: AbortSignal,
): Promise<FriendRecordDashboard> {
  assertFriendUserId(friendUserId);
  const response = await fetchAuthenticatedJson<unknown>(
    `/users/${encodeURIComponent(String(friendUserId))}/records/regions`,
    { signal },
  );
  if (!isRecord(response) || typeof response.message !== 'string' || !isRecord(response.data)) {
    throw new Error('친구 대시보드 응답 형식이 올바르지 않습니다.');
  }
  const data = response.data;
  if (
    data.userId !== friendUserId ||
    !isNonEmptyString(data.nickname) ||
    !isNonNegativeInteger(data.recordsCount) ||
    !Array.isArray(data.regions)
  ) {
    throw new Error('친구 대시보드 응답 형식이 올바르지 않습니다.');
  }
  const regions = data.regions.map((region) => {
    if (
      !isRecord(region) ||
      !isNonEmptyString(region.legalDongCode) ||
      !isNonEmptyString(region.legalDongName) ||
      !isNonNegativeInteger(region.recordsCount)
    ) {
      throw new Error('친구 대시보드 지역 항목 형식이 올바르지 않습니다.');
    }
    return {
      legalDongCode: region.legalDongCode,
      legalDongName: region.legalDongName,
      recordsCount: region.recordsCount,
    };
  });
  if (regions.reduce((sum, region) => sum + region.recordsCount, 0) !== data.recordsCount) {
    throw new Error('친구 대시보드 자물쇠 합계가 일치하지 않습니다.');
  }
  return { userId: data.userId, nickname: data.nickname, recordsCount: data.recordsCount, regions };
}

/** API 호출 전에 사용자 경로 ID가 유효한 양의 정수인지 확인한다. */
function assertFriendUserId(friendUserId: number): void {
  if (!Number.isSafeInteger(friendUserId) || friendUserId <= 0) {
    throw new Error('올바른 친구 ID가 필요합니다.');
  }
}

/** 외부 응답 값이 객체인지 검사한다. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 사용자명·지역명이 비어 있지 않은 문자열인지 검사한다. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** 자물쇠 합계가 음수가 아닌 정수인지 검사한다. */
function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
