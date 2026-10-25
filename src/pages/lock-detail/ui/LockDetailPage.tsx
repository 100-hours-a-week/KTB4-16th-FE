import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { useSession } from '../../../entities/session/model/useSession';
import { deleteRecord } from '../../../features/record-detail/api/deleteRecord';
import { getRecordDetail } from '../../../features/record-detail/api/getRecordDetail';
import { updateRecordComment } from '../../../features/record-detail/api/updateRecordComment';
import type { LockDetailData } from '../../../features/record-detail/model/lockDetail.types';
import { LockDetail } from '../../../features/record-detail/ui/LockDetail';
import { ApiError } from '../../../shared/api/apiError';
import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import '../../pageShell.css';
import './lockDetailPage.css';

type LoadState = 'loading' | 'ready' | 'error';

/** URL의 recordId로 본인 또는 현재 친구의 자물쇠 상세를 조회해 표시한다. */
export function LockDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { recordId: recordIdParam, friendUserId: friendUserIdParam } = useParams();
  const friendUserId = Number(friendUserIdParam);
  const isNestedFriendDetail = Number.isSafeInteger(friendUserId) && friendUserId > 0;
  const { fetchAuthenticatedJson } = useSession();
  const isFriendOrigin =
    isNestedFriendDetail || new URLSearchParams(location.search).get('origin') === 'friend';
  const requestIdRef = useRef(0);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [detail, setDetail] = useState<LockDetailData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const recordId = Number(recordIdParam);
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = new AbortController();
    const requestFrame = requestAnimationFrame(() => {
      setDetail(null);
      setErrorMessage('');

      if (!Number.isSafeInteger(recordId) || recordId <= 0) {
        setLoadState('error');
        setErrorMessage('자물쇠를 찾을 수 없어요.');
        return;
      }

      setLoadState('loading');
      void getRecordDetail(recordId, fetchAuthenticatedJson, controller.signal)
        .then((nextDetail) => {
          if (controller.signal.aborted || requestId !== requestIdRef.current) return;
          setDetail(nextDetail);
          setLoadState('ready');
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || requestId !== requestIdRef.current) return;
          if (isFriendOrigin && error instanceof ApiError && error.status === 404) {
            navigate('/friends', { replace: true });
            return;
          }
          setErrorMessage(messageForDetailError(error));
          setLoadState('error');
        });
    });

    return () => {
      cancelAnimationFrame(requestFrame);
      controller.abort();
      if (requestId === requestIdRef.current) requestIdRef.current += 1;
    };
  }, [fetchAuthenticatedJson, isFriendOrigin, navigate, recordIdParam]);

  /** 목록에서 연 상세는 같은 기록으로 돌아가고 직접 진입은 친구의 목록으로 안전하게 닫는다. */
  const closeDetail = () => {
    if (isNestedFriendDetail) {
      const state: unknown = location.state;
      if (
        typeof state === 'object' &&
        state !== null &&
        'friendDashboardId' in state &&
        state.friendDashboardId === friendUserId
      ) {
        navigate(-1);
      } else {
        navigate(`/friends/${friendUserId}/dashboard`, { replace: true });
      }
      return;
    }
    if (isFriendOrigin) {
      navigate('/friends', { replace: true });
      return;
    }
    navigate(-1);
  };

  return (
    <main className="static-page lock-detail-page">
      <div
        aria-label="자물쇠 상세 내용"
        className="static-page-content lock-detail-page-content"
        role="region"
      >
        {loadState === 'loading' ? (
          <section
            className="surface-card lock-detail-page-status"
            aria-live="polite"
            role="status"
          >
            <strong>자물쇠를 불러오는 중이에요.</strong>
          </section>
        ) : null}
        {loadState === 'error' ? (
          <section className="surface-card lock-detail-page-status is-error" role="alert">
            <strong>{errorMessage}</strong>
            <button type="button" onClick={closeDetail}>
              이전 화면으로
            </button>
          </section>
        ) : null}
        {loadState === 'ready' && detail ? (
          <LockDetail
            key={detail.recordId}
            detail={detail}
            isOwner={detail.isOwner}
            onClose={closeDetail}
            onSaveComment={(comment) =>
              updateRecordComment(detail.recordId, comment, fetchAuthenticatedJson)
            }
            onDelete={() => deleteRecord(detail.recordId, fetchAuthenticatedJson)}
            onDeleted={() => navigate('/', { replace: true })}
          />
        ) : null}
      </div>
      {/* 중첩 상세는 부모 메뉴를 추가하지 않고 기존 뒤로 가기 흐름을 유지한다. */}
      {!isNestedFriendDetail ? (
        <MainNavigation activeItem={isFriendOrigin ? 'friends' : 'dashboard'} wideOnly />
      ) : null}
    </main>
  );
}

/** 상세 API 오류를 사용자에게 표시할 안전한 문장으로 변환한다. */
function messageForDetailError(error: unknown): string {
  if (error instanceof ApiError && (error.status === 404 || error.code === 'RECORD_NOT_FOUND')) {
    return '자물쇠를 찾을 수 없어요.';
  }

  return '자물쇠를 불러오지 못했어요. 잠시 후 다시 시도해주세요.';
}
