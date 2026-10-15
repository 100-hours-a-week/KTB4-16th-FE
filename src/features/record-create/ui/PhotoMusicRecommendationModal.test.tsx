import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { PhotoMusicRecommendation } from '../api/getPhotoMusicRecommendations';
import { PhotoMusicRecommendationModal } from './PhotoMusicRecommendationModal';

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
