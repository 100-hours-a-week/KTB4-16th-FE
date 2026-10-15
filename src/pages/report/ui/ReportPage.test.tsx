import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '../../../entities/session/model/SessionProvider';
import { getMonthlyReports } from '../../../features/monthly-report/api/monthlyReportApi';
import { ApiError } from '../../../shared/api/apiError';
import { ReportPage } from './ReportPage';

vi.mock('../../../features/monthly-report/api/monthlyReportApi', () => ({
  getMonthlyReports: vi.fn(),
}));

/** 실제 세션과 라우터 안에서 리포트 목록의 비동기 상태를 렌더링한다. */
function renderReportPage() {
  return render(
    <MemoryRouter>
      <SessionProvider>
        <ReportPage />
      </SessionProvider>
    </MemoryRouter>,
  );
}

/** 리포트 기본 연도 테스트를 한국 시간 기준으로 계산한다. */
function currentKoreanYear(): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'Asia/Seoul' }).format(
      new Date(),
    ),
  );
}

beforeEach(() => vi.clearAllMocks());

describe('ReportPage', () => {
  it('리포트를 불러오는 동안 로딩 상태를 표시한다', () => {
    vi.mocked(getMonthlyReports).mockImplementation(() => new Promise(() => undefined));

    renderReportPage();

    expect(screen.getByRole('status')).toHaveTextContent('월별 리포트를 불러오는 중');
  });

  it('서버의 빈 목록에서도 현재 연도 달력을 빈 상태로 표시한다', async () => {
    vi.mocked(getMonthlyReports).mockResolvedValue([]);

    renderReportPage();

    expect(await screen.findByText('아직 생성된 월별 리포트가 없어요.')).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: `${currentKoreanYear()}년 리포트` }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^\d{1,2}월$/)).toHaveLength(12);
    expect(screen.queryByText('14개')).not.toBeInTheDocument();
  });

  it('하단 리포트를 다시 누르면 현재 연도로 돌아온다', async () => {
    const user = userEvent.setup();
    const currentYear = currentKoreanYear();
    vi.mocked(getMonthlyReports).mockResolvedValue([]);
    renderReportPage();

    await screen.findByRole('region', { name: `${currentYear}년 리포트` });
    await user.click(screen.getByRole('button', { name: '이전 연도' }));
    expect(screen.getByRole('region', { name: `${currentYear - 1}년 리포트` })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: '리포트' }));
    expect(screen.getByRole('region', { name: `${currentYear}년 리포트` })).toBeInTheDocument();
  });

  it('요청 실패 후 다시 시도해 서버 리포트를 표시한다', async () => {
    const user = userEvent.setup();
    const currentYear = currentKoreanYear();
    vi.mocked(getMonthlyReports)
      .mockRejectedValueOnce(new ApiError(0, 'network', 'NETWORK_ERROR'))
      .mockResolvedValueOnce([
        {
          monthlyReportId: 50,
          year: currentYear,
          month: 8,
          recordCount: 15,
          aiRecapStatus: 'COMPLETED',
        },
      ]);

    renderReportPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '월별 리포트를 불러오지 못했습니다.',
    );
    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByRole('link', { name: /8월 리포트/ })).toBeInTheDocument();
    expect(getMonthlyReports).toHaveBeenCalledTimes(2);
  });
});
