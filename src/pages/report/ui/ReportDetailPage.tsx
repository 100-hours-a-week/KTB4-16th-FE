import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import { FeatureUnavailableNotice } from '../../../shared/ui/FeatureUnavailableNotice';
import '../../pageShell.css';
import './reportPage.css';

/** 직접 접근한 상세 경로도 목업 리포트 대신 구현 예정 상태로 유지한다. */
export function ReportDetailPage() {
  return (
    <main className="static-page">
      <div className="static-page-content">
        <FeatureUnavailableNotice
          description="월별 리포트 기능을 구현할 예정이에요."
          title="월별 리포트"
        />
      </div>
      <MainNavigation />
    </main>
  );
}
