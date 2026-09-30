import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MonthlyReportDetail } from './MonthlyReportDetail';

describe('MonthlyReportDetail', () => {
  it('평균 기분 점수를 공통 정책의 이모지로 표시하고 숫자는 노출하지 않는다', () => {
    render(
      <MonthlyReportDetail
        report={{
          monthlyReportId: 50,
          year: 2026,
          month: 8,
          stats: {
            recordCount: 15,
            topPlace: null,
            topArtistName: null,
            averageMoodScore: 0.3,
          },
          photoScenes: [],
          aiRecap: { status: 'FAILED', text: null },
        }}
      />,
    );

    expect(screen.getByRole('img', { name: '평균 기분' })).toHaveTextContent('😐');
    expect(screen.queryByText('0.3점')).not.toBeInTheDocument();
    expect(screen.getByText('평균 기분')).toBeInTheDocument();
  });

  it('평균 기분 점수가 없으면 기록 없음을 표시한다', () => {
    render(
      <MonthlyReportDetail
        report={{
          monthlyReportId: 50,
          year: 2026,
          month: 8,
          stats: {
            recordCount: 15,
            topPlace: null,
            topArtistName: null,
            averageMoodScore: null,
          },
          photoScenes: [],
          aiRecap: { status: 'FAILED', text: null },
        }}
      />,
    );

    expect(screen.getAllByText('기록 없음')).toHaveLength(3);
    expect(screen.queryByRole('img', { name: '평균 기분' })).not.toBeInTheDocument();
  });

  it('완료 상태가 아닌 AI 회고 텍스트는 표시하지 않는다', () => {
    render(
      <MonthlyReportDetail
        report={{
          monthlyReportId: 50,
          year: 2026,
          month: 8,
          stats: { recordCount: 15, topPlace: null, topArtistName: null, averageMoodScore: null },
          photoScenes: [],
          aiRecap: { status: 'FAILED', text: '표시하면 안 되는 텍스트' },
        }}
      />,
    );

    expect(screen.getByText('AI 회고를 준비하고 있어요.')).toBeInTheDocument();
    expect(screen.queryByText('표시하면 안 되는 텍스트')).not.toBeInTheDocument();
  });
});
