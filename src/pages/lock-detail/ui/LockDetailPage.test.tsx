import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LockDetailData } from '../../../features/record-detail/model/lockDetail.types';
import { ApiError } from '../../../shared/api/apiError';
import { LockDetailPage } from './LockDetailPage';

const mocks = vi.hoisted(() => ({
  fetchAuthenticatedJson: vi.fn(),
  getRecordDetail: vi.fn(),
  updateRecordComment: vi.fn(),
  deleteRecord: vi.fn(),
}));

vi.mock('../../../entities/session/model/useSession', () => ({
  useSession: () => ({ fetchAuthenticatedJson: mocks.fetchAuthenticatedJson }),
}));
vi.mock('../../../features/record-detail/api/getRecordDetail', () => ({
  getRecordDetail: mocks.getRecordDetail,
}));
vi.mock('../../../features/record-detail/api/deleteRecord', () => ({
  deleteRecord: mocks.deleteRecord,
}));
vi.mock('../../../features/record-detail/api/updateRecordComment', () => ({
  updateRecordComment: mocks.updateRecordComment,
}));

const detail: LockDetailData = {
  recordId: 585,
  userId: 108,
  isOwner: true,
  place: {
    placeId: 225,
    legalDongName: '매산로1가',
    latitude: 37.266348,
    longitude: 126.99956,
    legalDongCode: '4111513400',
  },
  music: {
    musicTrackId: 122,
    title: 'REALLY REALLY',
    artistName: 'WINNER',
    albumImageUrl: 'https://image.test/really-really.jpg',
    externalUrl: 'https://open.spotify.test/really-really',
  },
  weatherCondition: 'CLEAR',
  temperature: 22.5,
  moodScore: 10,
  comment: '수원역에서 남긴 자물쇠',
  photoUrl: 'https://signed.example/photo.jpg',
  createdAt: '2026-09-26T18:30:00',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getRecordDetail.mockResolvedValue(detail);
  mocks.updateRecordComment.mockImplementation(
    async (_recordId: number, comment: string | null) => comment,
  );
  mocks.deleteRecord.mockResolvedValue(undefined);
});

describe('LockDetailPage', () => {
  it('loads the URL record ID and renders the detail response', async () => {
    renderPage('/records/585');

    expect(screen.getByRole('status')).toHaveTextContent('자물쇠를 불러오는 중이에요.');
    expect(await screen.findByText('📍 매산로1가')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '자물쇠 상세 내용' })).toContainElement(
      screen.getByRole('button', { name: '자물쇠 삭제' }),
    );
    expect(screen.getByText('2026.09.26 · 18:30')).toBeInTheDocument();
    expect(mocks.getRecordDetail).toHaveBeenCalledWith(
      585,
      mocks.fetchAuthenticatedJson,
      expect.any(AbortSignal),
    );
  });

  it('shows the not-found state for a RECORD_NOT_FOUND response', async () => {
    mocks.getRecordDetail.mockRejectedValueOnce(
      new ApiError(404, '자물쇠를 찾을 수 없습니다.', 'RECORD_NOT_FOUND'),
    );
    renderPage('/records/9999');

    expect(await screen.findByRole('alert')).toHaveTextContent('자물쇠를 찾을 수 없어요.');
  });

  it('hides edit and delete controls when the detail belongs to a friend', async () => {
    mocks.getRecordDetail.mockResolvedValueOnce({ ...detail, isOwner: false });
    renderPage('/records/585');

    await screen.findByText('📍 매산로1가');

    expect(screen.queryByRole('button', { name: '자물쇠 삭제' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '수정' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '코멘트 추가' })).not.toBeInTheDocument();
  });

  it('returns to the friend list when a friend-origin detail is no longer accessible', async () => {
    mocks.getRecordDetail.mockRejectedValueOnce(
      new ApiError(404, '자물쇠를 찾을 수 없습니다.', 'RECORD_NOT_FOUND'),
    );
    renderPage('/records/585?origin=friend');

    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/friends'));
  });

  it('updates the detail comment through the feature API callback', async () => {
    const user = userEvent.setup();
    renderPage('/records/585');
    await screen.findByText('📍 매산로1가');

    await user.click(screen.getByRole('button', { name: '수정' }));
    await user.clear(screen.getByRole('textbox', { name: '코멘트 입력' }));
    await user.type(screen.getByRole('textbox', { name: '코멘트 입력' }), '수정한 코멘트');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByText('“수정한 코멘트”')).toBeInTheDocument();
    expect(mocks.updateRecordComment).toHaveBeenCalledWith(
      585,
      '수정한 코멘트',
      mocks.fetchAuthenticatedJson,
    );
  });

  it('deletes the record then replaces the detail route with home', async () => {
    const user = userEvent.setup();
    renderPage('/records/585');
    await screen.findByText('📍 매산로1가');

    await user.click(screen.getByRole('button', { name: '자물쇠 삭제' }));
    await user.click(screen.getByRole('button', { name: '삭제' }));

    await waitFor(() => expect(screen.getByTestId('current-path')).toHaveTextContent('/'));
    expect(mocks.deleteRecord).toHaveBeenCalledWith(585, mocks.fetchAuthenticatedJson);
  });

  it('keeps the detail page after a delete API failure', async () => {
    const user = userEvent.setup();
    mocks.deleteRecord.mockRejectedValueOnce(new Error('failed'));
    renderPage('/records/585');
    await screen.findByText('📍 매산로1가');

    await user.click(screen.getByRole('button', { name: '자물쇠 삭제' }));
    await user.click(screen.getByRole('button', { name: '삭제' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '자물쇠를 삭제하지 못했어요. 다시 시도해주세요.',
    );
    expect(screen.getByTestId('current-path')).toHaveTextContent('/records/585');
  });

  it('aborts the detail request on unmount', async () => {
    mocks.getRecordDetail.mockReturnValueOnce(new Promise(() => undefined));
    const { unmount } = renderPage('/records/585');
    await waitFor(() => expect(mocks.getRecordDetail).toHaveBeenCalledOnce());
    const signal = mocks.getRecordDetail.mock.calls[0]?.[2] as AbortSignal;

    unmount();

    expect(signal.aborted).toBe(true);
  });
});

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/records/:recordId" element={<LockDetailPage />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="current-path">{location.pathname}</span>;
}
