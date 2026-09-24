import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import { useNavigate } from 'react-router';
import '../../pageShell.css';
import './dashboardPage.css';

const placeGroups = [
  {
    place: '삼평동',
    count: '자물쇠 2개',
    locks: [
      ['밤편지 — 아이유', '08.24 · 흐림 21°C', '🌙'],
      ['Love wins all — 아이유', '08.09 · 맑음 29°C', '☕'],
    ],
  },
  {
    place: '백현동',
    count: '자물쇠 1개',
    locks: [['Ditto — NewJeans', '08.21 · 맑음 26°C', '🥰']],
  },
] as const;

/** 목업의 장소별 자물쇠 목록을 API 없이 정적 UI로 표시한다. */
export function DashboardPage() {
  const navigate = useNavigate();

  return (
    <main className="static-page">
      <div className="static-page-content">
        <header className="static-page-header">
          <h1 className="static-page-title">내 대시보드</h1>
          <div className="dashboard-actions">
            <span className="static-page-chip">나만 볼 수 있음</span>
            <button
              className="dashboard-create"
              type="button"
              aria-label="자물쇠 만들기"
              onClick={() => navigate('/locks/create')}
            >
              +
            </button>
          </div>
        </header>
        <div className="dashboard-list">
          {placeGroups.map((group) => (
            <section className="surface-card dashboard-place" key={group.place}>
              <header>
                <span className="dashboard-pin" />
                <strong>{group.place}</strong>
                <small>{group.count}</small>
              </header>
              {group.locks.map(([song, detail, mood]) => (
                <button className="dashboard-lock" key={song} type="button">
                  <span className="dashboard-cover" />
                  <span>
                    <b>{song}</b>
                    <small>{detail}</small>
                  </span>
                  <em>{mood}</em>
                </button>
              ))}
            </section>
          ))}
        </div>
      </div>
      <MainNavigation />
    </main>
  );
}
