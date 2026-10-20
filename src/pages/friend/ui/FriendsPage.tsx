import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router';

import type { FriendListItem } from '../../../features/friend/api/friendApi';
import { messageForFriendError, useFriends } from '../../../features/friend/model/useFriends';
import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import { FriendsDialog } from './FriendsDialog';
import { FriendToast } from './FriendToast';
import '../../pageShell.css';
import './friendsPage.css';

type Tab = 'friends' | 'received' | 'sent';
type Dialog = { kind: 'add' } | { kind: 'manage' | 'delete'; friend: FriendListItem } | null;
const TABS: { id: Tab; label: string }[] = [
  { id: 'friends', label: '친구' },
  { id: 'received', label: '받은 요청' },
  { id: 'sent', label: '보낸 요청' },
];

/** 독립 조회한 친구·요청 목록, 추가/관리 모달과 일시적인 완료 안내를 조립한다. */
export function FriendsPage() {
  const model = useFriends();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: Tab = tabParam === 'received' || tabParam === 'sent' ? tabParam : 'friends';
  const [nickname, setNickname] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [highlightedFriend, setHighlightedFriend] = useState<number | undefined>();
  const tabsRef = useRef<HTMLDivElement>(null);
  const [dialogOpener, setDialogOpener] = useState<HTMLElement | null>(null);
  const list = model[tab];
  const busy = model.actionKey !== null;

  /** 탭은 URL과 함께 바꾸되 다른 탭에서 진행 중인 조회·기존 목록은 유지한다. */
  function selectTab(nextTab: Tab) {
    setSearchParams(nextTab === 'friends' ? {} : { tab: nextTab }, { replace: true });
  }

  /** 방향키/Home/End로 탭을 선택하고 선택한 탭에 키보드 포커스를 옮긴다. */
  function navigateTabs(event: KeyboardEvent<HTMLDivElement>) {
    const index = TABS.findIndex((item) => item.id === tab);
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') next = (index + TABS.length - 1) % TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    else return;
    event.preventDefault();
    selectTab(TABS[next].id);
    tabsRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }

  /** 새 요청 폼을 열 때 이전 입력 오류를 지우고 목록의 현재 탭은 유지한다. */
  function openAdd() {
    setDialogOpener(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    model.clearFormError();
    setDialog({ kind: 'add' });
  }

  /** 배경을 inert로 바꾸기 전에 관리 창을 열었던 실제 버튼을 기록한다. */
  function openManagement(friend: FriendListItem) {
    setDialogOpener(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setDialog({ kind: 'manage', friend });
  }

  /** 전송 성공 때만 입력창을 닫고 실패 시에는 입력과 오류를 그대로 보여준다. */
  async function submitFriendRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nickname.trim().length === 0) return;
    if (await model.send(nickname)) {
      setNickname('');
      setDialog(null);
    }
  }

  /** 친구 성립 안내의 명시적 행동으로만 친구 탭으로 이동한다. */
  function viewFriends() {
    setHighlightedFriend(model.notice?.friendUserId);
    selectTab('friends');
    model.dismissNotice();
    tabsRef.current?.querySelector<HTMLButtonElement>('[role="tab"]')?.focus();
  }

  /** 삭제 확인을 마친 친구만 제거하고 성공했을 때 관리 창을 닫는다. */
  async function confirmDelete(friend: FriendListItem) {
    if (await model.removeFriend(friend)) setDialog(null);
  }

  return (
    <main className={`static-page friends-page${model.notice ? ' has-notice' : ''}`}>
      <div className="static-page-content friends-page-content" inert={dialog !== null}>
        <header className="friends-header">
          <div>
            <h1 className="static-page-title">친구</h1>
            <p>친구의 자물쇠에서 새로운 음악을 만나보세요.</p>
          </div>
          <button
            className="friend-primary-action friends-add-button"
            type="button"
            onClick={openAdd}
          >
            <span aria-hidden="true">＋</span> 친구 추가
          </button>
        </header>
        <div
          ref={tabsRef}
          className="friends-tabs"
          role="tablist"
          aria-label="친구 목록 종류"
          onKeyDown={navigateTabs}
        >
          {TABS.map((item) => (
            <button
              key={item.id}
              id={`friends-tab-${item.id}`}
              aria-controls="friends-panel"
              aria-selected={tab === item.id}
              className={tab === item.id ? 'is-active' : ''}
              role="tab"
              tabIndex={tab === item.id ? 0 : -1}
              type="button"
              onClick={() => selectTab(item.id)}
            >
              {item.label}
              {item.id !== 'friends' && model[item.id].status === 'ready' ? (
                <span>
                  {model[item.id].items.length}
                  {model[item.id].nextCursor !== null ? '+' : ''}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <section
          id="friends-panel"
          role="tabpanel"
          aria-labelledby={`friends-tab-${tab}`}
          className="friends-panel"
          tabIndex={0}
        >
          {list.status === 'loading' ? (
            <div className="friends-loading" role="status">
              <span className="friends-loading-shape" aria-hidden="true" />
              목록을 불러오는 중이에요.
            </div>
          ) : null}
          {list.error ? (
            <div className="friends-state">
              <p className="friends-error" role="alert">
                {messageForFriendError(list.error)}
              </p>
              <button className="friends-retry" type="button" onClick={() => void list.refresh()}>
                다시 불러오기
              </button>
            </div>
          ) : null}
          {list.status === 'ready' && list.items.length === 0 ? (
            <div className="friends-state friends-empty">
              <span className="friends-empty-icon" aria-hidden="true">
                ♡
              </span>
              <h2>
                {tab === 'friends'
                  ? '아직 친구가 없어요.'
                  : tab === 'received'
                    ? '받은 친구 요청이 없어요.'
                    : '보낸 친구 요청이 없어요.'}
              </h2>
              <p>
                {tab === 'friends'
                  ? '닉네임으로 친구를 찾아 음악과 기억을 나눠보세요.'
                  : tab === 'received'
                    ? '새로운 요청이 오면 여기에서 확인할 수 있어요.'
                    : '함께 음악을 나누고 싶은 친구에게 요청을 보내보세요.'}
              </p>
              {tab !== 'received' ? (
                <button className="friend-primary-action" type="button" onClick={openAdd}>
                  친구 찾아보기
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="friends-list">
            {tab === 'friends'
              ? model.friends.items.map((friend) => (
                  <article
                    className={`friend-card${highlightedFriend === friend.userId ? ' is-highlighted' : ''}`}
                    key={friend.friendshipId}
                  >
                    <Link className="friend-card-person" to={`/friends/${friend.userId}/dashboard`}>
                      <span className="friend-avatar" aria-hidden="true">
                        {friend.nickname.slice(0, 1)}
                      </span>
                      <span>
                        <strong>{friend.nickname}</strong>
                        <small>
                          자물쇠 보기 <span aria-hidden="true">›</span>
                        </small>
                      </span>
                    </Link>
                    <button
                      className="friend-icon-button"
                      type="button"
                      aria-label={`${friend.nickname} 친구 관리`}
                      disabled={busy}
                      onClick={() => openManagement(friend)}
                    >
                      ⋯
                    </button>
                    {dialog === null &&
                    model.actionError?.key === `friend-${friend.friendshipId}` ? (
                      <p className="friends-error friend-card-error" role="alert">
                        {model.actionError.message}
                      </p>
                    ) : null}
                  </article>
                ))
              : null}
            {tab !== 'friends'
              ? model[tab].items.map((request) => (
                  <article
                    className="friend-card friend-request-card"
                    key={request.friendRequestId}
                    aria-busy={model.actionKey === `request-${request.friendRequestId}`}
                  >
                    <span className="friend-avatar" aria-hidden="true">
                      {request.nickname.slice(0, 1)}
                    </span>
                    <span className="friend-card-person-text">
                      <strong>{request.nickname}</strong>
                      <small>
                        {tab === 'received' ? '친구가 되고 싶어해요' : '응답을 기다리고 있어요'}
                      </small>
                    </span>
                    <div className="friend-card-actions">
                      <button
                        className="friend-secondary-action"
                        disabled={busy}
                        type="button"
                        onClick={() => void model.removeRequest(request, tab)}
                      >
                        {model.actionKey === `request-${request.friendRequestId}`
                          ? '처리 중…'
                          : tab === 'received'
                            ? '거절'
                            : '요청 취소'}
                      </button>
                      {tab === 'received' ? (
                        <button
                          className="friend-primary-action"
                          disabled={busy}
                          type="button"
                          onClick={() => void model.accept(request)}
                        >
                          수락
                        </button>
                      ) : null}
                    </div>
                    {model.actionError?.key === `request-${request.friendRequestId}` ? (
                      <p className="friends-error friend-card-error" role="alert">
                        {model.actionError.message}
                      </p>
                    ) : null}
                  </article>
                ))
              : null}
          </div>
          {list.status === 'ready' && list.nextCursor !== null ? (
            <button
              className="friends-more"
              disabled={list.loadingMore}
              type="button"
              onClick={list.loadMore}
            >
              {list.loadingMore ? '불러오는 중…' : '더 보기'}
            </button>
          ) : null}
        </section>
      </div>
      <div inert={dialog !== null} className="friends-navigation-area">
        <div className="friends-toast-anchor">
          {model.notice ? (
            <FriendToast
              key={model.notice.id}
              notice={model.notice}
              onDismiss={model.dismissNotice}
              onViewFriends={viewFriends}
            />
          ) : null}
        </div>
        <MainNavigation activeItem="friends" />
      </div>
      {dialog ? (
        <FriendsDialog
          returnFocusTo={dialogOpener}
          title={
            dialog.kind === 'add'
              ? '친구 추가'
              : dialog.kind === 'manage'
                ? dialog.friend.nickname
                : '친구를 삭제할까요?'
          }
          busy={busy}
          onClose={() => setDialog(null)}
        >
          {dialog.kind === 'add' ? (
            <form
              className="friends-add-form"
              onSubmit={(event) => void submitFriendRequest(event)}
            >
              <p>친구의 닉네임을 입력해주세요.</p>
              <label htmlFor="friend-nickname">닉네임으로 친구 요청</label>
              <input
                autoComplete="off"
                id="friend-nickname"
                maxLength={10}
                placeholder="친구 닉네임"
                value={nickname}
                disabled={busy}
                onChange={(event) => setNickname(event.target.value)}
                aria-describedby={model.formError ? 'friend-form-error' : undefined}
              />
              {model.formError ? (
                <p id="friend-form-error" className="friends-error" role="alert">
                  {model.formError}
                </p>
              ) : null}
              <button
                className="friend-primary-action"
                disabled={busy || nickname.trim().length === 0}
                type="submit"
              >
                {model.actionKey === 'send' ? '요청 중…' : '요청 보내기'}
              </button>
            </form>
          ) : dialog.kind === 'manage' ? (
            <div className="friends-management">
              <Link to={`/friends/${dialog.friend.userId}/dashboard`}>
                자물쇠 보기 <span aria-hidden="true">›</span>
              </Link>
              <button
                type="button"
                onClick={() => setDialog({ kind: 'delete', friend: dialog.friend })}
              >
                친구 삭제
              </button>
            </div>
          ) : (
            <>
              <p>{dialog.friend.nickname}님과의 친구 관계가 종료됩니다.</p>
              {model.actionError?.key === `friend-${dialog.friend.friendshipId}` ? (
                <p className="friends-error" role="alert">
                  {model.actionError.message}
                </p>
              ) : null}
              <div className="friends-dialog-actions">
                <button
                  className="friend-secondary-action"
                  data-dialog-autofocus
                  type="button"
                  disabled={busy}
                  onClick={() => setDialog(null)}
                >
                  취소
                </button>
                <button
                  className="friend-primary-action"
                  type="button"
                  disabled={busy}
                  onClick={() => void confirmDelete(dialog.friend)}
                >
                  {busy ? '삭제 중…' : '삭제'}
                </button>
              </div>
            </>
          )}
        </FriendsDialog>
      ) : null}
    </main>
  );
}
