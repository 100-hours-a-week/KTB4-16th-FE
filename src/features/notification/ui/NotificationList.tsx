import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';

import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { notificationDate, type NotificationItem } from '../api/notificationApi';
import { useNotificationList } from '../model/useNotificationList';
import './notificationList.css';

/** 도착한 알림과 빈 목록·오류·추가 페이지 상태를 표시한다. */
export function NotificationList({ request }: { request: AuthenticatedApiClient['fetchJson'] }) {
  const {
    items,
    nextCursor,
    status,
    busy,
    error,
    readError,
    confirmingId,
    deletingId,
    deleteErrorId,
    loadPage,
    retryRead,
    startDelete,
    cancelDelete,
    confirmDelete,
  } = useNotificationList(request);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLElement>(null);

  /** 확인 창을 열면 취소 버튼으로 초점을 옮기고 닫힌 뒤 원래 위치로 돌린다. */
  useEffect(() => {
    if (confirmingId === null) return;
    const listElement = listRef.current;
    const deleteTrigger = deleteTriggerRef.current;
    cancelDeleteRef.current?.focus();
    return () => {
      if (deleteTrigger?.isConnected) deleteTrigger.focus();
      else if (listElement?.isConnected) listElement.focus();
    };
  }, [confirmingId]);

  return (
    <section className="notification-list" aria-label="알림 목록" ref={listRef} tabIndex={-1}>
      {status === 'loading' ? (
        <p className="notification-state" role="status">
          알림을 불러오는 중이에요.
        </p>
      ) : null}
      {error ? (
        <p className="notification-error" role="alert">
          {error}
        </p>
      ) : null}
      {status === 'error' ? (
        <button className="notification-more" type="button" onClick={() => void loadPage(null)}>
          다시 불러오기
        </button>
      ) : null}
      {readError ? (
        <div className="notification-read-error">
          <p role="alert">{readError}</p>
          <button type="button" disabled={busy} onClick={() => void retryRead()}>
            읽음 처리 다시 시도
          </button>
        </div>
      ) : null}
      {status === 'ready' && items.length === 0 && nextCursor === null ? (
        <div className="notification-empty">
          <span className="notification-empty-icon" aria-hidden="true">
            <NotificationIcon />
          </span>
          <h2>아직 도착한 알림이 없어요</h2>
        </div>
      ) : null}
      {items.length > 0 ? (
        <div className="notification-panel">
          {items.map((item) => {
            const destination = notificationDestination(item);
            return (
              <article
                className={`notification-card${item.readAt === null ? ' is-unread' : ''}`}
                key={item.notificationId}
              >
                <span aria-hidden="true" className="notification-dot" />
                <div className="notification-card-content">
                  <div className="notification-card-heading">
                    <h2>{item.title}</h2>
                    {item.readAt === null ? (
                      <span className="notification-unread">읽지 않음</span>
                    ) : null}
                  </div>
                  <p>{item.content}</p>
                  <time dateTime={notificationDate(item.createdAt).toISOString()}>
                    {new Intl.DateTimeFormat('ko-KR', {
                      timeZone: 'Asia/Seoul',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(notificationDate(item.createdAt))}
                  </time>
                  {destination ? (
                    <Link className="notification-destination" to={destination.to}>
                      {destination.label}
                      <span aria-hidden="true"> →</span>
                    </Link>
                  ) : null}
                </div>
                <button
                  className="notification-delete-trigger"
                  type="button"
                  aria-label="알림 삭제"
                  disabled={busy || deletingId !== null}
                  onClick={(event) => {
                    deleteTriggerRef.current = event.currentTarget;
                    startDelete(item.notificationId);
                  }}
                >
                  삭제
                </button>
              </article>
            );
          })}
        </div>
      ) : null}
      {status === 'ready' && nextCursor !== null ? (
        <button
          className="notification-more"
          type="button"
          disabled={busy || deletingId !== null}
          onClick={() => void loadPage(nextCursor)}
        >
          {busy ? '불러오는 중…' : '더 보기'}
        </button>
      ) : null}
      {confirmingId !== null
        ? createPortal(
            <div className="notification-delete-backdrop">
              <section
                aria-describedby="notification-delete-description"
                aria-labelledby="notification-delete-title"
                aria-modal="true"
                className="notification-delete-dialog"
                role="dialog"
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && deletingId === null) {
                    event.preventDefault();
                    cancelDelete();
                  }
                  if (event.key !== 'Tab') return;
                  const buttons = Array.from(
                    event.currentTarget.querySelectorAll<HTMLButtonElement>(
                      'button:not(:disabled)',
                    ),
                  );
                  const firstButton = buttons[0];
                  const lastButton = buttons[buttons.length - 1];
                  if (!firstButton || !lastButton) {
                    event.preventDefault();
                  } else if (event.shiftKey && document.activeElement === firstButton) {
                    event.preventDefault();
                    lastButton.focus();
                  } else if (!event.shiftKey && document.activeElement === lastButton) {
                    event.preventDefault();
                    firstButton.focus();
                  }
                }}
              >
                <span className="notification-delete-icon" aria-hidden="true">
                  <svg fill="none" viewBox="0 0 24 24">
                    <path d="M4 7h16M10 3h4m-8 4 1 14h10l1-14M10 11v6m4-6v6" />
                  </svg>
                </span>
                <h2 id="notification-delete-title">알림을 삭제할까요?</h2>
                <p id="notification-delete-description">삭제한 알림은 다시 볼 수 없어요.</p>
                {deleteErrorId === confirmingId ? (
                  <p className="notification-delete-error" role="alert">
                    알림을 삭제하지 못했어요. 다시 시도해주세요.
                  </p>
                ) : null}
                <div className="notification-delete-actions">
                  <button
                    ref={cancelDeleteRef}
                    type="button"
                    disabled={deletingId !== null}
                    onClick={cancelDelete}
                  >
                    취소
                  </button>
                  <button
                    className="notification-delete-final"
                    type="button"
                    aria-label={deletingId !== null ? '삭제 중…' : '삭제 확인'}
                    disabled={deletingId !== null || busy}
                    onClick={() => void confirmDelete(confirmingId)}
                  >
                    {deletingId !== null ? '삭제 중…' : '삭제'}
                  </button>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}

/** 알림이 없는 상태를 기존 탐색 아이콘과 같은 선 스타일로 표시한다. */
function NotificationIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </svg>
  );
}

/** 현재 존재하는 화면만 연결하며 관계 ID를 사용자 ID로 오인하지 않는다. */
function notificationDestination(item: NotificationItem): { to: string; label: string } | null {
  if (item.targetId === null) return null;
  if (item.type === 'FRIEND_REQUEST')
    return { to: '/friends?tab=received', label: '받은 요청 보기' };
  if (item.type === 'FRIEND_ACCEPTED') return { to: '/friends', label: '친구 목록 보기' };
  if (item.type === 'MONTHLY_REPORT_CREATED') return { to: '/report', label: '리포트 목록 보기' };
  // 채팅 라우트가 아직 없으므로 MATCH_COMPLETED는 내용만 표시한다.
  return null;
}
