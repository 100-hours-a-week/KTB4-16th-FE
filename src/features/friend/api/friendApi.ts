import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { getCsrfToken } from '../../../shared/api/csrf';

export type FriendListItem = {
  friendshipId: number;
  userId: number;
  nickname: string;
};

export type FriendRequestItem = {
  friendRequestId: number;
  userId: number;
  nickname: string;
  createdAt: string;
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type SendFriendRequestResult =
  { kind: 'pending'; friendRequestId: number } | { kind: 'friends'; friendshipId: number };

type FriendApiClient = AuthenticatedApiClient['fetchJson'];

/** 인증된 사용자의 친구 목록을 페이지 단위로 조회하고 응답 필드를 검증한다. */
export async function getFriends(
  cursor: string | null,
  fetchAuthenticatedJson: FriendApiClient,
  signal: AbortSignal,
  size?: number,
): Promise<CursorPage<FriendListItem>> {
  const query = new URLSearchParams();
  if (cursor !== null) query.set('cursor', cursor);
  if (size !== undefined) query.set('size', String(size));
  const suffix = query.size === 0 ? '' : `?${query.toString()}`;
  const response = await fetchAuthenticatedJson<unknown>(`/users/me/friends${suffix}`, { signal });
  return parseFriendPage(response);
}

/** 받은 친구 요청을 목록 항목 공통 형식으로 변환한다. */
export async function getReceivedFriendRequests(
  cursor: string | null,
  fetchAuthenticatedJson: FriendApiClient,
  signal: AbortSignal,
): Promise<CursorPage<FriendRequestItem>> {
  return getRequestPage('received', cursor, fetchAuthenticatedJson, signal);
}

/** 보낸 친구 요청을 목록 항목 공통 형식으로 변환한다. */
export async function getSentFriendRequests(
  cursor: string | null,
  fetchAuthenticatedJson: FriendApiClient,
  signal: AbortSignal,
): Promise<CursorPage<FriendRequestItem>> {
  return getRequestPage('sent', cursor, fetchAuthenticatedJson, signal);
}

/** 받은·보낸 요청 API를 조회하고 상대 사용자 필드를 공통 모양으로 정규화한다. */
async function getRequestPage(
  direction: 'received' | 'sent',
  cursor: string | null,
  fetchAuthenticatedJson: FriendApiClient,
  signal: AbortSignal,
): Promise<CursorPage<FriendRequestItem>> {
  const query = cursor === null ? '' : `?${new URLSearchParams({ cursor }).toString()}`;
  const response = await fetchAuthenticatedJson<unknown>(
    `/users/me/friend-requests/${direction}${query}`,
    { signal },
  );
  return parseFriendRequestPage(response, direction);
}

/** 닉네임으로 요청을 보내고 pending 저장과 역방향 자동 수락 결과를 구분한다. */
export async function sendFriendRequest(
  nickname: string,
  fetchAuthenticatedJson: FriendApiClient,
): Promise<SendFriendRequestResult> {
  const trimmedNickname = nickname.trim();
  if (!trimmedNickname) throw new Error('친구 닉네임을 입력해주세요.');

  const csrfToken = await getCsrfToken();
  const response = await fetchAuthenticatedJson<unknown>('/users/me/friend-requests', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrfToken },
    body: JSON.stringify({ nickname: trimmedNickname }),
  });
  return parseSendFriendRequestResponse(response);
}

/** 받은 요청을 수락하고 서버가 생성한 친구 관계 ID를 검증한다. */
export async function acceptFriendRequest(
  friendRequestId: number,
  fetchAuthenticatedJson: FriendApiClient,
): Promise<number> {
  assertPositiveId(friendRequestId, '친구 요청');
  const csrfToken = await getCsrfToken();
  const response = await fetchAuthenticatedJson<unknown>(
    `/friend-requests/${friendRequestId}/accept`,
    { method: 'POST', credentials: 'include', headers: { 'X-XSRF-TOKEN': csrfToken } },
  );
  return parseIdResponse(response, 'friendshipId', '친구 요청 수락');
}

/** 받은 요청 거절 또는 보낸 요청 취소를 처리한다. */
export async function deleteFriendRequest(
  friendRequestId: number,
  fetchAuthenticatedJson: FriendApiClient,
): Promise<void> {
  assertPositiveId(friendRequestId, '친구 요청');
  await deleteResource(`/friend-requests/${friendRequestId}`, fetchAuthenticatedJson);
}

/** 관계 ID의 친구 관계를 삭제한다. */
export async function deleteFriendship(
  friendshipId: number,
  fetchAuthenticatedJson: FriendApiClient,
): Promise<void> {
  assertPositiveId(friendshipId, '친구 관계');
  await deleteResource(`/friendships/${friendshipId}`, fetchAuthenticatedJson);
}

