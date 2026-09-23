import { Link } from 'react-router';

/** 회원가입 기능이 연결될 공개 진입 화면의 기본 구조를 제공한다. */
export function SignupPage() {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="signup-title">
        <p className="eyebrow">Join MULO</p>
        <h1 id="signup-title">회원가입</h1>
        <p>새 계정을 만들고 함께 시작해 보세요.</p>
        <Link to="/login">이미 계정이 있나요? 로그인</Link>
      </section>
    </main>
  );
}
