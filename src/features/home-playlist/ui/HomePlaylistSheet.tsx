import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useSession } from '../../../entities/session/model/useSession';
import { createRecommendationPlaylist } from '../api/recommendationPlaylistApi';
import type {
  RecommendationCoordinates,
  RecommendationPlaylist,
  RecommendationTrack,
} from '../model/recommendationPlaylist.types';
import './homePlaylistSheet.css';

type HomePlaylistSheetProps = {
  currentLocation: RecommendationCoordinates | null;
  isOpen: boolean;
  onClose: () => void;
  onExited: () => void;
};

const MAX_RECOMMENDATIONS = 3;
type LoadState = 'idle' | 'ready' | 'error' | 'creating';

/** 외부 링크가 브라우저에서 안전하게 열 수 있는 HTTP(S) URL인지 확인한다. */
function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/** 앨범 이미지 요청에 실패하면 기존 그라데이션 커버를 대신 표시한다. */
function RecommendationTrackCover({ track }: { track: RecommendationTrack }) {
  const [isImageUnavailable, setIsImageUnavailable] = useState(false);

  if (isImageUnavailable) {
    return <span className="home-playlist-cover" aria-hidden="true" />;
  }

  return (
    <img
      alt={`${track.title} 앨범 커버`}
      className="home-playlist-cover"
      height={34}
      loading="lazy"
      onError={() => setIsImageUnavailable(true)}
      src={track.albumImageUrl}
      width={34}
    />
  );
}

/** 한 트랙을 앨범 커버와 외부 링크 유무에 맞춰 접근 가능한 목록 항목으로 표시한다. */
function RecommendationTrackItem({ track }: { track: RecommendationTrack }) {
  const content = (
    <>
      <RecommendationTrackCover track={track} />
      <span>
        <strong>{track.title}</strong>
        <small>{track.artistName}</small>
      </span>
    </>
  );

  if (!isSafeExternalUrl(track.externalUrl)) {
    return <li className="home-playlist-track">{content}</li>;
  }

  return (
    <li>
      <a className="home-playlist-track" href={track.externalUrl} rel="noreferrer" target="_blank">
        {content}
      </a>
    </li>
  );
}

