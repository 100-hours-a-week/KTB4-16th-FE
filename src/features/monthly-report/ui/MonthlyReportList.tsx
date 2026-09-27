import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import type { MonthlyReportSummary } from '../model/monthlyReport.types';

type MonthlyReportListProps = {
  reports: MonthlyReportSummary[];
};

/** 서버 목록에서 선택 가능한 연도를 최신순으로 추출한다. */
function getReportYears(reports: MonthlyReportSummary[]): number[] {
  return [...new Set(reports.map((report) => report.year))].sort((left, right) => right - left);
}

/** 선택 연도에 속한 리포트를 월 오름차순으로 정렬한다. */
function getReportsForYear(reports: MonthlyReportSummary[], year: number): MonthlyReportSummary[] {
  return reports
    .filter((report) => report.year === year)
    .sort((left, right) => left.month - right.month);
}

/** API가 제공한 월 리포트를 연도별 목록과 상세 이동 링크로 표시한다. */
export function MonthlyReportList({ reports }: MonthlyReportListProps) {
  const years = useMemo(() => getReportYears(reports), [reports]);
  const [selectedYear, setSelectedYear] = useState(() => years[0] ?? null);
  const activeYear = years.includes(selectedYear ?? NaN) ? selectedYear : (years[0] ?? null);
  const reportsForYear = activeYear === null ? [] : getReportsForYear(reports, activeYear);

  if (reports.length === 0) {
    return <p className="report-empty-state">아직 생성된 월별 리포트가 없어요.</p>;
  }

  return (
    <section aria-label="월별 리포트 목록">
      <div className="report-year-tabs" role="tablist" aria-label="리포트 연도 선택">
        {years.map((year) => (
          <button
            aria-selected={activeYear === year}
            className={activeYear === year ? 'is-selected' : undefined}
            key={year}
            onClick={() => setSelectedYear(year)}
            role="tab"
            type="button"
          >
            {year}년
          </button>
        ))}
      </div>
      <div className="report-month-grid" role="tabpanel" aria-label={`${activeYear}년 리포트`}>
        {reportsForYear.map((report) => (
          <Link
            className="report-month has-data"
            key={report.monthlyReportId}
            state={{ monthlyReportId: report.monthlyReportId }}
            to={`/report/${report.year}/${report.month}`}
          >
            <strong>{report.month}월 리포트</strong>
            <small>기록 {report.recordCount}개</small>
            <small>
              {report.aiRecapStatus === 'COMPLETED' ? 'AI 회고 완료' : 'AI 회고 준비 중'}
            </small>
          </Link>
        ))}
      </div>
    </section>
  );
}
