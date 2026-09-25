import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import { DashboardContent } from '../../../features/dashboard/ui/DashboardContent';
import { useNavigate } from 'react-router';
import '../../pageShell.css';
import './dashboardPage.css';

/** 대시보드 페이지의 고정 헤더·내비게이션과 지역별 자물쇠 기능 UI를 조립한다. */
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
        <DashboardContent />
      </div>
      <MainNavigation />
    </main>
  );
}
