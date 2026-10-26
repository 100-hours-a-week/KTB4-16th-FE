import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { useSession } from '../../../entities/session/model/useSession';
import { HomeMap, type MapCenter } from '../../../features/home-map/ui/HomeMap';
import { HomePlaylistSheet } from '../../../features/home-playlist/ui/HomePlaylistSheet';
import { HomeWeather } from '../../../features/home-weather/ui/HomeWeather';
import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import { hasUnreadNotifications } from '../../../features/notification/api/notificationApi';
import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import './homePage.css';

/** 로그인한 사용자의 홈 진입 시 미읽음 여부를 확인해 새 알림 점을 표시한다. */
function HomeNotificationIndicator({ request }: { request: AuthenticatedApiClient['fetchJson'] }) {
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    // 홈 진입 시 확인하고, 머무는 동안에는 타이머나 포커스로 재조회하지 않는다.
    void hasUnreadNotifications(request, controller.signal)
      .then((unread) => {
        if (active && !controller.signal.aborted) setHasUnread(unread);
      })
      .catch(() => {
        // 조회 실패 시 홈 화면은 유지하고 다음 홈 진입에서 다시 확인한다.
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [request]);

  return hasUnread ? (
    <span className="home-notification-indicator" role="status" aria-label="새 알림" />
  ) : null;
}

/** 검색·지도·추천 진입을 조립하고 추천 모달의 화면 세션과 배경 차단을 소유한다. */
export function HomePage() {
  const { fetchAuthenticatedJson, isAuthenticated, isSessionRestoring } = useSession();
  const [currentLocation, setCurrentLocation] = useState<MapCenter | null>(null);
  const [isPlaylistRequested, setIsPlaylistRequested] = useState(false);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
  const [isPlaylistVisible, setIsPlaylistVisible] = useState(false);
  const playlistTriggerRef = useRef<HTMLButtonElement>(null);
  const openAnimationFrameRef = useRef<number | null>(null);
  const navigate = useNavigate();

  useEffect(
    () => () => {
      if (openAnimationFrameRef.current !== null) {
        cancelAnimationFrame(openAnimationFrameRef.current);
      }
    },
    [],
  );

  /** 시트를 먼저 렌더링한 뒤 다음 프레임에서 열어 CSS transition을 실행한다. */
  function openPlaylist(trigger: HTMLButtonElement) {
    if (openAnimationFrameRef.current !== null) {
      cancelAnimationFrame(openAnimationFrameRef.current);
    }

    playlistTriggerRef.current = trigger;
    setIsPlaylistRequested(true);
  }

  /** 지도 sheet가 완전히 닫힌 뒤 playlist sheet를 연다. */
  function showPlaylistAfterMapSheetExit() {
    setIsPlaylistRequested(false);
    setIsPlaylistVisible(true);
    openAnimationFrameRef.current = requestAnimationFrame(() => {
      setIsPlaylistOpen(true);
      openAnimationFrameRef.current = null;
    });
  }

  /** 닫힘 transition 종료 후에만 시트를 unmount한다. */
  function finishClosingPlaylist() {
    if (!isPlaylistOpen) {
      setIsPlaylistVisible(false);
    }
  }

  /** 추천 시트의 확인 절차가 끝난 뒤 닫힘 애니메이션을 시작한다. */
  function closePlaylist() {
    setIsPlaylistRequested(false);
    if (openAnimationFrameRef.current !== null) {
      cancelAnimationFrame(openAnimationFrameRef.current);
      openAnimationFrameRef.current = null;
    }
    setIsPlaylistOpen(false);
  }

  useEffect(() => {
    if (!isPlaylistVisible) playlistTriggerRef.current?.focus();
  }, [isPlaylistVisible]);

  useEffect(() => {
    if (!isPlaylistVisible || isPlaylistOpen) return;
    // transitionend가 발생하지 않는 환경에서도 닫은 세션은 제거한다.
    const timeout = window.setTimeout(() => setIsPlaylistVisible(false), 320);
    return () => window.clearTimeout(timeout);
  }, [isPlaylistVisible, isPlaylistOpen]);

  return (
    <main className="home-page">
      <div className="home-page-stage">
        <div className="home-page-content" inert={isPlaylistVisible}>
          <header className="home-topbar">
            <h1 className="home-topbar__brand">MULO</h1>
            <div className="home-topbar-actions">
              {/* 실제 위치를 확보한 경우에만 현재 날씨를 조회한다. */}
              <HomeWeather coordinates={currentLocation} />
              <button
                aria-label="알림 목록"
                className="home-notification-button"
                type="button"
                onClick={() => navigate('/notifications')}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4M12 2V1" />
                </svg>
                {isAuthenticated && !isSessionRestoring ? (
                  <HomeNotificationIndicator request={fetchAuthenticatedJson} />
                ) : null}
              </button>
            </div>
          </header>

          <button
            className="home-memory-search"
            type="button"
            onClick={() => navigate('/memory-search')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span>“비 오던 날 홍대에서 들었던 노래” 같은 기억, 물어보세요</span>
          </button>

          {/* 추천·지도·생성 UI를 한 번씩 조립해 상태·초점과 모바일 순서를 유지한다. */}
          <HomeMap
            isPlaylistRequested={isPlaylistRequested}
            isPlaylistVisible={isPlaylistVisible}
            onPlaylistReady={showPlaylistAfterMapSheetExit}
            onClosePlaylist={closePlaylist}
            onCurrentLocationResolved={setCurrentLocation}
            overview={
              <section className="home-shortcuts" aria-label="추천 기능">
                <button
                  className="home-shortcut-card"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openPlaylist(event.currentTarget);
                  }}
                >
                  <span className="home-shortcut-icon" aria-hidden="true">
                    🎧
                  </span>
                  <span>
                    <strong>지금 나를 위한 플레이리스트</strong>
                    <small>위치·날씨·시간·히스토리 기반 추천</small>
                  </span>
                </button>
                <button
                  className="home-shortcut-card home-shortcut-card--matching"
                  type="button"
                  onClick={() => navigate('/matching')}
                >
                  <span
                    className="home-shortcut-icon home-shortcut-icon--matching"
                    aria-hidden="true"
                  >
                    💬
                  </span>
                  <span>
                    <strong>취향 투표로 랜덤 채팅</strong>
                    <small>회원님이 좋아할 만한 취향 투표 질문을 준비했어요</small>
                  </span>
                </button>
              </section>
            }
            primaryAction={
              <div className="home-create-action">
                <button type="button" onClick={() => navigate('/locks/create')}>
                  🔒 자물쇠 만들기
                </button>
              </div>
            }
          />
        </div>
      </div>
      <div className="home-page-navigation" inert={isPlaylistVisible}>
        <MainNavigation />
      </div>
      {/* 하단 메뉴까지 덮되 홈 페이지의 바깥 경계는 넘지 않는 추천 모달이다. */}
      {isPlaylistVisible ? (
        <HomePlaylistSheet
          currentLocation={currentLocation}
          isOpen={isPlaylistOpen}
          onClose={closePlaylist}
          onExited={finishClosingPlaylist}
        />
      ) : null}
    </main>
  );
}
