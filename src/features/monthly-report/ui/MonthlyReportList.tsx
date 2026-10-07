import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';

import type { MonthlyReportSummary } from '../model/monthlyReport.types';

type MonthlyReportListProps = {
  reports: MonthlyReportSummary[];
};

/** 브라우저의 지역 설정과 관계없이 서비스 기준인 한국 시간의 현재 연도를 구한다. */
function getCurrentReportYear(): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'Asia/Seoul' }).format(
      new Date(),
    ),
  );
}

/** 선택 연도에 속한 리포트를 월 오름차순으로 정렬한다. */
function getReportsForYear(reports: MonthlyReportSummary[], year: number): MonthlyReportSummary[] {
  return reports
    .filter((report) => report.year === year)
    .sort((left, right) => left.month - right.month);
}

/** 선택 연도의 12개월을 표시하고 서버에 존재하는 리포트만 상세 링크로 연다. */
export function MonthlyReportList({ reports }: MonthlyReportListProps) {
  const currentYear = getCurrentReportYear();
  const [activeYear, setActiveYear] = useState(currentYear);
  const [yearDraft, setYearDraft] = useState(String(currentYear));
  const reportsForYear = getReportsForYear(reports, activeYear);
  const reportsByMonth = new Map(reportsForYear.map((report) => [report.month, report]));

  /** 앞뒤 연도로 이동할 때 화면과 빠른 이동 입력값을 함께 맞춘다. */
  function moveYear(offset: number) {
    const nextYear = Math.max(1, Math.min(9999, activeYear + offset));
    setActiveYear(nextYear);
    setYearDraft(String(nextYear));
  }

  /** 입력한 유효한 연도로 바로 이동하고 해당 연도의 월별 리포트를 보여준다. */
  function jumpToYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextYear = Number(yearDraft);
    if (!Number.isSafeInteger(nextYear) || nextYear < 1 || nextYear > 9999) return;
    setActiveYear(nextYear);
    setYearDraft(String(nextYear));
  }

  return (
    <section aria-label="월별 리포트 목록">
      <div className="report-year-controls" role="group" aria-label="리포트 연도 이동">
        <button
          aria-label="이전 연도"
          disabled={activeYear === 1}
          onClick={() => moveYear(-1)}
          type="button"
        >
          ‹
        </button>
        <strong aria-live="polite">{activeYear}년</strong>
        <button
          aria-label="다음 연도"
          disabled={activeYear === 9999}
          onClick={() => moveYear(1)}
          type="button"
        >
          ›
        </button>
      </div>
      <form className="report-year-jump" onSubmit={jumpToYear}>
        <label htmlFor="report-year-input">연도 바로 이동</label>
        <input
          id="report-year-input"
          inputMode="numeric"
          max={9999}
          min={1}
          onChange={(event) => setYearDraft(event.target.value)}
          required
          type="number"
          value={yearDraft}
        />
        <button type="submit">이동</button>
      </form>
      {reports.length === 0 ? (
        <p className="report-empty-state">아직 생성된 월별 리포트가 없어요.</p>
      ) : null}
      <div className="report-month-grid" role="region" aria-label={`${activeYear}년 리포트`}>
        {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => {
          const report = reportsByMonth.get(month);
          if (!report) {
            return (
              <span className="report-month is-unavailable" key={month}>
                <strong>{month}월</strong>
                <small>리포트 없음</small>
              </span>
            );
          }

          return (
            <Link
              aria-label={`${month}월 리포트 · 기록 ${report.recordCount}개 · ${report.aiRecapStatus === 'COMPLETED' ? 'AI 회고 완료' : 'AI 회고 준비 중'}`}
              className="report-month has-data"
              key={month}
              state={{ monthlyReportId: report.monthlyReportId }}
              to={`/report/${report.year}/${month}`}
            >
              <strong>{month}월</strong>
              <small>기록 {report.recordCount}개</small>
              <small>
                {report.aiRecapStatus === 'COMPLETED' ? 'AI 회고 완료' : 'AI 회고 준비 중'}
              </small>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
