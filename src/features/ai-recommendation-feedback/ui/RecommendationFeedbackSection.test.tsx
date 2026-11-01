import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../../shared/api/apiError';
import { getCsrfToken } from '../../../shared/api/csrf';
import { RecommendationFeedbackSection } from './RecommendationFeedbackSection';

const mocks = vi.hoisted(() => ({ fetchAuthenticatedJson: vi.fn() }));
vi.mock('../../../entities/session/model/useSession', () => ({
  useSession: () => ({ fetchAuthenticatedJson: mocks.fetchAuthenticatedJson }),
}));
vi.mock('../../../shared/api/csrf', () => ({ getCsrfToken: vi.fn() }));

const tracks = [
  { externalTrackId: 'spotify-1', title: '첫 번째 곡', artistName: '가수 1' },
  { externalTrackId: 'spotify-2', title: '두 번째 곡', artistName: '가수 2' },
];

function successResponse(feedback: 'LIKE' | 'DISLIKE', selectedTrackId?: string) {
  return {
    message: '추천 피드백을 제출했습니다.',
    data: {
      feedbackId: 12,
      recommendationId: 21,
      feedback,
      ...(selectedTrackId ? { selectedTrackId } : {}),
    },
  };
}

function renderSection(props?: Partial<Parameters<typeof RecommendationFeedbackSection>[0]>) {
  return render(
    <RecommendationFeedbackSection
      recommendationId={21}
      tracks={tracks}
      allowTrackSelection={false}
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCsrfToken).mockResolvedValue('csrf');
});

