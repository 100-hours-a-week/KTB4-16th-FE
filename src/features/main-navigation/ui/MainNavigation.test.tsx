import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { MainNavigation } from './MainNavigation';

describe('MainNavigation', () => {
  it('shows only the V1 navigation entries without a group menu', () => {
    render(
      <MemoryRouter>
        <MainNavigation />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: '홈' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: '대시보드' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: '리포트' })).toHaveAttribute('href', '/report');
    expect(screen.getByRole('link', { name: '마이페이지' })).toHaveAttribute('href', '/mypage');
    expect(screen.queryByRole('link', { name: '그룹' })).not.toBeInTheDocument();
  });
});
