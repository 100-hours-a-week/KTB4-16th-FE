import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { MainNavigation } from './MainNavigation';

describe('MainNavigation', () => {
  it('shows only the four V1 destinations', () => {
    render(
      <MemoryRouter>
        <MainNavigation />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(screen.getByRole('link', { name: '홈' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '대시보드' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '리포트' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '마이페이지' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '그룹' })).not.toBeInTheDocument();
  });
});
