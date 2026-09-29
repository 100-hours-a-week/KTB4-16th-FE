import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MonthlyReportDetail } from './MonthlyReportDetail';

describe('MonthlyReportDetail', () => {
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
