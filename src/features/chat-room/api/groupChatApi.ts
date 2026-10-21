import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { ApiError } from '../../../shared/api/apiError';
import { getCsrfToken } from '../../../shared/api/csrf';

type GroupChatRequest = AuthenticatedApiClient['fetchJson'];

export interface GroupChatJoinResult {
  chatRoomId: number;
  roomSequence: number;
  newlyAssigned: boolean;
  admittedParticipantCount: number;
  activeParticipantCount: number;
  expiresAt: string;
}

/** 서버 feature flag가 허용한 경우에만 투표 답변을 그룹 채팅방에 배정한다. */
export async function joinGroupChat(
  request: GroupChatRequest,
  voteAnswerId: number,
): Promise<GroupChatJoinResult> {
  const csrfToken = await getCsrfToken();
  const response = await request<unknown>('/group-chat-rooms/join', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrfToken },
    body: JSON.stringify({ voteAnswerId }),
  });
  const data = getData(response);
  if (
    !isPositiveInteger(data.chatRoomId) ||
    !isPositiveInteger(data.roomSequence) ||
    typeof data.newlyAssigned !== 'boolean' ||
    !isPositiveInteger(data.admittedParticipantCount) ||
    !isNonNegativeInteger(data.activeParticipantCount) ||
    data.activeParticipantCount > data.admittedParticipantCount ||
    !isDateTime(data.expiresAt)
  ) {
    throw invalidResponseError();
  }
  return {
    chatRoomId: data.chatRoomId,
    roomSequence: data.roomSequence,
    newlyAssigned: data.newlyAssigned,
    admittedParticipantCount: data.admittedParticipantCount,
    activeParticipantCount: data.activeParticipantCount,
    expiresAt: data.expiresAt,
  };
}

/** 그룹 채팅의 활성 여부 응답을 검증하고 알 수 없는 값은 오류로 남긴다. */
export async function getGroupChatAvailability(request: GroupChatRequest): Promise<boolean> {
  const response = await request<unknown>('/group-chat-rooms/availability');
  const data = getData(response);
  if (typeof data.available !== 'boolean') throw invalidResponseError();
  return data.available;
}

function getData(value: unknown): Record<string, unknown> {
  if (!isRecord(value) || !isNonEmptyString(value.message) || !isRecord(value.data)) {
    throw invalidResponseError();
  }
  return value.data;
}

function invalidResponseError(): ApiError {
  return new ApiError(502, '서버 응답 형식을 확인할 수 없습니다.', 'INVALID_RESPONSE');
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
  return typeof value === 'string' && value.trim().length > 0;
}

function isDateTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}
