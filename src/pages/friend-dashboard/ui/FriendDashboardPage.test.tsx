import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import userEvent from '@testing-library/user-event';
import { LockDetailPage } from '../../lock-detail/ui/LockDetailPage';
import { ApiError } from '../../../shared/api/apiError';

import { FriendDashboardPage } from './FriendDashboardPage';

const mocks = vi.hoisted(() => ({
  fetchAuthenticatedJson: vi.fn(),
  getFriendRecordRegions: vi.fn(),
  getFriendRegionRecords: vi.fn(),
  getRecordDetail: vi.fn(),
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

vi.mock('../../../features/record-detail/api/getRecordDetail', () => ({
  getRecordDetail: mocks.getRecordDetail,
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

/** 실제 목록과 상세 컴포넌트를 중첩 라우터에서 연결해 복귀 흐름을 검증한다. */
function renderNested(path = '/friends/22/dashboard') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/friends/:friendUserId/dashboard" element={<FriendDashboardPage />}>
          <Route path="records/:recordId" element={<LockDetailPage />} />
        </Route>
        <Route path="/friends" element={<h1>친구 목록 화면</h1>} />
      </Routes>
      <HistoryBack />
    </MemoryRouter>,
  );
}

/** 닫기와 브라우저 뒤로가기가 같은 목록을 복원하는지 각각 검증한다. */
function HistoryBack() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>브라우저 뒤로</button>;
}

/** 페이지별 결과와 상세는 실제 API 계약의 카드 필드로 구성한다. */
function setupRecords() {
  mocks.getFriendRecordRegions.mockResolvedValue({
    userId: 22,
    nickname: '지수',
    recordsCount: 2,
    regions: [{ legalDongCode: '116', legalDongName: '삼평동', recordsCount: 2 }],
  });
  const record = {
    recordId: 15,
    placeId: 4,
    musicTrackId: 8,
    title: '밤편지',
    artistName: '아이유',
    albumImageUrl: null,
    createdAt: '2026-10-06T12:00:00',
  };
  mocks.getFriendRegionRecords
    .mockResolvedValueOnce({
      legalDongCode: '116',
      legalDongName: '삼평동',
      recordsCount: 2,
      records: [record],
      nextCursor: 'next',
    })
    .mockResolvedValueOnce({
      legalDongCode: '116',
      legalDongName: '삼평동',
      recordsCount: 2,
      records: [{ ...record, recordId: 16, title: '다음 노래' }],
      nextCursor: null,
    });
  mocks.getRecordDetail.mockResolvedValue({
    recordId: 16,
    userId: 22,
    isOwner: false,
    place: {
      placeId: 4,
      legalDongName: '삼평동',
      legalDongCode: '116',
      latitude: 37,
      longitude: 127,
    },
    music: {
      musicTrackId: 8,
      title: '다음 노래',
      artistName: '아이유',
      albumImageUrl: 'https://example.test/album.jpg',
      externalUrl: '',
    },
    weatherCondition: 'CLEAR',
    temperature: 20,
    moodScore: 8,
    comment: null,
    photoUrl: '',
    createdAt: '2026-10-06T12:00:00',
  });
}

describe('친구 상세에서 목록 복귀', () => {
  it.each(['자물쇠 상세 닫기', '브라우저 뒤로'])(
    '%s 후 지역·추가 페이지·스크롤·카드 포커스를 복원한다',
    async (action) => {
      setupRecords();
      const user = userEvent.setup();
      const view = renderNested();
      await user.click(await screen.findByRole('button', { name: /삼평동/ }));
      await screen.findByRole('link', { name: /밤편지/ });
      await user.click(screen.getByRole('button', { name: '더 보기' }));
      const card = await screen.findByRole('link', { name: /다음 노래/ });
      const scrollArea = view.container.querySelector<HTMLElement>('.friend-dashboard-scroll')!;
      scrollArea.scrollTop = 180;
      fireEvent.scroll(scrollArea);
      await user.click(card);
      await screen.findByRole('button', { name: '자물쇠 상세 닫기' });
      expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).not.toBeInTheDocument();
      expect(screen.getAllByRole('navigation', { name: '주요 메뉴', hidden: true })).toHaveLength(
        1,
      );
      expect(screen.queryByRole('link', { name: /밤편지/ })).not.toBeInTheDocument();
      scrollArea.scrollTop = 0;
      await user.click(screen.getByRole('button', { name: action }));
      expect(await screen.findByRole('link', { name: /밤편지/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /다음 노래/ })).toHaveFocus();
      expect(screen.getByRole('heading', { name: '삼평동' })).toBeInTheDocument();
      expect(scrollArea.scrollTop).toBe(180);
      expect(mocks.getFriendRecordRegions).toHaveBeenCalledTimes(1);
      expect(mocks.getFriendRegionRecords).toHaveBeenCalledTimes(2);
      expect(screen.queryByText(/이전에 보던/)).not.toBeInTheDocument();
    },
  );

  it('중첩 상세 URL을 직접 열었으면 닫기는 해당 친구 목록으로 이동한다', async () => {
    setupRecords();
    renderNested('/friends/22/dashboard/records/16');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '자물쇠 상세 닫기' }));
    expect(await screen.findByRole('button', { name: /삼평동/ })).toBeInTheDocument();
  });

  it('상세에서 친구 404가 발생하면 보관한 목록 대신 친구 화면으로 이동한다', async () => {
    setupRecords();
    mocks.getRecordDetail.mockRejectedValueOnce(new ApiError(404, 'not found', 'RECORD_NOT_FOUND'));
    renderNested('/friends/22/dashboard/records/16');
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: '친구 목록 화면' })).toBeInTheDocument(),
    );
    expect(screen.queryByText('지수')).not.toBeInTheDocument();
  });
});
