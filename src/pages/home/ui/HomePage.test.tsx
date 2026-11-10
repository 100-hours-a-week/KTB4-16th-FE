import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.fn();
const mocks = vi.hoisted(() => ({
  fetchAuthenticatedJson: vi.fn(),
  isAuthenticated: false,
  isSessionRestoring: false,
  hasUnread: false,
  locationState: null as null | { recordCreated: boolean },
}));

vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
  useLocation: () => ({ pathname: '/', state: mocks.locationState }),
}));
vi.mock('../../../features/home-map/ui/HomeMap', () => ({
  HomeMap: ({
    onCurrentLocationResolved,
    onInitialCenterResolved,
    overview,
    primaryAction,
  }: {
    onCurrentLocationResolved?: (location: { latitude: number; longitude: number } | null) => void;
    onInitialCenterResolved?: (center: { latitude: number; longitude: number }) => void;
    overview?: ReactNode;
    primaryAction?: ReactNode;
  }) => {
    useEffect(() => {
      onInitialCenterResolved?.({ latitude: 37.2002, longitude: 127.098 });
      onCurrentLocationResolved?.(null);
    }, [onCurrentLocationResolved, onInitialCenterResolved]);

    return (
      <>
        {overview}
        {primaryAction}
      </>
    );
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
vi.mock('../../../features/notification/model/notificationSseContext', () => ({
  useNotificationSse: () => ({
    hasUnread: mocks.hasUnread,
    refreshUnreadStatus: vi.fn(),
    subscribeToNotificationUpdates: vi.fn(() => vi.fn()),
  }),
}));
import { HomePage } from './HomePage';

describe('HomePage weather location handling', () => {
  it('shows the saved memory confirmation and lets the user dismiss it', async () => {
    mocks.locationState = { recordCreated: true };
    render(<HomePage />);
    expect(screen.getByText('이곳에 추억의 자물쇠를 남겼어요')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '저장 완료 안내 닫기' }));
    expect(screen.queryByText('이곳에 추억의 자물쇠를 남겼어요')).not.toBeInTheDocument();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.locationState = null;
    mocks.isAuthenticated = false;
    mocks.isSessionRestoring = false;
    mocks.hasUnread = false;
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders the shared unread notification state without starting its own request', async () => {
    mocks.isAuthenticated = true;
    mocks.hasUnread = true;

    const home = render(<HomePage />);
    expect(screen.getByRole('status', { name: '새 알림' })).toBeInTheDocument();
    expect(mocks.fetchAuthenticatedJson).not.toHaveBeenCalled();

    home.unmount();
    mocks.hasUnread = false;
    render(<HomePage />);
    expect(screen.queryByRole('status', { name: '새 알림' })).not.toBeInTheDocument();
  });

  it('renders home without an onboarding dialog', async () => {
    render(<HomePage />);

    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the random chat card below the playlist card and navigates to matching', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    const playlistCard = screen.getByRole('button', { name: /지금 나를 위한 플레이리스트/ });
    const matchingCard = screen.getByRole('button', { name: /취향 투표로 랜덤 채팅/ });

    expect(
      playlistCard.compareDocumentPosition(matchingCard) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(matchingCard).toHaveTextContent('회원님이 좋아할 만한 취향 투표 질문을 준비했어요');

    await user.click(matchingCard);

    expect(navigate).toHaveBeenCalledWith('/matching');
  });

  it('opens the notification list from the header bell', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(screen.getByRole('button', { name: '알림 목록' }));

    expect(navigate).toHaveBeenCalledWith('/notifications');
  });

  it('does not request weather when geolocation is unavailable', async () => {
    render(<HomePage />);

    await waitFor(() => expect(fetch).not.toHaveBeenCalled());
  });
});
