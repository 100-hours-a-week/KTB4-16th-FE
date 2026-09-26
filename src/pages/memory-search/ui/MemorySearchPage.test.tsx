import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { MemorySearchPage } from './MemorySearchPage';

describe('MemorySearchPage', () => {
  it('가짜 기억 검색 답변 대신 미구현 안내만 표시한다', () => {
    render(
      <MemoryRouter>
        <MemorySearchPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('미구현 기능입니다.', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText(/홍대 근처에서/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '기억 검색' })).not.toBeInTheDocument();
  });
});
