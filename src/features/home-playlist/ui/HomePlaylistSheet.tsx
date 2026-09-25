import './homePlaylistSheet.css';

const playlistTracks = [
  { artist: '헤이즈', title: '비 오는 날엔' },
  { artist: '아이유', title: '밤편지' },
] as const;

type HomePlaylistSheetProps = {
  isOpen: boolean;
  onExited: () => void;
};

/** 홈 지도 위에 목업의 추천 플레이리스트 바텀시트를 표시한다. */
export function HomePlaylistSheet({ isOpen, onExited }: HomePlaylistSheetProps) {
  return (
    <section
      className={`home-playlist-sheet${isOpen ? ' is-open' : ''}`}
      aria-label="AI 추천 플레이리스트"
      onClick={(event) => event.stopPropagation()}
      onTransitionEnd={(event) => {
        if (!isOpen && event.target === event.currentTarget && event.propertyName === 'transform') {
          onExited();
        }
      }}
    >
      <span className="home-playlist-handle" aria-hidden="true" />
      <div className="home-playlist-title-row">
        <h2>🎧 AI 추천 플레이리스트</h2>
        <span>흐림 · 21°C · 저녁</span>
      </div>
      <div className="home-playlist-track-list">
        {playlistTracks.map((track) => (
          <article className="home-playlist-track" key={track.title}>
            <span className="home-playlist-cover" aria-hidden="true" />
            <span>
              <strong>{track.title}</strong>
              <small>{track.artist}</small>
            </span>
          </article>
        ))}
      </div>
      <button className="home-playlist-save-button" type="button">
        내 Spotify에 저장하기
      </button>
    </section>
  );
}
