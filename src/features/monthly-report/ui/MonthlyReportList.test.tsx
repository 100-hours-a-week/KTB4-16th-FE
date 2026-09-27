import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { MonthlyReportList } from './MonthlyReportList';

/** 링크 이동 뒤 전달된 리포트 ID를 검증할 수 있도록 현재 Router state를 표시한다. */
function CurrentRouteState() {
  return <output data-testid="route-state">{JSON.stringify(useLocation().state)}</output>;
}

describe('MonthlyReportList', () => {
  it('서버 리포트의 실제 ID를 상세 링크 state로 전달한다', async () => {
    const user = userEvent.setup();

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
        <CurrentRouteState />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('link', { name: /8월 리포트/ }));

    expect(screen.getByTestId('route-state')).toHaveTextContent('{"monthlyReportId":50}');
  });
});
