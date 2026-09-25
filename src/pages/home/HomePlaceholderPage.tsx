import { useSession } from '../../entities/session/model/useSession';

/** 로그인 연동 성공과 로그아웃 동작을 확인할 최소 홈 화면을 제공한다. */
export function HomePlaceholderPage() {
  const { clearSession } = useSession();

  return (
    <main className="home-page">
      <section className="home-card" aria-labelledby="home-title">
        <p className="eyebrow">함께 만드는 하루</p>
        <h1 id="home-title">MULO에 오신 것을 환영합니다</h1>
        <p>로그인이 완료되었습니다. 다음 화면은 팀과 논의한 뒤 이곳에서 이어집니다.</p>
        <button type="button" onClick={clearSession}>
          로그아웃
        </button>
      </section>
    </main>
  );
}
