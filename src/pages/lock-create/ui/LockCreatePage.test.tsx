import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '../../../entities/session/model/SessionProvider';
import type { MusicSearchResult } from '../../../features/music-search/model/musicSearch.types';
import { LockCreatePage } from './LockCreatePage';

const selectedTrack: MusicSearchResult = {
  provider: 'SPOTIFY',
  externalTrackId: 'track-1',
  title: '밤편지',
  artistName: '아이유',
  albumImageUrl: 'https://example.com/cover.jpg',
  externalUrl: 'https://example.com/track-1',
};

vi.mock('../../../features/music-search/ui/MusicSearchField', () => ({
  MusicSearchField: ({ onSelect }: { onSelect: (track: MusicSearchResult) => void }) => (
    <button type="button" onClick={() => onSelect(selectedTrack)}>
      테스트 음악 선택
    </button>
  ),
}));

describe('LockCreatePage', () => {
  it('음악 검색에서 선택한 곡을 작성 화면에 표시하고 저장은 활성화하지 않는다', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SessionProvider>
          <LockCreatePage />
        </SessionProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: '테스트 음악 선택' }));

    expect(screen.getByText('선택한 음악: 밤편지 — 아이유')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '🔒 자물쇠 저장하기' })).toBeDisabled();
    expect(screen.getByText('자물쇠 저장 기능은 구현 예정입니다.')).toBeInTheDocument();
  });
});