/** 한 번 열린 화면의 추천 횟수·제외 곡·요청 수명을 관리하는 홈 추천 모달이다. */
export function HomePlaylistSheet({
  currentLocation,
  isOpen,
  onClose,
  onExited,
}: HomePlaylistSheetProps) {
  const { fetchAuthenticatedJson, isAuthenticated } = useSession();
  const [playlist, setPlaylist] = useState<RecommendationPlaylist | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [successCount, setSuccessCount] = useState(0);
  const excludedTrackIdsRef = useRef(new Set<string>());
  const successCountRef = useRef(0);
  const createControllerRef = useRef<AbortController | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  /** 모든 닫기 경로에서 의사를 확인하고, 동의한 경우에만 요청과 화면 세션을 종료한다. */
  const requestClose = useCallback(() => {
    const pending = createControllerRef.current;
    const message =
      pending && !pending.signal.aborted
        ? '추천을 만드는 중이에요. 기다리지 않고 나갈까요? 닫으면 이번 추천 목록과 횟수가 초기화돼요.'
        : '추천 창을 닫을까요? 닫으면 이번 추천 목록과 횟수가 초기화돼요.';
    if (!window.confirm(message)) return;
    pending?.abort();
    onCloseRef.current();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const activeElement = document.activeElement;
    const previousFocus =
      activeElement instanceof HTMLElement && activeElement !== document.body
        ? activeElement
        : null;
    closeButtonRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    /** 모달 안에서 Tab 초점을 순환하고 ESC도 동일한 닫기 확인을 거친다. */
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        sheetRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], [tabindex="0"]',
        ) ?? [],
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last?.focus();
      } else if (
        (!event.shiftKey && active === last) ||
        !focusable.some((element) => element === active)
      ) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen, requestClose]);

  useEffect(
    () => () => {
      createControllerRef.current?.abort();
    },
    [],
  );

  /** 세션의 누적 제외 ID로 추천하며 성공한 새 목록에만 3회 예산을 사용한다. */
  const createPlaylist = useCallback(async () => {
    // ref 잠금은 React가 버튼을 다시 그리기 전의 연속 클릭도 막는다.
    if (
      !isOpen ||
      !isAuthenticated ||
      currentLocation === null ||
      createControllerRef.current ||
      successCountRef.current >= MAX_RECOMMENDATIONS
    )
      return;
    const controller = new AbortController();
    createControllerRef.current = controller;
    setLoadState('creating');
    try {
      const nextPlaylist = await createRecommendationPlaylist(
        { ...currentLocation, excludeTrackIds: [...excludedTrackIdsRef.current] },
        fetchAuthenticatedJson,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      for (const track of nextPlaylist.tracks)
        excludedTrackIdsRef.current.add(track.externalTrackId);
      successCountRef.current += 1;
      setSuccessCount(successCountRef.current);
      setPlaylist(nextPlaylist);
      setLoadState('ready');
    } catch {
      if (!controller.signal.aborted) setLoadState('error');
    } finally {
      if (createControllerRef.current === controller) createControllerRef.current = null;
    }
  }, [currentLocation, fetchAuthenticatedJson, isAuthenticated, isOpen]);

  const remainingCount = MAX_RECOMMENDATIONS - successCount;
  const isCreating = loadState === 'creating';
  const buttonLabel =
    remainingCount === 0
      ? '추천 3회를 모두 받았어요'
      : isCreating
        ? '추천을 만드는 중…'
        : loadState === 'error'
          ? `다시 시도 · ${remainingCount}회 남음`
          : successCount === 0
            ? '추천 받기'
            : `다시 추천받기 · ${remainingCount}회 남음`;

  return (
    <div className="home-playlist-layer" onClick={(event) => event.stopPropagation()}>
      <button
        className="home-playlist-backdrop"
        type="button"
        tabIndex={-1}
        aria-label="플레이리스트 배경 닫기"
        onClick={requestClose}
        disabled={!isOpen}
      />
      <section
        ref={sheetRef}
        className={`home-playlist-sheet${isOpen ? ' is-open' : ''}`}
        aria-label="AI 추천 플레이리스트"
        aria-hidden={!isOpen}
        inert={!isOpen}
        role="dialog"
        aria-modal="true"
        onTransitionEnd={(event) => {
          if (!isOpen && event.target === event.currentTarget && event.propertyName === 'transform')
            onExited();
        }}
      >
        <span className="home-playlist-handle" aria-hidden="true" />
        <button
          ref={closeButtonRef}
          className="home-playlist-close"
          type="button"
          aria-label="플레이리스트 안내 닫기"
          onClick={requestClose}
        >
          ×
        </button>
        <div className="home-playlist-title-row">
          <h2>AI 추천 플레이리스트</h2>
          {isAuthenticated ? <span>{successCount} / 3회</span> : null}
        </div>
        <p className="home-playlist-notice">
          이 창에서 최대 3번 추천받을 수 있어요. 추천에 실패한 경우에는 횟수가 줄어들지 않아요.
        </p>
        {!isAuthenticated ? (
          <div className="home-playlist-notice">
            <p>로그인 후 나만의 추천을 받을 수 있어요.</p>
            <Link to="/login">로그인하기</Link>
          </div>
        ) : (
          <>
            {playlist !== null ? (
              <ul className="home-playlist-track-list">
                {playlist.tracks.map((track) => (
                  <RecommendationTrackItem key={track.externalTrackId} track={track} />
                ))}
              </ul>
            ) : null}
            {loadState === 'error' ? (
              <p className="home-playlist-notice" role="alert">
                추천을 만들지 못했습니다. 횟수는 줄어들지 않았어요.
              </p>
            ) : null}
            {isCreating ? (
              <p className="home-playlist-notice" role="status">
                새 추천을 만드는 중이에요.
              </p>
            ) : null}
            <button
              className="home-playlist-save-button"
              type="button"
              disabled={!isOpen || currentLocation === null || isCreating || remainingCount === 0}
              onClick={() => void createPlaylist()}
            >
              {buttonLabel}
            </button>
            {currentLocation === null ? (
              <p className="home-playlist-notice">현재 위치를 확인한 뒤 추천을 받을 수 있어요.</p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
