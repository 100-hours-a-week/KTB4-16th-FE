import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getMyProfile: vi.fn(),
  updatePreferredGenres: vi.fn(),
  accessToken: 'access-token' as string | null,
  isAuthenticated: true,
  isSessionRestoring: false,
  fetchAuthenticatedJson: vi.fn(),
}));

vi.mock('../../../entities/session/model/useSession', () => ({
  useSession: () => ({
    accessToken: mocks.accessToken,
    isAuthenticated: mocks.isAuthenticated,
    isSessionRestoring: mocks.isSessionRestoring,
    fetchAuthenticatedJson: mocks.fetchAuthenticatedJson,
  }),
}));
vi.mock('../../../features/user-profile/api/userProfileApi', () => ({
  getMyProfile: mocks.getMyProfile,
}));
vi.mock('../../../features/genre-onboarding/api/genreOnboardingApi', () => ({
  updatePreferredGenres: mocks.updatePreferredGenres,
}));

import { GenreOnboardingGate } from './GenreOnboardingGate';

const profile = {
  userId: 9,
  nickname: '뮤로',
  email: 'mulo@example.com',
  preferredGenres: null,
  genreOnboardingDone: false,
  createdAt: '2024-01-01T00:00:00',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.accessToken = 'access-token';
  mocks.isAuthenticated = true;
  mocks.isSessionRestoring = false;
  mocks.getMyProfile.mockResolvedValue(profile);
  mocks.updatePreferredGenres.mockResolvedValue(undefined);
});

describe('GenreOnboardingGate', () => {
  it('does not render a requested service route while profile status is loading', async () => {
    let resolveProfile: ((value: typeof profile) => void) | undefined;
    mocks.getMyProfile.mockReturnValue(
      new Promise<typeof profile>((resolve) => {
        resolveProfile = resolve;
      }),
    );

    render(
      <GenreOnboardingGate>
        <h1>서비스 화면</h1>
      </GenreOnboardingGate>,
    );

    expect(await screen.findByRole('status', { name: '선호 장르 확인 중' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '서비스 화면' })).not.toBeInTheDocument();

    resolveProfile?.(profile);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it.each([
    { preferredGenres: null, genreOnboardingDone: true },
    { preferredGenres: [], genreOnboardingDone: true },
  ])(
    'requires selection even when legacy completion flag is true: $preferredGenres',
    async (state) => {
      mocks.getMyProfile.mockResolvedValue({ ...profile, ...state });

      render(
        <GenreOnboardingGate>
          <h1>서비스 화면</h1>
        </GenreOnboardingGate>,
      );

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: '서비스 화면' })).not.toBeInTheDocument();
    },
  );

  it('allows a previously saved valid preference without showing onboarding', async () => {
    mocks.getMyProfile.mockResolvedValue({ ...profile, preferredGenres: ['재즈'] });

    render(
      <GenreOnboardingGate>
        <h1>서비스 화면</h1>
      </GenreOnboardingGate>,
    );

    expect(await screen.findByRole('heading', { name: '서비스 화면' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('unblocks the current route only after a selected genre is saved', async () => {
    const user = userEvent.setup();
    render(
      <GenreOnboardingGate>
        <h1>서비스 화면</h1>
      </GenreOnboardingGate>,
    );

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '서비스 화면' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '인디음악' }));
    await user.click(screen.getByRole('button', { name: '완료' }));

    await waitFor(() => expect(mocks.updatePreferredGenres).toHaveBeenCalledOnce());
    expect(mocks.updatePreferredGenres).toHaveBeenCalledWith(mocks.fetchAuthenticatedJson, [
      '인디음악',
    ]);
    expect(await screen.findByRole('heading', { name: '서비스 화면' })).toBeInTheDocument();
  });

  it('fails closed and offers retry if the profile cannot be checked', async () => {
    const user = userEvent.setup();
    mocks.getMyProfile.mockRejectedValueOnce(new Error('network error'));

    render(
      <GenreOnboardingGate>
        <h1>서비스 화면</h1>
      </GenreOnboardingGate>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '선호 장르 정보를 확인하지 못했어요.',
    );
    expect(screen.queryByRole('heading', { name: '서비스 화면' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '서비스 화면' })).not.toBeInTheDocument();
  });

  it('holds protected content while session restoration is in progress', () => {
    mocks.isSessionRestoring = true;

    render(
      <GenreOnboardingGate>
        <h1>서비스 화면</h1>
      </GenreOnboardingGate>,
    );

    expect(screen.getByRole('status', { name: '세션 확인 중' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '서비스 화면' })).not.toBeInTheDocument();
    expect(mocks.getMyProfile).not.toHaveBeenCalled();
  });
});
