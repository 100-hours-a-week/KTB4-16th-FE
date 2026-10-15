import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FriendDashboardPage } from './FriendDashboardPage';

const mocks = vi.hoisted(() => ({
  fetchAuthenticatedJson: vi.fn(),
  getFriendRecordRegions: vi.fn(),
  getFriendRegionRecords: vi.fn(),
}));

vi.mock('../../../entities/session/model/useSession', () => ({
  useSession: () => ({ fetchAuthenticatedJson: mocks.fetchAuthenticatedJson }),
}));
vi.mock('../../../features/dashboard/api/getFriendRecordRegions', () => ({
  getFriendRecordRegions: mocks.getFriendRecordRegions,
}));
vi.mock('../../../features/dashboard/api/getFriendRegionRecords', () => ({
  getFriendRegionRecords: mocks.getFriendRegionRecords,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getFriendRecordRegions.mockResolvedValue({
    userId: 22,
    nickname: '지수',
    recordsCount: 0,
    regions: [],
  });
});

describe('FriendDashboardPage', () => {
  it('loads the friend ID from a directly opened dashboard route', async () => {
    render(
      <MemoryRouter initialEntries={['/friends/22/dashboard']}>
        <Routes>
          <Route path="/friends/:friendUserId/dashboard" element={<FriendDashboardPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('지수')).toBeInTheDocument();
    expect(mocks.getFriendRecordRegions).toHaveBeenCalledWith(
      22,
      mocks.fetchAuthenticatedJson,
      expect.any(AbortSignal),
    );
    expect(screen.getByRole('link', { name: '친구 목록' })).toHaveAttribute('href', '/friends');
  });
});
