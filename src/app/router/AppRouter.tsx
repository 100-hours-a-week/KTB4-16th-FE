import { Navigate, Route, Routes } from 'react-router';
import type { ReactNode } from 'react';

import { HomePage } from '../../pages/home/ui/HomePage';
import { DashboardPage } from '../../pages/dashboard/ui/DashboardPage';
import { LoginPage } from '../../pages/login/LoginPage';
import { LockCreatePage } from '../../pages/lock-create/ui/LockCreatePage';
import { LockDetailPage } from '../../pages/lock-detail/ui/LockDetailPage';
import { MyPage } from '../../pages/mypage/ui/MyPage';
import { NicknameChangePage } from '../../pages/mypage/ui/NicknameChangePage';
import { PasswordChangePage } from '../../pages/mypage/ui/PasswordChangePage';
import { MemorySearchPage } from '../../pages/memory-search/ui/MemorySearchPage';
import { ReportPage } from '../../pages/report/ui/ReportPage';
import { ReportDetailPage } from '../../pages/report/ui/ReportDetailPage';
import { SignupPage } from '../../pages/signup/SignupPage';
import { useSession } from '../../entities/session/model/useSession';

/** 세션 복원 중에는 보호 화면의 로그인 리다이렉트를 보류한다. */
function getProtectedRouteElement(
  isSessionRestoring: boolean,
  isAuthenticated: boolean,
  page: ReactNode,
): ReactNode {
  if (isSessionRestoring) {
    return getSessionRestoringElement();
  }

  return isAuthenticated ? page : <Navigate to="/login" replace />;
}

/** 진행 중인 세션 복원과 로그인 요청이 경합하지 않도록 대기 화면을 반환한다. */
function getSessionRestoringElement(): ReactNode {
  return <div role="status" aria-label="세션 확인 중" aria-busy="true" />;
}

/** 홈은 공개하고 로그인 상태의 인증 화면 재진입만 홈으로 돌려보낸다. */
export function AppRouter() {
  const { isAuthenticated, isSessionRestoring } = useSession();

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/dashboard"
        element={getProtectedRouteElement(isSessionRestoring, isAuthenticated, <DashboardPage />)}
      />
      <Route
        path="/report"
        element={getProtectedRouteElement(isSessionRestoring, isAuthenticated, <ReportPage />)}
      />
      <Route
        path="/report/:year/:month"
        element={getProtectedRouteElement(
          isSessionRestoring,
          isAuthenticated,
          <ReportDetailPage />,
        )}
      />
      <Route
        path="/mypage"
        element={getProtectedRouteElement(isSessionRestoring, isAuthenticated, <MyPage />)}
      />
      <Route
        path="/mypage/nickname"
        element={getProtectedRouteElement(
          isSessionRestoring,
          isAuthenticated,
          <NicknameChangePage />,
        )}
      />
      <Route
        path="/mypage/password"
        element={getProtectedRouteElement(
          isSessionRestoring,
          isAuthenticated,
          <PasswordChangePage />,
        )}
      />
      <Route
        path="/memory-search"
        element={getProtectedRouteElement(
          isSessionRestoring,
          isAuthenticated,
          <MemorySearchPage />,
        )}
      />
      <Route
        path="/locks/create"
        element={getProtectedRouteElement(isSessionRestoring, isAuthenticated, <LockCreatePage />)}
      />
      <Route
        path="/records/:recordId"
        element={getProtectedRouteElement(isSessionRestoring, isAuthenticated, <LockDetailPage />)}
      />
      <Route
        path="/login"
        element={
          isSessionRestoring ? (
            getSessionRestoringElement()
          ) : isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            <LoginPage />
          )
        }
      />
      <Route
        path="/signup"
        element={
          isSessionRestoring ? (
            getSessionRestoringElement()
          ) : isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            <SignupPage />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
