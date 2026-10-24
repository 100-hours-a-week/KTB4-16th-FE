import { Link } from 'react-router';

import { useSession } from '../../../entities/session/model/useSession';
import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import { NotificationList } from '../../../features/notification/ui/NotificationList';
import '../../pageShell.css';
import './notificationsPage.css';

/** 보호 라우트에서 알림 목록과 홈 복귀·하단 탐색을 조립한다. */
export function NotificationsPage() {
  const { fetchAuthenticatedJson } = useSession();
  return (
    <main className="static-page notifications-page">
      <div className="static-page-content">
        <header className="static-page-header notification-page-header">
          <Link aria-label="홈으로 돌아가기" className="notification-back-link" to="/">
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
              <path d="m15 6-6 6 6 6" />
            </svg>
          </Link>
          <h1 className="static-page-title">알림</h1>
          <span aria-hidden="true" className="notification-header-spacer" />
        </header>
        <NotificationList request={fetchAuthenticatedJson} />
      </div>
      <MainNavigation />
    </main>
  );
}
