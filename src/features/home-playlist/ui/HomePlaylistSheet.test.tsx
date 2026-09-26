import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { HomePlaylistSheet } from './HomePlaylistSheet';

describe('HomePlaylistSheet', () => {
  it('가짜 추천 곡과 Spotify 저장 동작 대신 미구현 안내를 표시한다', () => {
    render(
      <MemoryRouter>
        <HomePlaylistSheet isOpen onExited={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText('미구현 기능입니다.', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('비 오는 날엔')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '내 Spotify에 저장하기' })).not.toBeInTheDocument();
  });
});
