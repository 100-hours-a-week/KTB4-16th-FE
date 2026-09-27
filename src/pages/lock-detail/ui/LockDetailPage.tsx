import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { useSession } from '../../../entities/session/model/useSession';
import { deleteRecord } from '../../../features/record-detail/api/deleteRecord';
import { getRecordDetail } from '../../../features/record-detail/api/getRecordDetail';
import { updateRecordComment } from '../../../features/record-detail/api/updateRecordComment';
import type { LockDetailData } from '../../../features/record-detail/model/lockDetail.types';
import { LockDetail } from '../../../features/record-detail/ui/LockDetail';
import { ApiError } from '../../../shared/api/apiError';
import '../../pageShell.css';
import './lockDetailPage.css';

type LoadState = 'loading' | 'ready' | 'error';

/** URL의 recordId로 로그인 사용자의 자물쇠 상세를 조회해 상세 UI를 조립한다. */
export function LockDetailPage() {
  const navigate = useNavigate();
  const { recordId: recordIdParam } = useParams();
  const { fetchAuthenticatedJson } = useSession();
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
          setErrorMessage(messageForDetailError(error));
          setLoadState('error');
        });
    });

    return () => {
      cancelAnimationFrame(requestFrame);
      controller.abort();
      if (requestId === requestIdRef.current) requestIdRef.current += 1;
    };
  }, [fetchAuthenticatedJson, recordIdParam]);

  const closeDetail = () => navigate(-1);

  return (
    <main className="static-page">
      <div className="static-page-content lock-detail-page-content">
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
            isOwner
            onClose={closeDetail}
            onSaveComment={(comment) =>
              updateRecordComment(detail.recordId, comment, fetchAuthenticatedJson)
            }
            onDelete={() => deleteRecord(detail.recordId, fetchAuthenticatedJson)}
            onDeleted={() => navigate('/', { replace: true })}
          />
        ) : null}
      </div>
    </main>
  );
}

function messageForDetailError(error: unknown): string {
  if (error instanceof ApiError && (error.status === 404 || error.code === 'RECORD_NOT_FOUND')) {
    return '자물쇠를 찾을 수 없어요.';
  }

  return '자물쇠를 불러오지 못했어요. 잠시 후 다시 시도해주세요.';
}
