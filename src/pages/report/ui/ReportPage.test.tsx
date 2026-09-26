import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { ReportPage } from './ReportPage';

describe('ReportPage', () => {
  it('월별 목업 집계 대신 미구현 안내만 표시한다', () => {
    render(
      <MemoryRouter>
        <ReportPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('미구현 기능입니다.', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText('14개')).not.toBeInTheDocument();
  });
});
