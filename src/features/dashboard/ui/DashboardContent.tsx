import { useCallback, useEffect, useRef, useState } from 'react';

import { useSession } from '../../../entities/session/model/useSession';
import { getRecordRegions, type RecordRegion } from '../api/getRecordRegions';
import { getRegionRecords, type RegionRecord } from '../api/getRegionRecords';
import './dashboardContent.css';

type RegionsLoadState = 'loading' | 'ready' | 'empty' | 'error';
type RecordsLoadState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

/** 지역 목록과 선택 지역의 Cursor 기반 자물쇠 목록을 대시보드에서 관리한다. */
export function DashboardContent() {
  const { fetchAuthenticatedJson } = useSession();
  const regionsRequestRef = useRef<AbortController | null>(null);
  const recordsRequestRef = useRef<AbortController | null>(null);
  const recordsRequestIdRef = useRef(0);
  const selectedCodeRef = useRef<string | null>(null);
  const [regions, setRegions] = useState<RecordRegion[]>([]);
  const [regionsLoadState, setRegionsLoadState] = useState<RegionsLoadState>('loading');
  const [selectedRegion, setSelectedRegion] = useState<RecordRegion | null>(null);
  const [records, setRecords] = useState<RegionRecord[]>([]);
  const [recordsCount, setRecordsCount] = useState(0);
  const [recordsLoadState, setRecordsLoadState] = useState<RecordsLoadState>('idle');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);

  /** 지역을 바꿀 때 이전 요청과 목록 상태를 모두 무효화한다. */
  const clearSelectedRegion = useCallback(() => {
    recordsRequestRef.current?.abort();
    recordsRequestRef.current = null;
    recordsRequestIdRef.current += 1;
    selectedCodeRef.current = null;
    setSelectedRegion(null);
    setRecords([]);
    setRecordsCount(0);
    setRecordsLoadState('idle');
    setNextCursor(null);
    setIsLoadingMore(false);
    setLoadMoreFailed(false);
  }, []);

  /** 선택 지역의 첫 페이지 또는 다음 Cursor 페이지를 최신 요청만 반영한다. */
  const loadRegionRecords = useCallback(
    async (region: RecordRegion, cursor: string | null, append: boolean) => {
      recordsRequestRef.current?.abort();
      const controller = new AbortController();
      const requestId = recordsRequestIdRef.current + 1;
      recordsRequestIdRef.current = requestId;
      recordsRequestRef.current = controller;

      if (append) {
        setIsLoadingMore(true);
        setLoadMoreFailed(false);
      } else {
        setRecords([]);
        setRecordsCount(region.recordsCount);
        setRecordsLoadState('loading');
        setNextCursor(null);
        setIsLoadingMore(false);
        setLoadMoreFailed(false);
      }

      try {
        const page = await getRegionRecords(
          region.legalDongCode,
          cursor,
          fetchAuthenticatedJson,
          controller.signal,
        );

        if (
          controller.signal.aborted ||
          requestId !== recordsRequestIdRef.current ||
          selectedCodeRef.current !== region.legalDongCode
        ) {
          return;
        }

        setRecords((currentRecords) =>
          append ? [...currentRecords, ...page.records] : page.records,
        );
        setRecordsCount(page.recordsCount);
        setNextCursor(page.nextCursor);
        setRecordsLoadState(page.records.length === 0 && !append ? 'empty' : 'ready');
      } catch {
        if (
          !controller.signal.aborted &&
          requestId === recordsRequestIdRef.current &&
          selectedCodeRef.current === region.legalDongCode
        ) {
          if (append) {
            setLoadMoreFailed(true);
          } else {
            setRecordsLoadState('error');
          }
        }
      } finally {
        if (requestId === recordsRequestIdRef.current) {
          recordsRequestRef.current = null;
          setIsLoadingMore(false);
        }
      }
    },
    [fetchAuthenticatedJson],
  );

  /** 로그인 사용자의 지역 그룹을 최초 진입 시 한 번 조회한다. */
  const loadRegions = useCallback(async () => {
    regionsRequestRef.current?.abort();
    const controller = new AbortController();
    regionsRequestRef.current = controller;
    setRegionsLoadState('loading');

    try {
      const nextRegions = await getRecordRegions(fetchAuthenticatedJson, controller.signal);

      if (controller.signal.aborted || regionsRequestRef.current !== controller) {
        return;
      }

      setRegions(nextRegions);
      setRegionsLoadState(nextRegions.length === 0 ? 'empty' : 'ready');
    } catch {
      if (!controller.signal.aborted && regionsRequestRef.current === controller) {
        setRegionsLoadState('error');
      }
    } finally {
      if (regionsRequestRef.current === controller) {
        regionsRequestRef.current = null;
      }
    }
  }, [fetchAuthenticatedJson]);

  useEffect(() => {
    const requestFrame = requestAnimationFrame(() => {
      void loadRegions();
    });

    return () => {
      cancelAnimationFrame(requestFrame);
      regionsRequestRef.current?.abort();
      recordsRequestRef.current?.abort();
      recordsRequestIdRef.current += 1;
    };
  }, [loadRegions]);

  function selectRegion(region: RecordRegion) {
    selectedCodeRef.current = region.legalDongCode;
    setSelectedRegion(region);
    void loadRegionRecords(region, null, false);
  }

  if (selectedRegion !== null) {
    return (
      <section className="dashboard-detail" aria-label={`${selectedRegion.legalDongName} 자물쇠`}>
        <div className="dashboard-detail-heading">
          <div>
            <p className="dashboard-eyebrow">내 자물쇠</p>
            <h2>{selectedRegion.legalDongName}</h2>
            <span>자물쇠 {recordsCount}개</span>
          </div>
          <button className="dashboard-close" type="button" onClick={clearSelectedRegion}>
            닫기
          </button>
        </div>

        {recordsLoadState === 'loading' ? (
          <p className="dashboard-status">자물쇠를 불러오는 중이에요.</p>
        ) : null}
        {recordsLoadState === 'empty' ? (
          <p className="dashboard-status">이 지역에 남긴 자물쇠가 없어요.</p>
        ) : null}
        {recordsLoadState === 'error' ? (
          <p className="dashboard-status is-error">자물쇠를 불러오지 못했어요.</p>
        ) : null}
        {recordsLoadState === 'ready' ? (
          <div className="dashboard-record-list">
            {records.map((record) => (
              <article className="dashboard-record" key={record.recordId}>
                <span className="dashboard-cover" aria-hidden="true" />
                <span>
                  <strong>{record.title}</strong>
                  <small>
                    {record.artistName} · {formatRecordDate(record.createdAt)}
                  </small>
                </span>
              </article>
            ))}
            {nextCursor !== null ? (
              <button
                className="dashboard-more"
                type="button"
                disabled={isLoadingMore}
                onClick={() => void loadRegionRecords(selectedRegion, nextCursor, true)}
              >
                {isLoadingMore ? '불러오는 중...' : '더 보기'}
              </button>
            ) : null}
            {loadMoreFailed ? (
              <p className="dashboard-more-error">추가 자물쇠를 불러오지 못했어요.</p>
            ) : null}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="dashboard-regions" aria-label="내 자물쇠 지역 목록">
      {regionsLoadState === 'loading' ? (
        <p className="dashboard-status">지역을 불러오는 중이에요.</p>
      ) : null}
      {regionsLoadState === 'empty' ? (
        <p className="dashboard-status">아직 만든 자물쇠가 없어요.</p>
      ) : null}
      {regionsLoadState === 'error' ? (
        <div className="dashboard-status-group">
          <p className="dashboard-status is-error">지역을 불러오지 못했어요.</p>
          <button className="dashboard-retry" type="button" onClick={() => void loadRegions()}>
            다시 시도
          </button>
        </div>
      ) : null}
      {regionsLoadState === 'ready'
        ? regions.map((region) => (
            <button
              className="surface-card dashboard-region"
              key={region.legalDongCode}
              type="button"
              onClick={() => selectRegion(region)}
            >
              <span className="dashboard-pin" aria-hidden="true" />
              <span>
                <strong>{region.legalDongName}</strong>
                <small>자물쇠 {region.recordsCount}개</small>
              </span>
              <span className="dashboard-chevron" aria-hidden="true">
                ›
              </span>
            </button>
          ))
        : null}
    </section>
  );
}

function formatRecordDate(createdAt: string): string {
  return createdAt.slice(0, 10).replaceAll('-', '.');
}
