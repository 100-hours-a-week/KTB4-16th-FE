import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '../../../entities/session/model/SessionProvider';
import { getMonthlyReportDetail } from '../../../features/monthly-report/api/monthlyReportApi';
import { ApiError } from '../../../shared/api/apiError';
import { ReportDetailPage } from './ReportDetailPage';

vi.mock('../../../features/monthly-report/api/monthlyReportApi', () => ({
  getMonthlyReportDetail: vi.fn(),
}));

const report = {
  monthlyReportId: 50,
  year: 2026,
  month: 8,
  stats: {
    recordCount: 15,
    topPlace: { placeId: 10, legalDongName: '역삼동' },
    topArtistName: '아이유',
    averageMoodScore: 24.3,
  },
  photoScenes: [{ sceneTag: '야경', count: 3, ratio: 60 }],
  aiRecap: { status: 'COMPLETED', text: '이번 달의 기록입니다.' },
};

/** 실제 경로 파라미터·세션 안에서 상세 화면을 렌더링한다. */
function renderReportDetail(state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/report/2026/8', state }]}>
      <SessionProvider>
        <Routes>
          <Route path="/report/:year/:month" element={<ReportDetailPage />} />
        </Routes>
      </SessionProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('ReportDetailPage', () => {
  it('유효한 목록 state로 상세 통계와 완료된 AI 회고를 표시한다', async () => {
    vi.mocked(getMonthlyReportDetail).mockResolvedValue(report);

    renderReportDetail({ monthlyReportId: 50 });

    expect(await screen.findByText('2026년 8월 리포트')).toBeInTheDocument();
    expect(screen.getByText('15개')).toBeInTheDocument();
    expect(screen.getByText('역삼동')).toBeInTheDocument();
    expect(screen.getByText('아이유')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '평균 기분' })).toHaveTextContent('😊');
    expect(screen.queryByText('24.3점')).not.toBeInTheDocument();
    expect(screen.getByText('야경 3개 · 60%')).toBeInTheDocument();
    expect(screen.getByText('이번 달의 기록입니다.')).toBeInTheDocument();
  });

  it('선택 통계와 AI 회고가 아직 없으면 가짜 값을 표시하지 않는다', async () => {
    vi.mocked(getMonthlyReportDetail).mockResolvedValue({
      ...report,
      stats: { ...report.stats, topPlace: null, topArtistName: null, averageMoodScore: null },
      photoScenes: [],
      aiRecap: { status: 'PENDING', text: null },
    });

    renderReportDetail({ monthlyReportId: 50 });

    expect(await screen.findByText('AI 회고를 준비하고 있어요.')).toBeInTheDocument();
    expect(screen.getAllByText('기록 없음')).toHaveLength(3);
    expect(screen.getByText('사진 장면 분석 결과가 없어요.')).toBeInTheDocument();
  });

  it('상세 요청 실패 후 다시 시도한다', async () => {
    const user = userEvent.setup();
    vi.mocked(getMonthlyReportDetail)
      .mockRejectedValueOnce(new ApiError(0, 'network', 'NETWORK_ERROR'))
      .mockResolvedValueOnce(report);

    renderReportDetail({ monthlyReportId: 50 });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '월별 리포트를 불러오지 못했습니다.',
    );
    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByText('이번 달의 기록입니다.')).toBeInTheDocument();
    expect(getMonthlyReportDetail).toHaveBeenCalledTimes(2);
  });

  it('직접 접근에 리포트 ID가 없으면 요청 없이 목록 복귀 경로를 제공한다', () => {
    renderReportDetail();

    expect(screen.getByText('리포트 목록에서 보고 싶은 달을 선택해 주세요.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '리포트 목록으로' })).toHaveAttribute(
      'href',
      '/report',
    );
    expect(getMonthlyReportDetail).not.toHaveBeenCalled();
  });
});
