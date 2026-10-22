import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import {
  SessionContext,
  type SessionContextValue,
} from '../../../entities/session/model/sessionContext';
import { ApiError } from '../../../shared/api/apiError';
import { ChatRoomPage } from './ChatRoomPage';

const participant = (userId: number, nickname: string) => ({
  userId,
  nickname,
  voteChoice: null,
  hasLeft: false,
});
const message = (chatMessageId: number, userId: number, nickname: string, content: string) => ({
  chatMessageId,
  clientMessageId: `550e8400-e29b-41d4-a716-${String(chatMessageId).padStart(12, '0')}`,
  userId,
  nickname,
  content,
  createdAt: `2026-10-18T12:${String(chatMessageId).padStart(2, '0')}:00+09:00`,
});

function createSession(
  overrides: {
    failEntry?: ApiError;
    failLeave?: Error;
    leaveRequest?: Promise<unknown>;
  } = {},
) {
  const requests: Array<{ path: string; init?: RequestInit }> = [];
  const fetchAuthenticatedJson: SessionContextValue['fetchAuthenticatedJson'] = async <T,>(
    path: string,
    init?: RequestInit,
  ) => {
    requests.push({ path, init });
    if (path === '/chat-rooms/42/members' && overrides.failEntry) {
      throw overrides.failEntry;
    }
    if (path === '/chat-rooms/42/members') return { message: '입장 완료' } as T;
    if (path === '/users/me') {
      return {
        message: 'success',
        data: {
          userId: 7,
          nickname: 'me',
          email: 'me@example.com',
          preferredGenres: [],
          genreOnboardingDone: true,
          createdAt: '2026-10-18T00:00:00+09:00',
        },
      } as T;
    }
    if (path === '/chat-rooms/42') {
      return {
        message: 'detail',
        data: {
          chatRoomId: 42,
          roomType: 'DIRECT',
          groupDate: null,
          voteQuestionId: null,
          roomSequence: null,
          capacity: 2,
          admittedParticipantCount: 2,
          activeParticipantCount: 2,
          expiresAt: '2026-10-22T00:00:00+09:00',
          participants: [participant(7, 'me'), participant(8, 'partner')],
        },
      } as T;
    }
    if (path === '/chat-rooms/42/messages') {
      return {
        message: 'history',
        data: {
          messages: [message(10, 7, 'me', '내 메시지'), message(11, 8, 'partner', '상대 메시지')],
          nextCursor: 'older cursor',
          hasNext: true,
        },
      } as T;
    }
    if (path === '/chat-rooms/42/messages?cursor=older+cursor') {
      return {
        message: 'history',
        data: {
          messages: [message(9, 8, 'partner', '이전 메시지'), message(10, 7, 'me', '중복 메시지')],
          nextCursor: null,
          hasNext: false,
        },
      } as T;
    }
    if (path === '/chat-rooms/42/leave') {
      if (overrides.failLeave) throw overrides.failLeave;
      if (overrides.leaveRequest) return (await overrides.leaveRequest) as T;
      return { message: '퇴장 완료' } as T;
    }
    throw new Error(`Unexpected request: ${path}`);
  };

  return {
    requests,
    session: {
      accessToken: 'access-token',
      sessionVersion: 1,
      isAuthenticated: true,
      isSessionRestoring: false,
      getAccessToken: () => 'access-token',
      refreshAccessToken: vi.fn(),
      setAccessToken: vi.fn(),
      clearSession: vi.fn(),
      fetchAuthenticatedJson,
    } satisfies SessionContextValue,
  };
}

function renderPage(session: SessionContextValue) {
  return render(
    <SessionContext value={session}>
      <MemoryRouter initialEntries={['/chat/42']}>
        <Routes>
          <Route path="/chat/:chatRoomId" element={<ChatRoomPage connectionState="connected" />} />
          <Route path="/matching" element={<h1>취향 투표 화면</h1>} />
        </Routes>
      </MemoryRouter>
    </SessionContext>,
  );
}

