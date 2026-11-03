import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { PhotoMusicRecommendation } from '../api/getPhotoMusicRecommendations';
import { PhotoMusicRecommendationModal } from './PhotoMusicRecommendationModal';

const mocks = vi.hoisted(() => ({ fetchAuthenticatedJson: vi.fn() }));
vi.mock('../../../entities/session/model/useSession', () => ({
  useSession: () => ({ fetchAuthenticatedJson: mocks.fetchAuthenticatedJson }),
}));
vi.mock('../../../shared/api/csrf', () => ({ getCsrfToken: vi.fn().mockResolvedValue('csrf') }));

const recommendation = {
  externalTrackId: 'spotify-track',
  title: 'REALLY REALLY',
  artistName: 'WINNER',
  albumImageUrl: 'https://image.test/really-really.jpg',
  externalUrl: 'https://music.test/really-really',
} satisfies PhotoMusicRecommendation;

const defaultProps = {
  isOpen: true,
  loadState: 'ready' as const,
  recommendations: [recommendation],
  recommendationId: 51,
  isFeedbackRequired: false,
  hasSubmittedFeedback: false,
  isFeedbackSubmitting: false,
  onFeedbackSubmittingChange: vi.fn(),
  errorMessage: null,
  onClose: vi.fn(),
  onDirectSearch: vi.fn(),
  onSelect: vi.fn(),
  onRetry: vi.fn(),
};

describe('PhotoMusicRecommendationModal', () => {
  it('renders an album cover and sends the selected recommendation through the existing selection path', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PhotoMusicRecommendationModal {...defaultProps} onSelect={onSelect} />);

    expect(screen.getByRole('img', { name: 'REALLY REALLY - WINNER 앨범 커버' })).toHaveAttribute(
      'src',
      recommendation.albumImageUrl,
    );
    await user.click(screen.getByRole('button', { name: /REALLY REALLY/ }));

    expect(onSelect).toHaveBeenCalledWith(recommendation);
  });

  it('renders all five recommendations and allows selecting the fifth', async () => {
    const user = userEvent.setup();
    const recommendations = Array.from({ length: 5 }, (_, index) => ({
      ...recommendation,
      externalTrackId: `spotify-track-${index + 1}`,
      title: `추천곡 ${index + 1}`,
    }));
    const onSelect = vi.fn();
    render(
      <PhotoMusicRecommendationModal
        {...defaultProps}
        onSelect={onSelect}
        recommendations={recommendations}
      />,
    );

    const list = screen.getByRole('list', { name: '사진 음악 추천 결과' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(5);
    await user.click(screen.getByRole('button', { name: /추천곡 5/ }));

    expect(onSelect).toHaveBeenCalledWith(recommendations[4]);
  });

  it('keeps the gradient fallback after an album cover fails to load', () => {
    const { container } = render(<PhotoMusicRecommendationModal {...defaultProps} />);
    const image = screen.getByRole('img');
    fireEvent.error(image);
    expect(image).not.toBeVisible();
    expect(container.querySelector('.photo-music-recommendation-cover')).toBeInTheDocument();
  });

  it('사진 추천은 곡 선택 영역 없이 피드백을 표시하고 닫을 때 자동 제출하지 않는다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PhotoMusicRecommendationModal {...defaultProps} onClose={onClose} />);

    expect(screen.getByRole('region', { name: '추천 결과 피드백' })).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '👍 좋아요' }));
    await user.click(screen.getByRole('button', { name: '사진 음악 추천 닫기' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(mocks.fetchAuthenticatedJson).not.toHaveBeenCalled();
  });

  it('필수 피드백 미제출 중에는 X·배경·ESC·곡 선택·직접 검색을 막는다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSelect = vi.fn();
    const onDirectSearch = vi.fn();
    render(
      <PhotoMusicRecommendationModal
        {...defaultProps}
        isFeedbackRequired
        onClose={onClose}
        onSelect={onSelect}
        onDirectSearch={onDirectSearch}
      />,
    );

    await user.click(screen.getByRole('button', { name: '사진 음악 추천 닫기' }));
    await user.click(screen.getByRole('button', { name: /REALLY REALLY/ }));
    await user.click(screen.getByRole('button', { name: '직접 검색하기' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('presentation'));

    expect(onClose).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    expect(onDirectSearch).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(
      '추천 결과를 평가한 후 다음 단계로 진행할 수 있어요.',
    );
  });

  it('피드백 API 성공 응답 이후에는 곡 선택과 모달 닫기가 허용된다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSelect = vi.fn();
    mocks.fetchAuthenticatedJson.mockResolvedValueOnce({
      message: '피드백 제출 성공',
      data: { feedbackId: 7, recommendationId: 51, feedback: 'DISLIKE', selectedTrackId: null },
    });
    const props = { ...defaultProps, isFeedbackRequired: true, onClose, onSelect };
    const { rerender } = render(<PhotoMusicRecommendationModal {...props} />);

    await user.click(screen.getByRole('button', { name: '👎 싫어요' }));
    await user.click(screen.getByRole('button', { name: '평가 제출하기' }));
    expect(await screen.findByText('평가를 제출했어요.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();

    rerender(<PhotoMusicRecommendationModal {...props} hasSubmittedFeedback />);
    await user.click(screen.getByRole('button', { name: /REALLY REALLY/ }));
    await user.click(screen.getByRole('button', { name: '사진 음악 추천 닫기' }));
    expect(onSelect).toHaveBeenCalledWith(recommendation);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('추천 ID가 없거나 추천 결과가 없는 경우에는 피드백 없이 기존 종료·이동을 허용한다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSelect = vi.fn();
    const { rerender } = render(
      <PhotoMusicRecommendationModal
        {...defaultProps}
        recommendationId={null}
        onClose={onClose}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole('button', { name: '사진 음악 추천 닫기' }));
    await user.click(screen.getByRole('button', { name: /REALLY REALLY/ }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledOnce();

    rerender(
      <PhotoMusicRecommendationModal
        {...defaultProps}
        recommendations={[]}
        isFeedbackRequired={false}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByRole('button', { name: '사진 음악 추천 닫기' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('supports empty, error, close, direct-search, and retry states', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDirectSearch = vi.fn();
    const onRetry = vi.fn();
    const { rerender } = render(
      <PhotoMusicRecommendationModal
        {...defaultProps}
        recommendations={[]}
        onClose={onClose}
        onDirectSearch={onDirectSearch}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText('추천 음악을 찾지 못했어요. 직접 검색해보세요.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '사진 음악 추천 닫기' }));
    await user.click(screen.getByRole('button', { name: '직접 검색하기' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onDirectSearch).toHaveBeenCalledOnce();

    rerender(
      <PhotoMusicRecommendationModal
        {...defaultProps}
        errorMessage="음악 추천에 실패했어요. 다시 시도해주세요."
        loadState="error"
        onRetry={onRetry}
      />,
    );
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
