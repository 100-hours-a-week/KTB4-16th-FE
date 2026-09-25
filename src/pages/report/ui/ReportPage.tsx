import { Link } from 'react-router';

import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import '../../pageShell.css';
import './reportPage.css';

const months = [
  '1월',
  '2월',
  '3월',
  '4월',
  '5월',
  '6월',
  '7월',
  '8월',
  '9월',
  '10월',
  '11월',
  '12월',
];
const recordCounts: Record<string, string> = {
  '3월': '6개',
  '4월': '9개',
  '5월': '11개',
  '6월': '7개',
  '7월': '14개',
  '8월': '8개',
};

/** 목업의 월별 리포트 선택 화면을 API 없이 정적으로 보여준다. */
export function ReportPage() {
  return (
    <main className="static-page">
      <div className="static-page-content">
        <header className="static-page-header">
          <h1 className="static-page-title">리포트</h1>
          <span className="static-page-chip">AI RECAP</span>
        </header>
        <div className="report-year">
          <button type="button" aria-label="이전 연도">
            ‹
          </button>
          <strong>2026년</strong>
          <button type="button" aria-label="다음 연도">
            ›
          </button>
        </div>
        <section className="report-month-grid" aria-label="월별 기록">
          {months.map((month) =>
            recordCounts[month] ? (
              <Link className="report-month has-data" key={month} to={`/report/2026/${month}`}>
                <strong>{month}</strong>
                <small>{recordCounts[month]}</small>
              </Link>
            ) : (
              <div className="report-month" key={month}>
                <strong>{month}</strong>
                <small>-</small>
              </div>
            ),
          )}
        </section>
      </div>
      <MainNavigation />
    </main>
  );
}
