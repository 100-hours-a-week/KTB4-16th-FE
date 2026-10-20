import { useLayoutEffect, useRef } from 'react';
import { Link, Outlet, useParams } from 'react-router';

import { FriendDashboardContent } from '../../../features/dashboard/ui/FriendDashboardContent';
import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import '../../pageShell.css';
import './friendDashboardPage.css';

/** 상세를 중첩해 열어 친구·지역·추가 페이지 상태를 목록 컴포넌트에 유지한다. */
export function FriendDashboardPage() {
  const { friendUserId: friendUserIdParam, recordId } = useParams();
  const friendUserId = Number(friendUserIdParam);
  const isValidFriendId = Number.isSafeInteger(friendUserId) && friendUserId > 0;
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);
  const openedRecordRef = useRef<string | undefined>(undefined);

  useLayoutEffect(() => {
    if (recordId) {
      openedRecordRef.current = recordId;
      return;
    }
    const content = scrollRef.current;
    if (!content) return;
    // 목록은 숨긴 채 유지하며, 상세를 닫을 때 스크롤과 열었던 카드의 포커스를 복원한다.
    content.scrollTop = scrollTopRef.current;
    const card = Array.from(content.querySelectorAll<HTMLAnchorElement>('[data-record-id]')).find(
      (element) => element.dataset.recordId === openedRecordRef.current,
    );
    card?.focus({ preventScroll: true });
  }, [recordId]);

  return (
    <>
      <div hidden={recordId !== undefined}>
        <main className="static-page friend-dashboard-page">
          <div
            ref={scrollRef}
            className="static-page-content friend-dashboard-scroll"
            onScroll={(event) => {
              if (!recordId) scrollTopRef.current = event.currentTarget.scrollTop;
            }}
          >
            <header className="static-page-header">
              <h1 className="static-page-title">친구의 자물쇠</h1>
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
      </div>
      <Outlet />
    </>
  );
}
