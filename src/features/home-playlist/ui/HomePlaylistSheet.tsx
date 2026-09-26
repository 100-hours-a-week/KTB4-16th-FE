import './homePlaylistSheet.css';
import { FeatureUnavailableNotice } from '../../../shared/ui/FeatureUnavailableNotice';

type HomePlaylistSheetProps = {
  isOpen: boolean;
  onExited: () => void;
};

/** 추천 API 연동 전 플레이리스트를 가짜 곡 없이 구현 예정으로 안내한다. */
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
      <FeatureUnavailableNotice
        description="추천 플레이리스트 기능을 구현할 예정이에요."
        title="AI 추천 플레이리스트"
      />
    </section>
  );
}
