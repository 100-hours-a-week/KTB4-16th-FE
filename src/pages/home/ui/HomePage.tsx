import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { HomeMap, type MapCenter } from '../../../features/home-map/ui/HomeMap';
import { HomePlaylistSheet } from '../../../features/home-playlist/ui/HomePlaylistSheet';
import { HomeWeather } from '../../../features/home-weather/ui/HomeWeather';
import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import './homePage.css';

/** 목업의 홈 진입 화면을 기능 UI로 조립한다. */
export function HomePage() {
  const [initialMapCenter, setInitialMapCenter] = useState<MapCenter | null>(null);
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false);
  const [isPlaylistVisible, setIsPlaylistVisible] = useState(false);
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
  function openPlaylist() {
    if (openAnimationFrameRef.current !== null) {
      cancelAnimationFrame(openAnimationFrameRef.current);
    }

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

  return (
    <main className="home-page" onClick={() => isPlaylistOpen && setIsPlaylistOpen(false)}>
      <div className="home-page-content">
        <header className="home-topbar">
          <h1>MULO</h1>
          <HomeWeather coordinates={initialMapCenter} />
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
              openPlaylist();
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

        <HomeMap onInitialCenterResolved={setInitialMapCenter}>
          {isPlaylistVisible ? (
            <HomePlaylistSheet isOpen={isPlaylistOpen} onExited={finishClosingPlaylist} />
          ) : null}
        </HomeMap>

        <div className="home-create-action">
          <button type="button" onClick={() => navigate('/locks/create')}>
            🔒 자물쇠 만들기
          </button>
        </div>
      </div>

      <MainNavigation />
    </main>
  );
}
