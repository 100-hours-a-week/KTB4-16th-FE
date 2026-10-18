import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import {
  SessionContext,
  type SessionContextValue,
} from '../../../entities/session/model/sessionContext';
import { ApiError } from '../../../shared/api/apiError';
import { ChatRoomPage } from './ChatRoomPage';

const participant = (userId: number, nickname: string) => ({ userId, nickname });
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
        data: { chatRoomId: 42, participants: [participant(7, 'me'), participant(8, 'partner')] },
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
    if (path === '/chat-rooms/42/leave') return { message: '퇴장 완료' } as T;
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

describe('ChatRoomPage REST integration', () => {
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
    const user = userEvent.setup();
    const { session, requests } = createSession();
    renderPage(session);
    await screen.findByText('상대 메시지');

    await user.click(screen.getByRole('button', { name: '이전 메시지 불러오기' }));

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

  it('calls the leave endpoint and returns to matching only after success', async () => {
    const user = userEvent.setup();
    const { session, requests } = createSession();
    renderPage(session);
    await screen.findByText('상대 메시지');

    await user.click(screen.getByRole('button', { name: '채팅방 메뉴' }));
    await user.click(screen.getByRole('menuitem', { name: '채팅방 나가기' }));

    expect(await screen.findByRole('heading', { name: '취향 투표 화면' })).toBeInTheDocument();
    await waitFor(() => {
      expect(requests.at(-1)).toEqual({
        path: '/chat-rooms/42/leave',
        init: { method: 'POST', signal: undefined },
      });
    });
  });
});
