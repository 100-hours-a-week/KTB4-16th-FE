import { afterEach, describe, expect, it, vi } from 'vitest';

import { getCsrfToken } from '../../../shared/api/csrf';
import {
  acceptFriendRequest,
  deleteFriendRequest,
  deleteFriendship,
  getFriends,
  getReceivedFriendRequests,
  getSentFriendRequests,
  sendFriendRequest,
} from './friendApi';

vi.mock('../../../shared/api/csrf', () => ({ getCsrfToken: vi.fn() }));

afterEach(() => vi.clearAllMocks());

describe('friendApi', () => {
  it('parses the friend list and sends cursor parameters', async () => {
    const fetchAuthenticatedJson = vi.fn().mockResolvedValue({
      message: '친구 목록 조회 성공',
      data: {
        friends: [{ friendshipId: 7, userId: 8, nickname: '친구' }],
        nextCursor: 'next',
      },
    });

    await expect(
      getFriends('cursor value', fetchAuthenticatedJson, new AbortController().signal, 10),
    ).resolves.toEqual({
      items: [{ friendshipId: 7, userId: 8, nickname: '친구' }],
      nextCursor: 'next',
    });
    expect(fetchAuthenticatedJson).toHaveBeenCalledWith(
      '/users/me/friends?cursor=cursor+value&size=10',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('normalizes received and sent requests while using each endpoint', async () => {
    const fetchAuthenticatedJson = vi
      .fn()
      .mockResolvedValueOnce({
        message: '받은 친구 요청 목록 조회 성공',
        data: {
          requests: [
            {
              friendRequestId: 11,
              requester: { userId: 8, nickname: '발신자' },
              createdAt: '2026-10-06T12:00:00',
            },
          ],
          nextCursor: null,
        },
      })
      .mockResolvedValueOnce({
        message: '보낸 친구 요청 목록 조회 성공',
        data: {
          requests: [
            {
              friendRequestId: 12,
              addressee: { userId: 9, nickname: '수신자' },
              createdAt: '2026-10-06T11:00:00',
            },
          ],
          nextCursor: null,
        },
      });
    const signal = new AbortController().signal;

    await expect(
      getReceivedFriendRequests(null, fetchAuthenticatedJson, signal),
    ).resolves.toMatchObject({
      items: [{ friendRequestId: 11, userId: 8, nickname: '발신자' }],
    });
    await expect(
      getSentFriendRequests(null, fetchAuthenticatedJson, signal),
    ).resolves.toMatchObject({
      items: [{ friendRequestId: 12, userId: 9, nickname: '수신자' }],
    });
    expect(fetchAuthenticatedJson).toHaveBeenNthCalledWith(
      1,
      '/users/me/friend-requests/received',
      { signal },
    );
    expect(fetchAuthenticatedJson).toHaveBeenNthCalledWith(2, '/users/me/friend-requests/sent', {
      signal,
    });
  });

  it('sends the received and sent cursor to their matching endpoints', async () => {
    const fetchAuthenticatedJson = vi
      .fn()
      .mockResolvedValueOnce({
        message: '받은 친구 요청 목록 조회 성공',
        data: { requests: [], nextCursor: null },
      })
      .mockResolvedValueOnce({
        message: '보낸 친구 요청 목록 조회 성공',
        data: { requests: [], nextCursor: null },
      });
    const signal = new AbortController().signal;

    await getReceivedFriendRequests('received next', fetchAuthenticatedJson, signal);
    await getSentFriendRequests('sent next', fetchAuthenticatedJson, signal);

    expect(fetchAuthenticatedJson).toHaveBeenNthCalledWith(
      1,
      '/users/me/friend-requests/received?cursor=received+next',
      { signal },
    );
    expect(fetchAuthenticatedJson).toHaveBeenNthCalledWith(
      2,
      '/users/me/friend-requests/sent?cursor=sent+next',
      { signal },
    );
  });

  it('uses CSRF for sending, accepting, and deleting friend resources', async () => {
    vi.mocked(getCsrfToken).mockResolvedValue('csrf-token');
    const fetchAuthenticatedJson = vi
      .fn()
      .mockResolvedValueOnce({ message: '친구 요청 성공', data: { friendRequestId: 21 } })
      .mockResolvedValueOnce({ message: '친구 요청 수락 성공', data: { friendshipId: 22 } })
      .mockResolvedValueOnce({ message: '친구 요청이 삭제되었습니다.' })
      .mockResolvedValueOnce({ message: '친구가 삭제되었습니다.' });

    await expect(sendFriendRequest('친구', fetchAuthenticatedJson)).resolves.toEqual({
      kind: 'pending',
      friendRequestId: 21,
    });
    await expect(acceptFriendRequest(21, fetchAuthenticatedJson)).resolves.toBe(22);
    await expect(deleteFriendRequest(21, fetchAuthenticatedJson)).resolves.toBeUndefined();
    await expect(deleteFriendship(22, fetchAuthenticatedJson)).resolves.toBeUndefined();

    expect(fetchAuthenticatedJson).toHaveBeenNthCalledWith(1, '/users/me/friend-requests', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': 'csrf-token' },
      body: JSON.stringify({ nickname: '친구' }),
    });
    expect(fetchAuthenticatedJson).toHaveBeenNthCalledWith(2, '/friend-requests/21/accept', {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-XSRF-TOKEN': 'csrf-token' },
    });
  });

  it('distinguishes a reverse request that became a friendship', async () => {
    const fetchAuthenticatedJson = vi.fn().mockResolvedValue({
      message: '친구 요청 성공',
      data: { friendshipId: 33 },
    });

    await expect(sendFriendRequest('친구', fetchAuthenticatedJson)).resolves.toEqual({
      kind: 'friends',
      friendshipId: 33,
    });
  });

  it('rejects malformed friend list data', async () => {
    const fetchAuthenticatedJson = vi.fn().mockResolvedValue({
      message: '친구 목록 조회 성공',
      data: { friends: [{ userId: 'bad' }], nextCursor: null },
    });

    await expect(
      getFriends(null, fetchAuthenticatedJson, new AbortController().signal),
    ).rejects.toThrow('친구 목록 항목 형식이 올바르지 않습니다.');
  });
});
