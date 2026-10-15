import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../../shared/api/apiError';
import { FriendDashboardContent } from './FriendDashboardContent';

const mocks = vi.hoisted(() => ({
  fetchAuthenticatedJson: vi.fn(),
  getFriendRecordRegions: vi.fn(),
  getFriendRegionRecords: vi.fn(),
}));

vi.mock('../../../entities/session/model/useSession', () => ({
  useSession: () => ({ fetchAuthenticatedJson: mocks.fetchAuthenticatedJson }),
}));
vi.mock('../api/getFriendRecordRegions', () => ({
  getFriendRecordRegions: mocks.getFriendRecordRegions,
}));
vi.mock('../api/getFriendRegionRecords', () => ({
  getFriendRegionRecords: mocks.getFriendRegionRecords,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getFriendRecordRegions.mockResolvedValue({
    userId: 22,
    nickname: '지수',
    recordsCount: 1,
    regions: [{ legalDongCode: 'UNKNOWN', legalDongName: '위치 정보 없음', recordsCount: 1 }],
  });
  mocks.getFriendRegionRecords.mockResolvedValue({
    legalDongCode: 'UNKNOWN',
    legalDongName: '위치 정보 없음',
    recordsCount: 1,
    records: [
      {
        recordId: 15,
        placeId: 4,
        musicTrackId: 8,
        title: '밤편지',
        artistName: '아이유',
        albumImageUrl: null,
        createdAt: '2026-10-06T12:00:00',
      },
    ],
    nextCursor: null,
  });
});

describe('FriendDashboardContent', () => {
  it('loads friend regions, opens a cursor list, and links to read-only detail', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <FriendDashboardContent friendUserId={22} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('지수')).toBeInTheDocument();
    expect(screen.getAllByText('자물쇠 1개')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: /위치 정보 없음/ }));
    expect(await screen.findByText('밤편지')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /밤편지/ })).toHaveAttribute(
      'href',
      '/records/15?origin=friend',
    );
    expect(mocks.getFriendRegionRecords).toHaveBeenCalledWith(
      22,
      'UNKNOWN',
      null,
      mocks.fetchAuthenticatedJson,
      expect.any(AbortSignal),
    );
  });

  it('shows an empty dashboard for a friend with no locks', async () => {
    mocks.getFriendRecordRegions.mockResolvedValueOnce({
      userId: 22,
      nickname: '지수',
      recordsCount: 0,
      regions: [],
    });
    render(
      <MemoryRouter>
        <FriendDashboardContent friendUserId={22} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('친구가 아직 자물쇠를 만들지 않았어요.')).toBeInTheDocument();
    const profile = screen.getByRole('region', { name: '친구 프로필' });
    expect(profile.textContent).toMatch(/^지수FRIEND DASHBOARD자물쇠 0개$/);
  });

  it('appends the next cursor page without replacing the first page', async () => {
    const user = userEvent.setup();
    mocks.getFriendRegionRecords
      .mockResolvedValueOnce({
        legalDongCode: 'UNKNOWN',
        legalDongName: '위치 정보 없음',
        recordsCount: 2,
        records: [
          {
            recordId: 15,
            placeId: 4,
            musicTrackId: 8,
            title: '첫 번째 노래',
            artistName: '가수',
            albumImageUrl: null,
            createdAt: '2026-10-06T12:00:00',
          },
        ],
        nextCursor: 'next',
      })
      .mockResolvedValueOnce({
        legalDongCode: 'UNKNOWN',
        legalDongName: '위치 정보 없음',
        recordsCount: 2,
        records: [
          {
            recordId: 16,
            placeId: 4,
            musicTrackId: 8,
            title: '다음 노래',
            artistName: '가수',
            albumImageUrl: null,
            createdAt: '2026-10-05T12:00:00',
          },
        ],
        nextCursor: null,
      });
    render(
      <MemoryRouter>
        <FriendDashboardContent friendUserId={22} />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: /위치 정보 없음/ }));
    expect(await screen.findByText('첫 번째 노래')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '더 보기' }));

    expect(await screen.findByText('다음 노래')).toBeInTheDocument();
    expect(screen.getByText('첫 번째 노래')).toBeInTheDocument();
    expect(mocks.getFriendRegionRecords).toHaveBeenNthCalledWith(
      2,
      22,
      'UNKNOWN',
      'next',
      mocks.fetchAuthenticatedJson,
      expect.any(AbortSignal),
    );
  });

  it('shows a record only once when a later cursor page overlaps', async () => {
    const user = userEvent.setup();
    const record = {
      recordId: 15,
      placeId: 4,
      musicTrackId: 8,
      title: '겹친 노래',
      artistName: '가수',
      albumImageUrl: null,
      createdAt: '2026-10-06T12:00:00',
    };
    mocks.getFriendRegionRecords
      .mockResolvedValueOnce({
        legalDongCode: 'UNKNOWN',
        legalDongName: '위치 정보 없음',
        recordsCount: 1,
        records: [record],
        nextCursor: 'next',
      })
      .mockResolvedValueOnce({
        legalDongCode: 'UNKNOWN',
        legalDongName: '위치 정보 없음',
        recordsCount: 1,
        records: [record],
        nextCursor: null,
      });
    render(
      <MemoryRouter>
        <FriendDashboardContent friendUserId={22} />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: /위치 정보 없음/ }));
    await screen.findByText('겹친 노래');
    await user.click(screen.getByRole('button', { name: '더 보기' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '더 보기' })).not.toBeInTheDocument(),
    );
    expect(screen.getAllByRole('link', { name: /겹친 노래/ })).toHaveLength(1);
  });

  it('offers a return to friends when the current friendship is gone', async () => {
    mocks.getFriendRecordRegions.mockRejectedValueOnce(
      new ApiError(404, '사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND'),
    );
    render(
      <MemoryRouter>
        <FriendDashboardContent friendUserId={22} />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText('현재 친구가 아니어서 대시보드를 볼 수 없어요.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '친구 목록으로' })).toHaveAttribute('href', '/friends');
  });
});
