import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    localStorage.clear();
    mocks.isAuthenticated = false;
    mocks.isSessionRestoring = false;
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
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
      createdAt: '2026-10-16T00:00:00',
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
      createdAt: '2026-10-15T12:00:00',
    },
    {
      preferredGenres: ['재즈'],
      genreOnboardingDone: true,
      createdAt: '2026-10-15T12:00:00',
    },
    {
      preferredGenres: ['재즈'],
      genreOnboardingDone: false,
      createdAt: '2026-10-15T12:00:00',
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
      createdAt: '2026-10-16T00:00:00',
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

  it('기존 사용자는 KST 10월 25일 23:59까지 노출되고 하루 숨김 액션이 있다', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-25T14:59:00.000Z'));
    mocks.isAuthenticated = true;
    mocks.getMyProfile.mockResolvedValue({
      userId: 41,
      nickname: '기존 사용자',
      email: 'legacy@mulo.com',
      preferredGenres: null,
      genreOnboardingDone: false,
      createdAt: '2026-10-15T12:00:00',
    });

    render(<HomePage />);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '오늘 하루 보지 않기' })).toBeInTheDocument();
  });

  it('기존 사용자는 KST 10월 26일 00:00부터 자동 노출되지 않는다', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-25T15:00:00.000Z'));
    mocks.isAuthenticated = true;
    mocks.getMyProfile.mockResolvedValue({
      userId: 42,
      nickname: '기존 사용자',
      email: 'legacy@mulo.com',
      preferredGenres: null,
      genreOnboardingDone: false,
      createdAt: '2026-10-15T12:00:00',
    });

    render(<HomePage />);

    await waitFor(() => expect(mocks.getMyProfile).toHaveBeenCalledOnce());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('신규 사용자는 KST 10월 26일 이후에도 노출되며 하루 숨김 액션은 없다', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-25T15:00:00.000Z'));
    mocks.isAuthenticated = true;
    mocks.getMyProfile.mockResolvedValue({
      userId: 43,
      nickname: '신규 사용자',
      email: 'new@mulo.com',
      preferredGenres: null,
      genreOnboardingDone: false,
      createdAt: '2026-10-16T00:00:00',
    });

    render(<HomePage />);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '오늘 하루 보지 않기' })).not.toBeInTheDocument();
  });

  it('기존 사용자가 오늘 하루 보지 않기를 선택하면 서버 저장 없이 닫고 KST 날짜 동안 숨긴다', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-23T15:30:00.000Z'));
    const user = userEvent.setup();
    mocks.isAuthenticated = true;
    mocks.getMyProfile.mockResolvedValue({
      userId: 44,
      nickname: '기존 사용자',
      email: 'legacy@mulo.com',
      preferredGenres: null,
      genreOnboardingDone: false,
      createdAt: '2026-10-15T12:00:00',
    });
    const firstRender = render(<HomePage />);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '오늘 하루 보지 않기' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mocks.updatePreferredGenres).not.toHaveBeenCalled();
    expect(localStorage.getItem('mulo:genre-onboarding-hidden-date:44')).toBe('2026-10-24');

    firstRender.unmount();
    mocks.getMyProfile.mockClear();
    render(<HomePage />);
    await waitFor(() => expect(mocks.getMyProfile).toHaveBeenCalledOnce());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    vi.setSystemTime(new Date('2026-10-24T15:00:00.000Z'));
    cleanup();
    mocks.getMyProfile.mockClear();
    render(<HomePage />);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('does not request weather when geolocation is unavailable', async () => {
    render(<HomePage />);

    await waitFor(() => expect(fetch).not.toHaveBeenCalled());
  });
});
