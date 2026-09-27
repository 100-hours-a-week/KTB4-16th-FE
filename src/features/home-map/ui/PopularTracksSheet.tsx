import type { PopularTracksResult } from '../api/getPopularTracks';

import './popularTracksSheet.css';

type Props = {
  isOpen: boolean;
  placeCount: number;
  result: PopularTracksResult | null;
  loadState: 'loading' | 'ready' | 'empty' | 'error';
  onRetry: () => void;
  onClose: () => void;
  onExited: () => void;
};

/** 선택한 인기 Place들의 최근 7일 음악 집계를 bottom sheet로 표시한다. */
export function PopularTracksSheet({
  isOpen,
  placeCount,
  result,
  loadState,
  onRetry,
  onClose,
  onExited,
}: Props) {
  return (
    <section
      className={`popular-tracks-sheet${isOpen ? ' is-open' : ''}`}
      aria-label="선택 영역 인기 음악"
      onClick={(event) => event.stopPropagation()}
      onTransitionEnd={(event) => {
        if (!isOpen && event.target === event.currentTarget && event.propertyName === 'transform') {
          onExited();
        }
      }}
    >
      <span className="popular-tracks-sheet-handle" aria-hidden="true" />
      <div className="popular-tracks-sheet-title-row">
        <div>
          <h2>인기 음악</h2>
          <p>선택한 장소 {placeCount}곳</p>
        </div>
        <button type="button" aria-label="인기 음악 목록 닫기" onClick={onClose}>
          ×
        </button>
      </div>

      {loadState === 'loading' ? (
        <p className="popular-tracks-sheet-status">인기 음악을 불러오는 중이에요.</p>
      ) : null}
      {loadState === 'empty' ? (
        <p className="popular-tracks-sheet-status">최근 7일 동안 기록된 음악이 없어요.</p>
      ) : null}
      {loadState === 'error' ? (
        <div className="popular-tracks-sheet-error">
          <p>인기 음악을 불러오지 못했어요.</p>
          <button type="button" onClick={onRetry}>
            다시 시도
          </button>
        </div>
      ) : null}
      {loadState === 'ready' && result ? (
        <div className="popular-tracks-sheet-list">
          <p className="popular-tracks-sheet-count">최근 7일 자물쇠 {result.recordCount}개</p>
          {result.music.map((track) => (
            <article className="popular-tracks-sheet-row" key={track.musicTrackId}>
              <strong className="popular-tracks-sheet-rank">{track.rank}</strong>
              <span>
                <strong>{track.title}</strong>
                <small>{track.artistName}</small>
              </span>
              <small className="popular-tracks-sheet-plays">{track.count}회</small>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
