import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { type PreferredGenre, type UserProfile } from '../../../entities/user/model/user.types';
import { useSession } from '../../../entities/session/model/useSession';
import { HomeMap, type MapCenter } from '../../../features/home-map/ui/HomeMap';
import { HomePlaylistSheet } from '../../../features/home-playlist/ui/HomePlaylistSheet';
import { HomeWeather } from '../../../features/home-weather/ui/HomeWeather';
import { GenreOnboardingSheet } from '../../../features/genre-onboarding/ui/GenreOnboardingSheet';
import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import { getMyProfile } from '../../../features/user-profile/api/userProfileApi';
import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import './homePage.css';

/** 로그인 세션에서 프로필을 조회하고 미응답 사용자에게만 온보딩을 표시한다. */
function HomeGenreOnboarding({ request }: { request: AuthenticatedApiClient['fetchJson'] }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let isCurrent = true;

    void getMyProfile(request)
      .then((nextProfile) => {
        if (isCurrent) setProfile(nextProfile);
      })
      .catch(() => {
        if (isCurrent) setProfile(null);
      });

    return () => {
      isCurrent = false;
    };
  }, [request]);

  /** 완료된 서버 저장을 현재 화면에 반영해 같은 진입에서 재노출하지 않는다. */
  function finishOnboarding(preferredGenres: PreferredGenre[] | null) {
    setProfile((current) =>
      current ? { ...current, preferredGenres, genreOnboardingDone: true } : current,
    );
  }

  if (profile?.preferredGenres !== null || profile?.genreOnboardingDone !== false) return null;

  return <GenreOnboardingSheet request={request} onSaved={finishOnboarding} />;
}

/** 목업의 홈 진입 화면을 기능 UI로 조립한다. */
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
      playlistTriggerRef.current?.focus();
    }
  }

  function closePlaylist() {
    setIsPlaylistRequested(false);
    if (openAnimationFrameRef.current !== null) {
      cancelAnimationFrame(openAnimationFrameRef.current);
      openAnimationFrameRef.current = null;
    }
    setIsPlaylistOpen(false);
  }

  return (
    <main className="home-page" onClick={() => isPlaylistOpen && closePlaylist()}>
      <div className="home-page-content">
        <header className="home-topbar">
          <h1 className="home-topbar__brand">MULO</h1>
          {/* 실제 위치를 확보한 경우에만 현재 날씨를 조회한다. */}
          <HomeWeather coordinates={currentLocation} />
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
        </section>

        <HomeMap
          isPlaylistRequested={isPlaylistRequested}
          isPlaylistVisible={isPlaylistVisible}
          onPlaylistReady={showPlaylistAfterMapSheetExit}
          onClosePlaylist={closePlaylist}
          onCurrentLocationResolved={setCurrentLocation}
        >
          {isPlaylistVisible ? (
            <HomePlaylistSheet
              currentLocation={currentLocation}
              isOpen={isPlaylistOpen}
              onClose={closePlaylist}
              onExited={finishClosingPlaylist}
            />
          ) : null}
        </HomeMap>

        <div className="home-create-action">
          <button type="button" onClick={() => navigate('/locks/create')}>
            🔒 자물쇠 만들기
          </button>
        </div>
      </div>

      <MainNavigation />
      {isAuthenticated && !isSessionRestoring ? (
        <HomeGenreOnboarding request={fetchAuthenticatedJson} />
      ) : null}
    </main>
  );
}
