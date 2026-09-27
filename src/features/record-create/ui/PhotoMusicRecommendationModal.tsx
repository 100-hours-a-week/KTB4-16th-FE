import type { PhotoMusicRecommendation } from '../api/getPhotoMusicRecommendations';
import './photoMusicRecommendationModal.css';

type Props = {
  isOpen: boolean;
  loadState: 'loading' | 'ready' | 'error';
  recommendations: PhotoMusicRecommendation[];
  errorMessage: string | null;
  onClose: () => void;
  onDirectSearch: () => void;
  onSelect: (recommendation: PhotoMusicRecommendation) => void;
  onRetry: () => void;
};

/** 사진 추천 요청 상태와 추천곡 선택을 표시하는 작성 화면 전용 모달이다. */
export function PhotoMusicRecommendationModal({
  isOpen,
  loadState,
  recommendations,
  errorMessage,
  onClose,
  onDirectSearch,
  onSelect,
  onRetry,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="photo-music-recommendation-overlay" role="presentation" onClick={onClose}>
      <section
        aria-label="사진 음악 추천"
        aria-modal="true"
        className="photo-music-recommendation-modal"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="photo-music-recommendation-heading">
          <h2>이 사진과 어울리는 음악 ✨</h2>
          <button aria-label="사진 음악 추천 닫기" type="button" onClick={onClose}>
            ×
          </button>
        </div>
        {loadState === 'loading' ? (
          <p className="photo-music-recommendation-status" role="status">
            음악을 추천하는 중이에요.
          </p>
        ) : null}
        {loadState === 'error' ? (
          <div className="photo-music-recommendation-status is-error">
            <p role="alert">{errorMessage ?? '음악 추천에 실패했어요. 다시 시도해주세요.'}</p>
            <button type="button" onClick={onRetry}>
              다시 시도
            </button>
          </div>
        ) : null}
        {loadState === 'ready' && recommendations.length === 0 ? (
          <p className="photo-music-recommendation-status">
            추천 음악을 찾지 못했어요. 직접 검색해보세요.
          </p>
        ) : null}
        {loadState === 'ready' && recommendations.length > 0 ? (
          <ul className="photo-music-recommendation-list" aria-label="사진 음악 추천 결과">
            {recommendations.map((recommendation) => (
              <li key={recommendation.externalTrackId}>
                <button type="button" onClick={() => onSelect(recommendation)}>
                  <span className="photo-music-recommendation-cover">
                    <img
                      alt={`${recommendation.title} - ${recommendation.artistName} 앨범 커버`}
                      src={recommendation.albumImageUrl}
                      onError={(event) => {
                        event.currentTarget.hidden = true;
                      }}
                    />
                  </span>
                  <span>
                    <strong>{recommendation.title}</strong>
                    <small>{recommendation.artistName}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <button
          className="photo-music-recommendation-search"
          type="button"
          onClick={onDirectSearch}
        >
          직접 검색하기
        </button>
      </section>
    </div>
  );
}
