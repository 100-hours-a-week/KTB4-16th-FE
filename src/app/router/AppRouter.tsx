import { Navigate, Route, Routes } from 'react-router';

import { useSession } from '../../entities/session/model/useSession';
import { HomePage } from '../../pages/home/ui/HomePage';
import { LoginPage } from '../../pages/login/LoginPage';
import { SignupPage } from '../../pages/signup/SignupPage';

/** 인증 여부에 따라 공개 인증 화면과 보호된 홈 화면을 분기한다. */
export function AppRouter() {
  const { isAuthenticated } = useSession();

  return (
    <Routes>
      <Route path="/" element={isAuthenticated ? <HomePage /> : <Navigate to="/login" replace />} />
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
