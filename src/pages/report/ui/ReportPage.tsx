import { useCallback, useEffect, useState } from 'react';

import { useSession } from '../../../entities/session/model/useSession';
import { getMonthlyReports } from '../../../features/monthly-report/api/monthlyReportApi';
import type { MonthlyReportSummary } from '../../../features/monthly-report/model/monthlyReport.types';
import { MonthlyReportList } from '../../../features/monthly-report/ui/MonthlyReportList';
import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import '../../pageShell.css';
import './reportPage.css';

type LoadState = 'loading' | 'ready' | 'error';

/** 인증된 목록 API 상태를 관리하며 월별 리포트 화면을 조립한다. */
export function ReportPage() {
  const { fetchAuthenticatedJson } = useSession();
  const [reports, setReports] = useState<MonthlyReportSummary[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [requestVersion, setRequestVersion] = useState(0);

  /** 최신 요청만 반영하도록 취소 신호와 함께 월별 리포트 목록을 조회한다. */
  const loadReports = useCallback(
    async (signal: AbortSignal) => {
      setLoadState('loading');

      try {
        const nextReports = await getMonthlyReports(fetchAuthenticatedJson, signal);
        if (!signal.aborted) {
          setReports(nextReports);
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
    const controller = new AbortController();
    void loadReports(controller.signal);

    return () => controller.abort();
  }, [loadReports, requestVersion]);

  /** 실패한 목록 요청을 새 AbortController로 다시 시작한다. */
  function retryReports() {
    setRequestVersion((version) => version + 1);
  }

  return (
    <main className="static-page">
      <div className="static-page-content">
        <header className="static-page-header">
          <h1 className="static-page-title">리포트</h1>
          <span className="static-page-chip">나의 월별 기록</span>
        </header>
        {loadState === 'loading' ? <p role="status">월별 리포트를 불러오는 중이에요.</p> : null}
        {loadState === 'error' ? (
          <section className="report-error-state" role="alert">
            <p>월별 리포트를 불러오지 못했습니다.</p>
            <button onClick={retryReports} type="button">
              다시 시도
            </button>
          </section>
        ) : null}
        {loadState === 'ready' ? <MonthlyReportList reports={reports} /> : null}
      </div>
      <MainNavigation />
    </main>
  );
}
