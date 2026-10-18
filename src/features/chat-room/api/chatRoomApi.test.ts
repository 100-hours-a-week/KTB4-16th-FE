import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../../shared/api/apiError';
import {
  enterChatRoom,
  getChatRoomDetails,
  getChatRoomHistory,
  leaveChatRoom,
} from './chatRoomApi';

describe('chatRoomApi', () => {
  it('enters without a body and validates the message response', async () => {
    const request = vi.fn().mockResolvedValue({ message: '입장 완료' });

    await expect(enterChatRoom(request, '42')).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledWith('/chat-rooms/42/members', { method: 'POST' });
  });

  it('validates room details and participant nicknames', async () => {
    const request = vi.fn().mockResolvedValue({
      message: '조회 성공',
      data: {
        chatRoomId: 42,
        participants: [
          { userId: 17, nickname: '나' },
          { userId: 28, nickname: '상대' },
        ],
      },
    });

    await expect(getChatRoomDetails(request, '42')).resolves.toEqual({
      chatRoomId: 42,
      participants: [
        { userId: 17, nickname: '나' },
        { userId: 28, nickname: '상대' },
      ],
    });
    expect(request).toHaveBeenCalledWith('/chat-rooms/42');
  });

  it('requests the first page and forwards the opaque cursor unchanged after encoding', async () => {
    const firstRequest = vi.fn().mockResolvedValue({
      message: '조회 성공',
      data: { messages: [], nextCursor: 'opaque cursor+/', hasNext: true },
    });
    await expect(getChatRoomHistory(firstRequest, '42')).resolves.toMatchObject({ hasNext: true });
    expect(firstRequest).toHaveBeenCalledWith('/chat-rooms/42/messages');

    const nextRequest = vi.fn().mockResolvedValue({
      message: '조회 성공',
      data: { messages: [], nextCursor: null, hasNext: false },
    });
    await getChatRoomHistory(nextRequest, '42', 'opaque cursor+/');
    expect(nextRequest).toHaveBeenCalledWith(
      `/chat-rooms/42/messages?${new URLSearchParams({ cursor: 'opaque cursor+/' }).toString()}`,
    );
  });

  it('rejects unsafe Java Long values rather than accepting rounded identifiers', async () => {
    const request = vi.fn().mockResolvedValue({
      message: '조회 성공',
      data: {
        chatRoomId: Number.MAX_SAFE_INTEGER + 1,
        participants: [
          { userId: 17, nickname: '나' },
          { userId: 28, nickname: '상대' },
        ],
      },
    });

    await expect(getChatRoomDetails(request, '42')).rejects.toMatchObject({
      status: 502,
      code: 'INVALID_RESPONSE',
    } satisfies Partial<ApiError>);
  });

  it('rejects malformed message identifiers and dates', async () => {
    const request = vi.fn().mockResolvedValue({
      message: '조회 성공',
      data: {
        messages: [
          {
            chatMessageId: Number.MAX_SAFE_INTEGER + 1,
            clientMessageId: 'uuid',
            userId: 17,
            nickname: '나',
            content: '내용',
            createdAt: 'invalid',
          },
        ],
        nextCursor: null,
        hasNext: false,
      },
    });

    await expect(getChatRoomHistory(request, '42')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('leaves without a body and validates the message response', async () => {
    const request = vi.fn().mockResolvedValue({ message: '퇴장 완료' });

    await expect(leaveChatRoom(request, '42')).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledWith('/chat-rooms/42/leave', { method: 'POST' });
  });
});
