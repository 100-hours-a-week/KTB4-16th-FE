import { Link } from 'react-router';

import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { notificationDate, type NotificationItem } from '../api/notificationApi';
import { useNotificationList } from '../model/useNotificationList';
import './notificationList.css';

/** 도착한 알림과 빈 목록·오류·추가 페이지 상태를 표시한다. */
export function NotificationList({ request }: { request: AuthenticatedApiClient['fetchJson'] }) {
  const { items, nextCursor, status, busy, error, readError, loadPage, retryRead } =
    useNotificationList(request);
  return (
    <section className="notification-list" aria-label="알림 목록">
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
      {status === 'ready' && items.length === 0 ? (
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
              </article>
            );
          })}
        </div>
      ) : null}
      {status === 'ready' && nextCursor !== null ? (
        <button
          className="notification-more"
          type="button"
          disabled={busy}
          onClick={() => void loadPage(nextCursor)}
        >
          {busy ? '불러오는 중…' : '더 보기'}
        </button>
      ) : null}
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
