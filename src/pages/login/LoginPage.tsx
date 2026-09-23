import { Link } from 'react-router';

/** 로그인 기능이 연결될 공개 진입 화면의 기본 구조를 제공한다. */
export function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <p className="eyebrow">Welcome back</p>
        <h1 id="login-title">로그인</h1>
        <p>계정으로 MULO를 시작해 보세요.</p>
        <Link to="/signup">처음이신가요? 회원가입</Link>
      </section>
    </main>
  );
}
