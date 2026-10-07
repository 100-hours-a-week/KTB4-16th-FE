import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FriendsPage } from './FriendsPage';

const mocks = vi.hoisted(() => ({
  fetchAuthenticatedJson: vi.fn(),
  acceptFriendRequest: vi.fn(),
  deleteFriendRequest: vi.fn(),
  deleteFriendship: vi.fn(),
  getFriends: vi.fn(),
  getReceivedFriendRequests: vi.fn(),
  getSentFriendRequests: vi.fn(),
  sendFriendRequest: vi.fn(),
}));

vi.mock('../../../entities/session/model/useSession', () => ({
  useSession: () => ({ fetchAuthenticatedJson: mocks.fetchAuthenticatedJson }),
}));
vi.mock('../../../features/friend/api/friendApi', () => ({
  acceptFriendRequest: mocks.acceptFriendRequest,
  deleteFriendRequest: mocks.deleteFriendRequest,
  deleteFriendship: mocks.deleteFriendship,
  getFriends: mocks.getFriends,
  getReceivedFriendRequests: mocks.getReceivedFriendRequests,
  getSentFriendRequests: mocks.getSentFriendRequests,
  sendFriendRequest: mocks.sendFriendRequest,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getFriends.mockResolvedValue({
    items: [{ friendshipId: 5, userId: 8, nickname: '지수' }],
    nextCursor: null,
  });
  mocks.getReceivedFriendRequests.mockResolvedValue({
    items: [{ friendRequestId: 11, userId: 9, nickname: '민준', createdAt: '2026-10-06T12:00:00' }],
    nextCursor: null,
  });
  mocks.getSentFriendRequests.mockResolvedValue({ items: [], nextCursor: null });
  mocks.acceptFriendRequest.mockResolvedValue(15);
  mocks.deleteFriendRequest.mockResolvedValue(undefined);
  mocks.deleteFriendship.mockResolvedValue(undefined);
  mocks.sendFriendRequest.mockResolvedValue({ kind: 'pending', friendRequestId: 20 });
});

describe('FriendsPage', () => {
  it('opens a friend dashboard and accepts a received request', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole('link', { name: /지수/ })).toHaveAttribute(
      'href',
      '/friends/8/dashboard',
    );
    await user.click(screen.getByRole('tab', { name: /받은 요청/ }));
    expect(await screen.findByText('민준')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '수락' }));

    expect(await screen.findByRole('status')).toHaveTextContent('민준님과 친구가 되었어요.');
    expect(mocks.acceptFriendRequest).toHaveBeenCalledWith(11, mocks.fetchAuthenticatedJson);
  });

  it('sends a nickname request and refreshes the request lists', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('link', { name: /지수/ });
    await user.type(screen.getByRole('textbox', { name: '닉네임으로 친구 요청' }), '새친구');
    await user.click(screen.getByRole('button', { name: '요청 보내기' }));

    expect(await screen.findByRole('status')).toHaveTextContent('친구 요청을 보냈어요.');
    expect(mocks.sendFriendRequest).toHaveBeenCalledWith('새친구', mocks.fetchAuthenticatedJson);
    await waitFor(() => expect(mocks.getFriends).toHaveBeenCalledTimes(2));
  });

  it('confirms before deleting an existing friendship', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('link', { name: /지수/ });

    await user.click(screen.getByRole('button', { name: '지수 친구 삭제' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('친구 관계가 종료됩니다.');
    await user.click(
      screen.getByRole('dialog').querySelector('button:last-child') as HTMLButtonElement,
    );

    expect(await screen.findByRole('status')).toHaveTextContent('친구 관계를 삭제했어요.');
    expect(mocks.deleteFriendship).toHaveBeenCalledWith(5, mocks.fetchAuthenticatedJson);
  });

  it('shows an empty state for an empty received request list', async () => {
    mocks.getReceivedFriendRequests.mockResolvedValue({ items: [], nextCursor: null });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('tab', { name: /받은 요청/ }));

    expect(await screen.findByText('받은 친구 요청이 없어요.')).toBeInTheDocument();
  });

  it('appends the next friend list page when the user selects more', async () => {
    const user = userEvent.setup();
    mocks.getFriends
      .mockResolvedValueOnce({
        items: [{ friendshipId: 5, userId: 8, nickname: '지수' }],
        nextCursor: 'friend-next',
      })
      .mockResolvedValueOnce({
        items: [{ friendshipId: 6, userId: 9, nickname: '민준' }],
        nextCursor: null,
      });
    renderPage();

    expect(await screen.findByRole('link', { name: /지수/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '더 보기' }));

    expect(await screen.findByRole('link', { name: /민준/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /지수/ })).toBeInTheDocument();
    expect(mocks.getFriends).toHaveBeenNthCalledWith(
      2,
      'friend-next',
      mocks.fetchAuthenticatedJson,
      expect.any(AbortSignal),
    );
  });

  it('discards an older cursor page after a friend request refreshes the lists', async () => {
    const user = userEvent.setup();
    let resolveOldPage:
      | ((page: {
          items: { friendshipId: number; userId: number; nickname: string }[];
          nextCursor: null;
        }) => void)
      | undefined;
    const oldPage = new Promise<{
      items: { friendshipId: number; userId: number; nickname: string }[];
      nextCursor: null;
    }>((resolve) => {
      resolveOldPage = resolve;
    });
    mocks.getFriends
      .mockResolvedValueOnce({
        items: [{ friendshipId: 5, userId: 8, nickname: '지수' }],
        nextCursor: 'old-cursor',
      })
      .mockImplementationOnce(() => oldPage)
      .mockResolvedValueOnce({
        items: [{ friendshipId: 7, userId: 10, nickname: '하나' }],
        nextCursor: null,
      });
    renderPage();

    await screen.findByRole('link', { name: /지수/ });
    await user.click(screen.getByRole('button', { name: '더 보기' }));
    await waitFor(() => expect(mocks.getFriends).toHaveBeenCalledTimes(2));
    await user.type(screen.getByRole('textbox', { name: '닉네임으로 친구 요청' }), '새친구');
    await user.click(screen.getByRole('button', { name: '요청 보내기' }));
    expect(await screen.findByRole('link', { name: /하나/ })).toBeInTheDocument();

    await act(async () => {
      resolveOldPage?.({
        items: [{ friendshipId: 6, userId: 9, nickname: '이전 친구' }],
        nextCursor: null,
      });
    });
    expect(screen.queryByRole('link', { name: /이전 친구/ })).not.toBeInTheDocument();
  });

  it('shows each friend once when a live cursor page overlaps an earlier page', async () => {
    const user = userEvent.setup();
    mocks.getFriends
      .mockResolvedValueOnce({
        items: [{ friendshipId: 5, userId: 8, nickname: '지수' }],
        nextCursor: 'friend-next',
      })
      .mockResolvedValueOnce({
        items: [
          { friendshipId: 5, userId: 8, nickname: '지수' },
          { friendshipId: 6, userId: 9, nickname: '민준' },
        ],
        nextCursor: null,
      });
    renderPage();

    await screen.findByRole('link', { name: /지수/ });
    await user.click(screen.getByRole('button', { name: '더 보기' }));
    expect(await screen.findByRole('link', { name: /민준/ })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /지수/ })).toHaveLength(1);
  });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <FriendsPage />
    </MemoryRouter>,
  );
}
