import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LockDetailData } from '../../../features/record-detail/model/lockDetail.types';
import { ApiError } from '../../../shared/api/apiError';
import { LockDetailPage } from './LockDetailPage';

const mocks = vi.hoisted(() => ({
  fetchAuthenticatedJson: vi.fn(),
  getRecordDetail: vi.fn(),
  updateRecordComment: vi.fn(),
}));

vi.mock('../../../entities/session/model/useSession', () => ({
  useSession: () => ({ fetchAuthenticatedJson: mocks.fetchAuthenticatedJson }),
}));
vi.mock('../../../features/record-detail/api/getRecordDetail', () => ({
  getRecordDetail: mocks.getRecordDetail,
}));
vi.mock('../../../features/record-detail/api/updateRecordComment', () => ({
  updateRecordComment: mocks.updateRecordComment,
}));

const detail: LockDetailData = {
  recordId: 585,
  userId: 108,
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
});

describe('LockDetailPage', () => {
  it('loads the URL record ID and renders the detail response', async () => {
    renderPage('/records/585');

    expect(screen.getByRole('status')).toHaveTextContent('자물쇠를 불러오는 중이에요.');
    expect(await screen.findByText('📍 매산로1가')).toBeInTheDocument();
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
    </MemoryRouter>,
  );
}
