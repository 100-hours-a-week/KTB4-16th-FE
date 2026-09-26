import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import { FeatureUnavailableNotice } from '../../../shared/ui/FeatureUnavailableNotice';
import '../../pageShell.css';
import './reportPage.css';

/** 목록 API 미구현 상태에서 월별 리포트를 가짜 집계 없이 안내한다. */
export function ReportPage() {
  return (
    <main className="static-page">
      <div className="static-page-content">
        <header className="static-page-header">
          <h1 className="static-page-title">리포트</h1>
          <span className="static-page-chip">미구현</span>
        </header>
        <FeatureUnavailableNotice
          description="월별 리포트 목록 API가 아직 구현되지 않았어요."
          title="월별 리포트"
        />
      </div>
      <MainNavigation />
    </main>
  );
}
