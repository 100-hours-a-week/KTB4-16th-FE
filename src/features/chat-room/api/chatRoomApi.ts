import { ApiError } from '../../../shared/api/apiError';

export type AuthenticatedRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

export interface ChatRoomParticipant {
  userId: number;
  nickname: string;
}

export interface ChatRoomDetail {
  chatRoomId: number;
  participants: ChatRoomParticipant[];
}

export interface ChatRoomMessageRecord {
  chatMessageId: number;
  clientMessageId: string;
  userId: number;
  nickname: string;
  content: string;
  createdAt: string;
}

export interface ChatRoomMessageHistory {
  messages: ChatRoomMessageRecord[];
  nextCursor: string | null;
  hasNext: boolean;
}

/** 채팅 서버의 입장 응답을 확인하고 멱등 입장 요청을 보낸다. */
export async function enterChatRoom(
  request: AuthenticatedRequest,
  chatRoomId: string,
  signal?: AbortSignal,
): Promise<void> {
  const response = await request<unknown>(`/chat-rooms/${chatRoomId}/members`, {
    method: 'POST',
    signal,
  });
  parseMessageResponse(response);
}

/** 활성 참가자 전용 채팅방 상세 응답을 런타임에서 검증한다. */
export async function getChatRoomDetail(
  request: AuthenticatedRequest,
  chatRoomId: string,
  signal?: AbortSignal,
): Promise<ChatRoomDetail> {
  const response = await request<unknown>(`/chat-rooms/${chatRoomId}`, { signal });
  return parseDataResponse(response, parseChatRoomDetail);
}

/** 서버 발급 커서를 사용해 최신 또는 이전 메시지 페이지 하나를 조회한다. */
export async function getChatRoomMessageHistory(
  request: AuthenticatedRequest,
  chatRoomId: string,
  cursor?: string,
  signal?: AbortSignal,
): Promise<ChatRoomMessageHistory> {
  const query = cursor ? `?${new URLSearchParams({ cursor }).toString()}` : '';
  const response = await request<unknown>(`/chat-rooms/${chatRoomId}/messages${query}`, { signal });
  return parseDataResponse(response, parseMessageHistory);
}

/** 채팅 서버의 퇴장 처리가 성공했는지 확인한다. */
export async function leaveChatRoom(
  request: AuthenticatedRequest,
  chatRoomId: string,
  signal?: AbortSignal,
): Promise<void> {
  const response = await request<unknown>(`/chat-rooms/${chatRoomId}/leave`, {
    method: 'POST',
    signal,
  });
  parseMessageResponse(response);
}

/** API 성공 응답의 공통 message envelope을 확인한다. */
function parseMessageResponse(value: unknown): void {
  if (!isRecord(value) || !isNonEmptyString(value.message)) {
    throw invalidResponseError();
  }
}

/** API data envelope을 검증한 뒤 도메인 파서로 전달한다. */
function parseDataResponse<T>(value: unknown, parseData: (data: unknown) => T): T {
  if (!isRecord(value) || !isNonEmptyString(value.message) || !('data' in value)) {
    throw invalidResponseError();
  }
  return parseData(value.data);
}

/** 채팅방 ID와 두 참가자의 실제 상세 DTO를 확인한다. */
function parseChatRoomDetail(value: unknown): ChatRoomDetail {
  if (
    !isRecord(value) ||
    !isPositiveSafeInteger(value.chatRoomId) ||
    !Array.isArray(value.participants) ||
    value.participants.length !== 2
  ) {
    throw invalidResponseError();
  }

  const participants = value.participants.map(parseParticipant);
  if (new Set(participants.map((participant) => participant.userId)).size !== 2) {
    throw invalidResponseError();
  }

  return { chatRoomId: value.chatRoomId, participants };
}

/** 참가자 DTO의 식별자와 닉네임을 검증한다. */
function parseParticipant(value: unknown): ChatRoomParticipant {
  if (
    !isRecord(value) ||
    !isPositiveSafeInteger(value.userId) ||
    !isNonEmptyString(value.nickname)
  ) {
    throw invalidResponseError();
  }
  return { userId: value.userId, nickname: value.nickname };
}

/** 커서 페이지 응답과 각 메시지 DTO를 검증한다. */
function parseMessageHistory(value: unknown): ChatRoomMessageHistory {
  if (
    !isRecord(value) ||
    !Array.isArray(value.messages) ||
    !(value.nextCursor === null || typeof value.nextCursor === 'string') ||
    typeof value.hasNext !== 'boolean'
  ) {
    throw invalidResponseError();
  }

  return {
    messages: value.messages.map(parseMessage),
    nextCursor: value.nextCursor,
    hasNext: value.hasNext,
  };
}

/** 메시지 이력 DTO의 필드를 검증하며 서버의 정렬 순서는 보존한다. */
function parseMessage(value: unknown): ChatRoomMessageRecord {
  if (
    !isRecord(value) ||
    !isPositiveSafeInteger(value.chatMessageId) ||
    !isUuid(value.clientMessageId) ||
    !isPositiveSafeInteger(value.userId) ||
    !isNonEmptyString(value.nickname) ||
    typeof value.content !== 'string' ||
    !isDateTime(value.createdAt)
  ) {
    throw invalidResponseError();
  }

  return {
    chatMessageId: value.chatMessageId,
    clientMessageId: value.clientMessageId,
    userId: value.userId,
    nickname: value.nickname,
    content: value.content,
    createdAt: value.createdAt,
  };
}

/** 서버 오류와 구별되는 응답 계약 오류를 공통 API 오류로 표시한다. */
function invalidResponseError(): ApiError {
  return new ApiError(502, '채팅 서버 응답 형식을 확인할 수 없습니다.', 'INVALID_RESPONSE');
}

/** 신뢰할 수 없는 응답 필드 접근 전 일반 객체인지 확인한다. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 양의 정수 ID가 JavaScript에서 정확히 표현 가능한지 확인한다. */
function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/** 서버가 화면에 표시할 수 있는 비어 있지 않은 문자열을 반환했는지 확인한다. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** 메시지 멱등 키가 UUID 형식인지 확인한다. */
function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

/** 서버의 OffsetDateTime 문자열이 유효한 날짜인지 확인한다. */
function isDateTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}
