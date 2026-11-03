import type { PhotoMusicRecommendation } from '../api/getPhotoMusicRecommendations';
import { useCallback, useEffect, useState } from 'react';
import { RecommendationFeedbackSection } from '../../ai-recommendation-feedback';
import './photoMusicRecommendationModal.css';

type Props = {
  isOpen: boolean;
  loadState: 'loading' | 'ready' | 'error';
  recommendations: PhotoMusicRecommendation[];
  recommendationId: number | null;
  recommendReason: string | null;
  isFeedbackRequired?: boolean;
  hasSubmittedFeedback?: boolean;
  onFeedbackSubmitted?: () => void;
  isFeedbackSubmitting: boolean;
  onFeedbackSubmittingChange: (isSubmitting: boolean) => void;
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
  recommendationId,
  recommendReason,
  isFeedbackRequired = false,
  hasSubmittedFeedback = false,
  onFeedbackSubmitted,
  isFeedbackSubmitting,
  onFeedbackSubmittingChange,
  errorMessage,
  onClose,
  onDirectSearch,
  onSelect,
  onRetry,
}: Props) {
  const [showBlockedHint, setShowBlockedHint] = useState(false);
  const canLeave = !isFeedbackRequired || hasSubmittedFeedback;

  const requestAction = useCallback(
    (action: () => void) => {
      if (!canLeave) {
        setShowBlockedHint(true);
        return;
      }
      setShowBlockedHint(false);
      action();
    },
    [canLeave],
  );

  const requestClose = useCallback(() => requestAction(onClose), [onClose, requestAction]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      requestClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, requestClose]);

  if (!isOpen) return null;

  return (
    <div className="photo-music-recommendation-overlay" role="presentation" onClick={requestClose}>
      <section
        aria-label="사진 음악 추천"
        aria-modal="true"
        className="photo-music-recommendation-modal"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="photo-music-recommendation-heading">
          <h2>이 사진과 어울리는 음악 ✨</h2>
          <button aria-label="사진 음악 추천 닫기" type="button" onClick={requestClose}>
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
          <>
            {recommendReason?.trim() ? (
              <p className="photo-music-recommendation-reason" role="note" aria-label="추천 이유">
                {recommendReason}
              </p>
            ) : null}
            <ul className="photo-music-recommendation-list" aria-label="사진 음악 추천 결과">
              {recommendations.map((recommendation) => (
                <li key={recommendation.externalTrackId}>
                  <button
                    type="button"
                    onClick={() => requestAction(() => onSelect(recommendation))}
                  >
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
            <RecommendationFeedbackSection
              recommendationId={recommendationId}
              tracks={recommendations}
              allowTrackSelection={false}
              onSubmitted={() => {
                setShowBlockedHint(false);
                onFeedbackSubmitted?.();
              }}
              disabled={isFeedbackSubmitting}
              onSubmittingChange={onFeedbackSubmittingChange}
            />
          </>
        ) : null}
        {showBlockedHint ? (
          <p className="photo-music-recommendation-status" role="status">
            추천 결과를 평가한 후 다음 단계로 진행할 수 있어요.
          </p>
        ) : null}
        <button
          className="photo-music-recommendation-search"
          type="button"
          onClick={() => requestAction(onDirectSearch)}
        >
          직접 검색하기
        </button>
      </section>
    </div>
  );
}
