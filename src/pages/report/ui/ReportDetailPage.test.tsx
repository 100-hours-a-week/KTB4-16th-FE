import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { ReportDetailPage } from './ReportDetailPage';

describe('ReportDetailPage', () => {
  it('상세 주소에서도 목업 리캡 대신 구현 예정 안내를 표시한다', () => {
    render(
      <MemoryRouter initialEntries={['/report/2026/3']}>
        <ReportDetailPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('구현 예정 기능입니다.', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText(/이번 달 평균/)).not.toBeInTheDocument();
  });
});
