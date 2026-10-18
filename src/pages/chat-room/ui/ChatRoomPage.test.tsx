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

const accessToken = `header.${btoa(JSON.stringify({ sub: '17' }))}.signature`;

function renderPage(path: string) {
  const session: SessionContextValue = {
    accessToken,
    sessionVersion: 0,
    clearSession: vi.fn(),
    fetchAuthenticatedJson: vi.fn(),
    getAccessToken: () => accessToken,
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

function arrangeSuccessfulLoad(
  history: ChatRoomHistoryPage = { messages: [], nextCursor: null, hasNext: false },
) {
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

  it.each(['0', '-3', '12.5', 'abc', '9223372036854775808'])(
    'rejects invalid chat room ID %s without entering',
    (id) => {
      renderPage(`/chat/${id}`);
      expect(screen.getByRole('alert')).toHaveTextContent('채팅방 주소를 확인');
      expect(api.enterChatRoom).not.toHaveBeenCalled();
    },
  );

  it.each(['1', '9223372036854775807'])('accepts valid Long path ID %s', (id) => {
    arrangeSuccessfulLoad();
    renderPage(`/chat/${id}`);
    expect(screen.getByRole('heading', { name: '채팅방' })).toBeInTheDocument();
  });

  it('enters first, then loads details and first history page for a reloadable room', async () => {
    arrangeSuccessfulLoad({
      messages: [
        {
          chatMessageId: 11,
          clientMessageId: 'one',
          userId: 28,
          nickname: '상대방',
          content: '안녕하세요',
          createdAt: '2026-10-13T15:30:00+09:00',
        },
      ],
      nextCursor: null,
      hasNext: false,
    });
    renderPage('/chat/42');
    expect(await screen.findByText('안녕하세요')).toBeInTheDocument();
    expect(screen.getByText(/참여자 2명/)).toBeInTheDocument();
    expect(screen.getByText(/종료 시간 대기 중/)).toBeInTheDocument();
    expect(api.enterChatRoom).toHaveBeenCalledWith(expect.any(Function), '42');
    expect(api.getChatRoomDetails).toHaveBeenCalledOnce();
    expect(api.getChatRoomHistory).toHaveBeenCalledWith(expect.any(Function), '42');
    expect(screen.getByRole('textbox', { name: '메시지' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '전송' })).toBeDisabled();
  });

  it('uses the opaque cursor, removes duplicates, and stops when hasNext is false', async () => {
    const user = userEvent.setup();
    const newest = {
      chatMessageId: 20,
      clientMessageId: 'twenty',
      userId: 17,
      nickname: '나',
      content: '새 메시지',
      createdAt: '2026-10-13T15:31:00+09:00',
    };
    arrangeSuccessfulLoad({ messages: [newest], nextCursor: 'cursor-20', hasNext: true });
    api.getChatRoomHistory
      .mockResolvedValueOnce({ messages: [newest], nextCursor: 'cursor-20', hasNext: true })
      .mockResolvedValueOnce({
        messages: [
          {
            chatMessageId: 19,
            clientMessageId: 'nineteen',
            userId: 28,
            nickname: '상대방',
            content: '과거 메시지',
            createdAt: '2026-10-13T15:30:00+09:00',
          },
        ],
        nextCursor: null,
        hasNext: false,
      });
    renderPage('/chat/42');
    await screen.findByText('새 메시지');
    await user.click(screen.getByRole('button', { name: '이전 메시지 불러오기' }));
    expect(await screen.findByText('과거 메시지')).toBeInTheDocument();
    expect(api.getChatRoomHistory).toHaveBeenLastCalledWith(
      expect.any(Function),
      '42',
      'cursor-20',
    );
    expect(screen.getAllByText('새 메시지')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: '이전 메시지 불러오기' })).not.toBeInTheDocument();
  });

  it('prevents duplicate concurrent history requests', async () => {
    const user = userEvent.setup();
    let resolvePage: ((page: ChatRoomHistoryPage) => void) | undefined;
    arrangeSuccessfulLoad({
      messages: [
        {
          chatMessageId: 20,
          clientMessageId: 'x',
          userId: 17,
          nickname: '나',
          content: '최근',
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
            content: '최근',
            createdAt: '2026-10-13T15:31:00+09:00',
          },
        ],
        nextCursor: 'cursor',
        hasNext: true,
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePage = resolve;
          }),
      );
    renderPage('/chat/42');
    await screen.findByText('최근');
    const button = screen.getByRole('button', { name: '이전 메시지 불러오기' });
    await user.click(button);
    await user.click(button);
    expect(api.getChatRoomHistory).toHaveBeenCalledTimes(2);
    resolvePage?.({ messages: [], nextCursor: null, hasNext: false });
  });

  it('retries a network failure and blocks retry after a reentry denial', async () => {
    const user = userEvent.setup();
    api.enterChatRoom
      .mockRejectedValueOnce(new ApiError(0, 'offline', 'NETWORK_ERROR'))
      .mockRejectedValueOnce(
        new ApiError(403, '퇴장한 채팅방에는 다시 입장할 수 없습니다.', 'CHAT_REENTRY_FORBIDDEN'),
      );
    renderPage('/chat/42');
    await user.click(await screen.findByRole('button', { name: '다시 불러오기' }));
    expect(await screen.findByText('이미 퇴장한 채팅방입니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 불러오기' })).not.toBeInTheDocument();
  });

  it.each([
    [new ApiError(403, '만료된 채팅방입니다.', 'CHAT_ROOM_EXPIRED'), '이 채팅방은 만료되었어요.'],
    [
      new ApiError(403, '재입장할 수 없습니다.', 'CHAT_REENTRY_FORBIDDEN'),
      '이미 퇴장한 채팅방입니다.',
    ],
    [
      new ApiError(404, '채팅방을 찾을 수 없습니다.', 'CHAT_ROOM_NOT_FOUND'),
      '채팅방을 찾을 수 없습니다.',
    ],
    [new ApiError(401, '인증이 필요합니다.', 'UNAUTHORIZED'), '인증이 필요합니다.'],
  ])('maps terminal REST entry errors without loading room data', async (error, notice) => {
    api.enterChatRoom.mockRejectedValue(error);
    renderPage('/chat/42');
    expect(await screen.findByText(notice)).toBeInTheDocument();
    expect(api.getChatRoomDetails).not.toHaveBeenCalled();
    expect(api.getChatRoomHistory).not.toHaveBeenCalled();
  });

  it('keeps the room after leave failure and navigates only after leave succeeds', async () => {
    const user = userEvent.setup();
    arrangeSuccessfulLoad();
    api.leaveChatRoom
      .mockRejectedValueOnce(new ApiError(409, '이미 퇴장한 채팅방입니다.', 'CHAT_ALREADY_LEFT'))
      .mockResolvedValueOnce(undefined);
    renderPage('/chat/42');
    await screen.findByText(/참여자 2명/);
    await user.click(screen.getByRole('button', { name: '채팅방 메뉴' }));
    await user.click(screen.getByRole('menuitem', { name: '채팅방 나가기' }));
    expect(await screen.findByText('이미 퇴장한 채팅방입니다.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '채팅방' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: '채팅방 나가기' }));
    expect(await screen.findByRole('heading', { name: '취향 투표' })).toBeInTheDocument();
  });

  it('keeps the room mounted while a leave request is pending and prevents a duplicate leave', async () => {
    const user = userEvent.setup();
    let resolveLeave: (() => void) | undefined;
    arrangeSuccessfulLoad();
    api.leaveChatRoom.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLeave = () => resolve(undefined);
        }),
    );
    renderPage('/chat/42');
    await screen.findByText(/참여자 2명/);
    await user.click(screen.getByRole('button', { name: '채팅방 메뉴' }));
    await user.click(screen.getByRole('menuitem', { name: '채팅방 나가기' }));
    expect(screen.getByRole('menuitem', { name: '채팅방 나가는 중…' })).toBeDisabled();
    expect(api.leaveChatRoom).toHaveBeenCalledOnce();
    resolveLeave?.();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: '취향 투표' })).toBeInTheDocument(),
    );
  });
});
