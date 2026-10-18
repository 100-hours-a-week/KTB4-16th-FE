import { ApiError } from '../../../shared/api/apiError';

export type ChatRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

export interface ChatRoomParticipant {
  userId: number;
  nickname: string;
}

export interface ChatRoomDetails {
  chatRoomId: number;
  participants: ChatRoomParticipant[];
}

export interface ChatRoomHistoryMessage {
  chatMessageId: number;
  clientMessageId: string;
  userId: number;
  nickname: string;
  content: string;
  createdAt: string;
}

export interface ChatRoomHistoryPage {
  messages: ChatRoomHistoryMessage[];
  nextCursor: string | null;
  hasNext: boolean;
}

/** 신뢰할 수 없는 API 객체가 필드 접근 가능한 JSON 객체인지 확인한다. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Java Long 식별자를 정밀도 손실 없이 사용할 수 있는 양의 안전 정수로 검증한다. */
function isSafeIdentifier(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/** 표시 가능한 문자열 값인지 확인한다. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** API 성공 응답이 문서화된 JSON 구조인지 확인한다. */
function getData(value: unknown): Record<string, unknown> {
  if (!isRecord(value) || !isNonEmptyString(value.message) || !isRecord(value.data)) {
    throw invalidResponseError();
  }
  return value.data;
}

/** Chat Server 응답 구조가 올바르지 않을 때 공통 API 오류를 만든다. */
function invalidResponseError(): ApiError {
  return new ApiError(502, '서버 응답 형식을 확인할 수 없습니다.', 'INVALID_RESPONSE');
}

/** 참가자 목록을 검증해 정확히 두 사용자로 구성된 1:1 채팅방만 반환한다. */
function parseRoomDetails(value: unknown): ChatRoomDetails {
  const data = getData(value);
  if (
    !isSafeIdentifier(data.chatRoomId) ||
    !Array.isArray(data.participants) ||
    data.participants.length !== 2
  ) {
    throw invalidResponseError();
  }

  const participants = data.participants.map((participant) => {
    if (
      !isRecord(participant) ||
      !isSafeIdentifier(participant.userId) ||
      !isNonEmptyString(participant.nickname)
    ) {
      throw invalidResponseError();
    }
    return { userId: participant.userId, nickname: participant.nickname };
  });

  if (participants[0].userId === participants[1].userId) {
    throw invalidResponseError();
  }

  return { chatRoomId: data.chatRoomId, participants };
}

/** 메시지 이력 응답과 각 메시지의 식별자·시간 필드를 런타임 검증한다. */
function parseHistoryPage(value: unknown): ChatRoomHistoryPage {
  const data = getData(value);
  if (
    !Array.isArray(data.messages) ||
    !(data.nextCursor === null || typeof data.nextCursor === 'string') ||
    typeof data.hasNext !== 'boolean'
  ) {
    throw invalidResponseError();
  }

  const messages = data.messages.map((message) => {
    if (
      !isRecord(message) ||
      !isSafeIdentifier(message.chatMessageId) ||
      !isNonEmptyString(message.clientMessageId) ||
      !isSafeIdentifier(message.userId) ||
      !isNonEmptyString(message.nickname) ||
      typeof message.content !== 'string' ||
      !isNonEmptyString(message.createdAt) ||
      Number.isNaN(Date.parse(message.createdAt))
    ) {
      throw invalidResponseError();
    }

    return {
      chatMessageId: message.chatMessageId,
      clientMessageId: message.clientMessageId,
      userId: message.userId,
      nickname: message.nickname,
      content: message.content,
      createdAt: message.createdAt,
    };
  });

  return { messages, nextCursor: data.nextCursor, hasNext: data.hasNext };
}

/** body 없이 입장 요청을 보내고 서버의 완료 메시지를 확인한다. */
export async function enterChatRoom(request: ChatRequest, chatRoomId: string): Promise<void> {
  const response = await request<unknown>(`/chat-rooms/${chatRoomId}/members`, { method: 'POST' });
  if (!isRecord(response) || !isNonEmptyString(response.message)) {
    throw invalidResponseError();
  }
}

/** 인증된 사용자의 채팅방 상세와 두 참가자 닉네임을 조회한다. */
export async function getChatRoomDetails(
  request: ChatRequest,
  chatRoomId: string,
): Promise<ChatRoomDetails> {
  return parseRoomDetails(await request<unknown>(`/chat-rooms/${chatRoomId}`));
}

/** 불투명 cursor를 URL 인코딩하여 고정 크기 페이지의 메시지 이력을 조회한다. */
export async function getChatRoomHistory(
  request: ChatRequest,
  chatRoomId: string,
  cursor?: string,
): Promise<ChatRoomHistoryPage> {
  const query = cursor ? `?${new URLSearchParams({ cursor }).toString()}` : '';
  return parseHistoryPage(await request<unknown>(`/chat-rooms/${chatRoomId}/messages${query}`));
}

/** body나 Backend 전용 CSRF 헤더 없이 채팅방 퇴장을 요청한다. */
export async function leaveChatRoom(request: ChatRequest, chatRoomId: string): Promise<void> {
  const response = await request<unknown>(`/chat-rooms/${chatRoomId}/leave`, { method: 'POST' });
  if (!isRecord(response) || !isNonEmptyString(response.message)) {
    throw invalidResponseError();
  }
}
