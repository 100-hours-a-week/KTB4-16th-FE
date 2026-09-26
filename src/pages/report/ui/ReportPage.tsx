import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import { FeatureUnavailableNotice } from '../../../shared/ui/FeatureUnavailableNotice';
import '../../pageShell.css';
import './reportPage.css';

/** 목록 API 연동 전 월별 리포트를 가짜 집계 없이 구현 예정으로 안내한다. */
export function ReportPage() {
  return (
    <main className="static-page">
      <div className="static-page-content">
        <header className="static-page-header">
          <h1 className="static-page-title">리포트</h1>
          <span className="static-page-chip">구현 예정</span>
        </header>
        <FeatureUnavailableNotice
          description="월별 리포트 기능을 구현할 예정이에요."
          title="월별 리포트"
        />
      </div>
      <MainNavigation />
    </main>
  );
}
