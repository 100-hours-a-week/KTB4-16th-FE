import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { MonthlyReportList } from './MonthlyReportList';

/** 링크 이동 뒤 전달된 리포트 ID를 검증할 수 있도록 현재 Router state를 표시한다. */
function CurrentRouteState() {
  return <output data-testid="route-state">{JSON.stringify(useLocation().state)}</output>;
}

/** 테스트 실행 환경의 시간대와 무관하게 한국의 현재 연도를 기대값으로 사용한다. */
function currentKoreanYear(): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'Asia/Seoul' }).format(
      new Date(),
    ),
  );
}

describe('MonthlyReportList', () => {
  it('현재 한국 연도를 기본으로 표시하며 그해 리포트가 없어도 12개월을 보여준다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-31T15:30:00Z'));
    try {
      render(
        <MemoryRouter>
          <MonthlyReportList
            reports={[
              {
                monthlyReportId: 50,
                year: 2026,
                month: 8,
                recordCount: 15,
                aiRecapStatus: 'COMPLETED',
              },
            ]}
          />
        </MemoryRouter>,
      );

      expect(screen.getByRole('region', { name: '2027년 리포트' })).toBeInTheDocument();
      expect(screen.getAllByText(/^\d{1,2}월$/)).toHaveLength(12);
      expect(screen.queryByRole('link', { name: /8월 리포트/ })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('이전·다음 버튼과 연도 입력으로 원하는 연도로 이동한다', async () => {
    const user = userEvent.setup();
    const currentYear = currentKoreanYear();
    render(
      <MemoryRouter>
        <MonthlyReportList reports={[]} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: '이전 연도' }));
    expect(screen.getByRole('region', { name: `${currentYear - 1}년 리포트` })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다음 연도' }));
    expect(screen.getByRole('region', { name: `${currentYear}년 리포트` })).toBeInTheDocument();
    await user.clear(screen.getByRole('spinbutton', { name: '연도 바로 이동' }));
    await user.type(screen.getByRole('spinbutton', { name: '연도 바로 이동' }), '2018');
    await user.click(screen.getByRole('button', { name: '이동' }));
    expect(screen.getByRole('region', { name: '2018년 리포트' })).toBeInTheDocument();
  });

  it('선택 연도의 12개월을 달력처럼 표시하고 리포트가 있는 달만 열 수 있다', () => {
    const currentYear = currentKoreanYear();
    render(
      <MemoryRouter>
        <MonthlyReportList
          reports={[
            {
              monthlyReportId: 50,
              year: currentYear,
              month: 8,
              recordCount: 15,
              aiRecapStatus: 'COMPLETED',
            },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByText(/^\d{1,2}월$/)).toHaveLength(12);
    expect(screen.getByRole('link', { name: /8월/ })).toHaveAttribute(
      'href',
      `/report/${currentYear}/8`,
    );
    expect(screen.queryByRole('link', { name: /7월/ })).not.toBeInTheDocument();
  });

  it('서버 리포트의 실제 ID를 상세 링크 state로 전달한다', async () => {
    const user = userEvent.setup();
    const currentYear = currentKoreanYear();

    render(
      <MemoryRouter>
        <MonthlyReportList
          reports={[
            {
              monthlyReportId: 50,
              year: currentYear,
              month: 8,
              recordCount: 15,
              aiRecapStatus: 'COMPLETED',
            },
          ]}
        />
        <CurrentRouteState />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('link', { name: /8월 리포트/ }));

    expect(screen.getByTestId('route-state')).toHaveTextContent('{"monthlyReportId":50}');
  });
});
