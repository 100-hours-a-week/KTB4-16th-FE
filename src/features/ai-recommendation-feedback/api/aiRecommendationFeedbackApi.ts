import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { ApiError } from '../../../shared/api/apiError';
import { getCsrfToken } from '../../../shared/api/csrf';

export type AiRecommendationFeedback = 'LIKE' | 'DISLIKE';

export type AiRecommendationFeedbackRequest = {
  feedback: AiRecommendationFeedback;
  selectedTrackId: string | null;
};

export type AiRecommendationFeedbackResponse = {
  feedbackId: number;
  recommendationId: number;
  feedback: AiRecommendationFeedback;
  selectedTrackId: string | null;
};

export async function submitAiRecommendationFeedback(
  recommendationId: number,
  request: AiRecommendationFeedbackRequest,
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
): Promise<AiRecommendationFeedbackResponse> {
  if (!Number.isSafeInteger(recommendationId) || recommendationId <= 0) {
    throw invalidResponse();
  }

  const csrfToken = await getCsrfToken();
  const value = await fetchAuthenticatedJson<unknown>(
    `/ai-recommendations/${recommendationId}/feedback`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrfToken },
      body: JSON.stringify(request),
    },
  );

  if (
    !isRecord(value) ||
    typeof value.message !== 'string' ||
    !isRecord(value.data) ||
    !isPositiveInteger(value.data.feedbackId) ||
    value.data.recommendationId !== recommendationId ||
    value.data.feedback !== request.feedback ||
    (value.data.selectedTrackId ?? null) !== request.selectedTrackId
  ) {
    throw invalidResponse();
  }

  return {
    feedbackId: value.data.feedbackId,
    recommendationId,
    feedback: request.feedback,
    selectedTrackId: request.selectedTrackId,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function invalidResponse(): ApiError {
  return new ApiError(502, '서버 응답 형식을 확인할 수 없습니다.', 'INVALID_RESPONSE');
}
