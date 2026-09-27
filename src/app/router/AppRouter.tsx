import { Navigate, Route, Routes } from 'react-router';
import type { ReactNode } from 'react';

import { HomePage } from '../../pages/home/ui/HomePage';
import { DashboardPage } from '../../pages/dashboard/ui/DashboardPage';
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
  const { isAuthenticated, isSessionReady } = useSession();
  const protectedPage = (page: ReactNode) => {
    if (!isSessionReady) {
      return (
        <main aria-live="polite" role="status">
          인증 정보를 확인하고 있습니다.
        </main>
      );
    }

    return isAuthenticated ? page : <Navigate to="/login" replace />;
  };

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/dashboard" element={protectedPage(<DashboardPage />)} />
      <Route path="/report" element={protectedPage(<ReportPage />)} />
      <Route path="/report/:year/:month" element={protectedPage(<ReportDetailPage />)} />
      <Route path="/mypage" element={protectedPage(<MyPage />)} />
      <Route path="/memory-search" element={protectedPage(<MemorySearchPage />)} />
      <Route path="/locks/create" element={protectedPage(<LockCreatePage />)} />
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
