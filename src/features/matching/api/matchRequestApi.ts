import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { ApiError } from '../../../shared/api/apiError';
import { getCsrfToken } from '../../../shared/api/csrf';

type MatchRequest = AuthenticatedApiClient['fetchJson'];

export type MatchRequestStatus = 'WAITING' | 'MATCHING' | 'MATCHED' | 'EXPIRED' | 'FAILED';

export interface CreatedMatchRequest {
  matchRequestId: number;
  status: Extract<MatchRequestStatus, 'WAITING' | 'MATCHING'>;
}

export interface MatchRequestState {
  matchRequestId: number;
  status: MatchRequestStatus;
  chatRoomId: number | null;
}

/** 투표 답변으로 한 번의 매칭 요청을 생성하고 서버가 부여한 상태를 반환한다. */
export async function createMatchRequest(
  request: MatchRequest,
  voteAnswerId: number,
): Promise<CreatedMatchRequest> {
  const csrfToken = await getCsrfToken();
  const response = await request<unknown>('/match-requests', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrfToken },
    body: JSON.stringify({ voteAnswerId }),
  });
  const data = getData(response);
  if (!isPositiveInteger(data.matchRequestId) || !isPendingStatus(data.status)) {
    throw invalidResponseError();
  }
  return { matchRequestId: data.matchRequestId, status: data.status };
}

/** 현재 로그인 사용자가 소유한 매칭 요청의 최신 상태를 조회한다. */
export async function getMatchRequestState(
  request: MatchRequest,
  matchRequestId: number,
): Promise<MatchRequestState> {
  const response = await request<unknown>(`/match-requests/${matchRequestId}`);
  return parseMatchRequestState(response);
}

/** 현재 사용자의 투표 답변으로 기존 매칭 요청을 복원한다. */
export async function getMatchRequestByVoteAnswer(
  request: MatchRequest,
  voteAnswerId: number,
): Promise<MatchRequestState> {
  const response = await request<unknown>(`/match-requests/by-vote-answer/${voteAnswerId}`);
  return parseMatchRequestState(response);
}

/** 매칭 요청 조회 응답을 공통 계약으로 검증한다. */
function parseMatchRequestState(response: unknown): MatchRequestState {
  const data = getData(response);
  if (
    !isPositiveInteger(data.matchRequestId) ||
    !isMatchRequestStatus(data.status) ||
    !isNullablePositiveInteger(data.chatRoomId) ||
    (data.status === 'MATCHED' && data.chatRoomId === null) ||
    (data.status !== 'MATCHED' && data.chatRoomId !== null)
  ) {
    throw invalidResponseError();
  }
  return {
    matchRequestId: data.matchRequestId,
    status: data.status,
    chatRoomId: data.chatRoomId,
  };
}

/** API 공통 응답의 data 객체만 안전하게 꺼낸다. */
function getData(value: unknown): Record<string, unknown> {
  if (!isRecord(value) || !isRecord(value.data)) throw invalidResponseError();
  return value.data;
}

/** 예상과 다른 성공 응답을 화면 오류로 일관되게 전달한다. */
function invalidResponseError(): ApiError {
  return new ApiError(502, '서버 응답 형식을 확인할 수 없습니다.', 'INVALID_RESPONSE');
}

/** 외부 JSON 값이 필드 접근 가능한 객체인지 확인한다. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** API 식별자는 JavaScript에서 정밀도를 보존할 수 있는 양의 정수여야 한다. */
function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/** chatRoomId는 MATCHED가 아닐 때만 null일 수 있다. */
function isNullablePositiveInteger(value: unknown): value is number | null {
  return value === null || isPositiveInteger(value);
}

/** 생성 응답은 아직 대기 또는 채팅방 준비 단계만 반환한다. */
function isPendingStatus(value: unknown): value is CreatedMatchRequest['status'] {
  return value === 'WAITING' || value === 'MATCHING';
}

/** 조회 응답의 서버 상태 enum을 계약에 따라 제한한다. */
function isMatchRequestStatus(value: unknown): value is MatchRequestStatus {
  return (
    value === 'WAITING' ||
    value === 'MATCHING' ||
    value === 'MATCHED' ||
    value === 'EXPIRED' ||
    value === 'FAILED'
  );
}
