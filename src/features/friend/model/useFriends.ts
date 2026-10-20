import { useCallback, useEffect, useRef, useState } from 'react';

import { useSession } from '../../../entities/session/model/useSession';
import { ApiError } from '../../../shared/api/apiError';
import {
  acceptFriendRequest,
  deleteFriendRequest,
  deleteFriendship,
  getFriends,
  getReceivedFriendRequests,
  getSentFriendRequests,
  sendFriendRequest,
  type FriendListItem,
  type FriendRequestItem,
} from '../api/friendApi';
import { useFriendList } from './useFriendList';

export type FriendNotice = {
  id: number;
  message: string;
  showFriends?: boolean;
  friendUserId?: number;
};

/** 친구 목록·요청의 독립 조회와 서버 확인 뒤 갱신할 목록의 범위를 관리한다. */
export function useFriends() {
  const { fetchAuthenticatedJson: client } = useSession();
  const friendLoader = useCallback(
    (cursor: string | null, signal: AbortSignal) => getFriends(cursor, client, signal),
    [client],
  );
  const receivedLoader = useCallback(
    (cursor: string | null, signal: AbortSignal) =>
      getReceivedFriendRequests(cursor, client, signal),
    [client],
  );
  const sentLoader = useCallback(
    (cursor: string | null, signal: AbortSignal) => getSentFriendRequests(cursor, client, signal),
    [client],
  );
  const friends = useFriendList(friendLoader, friendId);
  const received = useFriendList(receivedLoader, requestId);
  const sent = useFriendList(sentLoader, requestId);
  const pendingRef = useRef(false);
  const mountedRef = useRef(true);
  const noticeIdRef = useRef(0);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ key: string; message: string } | null>(null);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState<FriendNotice | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** 같은 이벤트의 연속 클릭을 상태 렌더링 전에도 차단하고 결과만 안내한다. */
  async function mutate(
    key: string,
    action: () => Promise<void>,
    isForm = false,
  ): Promise<boolean> {
    if (pendingRef.current) return false;
    pendingRef.current = true;
    setActionKey(key);
    setActionError(null);
    setFormError('');
    dismissNotice();
    try {
      await action();
      return mountedRef.current;
    } catch (error: unknown) {
      if (mountedRef.current) {
        const message = messageForFriendError(error);
        if (isForm) setFormError(message);
        else setActionError({ key, message });
      }
      return false;
    } finally {
      pendingRef.current = false;
      if (mountedRef.current) setActionKey(null);
    }
  }

  /** 새 완료 결과에 독립된 ID를 주어 같은 문구도 타이머를 다시 시작한다. */
  function announce(message: string, showFriends = false, friendUserId?: number) {
    setNotice({ id: ++noticeIdRef.current, message, showFriends, friendUserId });
  }

  /** 요청 저장 결과에 따라 보낸 목록 또는 친구 성립에 관련된 목록만 갱신한다. */
  function send(nickname: string) {
    return mutate(
      'send',
      async () => {
        const result = await sendFriendRequest(nickname.trim(), client);
        if (!mountedRef.current) return;
        if (result.kind === 'friends') {
          announce(`${nickname.trim()}님과 친구가 되었어요.`, true);
          void friends.refresh();
          void received.refresh();
          void sent.refresh();
        } else {
          announce('친구 요청을 보냈어요.');
          void sent.refresh();
        }
      },
      true,
    );
  }

  /** 수락한 요청만 제거하고 친구 목록은 기존 카드가 보이는 상태로 갱신한다. */
  function accept(request: FriendRequestItem) {
    return mutate(`request-${request.friendRequestId}`, async () => {
      await acceptFriendRequest(request.friendRequestId, client);
      if (!mountedRef.current) return;
      received.remove(request.friendRequestId);
      void friends.refresh();
      announce(`${request.nickname}님과 친구가 되었어요.`, true, request.userId);
    });
  }

  /** 거절·취소가 확정된 요청만 해당 목록에서 제거한다. */
  function removeRequest(request: FriendRequestItem, kind: 'received' | 'sent') {
    return mutate(`request-${request.friendRequestId}`, async () => {
      await deleteFriendRequest(request.friendRequestId, client);
      if (!mountedRef.current) return;
      (kind === 'received' ? received : sent).remove(request.friendRequestId);
      announce(kind === 'received' ? '친구 요청을 거절했어요.' : '보낸 친구 요청을 취소했어요.');
    });
  }

  /** 친구 관계 삭제가 확정된 뒤 해당 카드만 제거한다. */
  function removeFriend(friend: FriendListItem) {
    return mutate(`friend-${friend.friendshipId}`, async () => {
      await deleteFriendship(friend.friendshipId, client);
      if (!mountedRef.current) return;
      friends.remove(friend.userId);
      announce('친구 관계를 삭제했어요.');
    });
  }

  return {
    friends,
    received,
    sent,
    actionKey,
    actionError,
    formError,
    notice,
    dismissNotice,
    send,
    accept,
    removeRequest,
    removeFriend,
    clearFormError: () => setFormError(''),
  };
}

/** 친구 페이지의 중복 제거와 삭제는 사용자 ID를 기준으로 한다. */
function friendId(item: FriendListItem) {
  return item.userId;
}
/** 요청 페이지의 중복 제거와 삭제는 요청 ID를 기준으로 한다. */
function requestId(item: FriendRequestItem) {
  return item.friendRequestId;
}

/** 서버 상태를 사용자가 다음 행동을 선택할 수 있는 문구로 바꾼다. */
export function messageForFriendError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return '로그인이 만료되었어요. 다시 로그인해주세요.';
    if (error.status === 404) return '친구 또는 요청을 찾을 수 없어요. 목록을 새로고침해주세요.';
    if (error.status === 409) {
      if (error.code === 'FRIEND_REQUEST_ALREADY_EXISTS') return '이미 보낸 친구 요청이 있어요.';
      if (error.code === 'FRIENDSHIP_ALREADY_EXISTS') return '이미 친구인 사용자예요.';
      return '요청을 처리할 수 없는 상태예요.';
    }
  }
  return '친구 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.';
}
