import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.fn();
const mocks = vi.hoisted(() => ({
  fetchAuthenticatedJson: vi.fn(),
  getMyProfile: vi.fn(),
  updatePreferredGenres: vi.fn(),
  isAuthenticated: false,
  isSessionRestoring: false,
}));

vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}));
vi.mock('../../../features/home-map/ui/HomeMap', () => ({
  HomeMap: ({
    onCurrentLocationResolved,
    onInitialCenterResolved,
  }: {
    onCurrentLocationResolved?: (location: { latitude: number; longitude: number } | null) => void;
    onInitialCenterResolved?: (center: { latitude: number; longitude: number }) => void;
  }) => {
    useEffect(() => {
      onInitialCenterResolved?.({ latitude: 37.2002, longitude: 127.098 });
      onCurrentLocationResolved?.(null);
    }, [onCurrentLocationResolved, onInitialCenterResolved]);

    return null;
  },
}));
vi.mock('../../../features/home-playlist/ui/HomePlaylistSheet', () => ({
  HomePlaylistSheet: () => null,
}));
vi.mock('../../../features/main-navigation/ui/MainNavigation', () => ({
  MainNavigation: () => null,
}));
vi.mock('../../../entities/session/model/useSession', () => ({
  useSession: () => ({
    fetchAuthenticatedJson: mocks.fetchAuthenticatedJson,
    isAuthenticated: mocks.isAuthenticated,
    isSessionRestoring: mocks.isSessionRestoring,
  }),
}));
vi.mock('../../../features/user-profile/api/userProfileApi', () => ({
  getMyProfile: mocks.getMyProfile,
}));
vi.mock('../../../features/genre-onboarding/api/genreOnboardingApi', () => ({
  updatePreferredGenres: mocks.updatePreferredGenres,
}));

import { HomePage } from './HomePage';

describe('HomePage weather location handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAuthenticated = false;
    mocks.isSessionRestoring = false;
    vi.stubGlobal('fetch', vi.fn());
  });

  it('does not fetch a profile for anonymous home visitors', async () => {
    render(<HomePage />);

    await waitFor(() => expect(mocks.getMyProfile).not.toHaveBeenCalled());
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('waits for session restoration before requesting the profile', async () => {
    mocks.isAuthenticated = true;
    mocks.isSessionRestoring = true;
    mocks.getMyProfile.mockResolvedValue({
      userId: 1,
      nickname: '뮤로',
      email: 'mulo@example.com',
      preferredGenres: null,
      genreOnboardingDone: false,
    });

    const { rerender } = render(<HomePage />);
    expect(mocks.getMyProfile).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    mocks.isSessionRestoring = false;
    rerender(<HomePage />);

    await waitFor(() =>
      expect(mocks.getMyProfile).toHaveBeenCalledWith(mocks.fetchAuthenticatedJson),
    );
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it.each([
    {
      preferredGenres: null,
      genreOnboardingDone: true,
    },
    {
      preferredGenres: ['재즈'],
      genreOnboardingDone: true,
    },
    {
      preferredGenres: ['재즈'],
      genreOnboardingDone: false,
    },
  ])('does not show onboarding for a completed profile: $genreOnboardingDone', async (state) => {
    mocks.isAuthenticated = true;
    mocks.getMyProfile.mockResolvedValue({
      userId: 1,
      nickname: '뮤로',
      email: 'mulo@example.com',
      ...state,
    });

    render(<HomePage />);

    await waitFor(() => expect(mocks.getMyProfile).toHaveBeenCalledOnce());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('saves selected genres and closes onboarding without reopening', async () => {
    const user = userEvent.setup();
    mocks.isAuthenticated = true;
    mocks.getMyProfile.mockResolvedValue({
      userId: 1,
      nickname: '뮤로',
      email: 'mulo@example.com',
      preferredGenres: null,
      genreOnboardingDone: false,
    });
    mocks.updatePreferredGenres.mockResolvedValue(undefined);

    render(<HomePage />);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '인디음악' }));
    await user.click(screen.getByRole('button', { name: '재즈' }));
    await user.click(screen.getByRole('button', { name: '댄스' }));
    await user.click(screen.getByRole('button', { name: '완료' }));

    expect(mocks.updatePreferredGenres).toHaveBeenCalledWith(mocks.fetchAuthenticatedJson, [
      '인디음악',
      '재즈',
      '댄스',
    ]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('does not request weather when geolocation is unavailable', async () => {
    render(<HomePage />);

    await waitFor(() => expect(fetch).not.toHaveBeenCalled());
  });
});
