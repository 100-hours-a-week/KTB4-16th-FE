import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { getGroupChatAvailability, joinGroupChat } from './groupChatApi';

vi.mock('../../../shared/api/csrf', () => ({
  getCsrfToken: vi.fn().mockResolvedValue('test-csrf-token'),
}));

const calls = vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
const request: AuthenticatedApiClient['fetchJson'] = <T>(path: string, init?: RequestInit) =>
  calls(path, init).then((value) => value as T);

describe('groupChatApi', () => {
  afterEach(() => vi.resetAllMocks());

  it('uses the Backend availability response without inferring activation from date', async () => {
    calls.mockResolvedValue({ message: '채팅 방식 조회 성공', data: { available: true } });

    await expect(getGroupChatAvailability(request)).resolves.toBe(true);
    expect(calls).toHaveBeenCalledWith('/group-chat-rooms/availability', undefined);
  });

  it('sends only voteAnswerId and parses an assigned room response', async () => {
    calls.mockResolvedValue({
      message: '그룹 채팅방 입장 성공',
      data: {
        chatRoomId: 21,
        roomSequence: 2,
        newlyAssigned: true,
        admittedParticipantCount: 1,
        activeParticipantCount: 0,
        expiresAt: '2026-10-22T00:00:00+09:00',
      },
    });

    await expect(joinGroupChat(request, 43)).resolves.toMatchObject({
      chatRoomId: 21,
      roomSequence: 2,
      newlyAssigned: true,
    });
    const [, init] = calls.mock.calls[0];
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ voteAnswerId: 43 });
  });

  it('rejects malformed availability instead of choosing a chat flow', async () => {
    calls.mockResolvedValue({ message: 'ok', data: {} });

    await expect(getGroupChatAvailability(request)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });
});
