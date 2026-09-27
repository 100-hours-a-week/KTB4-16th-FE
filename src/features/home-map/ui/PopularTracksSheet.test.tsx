import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PopularTracksSheet } from './PopularTracksSheet';

const defaultProps = {
  isOpen: true,
  placeCount: 2,
  result: {
    recordCount: 214,
    music: [{ rank: 1, musicTrackId: 583, title: '밤편지', artistName: '아이유', count: 42 }],
  },
  loadState: 'ready' as const,
  onRetry: vi.fn(),
  onClose: vi.fn(),
  onExited: vi.fn(),
};

describe('PopularTracksSheet', () => {
  it('renders the API rank, title, artist, count, and total record count', () => {
    render(<PopularTracksSheet {...defaultProps} />);

    expect(screen.getByText('최근 7일 자물쇠 214개')).toBeInTheDocument();
    expect(screen.getByText('밤편지')).toBeInTheDocument();
    expect(screen.getByText('아이유')).toBeInTheDocument();
    expect(screen.getByText('42회')).toBeInTheDocument();
  });

  it('shows empty and error states inside the sheet', () => {
    const { rerender } = render(
      <PopularTracksSheet
        {...defaultProps}
        loadState="empty"
        result={{ recordCount: 0, music: [] }}
      />,
    );
    expect(screen.getByText('최근 7일 동안 기록된 음악이 없어요.')).toBeInTheDocument();

    rerender(<PopularTracksSheet {...defaultProps} loadState="error" result={null} />);
    expect(screen.getByText('인기 음악을 불러오지 못했어요.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(defaultProps.onRetry).toHaveBeenCalledOnce();
  });
});
