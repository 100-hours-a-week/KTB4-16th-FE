import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../../shared/api/apiError';
import { getCsrfToken } from '../../../shared/api/csrf';
import { submitAiRecommendationFeedback } from './aiRecommendationFeedbackApi';

vi.mock('../../../shared/api/csrf', () => ({ getCsrfToken: vi.fn() }));

describe('submitAiRecommendationFeedback', () => {
  it('인증된 클라이언트와 CSRF로 선택 피드백을 제출한다', async () => {
    vi.mocked(getCsrfToken).mockResolvedValue('csrf');
    const request = vi.fn().mockResolvedValue({
      message: '추천 피드백을 제출했습니다.',
      data: {
        feedbackId: 15,
        recommendationId: 21,
        feedback: 'LIKE',
        selectedTrackId: 'spotify-track',
      },
    });

    await expect(
      submitAiRecommendationFeedback(
        21,
        { feedback: 'LIKE', selectedTrackId: 'spotify-track' },
        request,
      ),
    ).resolves.toEqual({
      feedbackId: 15,
      recommendationId: 21,
      feedback: 'LIKE',
      selectedTrackId: 'spotify-track',
    });
    expect(request).toHaveBeenCalledWith('/ai-recommendations/21/feedback', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': 'csrf' },
      body: JSON.stringify({ feedback: 'LIKE', selectedTrackId: 'spotify-track' }),
    });
  });

  it('selectedTrackId가 없는 피드백도 계약대로 제출한다', async () => {
    vi.mocked(getCsrfToken).mockResolvedValue('csrf');
    const request = vi.fn().mockResolvedValue({
      message: '추천 피드백을 제출했습니다.',
      data: { feedbackId: 15, recommendationId: 21, feedback: 'DISLIKE' },
    });

    await expect(
      submitAiRecommendationFeedback(21, { feedback: 'DISLIKE', selectedTrackId: null }, request),
    ).resolves.toMatchObject({ feedback: 'DISLIKE', selectedTrackId: null });
    expect(request).toHaveBeenCalledWith(
      '/ai-recommendations/21/feedback',
      expect.objectContaining({ body: '{"feedback":"DISLIKE","selectedTrackId":null}' }),
    );
  });

  it('성공 응답의 추천 ID가 다르면 계약 오류로 처리한다', async () => {
    const request = vi.fn().mockResolvedValue({
      message: '성공',
      data: { feedbackId: 15, recommendationId: 22, feedback: 'DISLIKE' },
    });

    await expect(
      submitAiRecommendationFeedback(21, { feedback: 'DISLIKE', selectedTrackId: null }, request),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' } satisfies Partial<ApiError>);
  });

  it('서버의 중복 제출 오류를 성공으로 바꾸지 않고 그대로 전달한다', async () => {
    const request = vi
      .fn()
      .mockRejectedValue(
        new ApiError(409, '이미 제출했습니다.', 'AI_RECOMMENDATION_FEEDBACK_ALREADY_SUBMITTED'),
      );

    await expect(
      submitAiRecommendationFeedback(21, { feedback: 'DISLIKE', selectedTrackId: null }, request),
    ).rejects.toMatchObject({
      status: 409,
      code: 'AI_RECOMMENDATION_FEEDBACK_ALREADY_SUBMITTED',
    });
  });
});
