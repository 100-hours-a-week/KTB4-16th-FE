import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { MainNavigation } from './MainNavigation';

describe('MainNavigation', () => {
  it('announces the explicit dashboard destination while creating a lock', () => {
    render(
      <MemoryRouter initialEntries={['/locks/create']}>
        <MainNavigation activeItem="dashboard" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: '대시보드', current: 'page' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    expect(screen.getAllByRole('link', { current: 'page' })).toHaveLength(1);
  });

  it('announces the friends destination for a nested friends URL', () => {
    render(
      <MemoryRouter initialEntries={['/friends/42/dashboard']}>
        <MainNavigation />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: '친구', current: 'page' })).toHaveAttribute(
      'href',
      '/friends',
    );
    expect(screen.getAllByRole('link', { current: 'page' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: '홈' })).not.toHaveAttribute('aria-current');
  });

  it('uses the explicit destination instead of announcing two current pages', () => {
    render(
      <MemoryRouter initialEntries={['/friends/42/dashboard']}>
        <MainNavigation activeItem="dashboard" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: '대시보드', current: 'page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '친구' })).not.toHaveAttribute('aria-current');
    expect(screen.getAllByRole('link', { current: 'page' })).toHaveLength(1);
  });

  it('shows only the V1 navigation entries without a group menu', () => {
    render(
      <MemoryRouter>
        <MainNavigation />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: '홈' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: '대시보드' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: '친구' })).toHaveAttribute('href', '/friends');
    expect(screen.getByRole('link', { name: '리포트' })).toHaveAttribute('href', '/report');
    expect(screen.getByRole('link', { name: '마이페이지' })).toHaveAttribute('href', '/mypage');
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      '홈',
      '대시보드',
      '리포트',
      '친구',
      '마이페이지',
    ]);
    expect(screen.queryByRole('link', { name: '그룹' })).not.toBeInTheDocument();
  });
});
