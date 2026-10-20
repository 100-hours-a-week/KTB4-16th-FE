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
  it('성공 안내의 닫기를 누르면 4초를 기다리지 않고 바로 숨긴다', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('link', { name: /지수/ });
    await user.click(screen.getByRole('button', { name: '친구 추가' }));
    await user.type(screen.getByRole('textbox', { name: '닉네임으로 친구 요청' }), '새친구');
    await user.click(screen.getByRole('button', { name: '요청 보내기' }));
    await user.click(await screen.findByRole('button', { name: '완료 안내 닫기' }));
    expect(screen.queryByText('친구 요청을 보냈어요.')).not.toBeInTheDocument();
  });

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

  it('opens the received request tab from a friend request notification', async () => {
    renderPage('/friends?tab=received');
    expect(await screen.findByText('민준')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /받은 요청/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('sends a nickname request and refreshes only the sent list', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('link', { name: /지수/ });
    await user.click(screen.getByRole('button', { name: '친구 추가' }));
    await user.type(screen.getByRole('textbox', { name: '닉네임으로 친구 요청' }), '새친구');
    await user.click(screen.getByRole('button', { name: '요청 보내기' }));

    expect(await screen.findByRole('status')).toHaveTextContent('친구 요청을 보냈어요.');
    expect(mocks.sendFriendRequest).toHaveBeenCalledWith('새친구', mocks.fetchAuthenticatedJson);
    await waitFor(() => expect(mocks.getSentFriendRequests).toHaveBeenCalledTimes(2));
    expect(mocks.getFriends).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('tab', { name: /^친구$/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: '보낸 요청 보기' })).not.toBeInTheDocument();
  });

  it('confirms before deleting an existing friendship', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('link', { name: /지수/ });

    await user.click(screen.getByRole('button', { name: '지수 친구 관리' }));
    await user.click(screen.getByRole('button', { name: '친구 삭제' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('친구 관계가 종료됩니다.');
    await user.click(screen.getByRole('button', { name: '삭제' }));

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

  it('삭제 중에도 목록을 유지하고 삭제 전 시작한 페이지가 뒤늦게 도착해도 무시한다', async () => {
    const user = userEvent.setup();
    let resolvePage!: (page: {
      items: { friendshipId: number; userId: number; nickname: string }[];
      nextCursor: null;
    }) => void;
    let resolveDelete!: () => void;
    mocks.getFriends
      .mockResolvedValueOnce({
        items: [{ friendshipId: 5, userId: 8, nickname: '지수' }],
        nextCursor: 'next',
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePage = resolve;
          }),
      );
    mocks.deleteFriendship.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );
    renderPage();
    await screen.findByRole('link', { name: /지수/ });
    await user.click(screen.getByRole('button', { name: '더 보기' }));
    await user.click(screen.getByRole('button', { name: '지수 친구 관리' }));
    await user.click(screen.getByRole('button', { name: '친구 삭제' }));
    await user.click(screen.getByRole('button', { name: '삭제' }));
    expect(screen.getByRole('link', { name: /지수/ })).toBeInTheDocument();
    await act(async () => resolveDelete());
    expect(screen.queryByRole('link', { name: /지수/ })).not.toBeInTheDocument();
    await act(async () =>
      resolvePage({ items: [{ friendshipId: 5, userId: 8, nickname: '지수' }], nextCursor: null }),
    );
    expect(screen.queryByRole('link', { name: /지수/ })).not.toBeInTheDocument();
  });

  it('받은 요청 조회가 느려도 친구 목록은 먼저 보여준다', async () => {
    mocks.getReceivedFriendRequests.mockReturnValueOnce(new Promise(() => {}));
    renderPage();
    expect(await screen.findByRole('link', { name: /지수/ })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /받은 요청/ }));
    expect(screen.getByRole('status')).toHaveTextContent('목록을 불러오는 중이에요.');
  });

  it('받은 요청 조회가 실패해도 친구 목록을 이용하고 해당 탭에서만 재시도한다', async () => {
    mocks.getReceivedFriendRequests.mockRejectedValueOnce(new Error('network'));
    renderPage();
    expect(await screen.findByRole('link', { name: /지수/ })).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /받은 요청/ }));
    await user.click(screen.getByRole('button', { name: '다시 불러오기' }));
    expect(await screen.findByText('민준')).toBeInTheDocument();
    expect(mocks.getFriends).toHaveBeenCalledTimes(1);
  });

  it('실패한 목록 재시도 중에도 로딩 상태를 안내한다', async () => {
    mocks.getReceivedFriendRequests.mockRejectedValueOnce(new Error('network'));
    mocks.getReceivedFriendRequests.mockImplementationOnce(() => new Promise(() => {}));
    renderPage('/friends?tab=received');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '다시 불러오기' }));
    expect(screen.getByRole('status')).toHaveTextContent('목록을 불러오는 중이에요.');
  });

  it('요청 처리 중 다른 탭으로 이동해도 실패는 해당 요청에서만 표시한다', async () => {
    let rejectAccept!: (error: Error) => void;
    mocks.acceptFriendRequest.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectAccept = reject;
        }),
    );
    renderPage('/friends?tab=received');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '수락' }));
    await user.click(screen.getByRole('tab', { name: /보낸 요청/ }));
    await act(async () => rejectAccept(new Error('network')));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /받은 요청/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('친구 정보를 불러오지 못했어요.');
  });

  it('관리 창에서 삭제 확인으로 이동한 후 취소하면 원래 관리 버튼으로 복귀한다', async () => {
    renderPage();
    const user = userEvent.setup();
    const opener = await screen.findByRole('button', { name: '지수 친구 관리' });
    await user.click(opener);
    await user.click(screen.getByRole('button', { name: '친구 삭제' }));
    expect(screen.getByRole('button', { name: '취소' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(opener).toHaveFocus();
  });

  it('친구 추가 모달의 Escape 닫기는 열었던 버튼에 포커스를 돌려준다', async () => {
    const user = userEvent.setup();
    renderPage();
    const opener = screen.getByRole('button', { name: '친구 추가' });
    await user.click(opener);
    expect(screen.getByRole('textbox', { name: '닉네임으로 친구 요청' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
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

/** 실제 라우터로 알림의 받은 요청 탭 링크를 확인한다. */
function renderPage(initialEntry = '/friends') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <FriendsPage />
    </MemoryRouter>,
  );
}
