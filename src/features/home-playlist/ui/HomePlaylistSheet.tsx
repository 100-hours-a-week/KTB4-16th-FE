import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useSession } from '../../../entities/session/model/useSession';
import {
  createRecommendationPlaylist,
  getRecommendationPlaylist,
} from '../api/recommendationPlaylistApi';
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

type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'creating';
type FailedOperation = 'load' | 'create' | null;

/** 외부 링크가 브라우저에서 안전하게 열 수 있는 HTTP(S) URL인지 확인한다. */
function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/** 한 트랙을 외부 링크 유무에 맞춰 접근 가능한 목록 항목으로 표시한다. */
function RecommendationTrackItem({ track }: { track: RecommendationTrack }) {
  const content = (
    <>
      <span className="home-playlist-cover" aria-hidden="true" />
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

/** 인증 상태와 실제 위치를 사용해 추천 조회·생성 상태를 관리하는 홈 시트다. */
export function HomePlaylistSheet({
  currentLocation,
  isOpen,
  onClose,
  onExited,
}: HomePlaylistSheetProps) {
  const { fetchAuthenticatedJson, isAuthenticated } = useSession();
  const [playlist, setPlaylist] = useState<RecommendationPlaylist | null>(null);
  const [loadState, setLoadState] = useState<LoadState>(() =>
    isAuthenticated && isOpen ? 'loading' : 'idle',
  );
  const [failedOperation, setFailedOperation] = useState<FailedOperation>(null);
  const createControllerRef = useRef<AbortController | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const activeElement = document.activeElement;
    const previousFocus =
      activeElement instanceof HTMLElement && activeElement !== document.body
        ? activeElement
        : null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen]);

  /** 열린 시트에서만 현재 저장 추천을 조회하고 취소된 응답은 반영하지 않는다. */
  const loadPlaylist = useCallback(
    async (signal: AbortSignal) => {
      setLoadState('loading');
      setFailedOperation(null);

      try {
        const nextPlaylist = await getRecommendationPlaylist(fetchAuthenticatedJson, signal);
        if (!signal.aborted) {
          setPlaylist(nextPlaylist);
          setLoadState('ready');
        }
      } catch {
        if (!signal.aborted) {
          setLoadState('error');
          setFailedOperation('load');
        }
      }
    },
    [fetchAuthenticatedJson],
  );

  useEffect(() => {
    if (!isOpen || !isAuthenticated) {
      return undefined;
    }

    const controller = new AbortController();
    queueMicrotask(() => void loadPlaylist(controller.signal));

    return () => controller.abort();
  }, [isAuthenticated, isOpen, loadPlaylist]);

  useEffect(
    () => () => {
      createControllerRef.current?.abort();
    },
    [],
  );

  /** 실제 geolocation 성공 좌표로만 새 추천 생성을 요청한다. */
  const createPlaylist = useCallback(async () => {
    if (currentLocation === null) {
      return;
    }

    createControllerRef.current?.abort();
    const controller = new AbortController();
    createControllerRef.current = controller;
    setLoadState('creating');
    setFailedOperation(null);

    try {
      const nextPlaylist = await createRecommendationPlaylist(
        currentLocation,
        fetchAuthenticatedJson,
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setPlaylist(nextPlaylist);
        setLoadState('ready');
      }
    } catch {
      if (!controller.signal.aborted) {
        setLoadState('error');
        setFailedOperation('create');
      }
    }
  }, [currentLocation, fetchAuthenticatedJson]);

  /** 마지막 실패 작업에 맞춰 조회 또는 생성 요청을 다시 시작한다. */
  function retry() {
    if (failedOperation === 'create') {
      void createPlaylist();
      return;
    }

    const controller = new AbortController();
    void loadPlaylist(controller.signal);
  }

  return (
    <section
      className={`home-playlist-sheet${isOpen ? ' is-open' : ''}`}
      aria-label="AI 추천 플레이리스트"
      aria-hidden={!isOpen}
      inert={!isOpen}
      role="region"
      onClick={(event) => event.stopPropagation()}
      onTransitionEnd={(event) => {
        if (!isOpen && event.target === event.currentTarget && event.propertyName === 'transform') {
          onExited();
        }
      }}
    >
      <span className="home-playlist-handle" aria-hidden="true" />
      <button
        ref={closeButtonRef}
        className="home-playlist-close"
        type="button"
        aria-label="플레이리스트 안내 닫기"
        onClick={onClose}
      >
        ×
      </button>
      <div className="home-playlist-title-row">
        <h2>AI 추천 플레이리스트</h2>
        <span>현재 추천</span>
      </div>
      {!isAuthenticated ? (
        <div className="home-playlist-notice">
          <p>로그인 후 나만의 추천을 확인할 수 있어요.</p>
          <Link to="/login">로그인하기</Link>
        </div>
      ) : null}
      {isAuthenticated && loadState === 'loading' ? (
        <p role="status">추천을 불러오는 중이에요.</p>
      ) : null}
      {isAuthenticated && loadState === 'error' ? (
        <section className="home-playlist-notice" role="alert">
          <p>
            {failedOperation === 'create'
              ? '추천을 만들지 못했습니다.'
              : '추천을 불러오지 못했습니다.'}
          </p>
          <button onClick={retry} type="button">
            다시 시도
          </button>
        </section>
      ) : null}
      {isAuthenticated && loadState !== 'loading' && playlist !== null ? (
        <ul className="home-playlist-track-list">
          {playlist.tracks.map((track) => (
            <RecommendationTrackItem key={track.musicTrackId} track={track} />
          ))}
        </ul>
      ) : null}
      {isAuthenticated && loadState === 'ready' && playlist !== null ? (
        <>
          <button
            className="home-playlist-save-button"
            disabled={currentLocation === null}
            onClick={() => void createPlaylist()}
            type="button"
          >
            새 추천 받기
          </button>
          {currentLocation === null ? (
            <p className="home-playlist-notice">현재 위치를 확인한 뒤 새 추천을 받을 수 있어요.</p>
          ) : null}
        </>
      ) : null}
      {isAuthenticated && loadState === 'ready' && playlist === null && currentLocation === null ? (
        <p className="home-playlist-notice">현재 위치를 확인한 뒤 추천을 만들 수 있어요.</p>
      ) : null}
      {isAuthenticated && loadState === 'ready' && playlist === null && currentLocation !== null ? (
        <button
          className="home-playlist-save-button"
          onClick={() => void createPlaylist()}
          type="button"
        >
          새 추천 만들기
        </button>
      ) : null}
      {isAuthenticated && loadState === 'creating' ? (
        <p role="status">새 추천을 만드는 중이에요.</p>
      ) : null}
    </section>
  );
}
