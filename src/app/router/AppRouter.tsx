import { Navigate, Route, Routes } from 'react-router';

import { HomePage } from '../../pages/home/ui/HomePage';
import { DashboardPage } from '../../pages/dashboard/ui/DashboardPage';
import { GroupPage } from '../../pages/group/ui/GroupPage';
import { LoginPage } from '../../pages/login/LoginPage';
import { LockCreatePage } from '../../pages/lock-create/ui/LockCreatePage';
import { MyPage } from '../../pages/mypage/ui/MyPage';
import { MemorySearchPage } from '../../pages/memory-search/ui/MemorySearchPage';
import { ReportPage } from '../../pages/report/ui/ReportPage';
import { ReportDetailPage } from '../../pages/report/ui/ReportDetailPage';
import { SignupPage } from '../../pages/signup/SignupPage';
import { useSession } from '../../entities/session/model/useSession';

/** 홈은 공개하고 로그인 상태의 인증 화면 재진입만 홈으로 돌려보낸다. */
export function AppRouter() {
  const { isAuthenticated } = useSession();

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/dashboard"
        element={isAuthenticated ? <DashboardPage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/report"
        element={isAuthenticated ? <ReportPage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/report/:year/:month"
        element={isAuthenticated ? <ReportDetailPage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/group"
        element={isAuthenticated ? <GroupPage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/mypage"
        element={isAuthenticated ? <MyPage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/memory-search"
        element={isAuthenticated ? <MemorySearchPage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/locks/create"
        element={isAuthenticated ? <LockCreatePage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/signup"
        element={isAuthenticated ? <Navigate to="/" replace /> : <SignupPage />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
