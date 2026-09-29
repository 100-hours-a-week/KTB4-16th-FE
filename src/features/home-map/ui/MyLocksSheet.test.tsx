import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import type { MyPlaceRecord } from '../api/getMyPlaceRecords';
import { MyLocksSheet } from './MyLocksSheet';

const defaultProps = {
  isOpen: true,
  placeCount: 1,
  loadState: 'ready' as const,
  hasNextPage: false,
  isLoadingNextPage: false,
  onLoadNextPage: vi.fn(),
  onClose: vi.fn(),
  onExited: vi.fn(),
};

const record = {
  recordId: 1356,
  placeId: 222,
  musicTrackId: 123,
  title: 'REALLY REALLY',
  artistName: 'WINNER',
  albumImageUrl: 'https://image.test/really-really.jpg',
  createdAt: '2026-09-26T11:30:43',
} satisfies MyPlaceRecord;

describe('MyLocksSheet', () => {
  it('names the non-modal region, focuses close on open, and supports Escape/restore', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(
      <MemoryRouter>
        <button type="button">지도 마커 열기</button>
        <MyLocksSheet {...defaultProps} isOpen={false} onClose={onClose} records={[record]} />
      </MemoryRouter>,
    );
    const opener = screen.getByRole('button', { name: '지도 마커 열기' });
    opener.focus();

    rerender(
      <MemoryRouter>
        <button type="button">지도 마커 열기</button>
        <MyLocksSheet {...defaultProps} isOpen onClose={onClose} records={[record]} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('region', { name: '내 자물쇠 목록' })).toBeInTheDocument();
    const closeButton = screen.getByRole('button', { name: '내 자물쇠 목록 닫기' });
    expect(closeButton).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();

    rerender(
      <MemoryRouter>
        <button type="button">지도 마커 열기</button>
        <MyLocksSheet {...defaultProps} isOpen={false} onClose={onClose} records={[record]} />
      </MemoryRouter>,
    );
    expect(opener).toHaveFocus();
  });

  it('links a record row to its detail route and renders the album cover', async () => {
    const user = userEvent.setup();
    renderSheet([record]);

    const image = screen.getByRole('img', { name: 'REALLY REALLY - WINNER 앨범 커버' });
    expect(image).toHaveAttribute('src', record.albumImageUrl);
    await user.click(screen.getByRole('link', { name: /REALLY REALLY/ }));

    expect(screen.getByTestId('current-path')).toHaveTextContent('/records/1356');
  });

  it('keeps the gradient cover fallback after an album image load failure', () => {
    const { container } = renderSheet([record]);
    const image = screen.getByRole('img', { name: 'REALLY REALLY - WINNER 앨범 커버' });

    fireEvent.error(image);

    expect(image).not.toBeVisible();
    expect(container.querySelector('.my-locks-sheet-cover')).toBeInTheDocument();
  });
});

function renderSheet(records: MyPlaceRecord[]) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <MyLocksSheet {...defaultProps} records={records} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="current-path">{location.pathname}</span>;
}
