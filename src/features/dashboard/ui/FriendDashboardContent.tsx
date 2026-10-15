import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { getFriendRecordRegions, type FriendRecordDashboard } from '../api/getFriendRecordRegions';
import { getFriendRegionRecords } from '../api/getFriendRegionRecords';
import type { RecordRegion } from '../api/getRecordRegions';
import type { RegionRecord } from '../api/getRegionRecords';
import { useSession } from '../../../entities/session/model/useSession';
import { ApiError } from '../../../shared/api/apiError';
import './dashboardContent.css';

type LoadState = 'loading' | 'ready' | 'empty' | 'error';

/** 친구 프로필, 지역별 자물쇠 페이지, 상세 링크를 친구 전용 읽기 화면에 제공한다. */
export function FriendDashboardContent({ friendUserId }: { friendUserId: number }) {
  const { fetchAuthenticatedJson } = useSession();
  const dashboardRequestRef = useRef<AbortController | null>(null);
  const recordsRequestRef = useRef<AbortController | null>(null);
  const recordsRequestIdRef = useRef(0);
  const selectedCodeRef = useRef<string | null>(null);
  const [dashboard, setDashboard] = useState<FriendRecordDashboard | null>(null);
  const [regions, setRegions] = useState<RecordRegion[]>([]);
  const [dashboardState, setDashboardState] = useState<LoadState>('loading');
  const [selectedRegion, setSelectedRegion] = useState<RecordRegion | null>(null);
  const [records, setRecords] = useState<RegionRecord[]>([]);
  const [recordsCount, setRecordsCount] = useState(0);
  const [recordsState, setRecordsState] = useState<LoadState>('loading');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [friendshipEnded, setFriendshipEnded] = useState(false);

  /** 친구 대시보드 메타데이터와 지역별 활성 자물쇠 수를 조회한다. */
  const loadDashboard = useCallback(async () => {
    dashboardRequestRef.current?.abort();
    const controller = new AbortController();
    dashboardRequestRef.current = controller;
    setDashboardState('loading');
    setFriendshipEnded(false);
    try {
      const result = await getFriendRecordRegions(
        friendUserId,
        fetchAuthenticatedJson,
        controller.signal,
      );
      if (controller.signal.aborted || dashboardRequestRef.current !== controller) return;
      setDashboard(result);
      setRegions(result.regions);
      setDashboardState(result.regions.length === 0 ? 'empty' : 'ready');
    } catch (error: unknown) {
      if (controller.signal.aborted || dashboardRequestRef.current !== controller) return;
      setFriendshipEnded(error instanceof ApiError && error.status === 404);
      setDashboardState('error');
    } finally {
      if (dashboardRequestRef.current === controller) dashboardRequestRef.current = null;
    }
  }, [fetchAuthenticatedJson, friendUserId]);

  /** 선택한 지역의 첫 페이지나 다음 cursor 페이지를 불러온다. */
  const loadRegionPage = useCallback(
    async (region: RecordRegion, cursor: string | null, append: boolean) => {
      recordsRequestRef.current?.abort();
      const controller = new AbortController();
      const requestId = recordsRequestIdRef.current + 1;
      recordsRequestIdRef.current = requestId;
      recordsRequestRef.current = controller;
      setFriendshipEnded(false);
      if (append) {
        setLoadingMore(true);
        setLoadMoreFailed(false);
      } else {
        setRecords([]);
        setRecordsCount(region.recordsCount);
        setNextCursor(null);
        setLoadMoreFailed(false);
        setRecordsState('loading');
      }
      try {
        const page = await getFriendRegionRecords(
          friendUserId,
          region.legalDongCode,
          cursor,
          fetchAuthenticatedJson,
          controller.signal,
        );
        if (
          controller.signal.aborted ||
          requestId !== recordsRequestIdRef.current ||
          selectedCodeRef.current !== region.legalDongCode
        )
          return;
        setRecords((items) => (append ? appendDistinctRecords(items, page.records) : page.records));
        setRecordsCount(page.recordsCount);
        setNextCursor(page.nextCursor);
        setRecordsState(page.records.length === 0 && !append ? 'empty' : 'ready');
      } catch (error: unknown) {
        if (controller.signal.aborted || requestId !== recordsRequestIdRef.current) return;
        const notFound = error instanceof ApiError && error.status === 404;
        setFriendshipEnded(notFound);
        if (append && !notFound) {
          setLoadMoreFailed(true);
        } else {
          setRecordsState('error');
        }
      } finally {
        if (requestId === recordsRequestIdRef.current) {
          recordsRequestRef.current = null;
          setLoadingMore(false);
        }
      }
    },
    [fetchAuthenticatedJson, friendUserId],
  );

  useEffect(() => {
    const requestFrame = requestAnimationFrame(() => {
      void loadDashboard();
    });
    return () => {
      cancelAnimationFrame(requestFrame);
      dashboardRequestRef.current?.abort();
      recordsRequestRef.current?.abort();
      recordsRequestIdRef.current += 1;
    };
  }, [loadDashboard]);

  /** 선택 지역을 닫아 지역 카드로 돌아가고 진행 중인 목록 요청을 무효화한다. */
  function clearRegion() {
    recordsRequestRef.current?.abort();
    recordsRequestRef.current = null;
    recordsRequestIdRef.current += 1;
    selectedCodeRef.current = null;
    setSelectedRegion(null);
    setRecords([]);
    setNextCursor(null);
    setLoadMoreFailed(false);
    setRecordsState('loading');
  }

  /** 지역 카드를 선택해 친구의 첫 자물쇠 페이지를 연다. */
  function selectRegion(region: RecordRegion) {
    selectedCodeRef.current = region.legalDongCode;
    setSelectedRegion(region);
    void loadRegionPage(region, null, false);
  }

  if (dashboardState === 'loading') {
    return (
      <p className="dashboard-status" role="status">
        친구 대시보드를 불러오는 중이에요.
      </p>
    );
  }
  if (dashboardState === 'error' && !dashboard) {
    return (
      <div className="dashboard-status-group">
        <p className="dashboard-status is-error">
          {friendshipEnded
            ? '현재 친구가 아니어서 대시보드를 볼 수 없어요.'
            : '친구 대시보드를 불러오지 못했어요.'}
        </p>
        {friendshipEnded ? (
          <Link className="dashboard-retry" to="/friends">
            친구 목록으로
          </Link>
        ) : null}
        <button className="dashboard-retry" type="button" onClick={() => void loadDashboard()}>
          다시 시도
        </button>
      </div>
    );
  }
  if (!dashboard) return null;

  return (
    <div className="friend-dashboard-content">
      <section className="friend-dashboard-summary" aria-label="친구 프로필">
        <strong>{dashboard.nickname}</strong>
        <span>FRIEND DASHBOARD</span>
        <small>자물쇠 {dashboard.recordsCount}개</small>
      </section>

      {selectedRegion ? (
        <section className="dashboard-detail" aria-label={`${selectedRegion.legalDongName} 자물쇠`}>
          <div className="dashboard-detail-heading">
            <div>
              <p className="dashboard-eyebrow">친구 자물쇠</p>
              <h2>{selectedRegion.legalDongName}</h2>
              <span>자물쇠 {recordsCount}개</span>
            </div>
            <button className="dashboard-close" type="button" onClick={clearRegion}>
              지역 목록
            </button>
          </div>
          {recordsState === 'loading' ? (
            <p className="dashboard-status" role="status">
              자물쇠를 불러오는 중이에요.
            </p>
          ) : null}
          {recordsState === 'empty' ? (
            <p className="dashboard-status">이 지역에 남긴 자물쇠가 없어요.</p>
          ) : null}
          {recordsState === 'error' ? (
            <div className="dashboard-status-group">
              <p className="dashboard-status is-error">
                {friendshipEnded
                  ? '친구 관계가 바뀌어 자물쇠를 볼 수 없어요.'
                  : '자물쇠를 불러오지 못했어요.'}
              </p>
              {friendshipEnded ? (
                <Link className="dashboard-retry" to="/friends">
                  친구 목록으로
                </Link>
              ) : null}
              {!friendshipEnded ? (
                <button
                  className="dashboard-retry"
                  type="button"
                  onClick={() => void loadRegionPage(selectedRegion, null, false)}
                >
                  다시 시도
                </button>
              ) : null}
            </div>
          ) : null}
          {recordsState === 'ready' ? (
            <div className="dashboard-record-list">
              {records.map((record) => (
                <Link
                  className="dashboard-record"
                  key={record.recordId}
                  to={`/records/${record.recordId}?origin=friend`}
                >
                  {record.albumImageUrl ? (
                    <span className="dashboard-cover">
                      <img
                        alt={`${record.title} - ${record.artistName} 앨범 커버`}
                        src={record.albumImageUrl}
                      />
                    </span>
                  ) : (
                    <span aria-hidden="true" className="dashboard-cover" />
                  )}
                  <span>
                    <strong>{record.title}</strong>
                    <small>
                      {record.artistName} · {formatRecordDate(record.createdAt)}
                    </small>
                  </span>
                </Link>
              ))}
              {nextCursor !== null ? (
                <button
                  className="dashboard-more"
                  disabled={loadingMore}
                  type="button"
                  onClick={() => void loadRegionPage(selectedRegion, nextCursor, true)}
                >
                  {loadingMore ? '불러오는 중…' : '더 보기'}
                </button>
              ) : null}
              {loadMoreFailed ? (
                <p className="dashboard-more-error">추가 자물쇠를 불러오지 못했어요.</p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : (
        <section className="dashboard-regions" aria-label="친구 자물쇠 지역 목록">
          {dashboardState === 'empty' ? (
            <p className="dashboard-status">친구가 아직 자물쇠를 만들지 않았어요.</p>
          ) : (
            regions.map((region) => (
              <button
                className="surface-card dashboard-region"
                key={region.legalDongCode}
                type="button"
                onClick={() => selectRegion(region)}
              >
                <span aria-hidden="true" className="dashboard-pin" />
                <span>
                  <strong>{region.legalDongName}</strong>
                  <small>자물쇠 {region.recordsCount}개</small>
                </span>
                <span aria-hidden="true" className="dashboard-chevron">
                  ›
                </span>
              </button>
            ))
          )}
        </section>
      )}
    </div>
  );
}

/** 자물쇠 항목 날짜를 한국식 짧은 날짜로 표시한다. */
function formatRecordDate(createdAt: string): string {
  return createdAt.slice(0, 10).replaceAll('-', '.');
}

/** cursor 페이지가 겹쳐도 자물쇠 ID당 항목 하나만 화면 목록에 남긴다. */
function appendDistinctRecords(current: RegionRecord[], incoming: RegionRecord[]): RegionRecord[] {
  const existingIds = new Set(current.map((record) => record.recordId));
  const additions = incoming.filter((record) => {
    if (existingIds.has(record.recordId)) return false;
    existingIds.add(record.recordId);
    return true;
  });
  return [...current, ...additions];
}
