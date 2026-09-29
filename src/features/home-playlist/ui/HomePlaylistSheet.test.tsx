import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { HomePlaylistSheet } from './HomePlaylistSheet';

describe('HomePlaylistSheet', () => {
  it('가짜 추천 곡과 Spotify 저장 동작 대신 구현 예정 안내를 표시한다', () => {
    render(
      <MemoryRouter>
        <HomePlaylistSheet isOpen onClose={vi.fn()} onExited={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText('구현 예정 기능입니다.', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('비 오는 날엔')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '내 Spotify에 저장하기' })).not.toBeInTheDocument();
  });

  it('provides a named non-modal region, close control, and Escape handling', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <button type="button">플레이리스트 열기</button>
        <HomePlaylistSheet isOpen={false} onClose={onClose} onExited={vi.fn()} />
      </MemoryRouter>,
    );
    const opener = screen.getByRole('button', { name: '플레이리스트 열기' });
    opener.focus();
    rerender(
      <MemoryRouter>
        <button type="button">플레이리스트 열기</button>
        <HomePlaylistSheet isOpen onClose={onClose} onExited={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('region', { name: 'AI 추천 플레이리스트' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '플레이리스트 안내 닫기' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
    rerender(
      <MemoryRouter>
        <button type="button">플레이리스트 열기</button>
        <HomePlaylistSheet isOpen={false} onClose={onClose} onExited={vi.fn()} />
      </MemoryRouter>,
    );
    expect(opener).toHaveFocus();
  });
});
