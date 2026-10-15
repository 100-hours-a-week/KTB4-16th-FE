import { Link, useParams } from 'react-router';

import { FriendDashboardContent } from '../../../features/dashboard/ui/FriendDashboardContent';
import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import '../../pageShell.css';
import './friendDashboardPage.css';

/** URL의 친구 ID를 검증하고 로그인 보호 친구 대시보드를 조립한다. */
export function FriendDashboardPage() {
  const { friendUserId: friendUserIdParam } = useParams();
  const friendUserId = Number(friendUserIdParam);
  const isValidFriendId = Number.isSafeInteger(friendUserId) && friendUserId > 0;

  return (
    <main className="static-page">
      <div className="static-page-content">
        <header className="static-page-header">
          <h1 className="static-page-title">친구 대시보드</h1>
          <Link className="friend-dashboard-back-link" to="/friends">
            친구 목록
          </Link>
        </header>
        {isValidFriendId ? (
          <FriendDashboardContent key={friendUserId} friendUserId={friendUserId} />
        ) : (
          <section className="dashboard-status-group">
            <p className="dashboard-status is-error">친구를 찾을 수 없어요.</p>
            <Link className="friend-dashboard-back-link" to="/friends">
              친구 목록으로
            </Link>
          </section>
        )}
      </div>
      <MainNavigation activeItem="friends" />
    </main>
  );
}
