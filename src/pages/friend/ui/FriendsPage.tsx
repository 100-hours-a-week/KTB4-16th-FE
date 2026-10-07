import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import { useSession } from '../../../entities/session/model/useSession';
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
} from '../../../features/friend/api/friendApi';
import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import { ApiError } from '../../../shared/api/apiError';
import '../../pageShell.css';
import './friendsPage.css';

type Tab = 'friends' | 'received' | 'sent';
type PageLoadState = 'loading' | 'ready' | 'error';

/** 친구·받은 요청·보낸 요청 목록과 닉네임 요청을 한 화면에서 관리한다. */
export function FriendsPage() {
  const { fetchAuthenticatedJson } = useSession();
  const loadControllerRef = useRef<AbortController | null>(null);
  const loadMoreControllerRef = useRef<AbortController | null>(null);
  const loadMoreRequestIdRef = useRef(0);
  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [received, setReceived] = useState<FriendRequestItem[]>([]);
  const [sent, setSent] = useState<FriendRequestItem[]>([]);
  const [nextCursors, setNextCursors] = useState<Record<Tab, string | null>>({
    friends: null,
    received: null,
    sent: null,
  });
  const [loadState, setLoadState] = useState<PageLoadState>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [friendToDelete, setFriendToDelete] = useState<FriendListItem | null>(null);

  /** 목록 갱신·탭 전환 시 이전 cursor 요청을 취소하고 늦은 응답을 무효화한다. */
  const invalidateLoadMore = useCallback(() => {
    loadMoreRequestIdRef.current += 1;
    loadMoreControllerRef.current?.abort();
    loadMoreControllerRef.current = null;
  }, []);

  /** 친구 및 요청의 첫 페이지를 함께 새로 불러와 변경 뒤 목록을 일관되게 갱신한다. */
  const loadAll = useCallback(async () => {
    invalidateLoadMore();
    setLoadingMore(false);
    loadControllerRef.current?.abort();
    const controller = new AbortController();
    loadControllerRef.current = controller;
    setLoadState('loading');
    setErrorMessage('');
    try {
      const [friendPage, receivedPage, sentPage] = await Promise.all([
        getFriends(null, fetchAuthenticatedJson, controller.signal),
        getReceivedFriendRequests(null, fetchAuthenticatedJson, controller.signal),
        getSentFriendRequests(null, fetchAuthenticatedJson, controller.signal),
      ]);
      if (controller.signal.aborted || loadControllerRef.current !== controller) return;
      setFriends(friendPage.items);
      setReceived(receivedPage.items);
      setSent(sentPage.items);
      setNextCursors({
        friends: friendPage.nextCursor,
        received: receivedPage.nextCursor,
        sent: sentPage.nextCursor,
      });
      setLoadState('ready');
    } catch (error: unknown) {
      if (controller.signal.aborted || loadControllerRef.current !== controller) return;
      setErrorMessage(messageForFriendError(error));
      setLoadState('error');
    }
  }, [fetchAuthenticatedJson, invalidateLoadMore]);

  useEffect(() => {
    const requestFrame = requestAnimationFrame(() => {
      void loadAll();
    });
    return () => {
      cancelAnimationFrame(requestFrame);
      loadControllerRef.current?.abort();
      loadControllerRef.current = null;
      invalidateLoadMore();
    };
  }, [invalidateLoadMore, loadAll]);

  /** 탭을 바꾸면서 이전 탭의 진행 중인 페이지 요청을 무효화한다. */
  function selectTab(nextTab: Tab) {
    if (nextTab === tab) return;
    invalidateLoadMore();
    setLoadingMore(false);
    setTab(nextTab);
  }

  /** 닉네임 요청을 보내고 pending 저장과 자동 친구 성립 결과를 안내한다. */
  async function submitFriendRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setNotice('');
    setActionKey('send');
    try {
      const result = await sendFriendRequest(nickname, fetchAuthenticatedJson);
      setNickname('');
      setNotice(result.kind === 'friends' ? '서로 친구가 되었어요.' : '친구 요청을 보냈어요.');
      if (result.kind === 'friends') setTab('friends');
      await loadAll();
    } catch (error: unknown) {
      setFormError(messageForFriendError(error));
    } finally {
      setActionKey(null);
    }
  }

  /** 요청 수락·거절·취소 또는 친구 삭제를 실행하고 세 목록을 다시 불러온다. */
  async function runFriendAction(key: string, action: () => Promise<unknown>, success: string) {
    setActionKey(key);
    setErrorMessage('');
    setNotice('');
    try {
      await action();
      setNotice(success);
      setFriendToDelete(null);
      await loadAll();
    } catch (error: unknown) {
      setErrorMessage(messageForFriendError(error));
    } finally {
      setActionKey(null);
    }
  }

  /** 현재 탭에서 남은 cursor 페이지를 불러와 표시 목록 끝에 추가한다. */
  async function loadMore() {
    const requestedTab = tab;
    const cursor = nextCursors[requestedTab];
    if (cursor === null || loadMoreControllerRef.current !== null) return;
    const controller = new AbortController();
    const requestId = loadMoreRequestIdRef.current + 1;
    loadMoreRequestIdRef.current = requestId;
    loadMoreControllerRef.current = controller;
    setLoadingMore(true);
    setErrorMessage('');
    try {
      if (requestedTab === 'friends') {
        const page = await getFriends(cursor, fetchAuthenticatedJson, controller.signal);
        if (controller.signal.aborted || requestId !== loadMoreRequestIdRef.current) return;
        setFriends((items) => appendDistinct(items, page.items, (item) => item.userId));
        setNextCursors((current) => ({ ...current, friends: page.nextCursor }));
      } else if (requestedTab === 'received') {
        const page = await getReceivedFriendRequests(
          cursor,
          fetchAuthenticatedJson,
          controller.signal,
        );
        if (controller.signal.aborted || requestId !== loadMoreRequestIdRef.current) return;
        setReceived((items) => appendDistinct(items, page.items, (item) => item.friendRequestId));
        setNextCursors((current) => ({ ...current, received: page.nextCursor }));
      } else {
        const page = await getSentFriendRequests(cursor, fetchAuthenticatedJson, controller.signal);
        if (controller.signal.aborted || requestId !== loadMoreRequestIdRef.current) return;
        setSent((items) => appendDistinct(items, page.items, (item) => item.friendRequestId));
        setNextCursors((current) => ({ ...current, sent: page.nextCursor }));
      }
    } catch (error: unknown) {
      if (controller.signal.aborted || requestId !== loadMoreRequestIdRef.current) return;
      setErrorMessage(messageForFriendError(error));
    } finally {
      if (loadMoreControllerRef.current === controller) {
        loadMoreControllerRef.current = null;
        setLoadingMore(false);
      }
    }
  }

  const activeCount =
    tab === 'friends' ? friends.length : tab === 'received' ? received.length : sent.length;

  return (
    <main className="static-page">
      <div className="static-page-content friends-page-content">
        <header className="static-page-header">
          <h1 className="static-page-title">친구</h1>
          <Link className="friends-back-link" to="/dashboard">
            내 대시보드
          </Link>
        </header>

        <form className="friends-add-form" onSubmit={(event) => void submitFriendRequest(event)}>
          <label htmlFor="friend-nickname">닉네임으로 친구 요청</label>
          <div className="friends-add-controls">
            <input
              autoComplete="off"
              id="friend-nickname"
              maxLength={10}
              placeholder="친구 닉네임"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
            />
            <button disabled={actionKey === 'send' || nickname.trim().length === 0} type="submit">
              {actionKey === 'send' ? '요청 중…' : '요청 보내기'}
            </button>
          </div>
          {formError ? (
            <p className="friends-error" role="alert">
              {formError}
            </p>
          ) : null}
        </form>

        <section className="friends-request-intro" aria-label="친구 요청 관리">
          <span>NEW CONNECTION</span>
          <h2>함께 기록할 친구를 만나보세요</h2>
          <p>받은 요청을 수락하면 친구의 지역별 자물쇠를 볼 수 있어요.</p>
        </section>

        <div className="friends-tabs" role="tablist" aria-label="친구 목록 종류">
          <button
            aria-selected={tab === 'friends'}
            className={tab === 'friends' ? 'is-active' : ''}
            role="tab"
            type="button"
            onClick={() => selectTab('friends')}
          >
            친구 <span>{friends.length}</span>
          </button>
          <button
            aria-selected={tab === 'received'}
            className={tab === 'received' ? 'is-active' : ''}
            role="tab"
            type="button"
            onClick={() => selectTab('received')}
          >
            받은 요청 <span>{received.length}</span>
          </button>
          <button
            aria-selected={tab === 'sent'}
            className={tab === 'sent' ? 'is-active' : ''}
            role="tab"
            type="button"
            onClick={() => selectTab('sent')}
          >
            보낸 요청 <span>{sent.length}</span>
          </button>
        </div>

        {notice ? (
          <p className="friends-notice" role="status">
            {notice}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="friends-error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {loadState === 'loading' ? (
          <p className="friends-state" role="status">
            목록을 불러오는 중이에요.
          </p>
        ) : null}
        {loadState === 'error' ? (
          <button className="friends-retry" type="button" onClick={() => void loadAll()}>
            다시 불러오기
          </button>
        ) : null}
        {loadState === 'ready' ? (
          <div aria-label="친구 요청 목록" className="friends-list" role="tabpanel">
            {activeCount === 0 ? (
              <p className="friends-state">
                {tab === 'friends'
                  ? '아직 친구가 없어요.'
                  : tab === 'received'
                    ? '받은 친구 요청이 없어요.'
                    : '보낸 친구 요청이 없어요.'}
              </p>
            ) : null}
            {tab === 'friends'
              ? friends.map((friend) => (
                  <article className="friend-card" key={friend.friendshipId}>
                    <Link className="friend-card-person" to={`/friends/${friend.userId}/dashboard`}>
                      <span className="friend-avatar" aria-hidden="true">
                        {friend.nickname.slice(0, 1)}
                      </span>
                      <span>
                        <strong>{friend.nickname}</strong>
                        <small>친구 대시보드 보기</small>
                      </span>
                    </Link>
                    <button
                      aria-label={`${friend.nickname} 친구 삭제`}
                      className="friend-secondary-action"
                      disabled={actionKey !== null}
                      type="button"
                      onClick={() => setFriendToDelete(friend)}
                    >
                      삭제
                    </button>
                  </article>
                ))
              : null}
            {tab === 'received'
              ? received.map((request) => (
                  <article
                    className="friend-card friend-request-card"
                    key={request.friendRequestId}
                  >
                    <span className="friend-avatar" aria-hidden="true">
                      {request.nickname.slice(0, 1)}
                    </span>
                    <span className="friend-card-person-text">
                      <strong>{request.nickname}</strong>
                      <small>친구 요청을 보냈어요.</small>
                    </span>
                    <div className="friend-card-actions">
                      <button
                        className="friend-secondary-action"
                        disabled={actionKey !== null}
                        type="button"
                        onClick={() =>
                          void runFriendAction(
                            `request-${request.friendRequestId}`,
                            () =>
                              deleteFriendRequest(request.friendRequestId, fetchAuthenticatedJson),
                            '친구 요청을 거절했어요.',
                          )
                        }
                      >
                        거절
                      </button>
                      <button
                        className="friend-primary-action"
                        disabled={actionKey !== null}
                        type="button"
                        onClick={() =>
                          void runFriendAction(
                            `request-${request.friendRequestId}`,
                            () =>
                              acceptFriendRequest(request.friendRequestId, fetchAuthenticatedJson),
                            `${request.nickname}님과 친구가 되었어요.`,
                          )
                        }
                      >
                        수락
                      </button>
                    </div>
                  </article>
                ))
              : null}
            {tab === 'sent'
              ? sent.map((request) => (
                  <article
                    className="friend-card friend-request-card"
                    key={request.friendRequestId}
                  >
                    <span className="friend-avatar" aria-hidden="true">
                      {request.nickname.slice(0, 1)}
                    </span>
                    <span className="friend-card-person-text">
                      <strong>{request.nickname}</strong>
                      <small>응답을 기다리고 있어요.</small>
                    </span>
                    <button
                      className="friend-secondary-action"
                      disabled={actionKey !== null}
                      type="button"
                      onClick={() =>
                        void runFriendAction(
                          `request-${request.friendRequestId}`,
                          () =>
                            deleteFriendRequest(request.friendRequestId, fetchAuthenticatedJson),
                          '보낸 친구 요청을 취소했어요.',
                        )
                      }
                    >
                      요청 취소
                    </button>
                  </article>
                ))
              : null}
            {nextCursors[tab] !== null ? (
              <button
                className="friends-more"
                disabled={loadingMore}
                type="button"
                onClick={() => void loadMore()}
              >
                {loadingMore ? '불러오는 중…' : '더 보기'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <MainNavigation activeItem="friends" />

      {friendToDelete ? (
        <div className="friends-dialog-backdrop">
          <section
            aria-labelledby="friend-delete-title"
            aria-modal="true"
            className="friends-dialog"
            role="dialog"
          >
            <h2 id="friend-delete-title">친구를 삭제할까요?</h2>
            <p>{friendToDelete.nickname}님과의 친구 관계가 종료됩니다.</p>
            <div>
              <button
                className="friend-secondary-action"
                type="button"
                onClick={() => setFriendToDelete(null)}
              >
                취소
              </button>
              <button
                className="friend-primary-action"
                disabled={actionKey !== null}
                type="button"
                onClick={() =>
                  void runFriendAction(
                    `friend-${friendToDelete.friendshipId}`,
                    () => deleteFriendship(friendToDelete.friendshipId, fetchAuthenticatedJson),
                    '친구 관계를 삭제했어요.',
                  )
                }
              >
                삭제
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

/** 실시간 cursor 페이지가 겹쳐도 사용자 또는 요청 ID당 항목 하나만 표시한다. */
function appendDistinct<T>(current: T[], incoming: T[], idOf: (item: T) => number): T[] {
  const existingIds = new Set(current.map(idOf));
  const additions = incoming.filter((item) => {
    const id = idOf(item);
    if (existingIds.has(id)) return false;
    existingIds.add(id);
    return true;
  });
  return [...current, ...additions];
}

/** 서버 상태 코드를 친구 화면에서 다음 행동이 분명한 안내 문구로 바꾼다. */
function messageForFriendError(error: unknown): string {
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
