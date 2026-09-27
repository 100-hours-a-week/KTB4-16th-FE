import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardContent } from './DashboardContent';

const mocks = vi.hoisted(() => ({
  fetchAuthenticatedJson: vi.fn(),
  getRecordRegions: vi.fn(),
  getRegionRecords: vi.fn(),
}));

vi.mock('../../../entities/session/model/useSession', () => ({
  useSession: () => ({ fetchAuthenticatedJson: mocks.fetchAuthenticatedJson }),
}));
vi.mock('../api/getRecordRegions', () => ({ getRecordRegions: mocks.getRecordRegions }));
vi.mock('../api/getRegionRecords', () => ({ getRegionRecords: mocks.getRegionRecords }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  mocks.getRecordRegions.mockResolvedValue([
    { legalDongCode: '4111710100', legalDongName: '영통동', recordsCount: 1 },
  ]);
  mocks.getRegionRecords.mockResolvedValue({
    legalDongCode: '4111710100',
    legalDongName: '영통동',
    recordsCount: 1,
    records: [
      {
        recordId: 1456,
        placeId: 552,
        musicTrackId: 305,
        title: 'REDRED',
        artistName: 'CORTIS',
        albumImageUrl: 'https://image.test/redred.jpg',
        createdAt: '2026-09-26T18:25:02',
      },
    ],
    nextCursor: null,
  });
});

describe('DashboardContent', () => {
  it('renders the album cover received in the selected region records response', async () => {
    const user = userEvent.setup();
    render(<DashboardContent />);

    await user.click(await screen.findByRole('button', { name: /영통동/ }));

    const image = await screen.findByRole('img', { name: 'REDRED - CORTIS 앨범 커버' });
    expect(image).toHaveAttribute('src', 'https://image.test/redred.jpg');
  });

  it('keeps the gradient fallback when the album image fails to load', async () => {
    const user = userEvent.setup();
    const { container } = render(<DashboardContent />);

    await user.click(await screen.findByRole('button', { name: /영통동/ }));
    const image = await screen.findByRole('img', { name: 'REDRED - CORTIS 앨범 커버' });
    fireEvent.error(image);

    expect(image).not.toBeVisible();
    expect(container.querySelector('.dashboard-cover')).toBeInTheDocument();
  });
});
