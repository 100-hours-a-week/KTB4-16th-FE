import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SessionContext,
  type SessionContextValue,
} from '../../../entities/session/model/sessionContext';
import { ApiError } from '../../../shared/api/apiError';
import type { ChatRoomHistoryPage } from '../../../features/chat-room/api/chatRoomApi';
import { ChatRoomPage } from './ChatRoomPage';

const api = vi.hoisted(() => ({
  enterChatRoom: vi.fn(),
  getChatRoomDetails: vi.fn(),
  getChatRoomHistory: vi.fn(),
  leaveChatRoom: vi.fn(),
}));
vi.mock('../../../features/chat-room/api/chatRoomApi', () => api);

function renderPage(path: string) {
  const payload = btoa(JSON.stringify({ sub: '17' }));
  const session: SessionContextValue = {
    accessToken: `a.${payload}.c`,
    sessionVersion: 0,
    clearSession: vi.fn(),
    fetchAuthenticatedJson: vi.fn(),
    getAccessToken: () => `a.${payload}.c`,
    isAuthenticated: true,
    isSessionRestoring: false,
    refreshAccessToken: vi.fn(),
    setAccessToken: vi.fn(),
  };
  return render(
    <SessionContext value={session}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/chat/:chatRoomId" element={<ChatRoomPage />} />
          <Route path="/matching" element={<h1>취향 투표</h1>} />
        </Routes>
      </MemoryRouter>
    </SessionContext>,
  );
}
function ready(history: ChatRoomHistoryPage = { messages: [], nextCursor: null, hasNext: false }) {
  api.enterChatRoom.mockResolvedValue(undefined);
  api.getChatRoomDetails.mockResolvedValue({
    chatRoomId: 42,
    participants: [
      { userId: 17, nickname: '나' },
      { userId: 28, nickname: '상대방' },
    ],
  });
  api.getChatRoomHistory.mockResolvedValue(history);
}
describe('ChatRoomPage', () => {
  beforeEach(() => vi.clearAllMocks());
  it.each(['0', 'abc', '9223372036854775808'])('does not request invalid id %s', (id) => {
    renderPage(`/chat/${id}`);
    expect(screen.getByRole('alert')).toHaveTextContent('채팅방 주소를 확인');
    expect(api.enterChatRoom).not.toHaveBeenCalled();
  });
  it('enters, loads details/history, shows partner, and leaves sending disabled', async () => {
    ready({
      messages: [
        {
          chatMessageId: 11,
          clientMessageId: 'x',
          userId: 28,
          nickname: '상대방',
          content: '안녕',
          createdAt: '2026-10-13T15:30:00+09:00',
        },
      ],
      nextCursor: 'cursor',
      hasNext: true,
    });
    renderPage('/chat/42');
    expect((await screen.findAllByText('상대방')).length).toBeGreaterThan(0);
    expect(screen.getByText('안녕')).toBeInTheDocument();
    expect(api.enterChatRoom).toHaveBeenCalledOnce();
    expect(api.getChatRoomHistory).toHaveBeenCalledWith(expect.any(Function), '42');
    expect(screen.getByRole('textbox', { name: '메시지' })).toBeDisabled();
  });
  it('uses opaque cursor once and de-duplicates older messages', async () => {
    const user = userEvent.setup();
    ready({
      messages: [
        {
          chatMessageId: 20,
          clientMessageId: 'x',
          userId: 17,
          nickname: '나',
          content: '새',
          createdAt: '2026-10-13T15:31:00+09:00',
        },
      ],
      nextCursor: 'cursor',
      hasNext: true,
    });
    api.getChatRoomHistory
      .mockResolvedValueOnce({
        messages: [
          {
            chatMessageId: 20,
            clientMessageId: 'x',
            userId: 17,
            nickname: '나',
            content: '새',
            createdAt: '2026-10-13T15:31:00+09:00',
          },
        ],
        nextCursor: 'cursor',
        hasNext: true,
      })
      .mockResolvedValueOnce({
        messages: [
          {
            chatMessageId: 19,
            clientMessageId: 'y',
            userId: 28,
            nickname: '상대방',
            content: '과거',
            createdAt: '2026-10-13T15:30:00+09:00',
          },
        ],
        nextCursor: null,
        hasNext: false,
      });
    renderPage('/chat/42');
    await screen.findByText('새');
    await user.click(screen.getByRole('button', { name: '이전 메시지 불러오기' }));
    await waitFor(() =>
      expect(api.getChatRoomHistory).toHaveBeenCalledWith(expect.any(Function), '42', 'cursor'),
    );
    expect(screen.getAllByText('새')).toHaveLength(1);
    expect(await screen.findByText('과거')).toBeInTheDocument();
  });
  it('maps terminal entry errors and retries only network failures', async () => {
    const user = userEvent.setup();
    api.enterChatRoom
      .mockRejectedValueOnce(new ApiError(0, 'offline', 'NETWORK_ERROR'))
      .mockRejectedValueOnce(new ApiError(403, '퇴장', 'CHAT_REENTRY_FORBIDDEN'));
    renderPage('/chat/42');
    await user.click(await screen.findByRole('button', { name: '다시 불러오기' }));
    expect(await screen.findByText('이미 퇴장한 채팅방입니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 불러오기' })).not.toBeInTheDocument();
  });
  it('keeps the room on leave failure and moves only after success', async () => {
    const user = userEvent.setup();
    ready();
    api.leaveChatRoom
      .mockRejectedValueOnce(new ApiError(409, '실패', 'CHAT_ALREADY_LEFT'))
      .mockResolvedValueOnce(undefined);
    renderPage('/chat/42');
    await screen.findByText('상대방');
    await user.click(screen.getByRole('button', { name: '채팅방 메뉴' }));
    await user.click(screen.getByRole('menuitem', { name: '채팅방 나가기' }));
    expect(await screen.findByText('실패')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '채팅방' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: '채팅방 나가기' }));
    expect(await screen.findByRole('heading', { name: '취향 투표' })).toBeInTheDocument();
  });
});
