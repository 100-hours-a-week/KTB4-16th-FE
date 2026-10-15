import { Link, useNavigate } from 'react-router';

import { useSession } from '../../../entities/session/model/useSession';
import { WithdrawalForm } from '../../../features/user-profile/ui/WithdrawalForm';
import '../../pageShell.css';
import './myPage.css';

/** 회원 탈퇴 안내와 확인 폼을 조립하는 보호 화면이다. */
export function WithdrawalPage() {
  const { clearSession, fetchAuthenticatedJson } = useSession();
  const navigate = useNavigate();

  /** 서버가 탈퇴를 완료한 뒤 메모리 인증 정보를 지우고 로그인으로 이동한다. */
  const handleSuccess = () => {
    clearSession();
    navigate('/login', { replace: true });
  };

  return (
    <main className="static-page">
      <div className="static-page-content">
        <header className="static-page-header">
          <Link className="settings-back-link" to="/mypage">
            ‹ 마이페이지
          </Link>
          <h1 className="static-page-title">회원 탈퇴</h1>
        </header>
        <section className="surface-card profile-change-card">
          <div className="withdrawal-notice">
            <strong>탈퇴하기 전에 확인해 주세요</strong>
            <p>탈퇴하면 계정과 내가 만든 기록을 더 이상 이용할 수 없어요.</p>
            <p>계속하려면 현재 비밀번호를 입력해 주세요.</p>
          </div>
          <WithdrawalForm onSuccess={handleSuccess} request={fetchAuthenticatedJson} />
        </section>
      </div>
    </main>
  );
}
