import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import '../../pageShell.css';
import './myPage.css';

const accountMenus = ['닉네임 변경', '비밀번호 변경'];
const accountActions = ['로그아웃', '회원탈퇴'];

/** 목업의 계정 메뉴를 동작 없이 표시하는 마이페이지 정적 UI다. */
export function MyPage() {
  return (
    <main className="static-page">
      <div className="static-page-content">
        <header className="static-page-header">
          <h1 className="static-page-title">마이페이지</h1>
        </header>
        <section className="surface-card my-profile">
          <div>뮤</div>
          <strong>mulo유저</strong>
          <small>example@mulo.com</small>
        </section>
        <MenuGroup items={accountMenus} />
        <MenuGroup items={accountActions} danger />
      </div>
      <MainNavigation />
    </main>
  );
}

function MenuGroup({ danger = false, items }: { danger?: boolean; items: readonly string[] }) {
  return (
    <section className="surface-card my-menu-group">
      {items.map((item) => (
        <button
          className={danger && item === '회원탈퇴' ? 'is-danger' : ''}
          key={item}
          type="button"
        >
          <span>{item}</span>
          <span aria-hidden="true">›</span>
        </button>
      ))}
    </section>
  );
}