/** 친구 요청·관계 DELETE에 공통 CSRF 헤더를 붙이고 성공 응답을 검증한다. */
async function deleteResource(
  path: string,
  fetchAuthenticatedJson: FriendApiClient,
): Promise<void> {
  const csrfToken = await getCsrfToken();
  const response = await fetchAuthenticatedJson<unknown>(path, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'X-XSRF-TOKEN': csrfToken },
  });
  if (!isRecord(response) || typeof response.message !== 'string') {
    throw new Error('친구 변경 응답 형식이 올바르지 않습니다.');
  }
}

/** 친구 목록 envelope와 각 친구 ID·닉네임을 검증한다. */
function parseFriendPage(value: unknown): CursorPage<FriendListItem> {
  if (!isRecord(value) || typeof value.message !== 'string' || !isRecord(value.data)) {
    throw new Error('친구 목록 응답 형식이 올바르지 않습니다.');
  }
  const data = value.data;
  if (!Array.isArray(data.friends) || !isNullableString(data.nextCursor)) {
    throw new Error('친구 목록 응답 형식이 올바르지 않습니다.');
  }
  return {
    items: data.friends.map((item) => {
      if (
        !isRecord(item) ||
        !isPositiveInteger(item.friendshipId) ||
        !isPositiveInteger(item.userId) ||
        !isNonEmptyString(item.nickname)
      ) {
        throw new Error('친구 목록 항목 형식이 올바르지 않습니다.');
      }
      return { friendshipId: item.friendshipId, userId: item.userId, nickname: item.nickname };
    }),
    nextCursor: data.nextCursor,
  };
}

/** 요청 목록의 발신자 또는 수신자 키를 공통 userId·nickname으로 파싱한다. */
function parseFriendRequestPage(
  value: unknown,
  direction: 'received' | 'sent',
): CursorPage<FriendRequestItem> {
  if (!isRecord(value) || typeof value.message !== 'string' || !isRecord(value.data)) {
    throw new Error('친구 요청 목록 응답 형식이 올바르지 않습니다.');
  }
  const data = value.data;
  if (!Array.isArray(data.requests) || !isNullableString(data.nextCursor)) {
    throw new Error('친구 요청 목록 응답 형식이 올바르지 않습니다.');
  }
  const personKey = direction === 'received' ? 'requester' : 'addressee';
  return {
    items: data.requests.map((item) => {
      if (
        !isRecord(item) ||
        !isPositiveInteger(item.friendRequestId) ||
        !isRecord(item[personKey]) ||
        !isPositiveInteger(item[personKey].userId) ||
        !isNonEmptyString(item[personKey].nickname) ||
        !isNonEmptyString(item.createdAt)
      ) {
        throw new Error('친구 요청 항목 형식이 올바르지 않습니다.');
      }
      return {
        friendRequestId: item.friendRequestId,
        userId: item[personKey].userId,
        nickname: item[personKey].nickname,
        createdAt: item.createdAt,
      };
    }),
    nextCursor: data.nextCursor,
  };
}

/** 새 pending 요청 또는 역방향 요청 자동 수락 응답의 두 결과 형식을 식별한다. */
function parseSendFriendRequestResponse(value: unknown): SendFriendRequestResult {
  if (!isRecord(value) || typeof value.message !== 'string' || !isRecord(value.data)) {
    throw new Error('친구 요청 응답 형식이 올바르지 않습니다.');
  }
  if (isPositiveInteger(value.data.friendRequestId)) {
    return { kind: 'pending', friendRequestId: value.data.friendRequestId };
  }
  if (isPositiveInteger(value.data.friendshipId)) {
    return { kind: 'friends', friendshipId: value.data.friendshipId };
  }
  throw new Error('친구 요청 응답 형식이 올바르지 않습니다.');
}

/** 수락 응답의 관계 ID를 확인해 API 호출자에게 반환한다. */
function parseIdResponse(value: unknown, key: string, label: string): number {
  if (!isRecord(value) || typeof value.message !== 'string' || !isRecord(value.data)) {
    throw new Error(`${label} 응답 형식이 올바르지 않습니다.`);
  }
  const id = value.data[key];
  if (!isPositiveInteger(id)) throw new Error(`${label} 응답 형식이 올바르지 않습니다.`);
  return id;
}

/** 변경 요청에 사용할 ID가 양의 정수인지 검증한다. */
function assertPositiveId(id: number, label: string): void {
  if (!isPositiveInteger(id)) throw new Error(`올바른 ${label} ID가 필요합니다.`);
}

/** API JSON 값이 배열이 아닌 객체인지 확인한다. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** ID 필드가 양의 안전 정수인지 확인한다. */
function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/** 필수 문자열 필드가 비어 있지 않은지 확인한다. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** cursor 필드가 문자열 또는 null인지 확인한다. */
function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}
