import { useEffect, useRef, useState } from 'react';

import { useSession } from '../../../entities/session/model/useSession';
import { ApiError } from '../../../shared/api/apiError';
import { submitAiRecommendationFeedback } from '../api/aiRecommendationFeedbackApi';
import type {
  AiRecommendationFeedback,
  AiRecommendationFeedbackRequest,
} from '../api/aiRecommendationFeedbackApi';
import './recommendationFeedbackSection.css';

export type RecommendationFeedbackTrack = {
  externalTrackId: string;
  title: string;
  artistName: string;
};

type Props = {
  recommendationId: number | null;
  tracks: readonly RecommendationFeedbackTrack[];
  allowTrackSelection: boolean;
  disabled?: boolean;
  onSubmitted?: () => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
};

function getFeedbackErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'AI_RECOMMENDATION_FEEDBACK_ALREADY_SUBMITTED':
        return '이미 평가한 추천 결과예요.';
      case 'AI_RECOMMENDATION_NOT_FOUND':
        return '추천 결과를 찾을 수 없어요. 새로 추천받아 주세요.';
      case 'AI_RECOMMENDATION_NOT_OWNED':
        return '이 추천 결과에 평가를 제출할 수 없어요.';
      case 'INVALID_INPUT_VALUE':
        return '선택한 평가 내용을 확인해 주세요.';
      default:
        return '평가를 제출하지 못했어요. 잠시 후 다시 시도해 주세요.';
    }
  }
  return '평가를 제출하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

export function RecommendationFeedbackSection({
  recommendationId,
  tracks,
  allowTrackSelection,
  disabled = false,
  onSubmitted,
  onSubmittingChange,
}: Props) {
  const { fetchAuthenticatedJson } = useSession();
  const [feedback, setFeedback] = useState<AiRecommendationFeedback | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const submissionLockRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function submitFeedback() {
    if (
      submissionLockRef.current ||
      recommendationId === null ||
      feedback === null ||
      isSubmitted ||
      disabled ||
      (allowTrackSelection && feedback === 'LIKE' && selectedTrackId === null)
    ) {
      return;
    }

    const request: AiRecommendationFeedbackRequest = {
      feedback,
      selectedTrackId: allowTrackSelection && feedback === 'LIKE' ? selectedTrackId : null,
    };
    submissionLockRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);
    onSubmittingChange?.(true);
    try {
      await submitAiRecommendationFeedback(recommendationId, request, fetchAuthenticatedJson);
      if (!mountedRef.current) return;
      setIsSubmitted(true);
      onSubmitted?.();
    } catch (error) {
      if (mountedRef.current) setErrorMessage(getFeedbackErrorMessage(error));
    } finally {
      submissionLockRef.current = false;
      if (mountedRef.current) setIsSubmitting(false);
      onSubmittingChange?.(false);
    }
  }

  function selectFeedback(nextFeedback: AiRecommendationFeedback) {
    if (isSubmitting || isSubmitted || disabled) return;
    if (feedback !== nextFeedback) setSelectedTrackId(null);
    setFeedback(nextFeedback);
    setErrorMessage(null);
  }

  const requiresTrack = allowTrackSelection && feedback === 'LIKE';
  const canSubmit =
    recommendationId !== null &&
    feedback !== null &&
    (!requiresTrack || selectedTrackId !== null) &&
    !isSubmitting &&
    !isSubmitted &&
    !disabled;

  return (
    <section className="recommendation-feedback" aria-label="추천 결과 피드백">
      <div className="recommendation-feedback-divider" />
      <p className="recommendation-feedback-question">추천 결과가 마음에 드셨나요?</p>
      <div className="recommendation-feedback-actions">
        <button
          type="button"
          aria-pressed={feedback === 'LIKE'}
          className={feedback === 'LIKE' ? 'is-selected' : ''}
          disabled={disabled || isSubmitting || isSubmitted}
          onClick={() => selectFeedback('LIKE')}
        >
          👍 좋아요
        </button>
        <button
          type="button"
          aria-pressed={feedback === 'DISLIKE'}
          className={feedback === 'DISLIKE' ? 'is-selected' : ''}
          disabled={disabled || isSubmitting || isSubmitted}
          onClick={() => selectFeedback('DISLIKE')}
        >
          👎 싫어요
        </button>
      </div>
      {requiresTrack ? (
        <fieldset
          className="recommendation-feedback-track-selection"
          disabled={disabled || isSubmitting || isSubmitted}
        >
          <legend>가장 마음에 드는 곡을 골라주세요</legend>
          {tracks.map((track) => (
            <label key={track.externalTrackId}>
              <input
                type="radio"
                name={`recommendation-feedback-track-${recommendationId ?? 'unavailable'}`}
                value={track.externalTrackId}
                checked={selectedTrackId === track.externalTrackId}
                onChange={() => setSelectedTrackId(track.externalTrackId)}
              />
              <span>
                <strong>{track.title}</strong>
                <small>{track.artistName}</small>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {recommendationId === null ? (
        <p className="recommendation-feedback-note" role="status">
          추천 정보를 확인할 수 없어 평가를 제출할 수 없어요.
        </p>
      ) : null}
      {errorMessage ? (
        <p className="recommendation-feedback-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {isSubmitted ? (
        <p className="recommendation-feedback-success" role="status">
          평가를 제출했어요.
        </p>
      ) : null}
      <button
        className="recommendation-feedback-submit"
        type="button"
        disabled={!canSubmit}
        onClick={() => void submitFeedback()}
      >
        {isSubmitting ? '제출 중…' : isSubmitted ? '제출 완료' : '평가 제출하기'}
      </button>
      <p className="recommendation-feedback-note">
        {recommendationId === null
          ? '피드백 없이 닫아도 괜찮아요.'
          : '피드백을 제출해야 닫거나 다음 단계로 진행할 수 있어요.'}
      </p>
    </section>
  );
}
