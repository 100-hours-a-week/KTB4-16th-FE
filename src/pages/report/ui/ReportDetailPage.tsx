import { Link, Navigate, useParams } from 'react-router';

import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import '../../pageShell.css';
import './reportPage.css';

const reportMonths = new Set(['3월', '4월', '5월', '6월', '7월', '8월']);

/** 선택한 월의 목업 RECAP을 표시하고 목록으로 돌아갈 수 있게 한다. */
export function ReportDetailPage() {
  const { month, year } = useParams();

  if (year !== '2026' || !month || !reportMonths.has(month)) {
    return <Navigate to="/report" replace />;
  }

  return (
    <main className="static-page">
      <div className="static-page-content">
        <header className="report-detail-header">
          <Link aria-label="리포트 목록으로 돌아가기" className="report-back-button" to="/report">
            ‹
          </Link>
          <h1 className="static-page-title">{month} 리포트</h1>
          <span aria-hidden="true" className="report-header-spacer" />
        </header>
        <section className="report-recap" aria-label={`${month} AI 리캡`}>
          <span>AI RECAP · 2026.08</span>
          <h2>“당신은 주로 비 오는 날 발라드를, 흐린 저녁의 동탄역에서 저장했어요.”</h2>
        </section>
        <div className="report-stat-grid">
          <article className="surface-card">
            <small>TOP ARTIST</small>
            <strong>아이유</strong>
          </article>
          <article className="surface-card">
            <small>TOP PLACE</small>
            <strong>동탄역</strong>
          </article>
        </div>
        <section className="surface-card report-mood">
          <h2>이번 달 평균 기분</h2>
          <div>
            <span aria-hidden="true">😄</span>
            <strong>32점</strong>
          </div>
        </section>
        <section className="surface-card report-photo">
          <h2>📷 AI 사진 분위기 분류</h2>
          <span>노을 42%</span>
          <span>카페 28%</span>
        </section>
        <button className="report-share" type="button">
          리포트 공유하기
        </button>
      </div>
      <MainNavigation />
    </main>
  );
}