function renderInlinePage(session: SessionContextValue, onLeaveSuccess = vi.fn()) {
  function InlineHarness() {
    const [expanded, setExpanded] = useState(false);
    return (
      <>
        <h1>취향 투표 화면</h1>
        <ChatRoomPage
          embeddedRoomId="42"
          inlineMode
          expanded={expanded}
          onToggleExpanded={setExpanded}
          onLeaveSuccess={onLeaveSuccess}
        />
      </>
    );
  }

  return {
    ...render(
      <SessionContext value={session}>
        <MemoryRouter initialEntries={['/matching']}>
          <InlineHarness />
        </MemoryRouter>
      </SessionContext>,
    ),
    onLeaveSuccess,
  };
}

describe('ChatRoomPage REST integration', () => {
  it('uses the embedded room ID and keeps loaded chat state through compact/expanded toggles', async () => {
    const user = userEvent.setup();
    const { session, requests } = createSession();
    renderInlinePage(session);
    await screen.findByText('상대 메시지');
    const initialRequestCount = requests.length;

    await user.click(screen.getByRole('button', { name: '채팅 전체보기' }));
    expect(screen.getByRole('button', { name: '채팅창 축소' })).toBeInTheDocument();
    expect(screen.getByText('상대 메시지')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '채팅창 축소' }));

    expect(screen.getByRole('button', { name: '채팅 전체보기' })).toBeInTheDocument();
    expect(screen.getByText('상대 메시지')).toBeInTheDocument();
    expect(requests).toHaveLength(initialRequestCount);
    expect(requests[0]?.path).toBe('/chat-rooms/42/members');
  });

  it('returns from an inline chat leave through its callback without navigating away', async () => {
    const user = userEvent.setup();
    const { session, requests } = createSession();
    const { onLeaveSuccess } = renderInlinePage(session);
    await screen.findByText('상대 메시지');

    await user.click(screen.getByRole('button', { name: '채팅방 메뉴' }));
    await user.click(screen.getByRole('menuitem', { name: '채팅방 나가기' }));
    await user.click(screen.getByRole('button', { name: '나가기' }));

    await waitFor(() => expect(onLeaveSuccess).toHaveBeenCalledOnce());
    expect(screen.getByRole('heading', { name: '취향 투표 화면' })).toBeInTheDocument();
    expect(requests.some(({ path }) => path === '/chat-rooms/42/leave')).toBe(true);
  });

  it('enters first, then loads the current profile, room detail, and first history page', async () => {
    const { session, requests } = createSession();
    renderPage(session);

    expect(await screen.findAllByText('partner')).toHaveLength(2);
    expect(await screen.findByText('내 메시지')).toBeInTheDocument();
    expect(screen.getByText('상대 메시지')).toBeInTheDocument();
    expect(screen.getByText(/참여자 2명/)).toBeInTheDocument();

    const requestedPaths = requests.map(({ path }) => path);
    expect(requestedPaths).toEqual([
      '/chat-rooms/42/members',
      '/users/me',
      '/chat-rooms/42',
      '/chat-rooms/42/messages',
    ]);
  });

  it('loads older messages with the returned cursor and suppresses duplicate IDs', async () => {
    const { session, requests } = createSession();
    renderPage(session);
    await screen.findByText('상대 메시지');

    const messageRegion = screen.getByRole('region', { name: /채팅 메시지/ });
    messageRegion.scrollTop = 0;
    fireEvent.scroll(messageRegion);

    expect(await screen.findByText('이전 메시지')).toBeInTheDocument();
    expect(screen.getAllByText('내 메시지')).toHaveLength(1);
    expect(screen.queryByText('중복 메시지')).not.toBeInTheDocument();
    expect(requests.at(-1)).toEqual({
      path: '/chat-rooms/42/messages?cursor=older+cursor',
      init: { signal: undefined },
    });
  });

  it('renders an expired state when the room-entry API rejects an expired room', async () => {
    renderPage(
      createSession({ failEntry: new ApiError(403, 'expired', 'CHAT_ROOM_EXPIRED') }).session,
    );

    expect(await screen.findByText('이 채팅방은 만료되었어요.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '메시지' })).toBeDisabled();
  });

  it('opens a confirmation dialog without calling the leave endpoint', async () => {
    const user = userEvent.setup();
    const { session, requests } = createSession();
    renderPage(session);
    await screen.findByText('상대 메시지');

    await user.click(screen.getByRole('button', { name: '채팅방 메뉴' }));
    await user.click(screen.getByRole('menuitem', { name: '채팅방 나가기' }));

    expect(screen.getByRole('dialog', { name: '채팅방을 나가시겠어요?' })).toBeInTheDocument();
    expect(screen.getByText(/다시 입장할 수 없으며/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '취소' })).toHaveFocus();
    expect(requests.some(({ path }) => path === '/chat-rooms/42/leave')).toBe(false);
  });

  it('closes on cancel, restores focus, and keeps the room without calling the leave API', async () => {
    const user = userEvent.setup();
    const { session, requests } = createSession();
    renderPage(session);
    await screen.findByText('상대 메시지');
    const menuButton = screen.getByRole('button', { name: '채팅방 메뉴' });

    await user.click(menuButton);
    await user.click(screen.getByRole('menuitem', { name: '채팅방 나가기' }));
    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '채팅방' })).toBeInTheDocument();
    expect(menuButton).toHaveFocus();
    expect(requests.some(({ path }) => path === '/chat-rooms/42/leave')).toBe(false);
  });

  it('closes with Escape and keeps focus inside the dialog while tabbing', async () => {
    const user = userEvent.setup();
    const { session } = createSession();
    renderPage(session);
    await screen.findByText('상대 메시지');

    await user.click(screen.getByRole('button', { name: '채팅방 메뉴' }));
    await user.click(screen.getByRole('menuitem', { name: '채팅방 나가기' }));
    const cancelButton = screen.getByRole('button', { name: '취소' });
    const confirmButton = screen.getByRole('button', { name: '나가기' });

    await user.tab();
    expect(confirmButton).toHaveFocus();
    await user.tab();
    expect(cancelButton).toHaveFocus();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '채팅방 메뉴' })).toHaveFocus();
  });

  it('calls the leave endpoint only after confirmation and returns to matching on success', async () => {
    const user = userEvent.setup();
    const { session, requests } = createSession();
    renderPage(session);
    await screen.findByText('상대 메시지');

    await user.click(screen.getByRole('button', { name: '채팅방 메뉴' }));
    await user.click(screen.getByRole('menuitem', { name: '채팅방 나가기' }));
    expect(requests.some(({ path }) => path === '/chat-rooms/42/leave')).toBe(false);
    await user.click(screen.getByRole('button', { name: '나가기' }));

    expect(await screen.findByRole('heading', { name: '취향 투표 화면' })).toBeInTheDocument();
    await waitFor(() => {
      expect(requests.at(-1)).toEqual({
        path: '/chat-rooms/42/leave',
        init: { method: 'POST', signal: undefined },
      });
    });
    expect(requests.filter(({ path }) => path === '/chat-rooms/42/leave')).toHaveLength(1);
  });

  it('prevents duplicate leave requests while confirmation is pending', async () => {
    let resolveLeave: ((value: unknown) => void) | undefined;
    const leaveRequest = new Promise<unknown>((resolve) => {
      resolveLeave = resolve;
    });
    const user = userEvent.setup();
    const { session, requests } = createSession({ leaveRequest });
    renderPage(session);
    await screen.findByText('상대 메시지');

    await user.click(screen.getByRole('button', { name: '채팅방 메뉴' }));
    await user.click(screen.getByRole('menuitem', { name: '채팅방 나가기' }));
    const confirmButton = screen.getByRole('button', { name: '나가기' });
    await user.dblClick(confirmButton);

    expect(confirmButton).toBeDisabled();
    expect(requests.filter(({ path }) => path === '/chat-rooms/42/leave')).toHaveLength(1);

    await act(async () => {
      resolveLeave?.({ message: '퇴장 완료' });
    });
    expect(await screen.findByRole('heading', { name: '취향 투표 화면' })).toBeInTheDocument();
  });

  it('keeps the room and shows an error when the confirmed leave request fails', async () => {
    const user = userEvent.setup();
    const { session, requests } = createSession({ failLeave: new Error('offline') });
    renderPage(session);
    await screen.findByText('상대 메시지');

    await user.click(screen.getByRole('button', { name: '채팅방 메뉴' }));
    await user.click(screen.getByRole('menuitem', { name: '채팅방 나가기' }));
    await user.click(screen.getByRole('button', { name: '나가기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '채팅방에서 나가지 못했어요. 잠시 후 다시 시도해 주세요.',
    );
    expect(requests.filter(({ path }) => path === '/chat-rooms/42/leave')).toHaveLength(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '채팅방' })).toBeInTheDocument();
    expect(screen.getByText('상대 메시지')).toBeInTheDocument();
  });
});
