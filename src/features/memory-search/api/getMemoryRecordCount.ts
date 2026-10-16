import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { ApiError } from '../../../shared/api/apiError';

/** 현재 사용자의 전체 활성 자물쇠 수를 지역 그룹 조회 결과에서 계산한다. */
export async function getMemoryRecordCount(
  request: AuthenticatedApiClient['fetchJson'],
  signal: AbortSignal,
): Promise<number> {
  const response = await request<unknown>('/records/regions', { signal });
  if (
    !isObject(response) ||
    typeof response.message !== 'string' ||
    !Array.isArray(response.data)
  ) {
    throw invalidResponse();
  }

  return response.data.reduce<number>((total, group: unknown) => {
    if (
      !isObject(group) ||
      !Number.isSafeInteger(group.recordsCount) ||
      typeof group.recordsCount !== 'number' ||
      group.recordsCount < 0
    ) {
      throw invalidResponse();
    }
    return total + group.recordsCount;
  }, 0);
}

/** 지역 그룹 응답이 예상 계약을 벗어나면 조회 실패로 전환한다. */
function invalidResponse(): ApiError {
  return new ApiError(502, '자물쇠 보유 여부를 확인할 수 없습니다.', 'INVALID_RESPONSE');
}

/** 외부 값이 필드 접근 가능한 객체인지 판별한다. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
