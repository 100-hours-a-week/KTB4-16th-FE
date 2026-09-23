import { Navigate, Route, Routes } from 'react-router';

import { HomePage } from '../../pages/home/ui/HomePage';
import { LoginPage } from '../../pages/login/LoginPage';
import { SignupPage } from '../../pages/signup/SignupPage';
import { useSession } from '../../entities/session/model/useSession';

/** 홈은 공개하고 로그인 상태의 인증 화면 재진입만 홈으로 돌려보낸다. */
export function AppRouter() {
  const { isAuthenticated } = useSession();

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
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
