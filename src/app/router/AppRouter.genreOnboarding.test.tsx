import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getMyProfile: vi.fn(),
  updatePreferredGenres: vi.fn(),
  fetchAuthenticatedJson: vi.fn(),
}));

vi.mock('../../entities/session/model/useSession', () => ({
  useSession: () => ({
    accessToken: 'access-token',
    isAuthenticated: true,
    isSessionRestoring: false,
    fetchAuthenticatedJson: mocks.fetchAuthenticatedJson,
  }),
}));
vi.mock('../../features/user-profile/api/userProfileApi', () => ({
  getMyProfile: mocks.getMyProfile,
}));
vi.mock('../../features/genre-onboarding/api/genreOnboardingApi', () => ({
  updatePreferredGenres: mocks.updatePreferredGenres,
}));

import { AppRouter } from './AppRouter';

function NavigateBackControl() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>테스트 뒤로가기</button>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getMyProfile.mockResolvedValue({
    userId: 9,
    nickname: '뮤로',
    email: 'mulo@example.com',
    preferredGenres: null,
    genreOnboardingDone: false,
    createdAt: '2024-01-01T00:00:00',
  });
  mocks.updatePreferredGenres.mockResolvedValue(undefined);
});

describe('AppRouter required genre onboarding', () => {
  it('blocks a direct protected URL until the user saves a genre', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/matching']}>
        <AppRouter />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '취향 투표' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'POP' }));
    await user.click(screen.getByRole('button', { name: '완료' }));

    expect(await screen.findByRole('heading', { name: '취향 투표' })).toBeInTheDocument();
  });

  it('keeps the required sheet open when browser history returns to another route', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/', '/matching']} initialIndex={1}>
        <NavigateBackControl />
        <AppRouter />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '테스트 뒤로가기' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'MULO' })).not.toBeInTheDocument();
  });
});
