import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';

import { useSession } from '../../../entities/session/model/useSession';
import { getMonthlyReportDetail } from '../../../features/monthly-report/api/monthlyReportApi';
import type { MonthlyReportDetail } from '../../../features/monthly-report/model/monthlyReport.types';
import { MonthlyReportDetail as MonthlyReportDetailContent } from '../../../features/monthly-report/ui/MonthlyReportDetail';
import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import '../../pageShell.css';
import './reportPage.css';

type ReportRouteState = { monthlyReportId: number };
type LoadState = 'loading' | 'ready' | 'error';

/** Router state에서 서버가 발급한 양의 리포트 ID만 읽는다. */
function readMonthlyReportId(state: unknown): number | null {
  if (
    typeof state !== 'object' ||
    state === null ||
    Array.isArray(state) ||
    !Number.isSafeInteger((state as ReportRouteState).monthlyReportId) ||
    (state as ReportRouteState).monthlyReportId <= 0
  ) {
    return null;
  }

  return (state as ReportRouteState).monthlyReportId;
}

/** Router state의 실제 리포트 ID로 상세 조회와 복구 상태를 조립한다. */
export function ReportDetailPage() {
  const { fetchAuthenticatedJson } = useSession();
  const { state } = useLocation();
  const { year, month } = useParams();
  const monthlyReportId = readMonthlyReportId(state);
  const [report, setReport] = useState<MonthlyReportDetail | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [requestVersion, setRequestVersion] = useState(0);

  /** 유효한 목록 전달 ID로만 상세 API를 호출하고 취소된 응답은 무시한다. */
  const loadReport = useCallback(
    async (reportId: number, signal: AbortSignal) => {
      setLoadState('loading');

      try {
        const nextReport = await getMonthlyReportDetail(reportId, fetchAuthenticatedJson, signal);
        if (!signal.aborted) {
          setReport(nextReport);
          setLoadState('ready');
        }
      } catch {
        if (!signal.aborted) {
          setLoadState('error');
        }
      }
    },
    [fetchAuthenticatedJson],
  );

  useEffect(() => {
    if (monthlyReportId === null) {
      return undefined;
    }

    const controller = new AbortController();
    void loadReport(monthlyReportId, controller.signal);

    return () => controller.abort();
  }, [loadReport, monthlyReportId, requestVersion]);

  /** 동일한 서버 리포트 ID를 사용해 실패한 상세 요청을 다시 시작한다. */
  function retryReport() {
    setRequestVersion((version) => version + 1);
  }

  if (monthlyReportId === null) {
    return (
      <main className="static-page">
        <div className="static-page-content">
          <section className="report-empty-state">
            <p>리포트 목록에서 보고 싶은 달을 선택해 주세요.</p>
            <Link to="/report">리포트 목록으로</Link>
          </section>
        </div>
        <MainNavigation />
      </main>
    );
  }

  return (
    <main className="static-page">
      <div className="static-page-content">
        <header className="report-detail-header">
          <Link aria-label="리포트 목록으로" className="report-back-button" to="/report">
            ‹
          </Link>
          <h1 className="static-page-title">
            {year}년 {month}월 리포트
          </h1>
          <span className="report-header-spacer" aria-hidden="true" />
        </header>
        {loadState === 'loading' ? <p role="status">월별 리포트를 불러오는 중이에요.</p> : null}
        {loadState === 'error' ? (
          <section className="report-error-state" role="alert">
            <p>월별 리포트를 불러오지 못했습니다.</p>
            <button onClick={retryReport} type="button">
              다시 시도
            </button>
          </section>
        ) : null}
        {loadState === 'ready' && report !== null ? (
          <MonthlyReportDetailContent report={report} />
        ) : null}
      </div>
      <MainNavigation />
    </main>
  );
}
