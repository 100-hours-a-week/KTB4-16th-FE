import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { getDailySongDetail, type DailySongDetail } from '../api/dailySongApi';
import './dailySongDetailDialog.css';

type Props = {
  jobId: number;
  request: AuthenticatedApiClient['fetchJson'];
  returnFocusTo: HTMLButtonElement | null;
  onClose: () => void;
};

/** 알림에서 선택한 Job의 오늘의 노래 상세 정보를 모달로 표시한다. */
export function DailySongDetailDialog({ jobId, request, returnFocusTo, onClose }: Props) {
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [detail, setDetail] = useState<DailySongDetail | null>(null);
  const [attempt, setAttempt] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void getDailySongDetail(jobId, request, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setDetail(result);
        setLoadState('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadState('error');
      });
    return () => controller.abort();
  }, [attempt, jobId, request]);

  useEffect(() => {
    closeButtonRef.current?.focus();
    return () => {
      if (returnFocusTo?.isConnected) returnFocusTo.focus();
    };
  }, [returnFocusTo]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
    );
    const firstButton = buttons[0];
    const lastButton = buttons[buttons.length - 1];
    if (!firstButton || !lastButton) {
      event.preventDefault();
    } else if (event.shiftKey && document.activeElement === firstButton) {
      event.preventDefault();
      lastButton.focus();
    } else if (!event.shiftKey && document.activeElement === lastButton) {
      event.preventDefault();
      firstButton.focus();
    }
  }

  return createPortal(
    <div className="daily-song-dialog-backdrop" onMouseDown={onClose}>
      <section
        aria-labelledby="daily-song-dialog-title"
        aria-modal="true"
        className="daily-song-dialog"
        role="dialog"
        onKeyDown={handleKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="daily-song-dialog-heading">
          <h2 id="daily-song-dialog-title">오늘의 노래</h2>
          <button
            ref={closeButtonRef}
            aria-label="오늘의 노래 닫기"
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {loadState === 'loading' ? (
          <p className="daily-song-dialog-state" role="status">
            오늘의 노래를 불러오고 있어요.
          </p>
        ) : null}
        {loadState === 'error' ? (
          <div className="daily-song-dialog-state is-error">
            <p role="alert">오늘의 노래를 불러오지 못했어요.</p>
            <button
              type="button"
              onClick={() => {
                setLoadState('loading');
                setDetail(null);
                setAttempt((current) => current + 1);
              }}
            >
              다시 시도
            </button>
          </div>
        ) : null}
        {loadState === 'ready' && detail ? (
          <div className="daily-song-detail">
            <div className="daily-song-cover">
              {detail.track.albumImageUrl ? (
                <img
                  alt={`${detail.track.title} 앨범 이미지`}
                  src={detail.track.albumImageUrl}
                  onError={(event) => {
                    event.currentTarget.hidden = true;
                  }}
                />
              ) : null}
            </div>
            <div className="daily-song-metadata">
              <h3>{detail.track.title}</h3>
              <p>{detail.track.artistName}</p>
            </div>
          </div>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}