describe('RecommendationFeedbackSection', () => {
  it('선택 전 제출은 비활성화되고 사진 좋아요·싫어요는 선택 곡 없이 제출한다', async () => {
    const user = userEvent.setup();
    mocks.fetchAuthenticatedJson.mockResolvedValueOnce(successResponse('LIKE'));
    const onSubmitted = vi.fn();
    renderSection({ onSubmitted });

    const submit = screen.getByRole('button', { name: '평가 제출하기' });
    expect(submit).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '👍 좋아요' }));
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(mocks.fetchAuthenticatedJson).toHaveBeenCalledWith(
      '/ai-recommendations/21/feedback',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ feedback: 'LIKE', selectedTrackId: null }),
      }),
    );
    expect(await screen.findByText('평가를 제출했어요.')).toBeInTheDocument();
    expect(submit).toBeDisabled();
    expect(onSubmitted).toHaveBeenCalledOnce();
  });

  it('플레이리스트 좋아요는 Spotify externalTrackId 한 곡만 선택해 전송한다', async () => {
    const user = userEvent.setup();
    mocks.fetchAuthenticatedJson.mockResolvedValueOnce(successResponse('LIKE', 'spotify-2'));
    renderSection({ allowTrackSelection: true });

    await user.click(screen.getByRole('button', { name: '👍 좋아요' }));
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(screen.getByRole('button', { name: '평가 제출하기' })).toBeDisabled();
    await user.click(radios[1]);
    expect(radios[1]).toBeChecked();
    expect(radios[0]).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: '평가 제출하기' }));

    expect(mocks.fetchAuthenticatedJson).toHaveBeenCalledWith(
      '/ai-recommendations/21/feedback',
      expect.objectContaining({
        body: JSON.stringify({ feedback: 'LIKE', selectedTrackId: 'spotify-2' }),
      }),
    );
  });

  it('LIKE에서 DISLIKE로 바꾸면 선택 곡을 초기화하고 null을 전송한다', async () => {
    const user = userEvent.setup();
    mocks.fetchAuthenticatedJson.mockResolvedValueOnce(successResponse('DISLIKE'));
    renderSection({ allowTrackSelection: true });

    await user.click(screen.getByRole('button', { name: '👍 좋아요' }));
    await user.click(screen.getByRole('radio', { name: /두 번째 곡/ }));
    await user.click(screen.getByRole('button', { name: '👎 싫어요' }));
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '평가 제출하기' }));

    expect(mocks.fetchAuthenticatedJson).toHaveBeenCalledWith(
      '/ai-recommendations/21/feedback',
      expect.objectContaining({
        body: JSON.stringify({ feedback: 'DISLIKE', selectedTrackId: null }),
      }),
    );
  });

  it('제출 중 연속 클릭을 막고 실패 후 선택을 유지해 재시도한다', async () => {
    const user = userEvent.setup();
    mocks.fetchAuthenticatedJson
      .mockRejectedValueOnce(new ApiError(500, '서버 오류', 'INTERNAL_SERVER_ERROR'))
      .mockResolvedValueOnce(successResponse('DISLIKE'));
    renderSection();

    await user.click(screen.getByRole('button', { name: '👎 싫어요' }));
    const submit = screen.getByRole('button', { name: '평가 제출하기' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.fetchAuthenticatedJson).toHaveBeenCalledOnce());
    expect(await screen.findByRole('alert')).toHaveTextContent('평가를 제출하지 못했어요.');
    expect(screen.getByRole('button', { name: '👎 싫어요' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: '평가 제출하기' }));
    await waitFor(() => expect(mocks.fetchAuthenticatedJson).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('평가를 제출했어요.')).toBeInTheDocument();
  });

  it('409 중복 제출을 성공으로 취급하지 않고 안내한다', async () => {
    const user = userEvent.setup();
    mocks.fetchAuthenticatedJson.mockRejectedValueOnce(
      new ApiError(409, '중복 제출', 'AI_RECOMMENDATION_FEEDBACK_ALREADY_SUBMITTED'),
    );
    renderSection();
    await user.click(screen.getByRole('button', { name: '👎 싫어요' }));
    await user.click(screen.getByRole('button', { name: '평가 제출하기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('이미 평가한 추천 결과예요.');
    expect(screen.queryByText('평가를 제출했어요.')).not.toBeInTheDocument();
  });

  it.each([
    { status: 400, code: 'INVALID_INPUT_VALUE', message: '선택한 평가 내용을 확인해 주세요.' },
    {
      status: 403,
      code: 'AI_RECOMMENDATION_NOT_OWNED',
      message: '이 추천 결과에 평가를 제출할 수 없어요.',
    },
    {
      status: 404,
      code: 'AI_RECOMMENDATION_NOT_FOUND',
      message: '추천 결과를 찾을 수 없어요. 새로 추천받아 주세요.',
    },
  ])(
    '$status 오류는 사용자 안내로 표시하고 성공 처리하지 않는다',
    async ({ status, code, message }) => {
      const user = userEvent.setup();
      mocks.fetchAuthenticatedJson.mockRejectedValueOnce(new ApiError(status, '실패', code));
      renderSection();
      await user.click(screen.getByRole('button', { name: '👎 싫어요' }));
      await user.click(screen.getByRole('button', { name: '평가 제출하기' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(screen.queryByText('평가를 제출했어요.')).not.toBeInTheDocument();
    },
  );

  it('recommendationId가 없으면 안내하고 제출을 막는다', async () => {
    const user = userEvent.setup();
    renderSection({ recommendationId: null });
    await user.click(screen.getByRole('button', { name: '👎 싫어요' }));

    expect(screen.getByRole('status')).toHaveTextContent('평가를 제출할 수 없어요.');
    expect(screen.getByRole('button', { name: '평가 제출하기' })).toBeDisabled();
    expect(mocks.fetchAuthenticatedJson).not.toHaveBeenCalled();
  });

  it('시트가 닫힌 뒤 늦게 온 응답은 완료 콜백을 호출하지 않는다', async () => {
    const user = userEvent.setup();
    let resolveResponse: ((value: unknown) => void) | undefined;
    mocks.fetchAuthenticatedJson.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveResponse = resolve;
      }),
    );
    const onSubmitted = vi.fn();
    const onSubmittingChange = vi.fn();
    const { unmount } = renderSection({ onSubmitted, onSubmittingChange });
    await user.click(screen.getByRole('button', { name: '👎 싫어요' }));
    await user.click(screen.getByRole('button', { name: '평가 제출하기' }));
    expect(onSubmittingChange).toHaveBeenLastCalledWith(true);
    unmount();
    resolveResponse?.(successResponse('DISLIKE'));

    await waitFor(() => expect(onSubmittingChange).toHaveBeenLastCalledWith(false));
    expect(onSubmitted).not.toHaveBeenCalled();
  });
});
