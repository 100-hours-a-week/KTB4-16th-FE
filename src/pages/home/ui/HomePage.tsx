import { HomeMap } from '../../../features/home-map/ui/HomeMap';
import './homePage.css';

type NavigationIconName = 'home' | 'dashboard' | 'report' | 'group' | 'profile';

/** 하단 메뉴 의미를 유지하는 동일한 선 굵기의 outline 아이콘을 제공한다. */
function NavigationIcon({ name }: { name: NavigationIconName }) {
  if (name === 'home') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m3.5 10.5 8.5-7 8.5 7v9a1.5 1.5 0 0 1-1.5 1.5h-4.5v-6h-5v6H5a1.5 1.5 0 0 1-1.5-1.5Z" />
      </svg>
    );
  }

  if (name === 'dashboard') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </svg>
    );
  }

  if (name === 'report') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3.5h8.5L19 8v12.5H6Z" />
        <path d="M14.5 3.5V8H19M9 16.5v-3m3 3v-5m3 5v-2" />
      </svg>
    );
  }

  if (name === 'group') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20c.4-3.1 2.4-5 5.5-5s5.1 1.9 5.5 5M16.5 5.5a3 3 0 0 1 0 5M16 15.1c2.4.3 3.9 1.9 4.4 4.9" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c.6-4.1 3.2-6.2 7.5-6.2s6.9 2.1 7.5 6.2" />
    </svg>
  );
}

/** 목업의 홈 진입 화면을 기능 UI로 조립한다. */
export function HomePage() {
  return (
    <main className="home-page">
      <div className="home-page-content">
        <header className="home-topbar">
          <h1>MULO</h1>
          <span className="home-weather-chip">
            ☁️ <strong>21°C</strong>
          </span>
        </header>

        <button className="home-memory-search" type="button">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <span>“비 오던 날 홍대에서 들었던 노래” 같은 기억, 물어보세요</span>
          <em>v3</em>
        </button>

        <section className="home-shortcuts" aria-label="추천 기능">
          <button className="home-shortcut-card" type="button">
            <span className="home-shortcut-icon" aria-hidden="true">
              🎧
            </span>
            <span>
              <strong>지금 나를 위한 플레이리스트</strong>
              <small>위치·날씨·시간·히스토리 기반 추천</small>
            </span>
          </button>
        </section>

        <HomeMap />

        <div className="home-create-action">
          <button type="button">🔒 자물쇠 만들기</button>
        </div>
      </div>

      <nav className="home-bottom-nav" aria-label="주요 메뉴">
        <button className="is-active" type="button" aria-current="page">
          <NavigationIcon name="home" />
          <span>홈</span>
        </button>
        <button type="button">
          <NavigationIcon name="dashboard" />
          <span>대시보드</span>
        </button>
        <button type="button">
          <NavigationIcon name="report" />
          <span>리포트</span>
        </button>
        <button type="button">
          <NavigationIcon name="group" />
          <span>그룹</span>
        </button>
        <button type="button">
          <NavigationIcon name="profile" />
          <span>마이페이지</span>
        </button>
      </nav>
    </main>
  );
}
