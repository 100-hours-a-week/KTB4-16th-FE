import { describe, expect, it, vi } from 'vitest';

import type { AuthenticatedRequest } from './chatRoomApi';
import {
  enterChatRoom,
  getChatRoomDetail,
  getChatRoomMessageHistory,
  leaveChatRoom,
} from './chatRoomApi';

function createRequest(response: unknown) {
  const calls = vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
  calls.mockResolvedValue(response);
  const request: AuthenticatedRequest = <T>(path: string, init?: RequestInit) =>
    calls(path, init).then((value) => value as T);
  return { calls, request };
}

describe('chatRoomApi', () => {
  it('enters a chat room with the idempotent members endpoint', async () => {
    const { calls, request } = createRequest({ message: '채팅방에 입장했습니다.' });

    await expect(enterChatRoom(request, '42')).resolves.toBeUndefined();
    expect(calls).toHaveBeenCalledWith('/chat-rooms/42/members', {
      method: 'POST',
      signal: undefined,
    });
  });

  it('parses the detail data envelope and both participants', async () => {
    const { request } = createRequest({
      message: '채팅방 정보 조회 성공',
      data: {
        chatRoomId: 42,
        participants: [
          { userId: 7, nickname: 'me' },
          { userId: 8, nickname: 'partner' },
        ],
      },
    });

    await expect(getChatRoomDetail(request, '42')).resolves.toEqual({
      chatRoomId: 42,
      participants: [
        { userId: 7, nickname: 'me' },
        { userId: 8, nickname: 'partner' },
      ],
    });
  });

  it('requests the first page without a cursor and later pages with encoded server cursor', async () => {
    const response = {
      message: '채팅 메시지 내역 조회 성공',
      data: {
        messages: [
          {
            chatMessageId: 9,
            clientMessageId: '550e8400-e29b-41d4-a716-446655440000',
            userId: 8,
            nickname: 'partner',
            content: '안녕하세요',
            createdAt: '2026-10-18T12:30:00+09:00',
          },
        ],
        nextCursor: 'cursor token',
        hasNext: true,
      },
    };
    const { calls, request } = createRequest(response);

    await expect(getChatRoomMessageHistory(request, '42')).resolves.toMatchObject({
      nextCursor: 'cursor token',
      hasNext: true,
      messages: [{ chatMessageId: 9, content: '안녕하세요' }],
    });
    await getChatRoomMessageHistory(request, '42', 'cursor token');

    expect(calls).toHaveBeenNthCalledWith(1, '/chat-rooms/42/messages', { signal: undefined });
    expect(calls).toHaveBeenNthCalledWith(2, '/chat-rooms/42/messages?cursor=cursor+token', {
      signal: undefined,
    });
  });

  it('rejects malformed server data rather than treating it as a valid empty history', async () => {
    const { request } = createRequest({ message: 'ok', data: { messages: [], hasNext: false } });

    await expect(getChatRoomMessageHistory(request, '42')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('leaves a chat room with the server POST endpoint', async () => {
    const { calls, request } = createRequest({ message: '채팅방에서 퇴장했습니다.' });

    await expect(leaveChatRoom(request, '42')).resolves.toBeUndefined();
    expect(calls).toHaveBeenCalledWith('/chat-rooms/42/leave', {
      method: 'POST',
      signal: undefined,
    });
  });
});
