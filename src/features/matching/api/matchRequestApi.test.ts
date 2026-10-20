import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCsrfToken } from '../../../shared/api/csrf';
import {
  createMatchRequest,
  getMatchRequestByVoteAnswer,
  getMatchRequestState,
} from './matchRequestApi';

vi.mock('../../../shared/api/csrf', () => ({ getCsrfToken: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

describe('matchRequestApi', () => {
  it('creates a match request with the vote answer and CSRF token', async () => {
    vi.mocked(getCsrfToken).mockResolvedValue('csrf-token');
    const request = vi.fn().mockResolvedValue({
      data: { matchRequestId: 90, status: 'WAITING' },
    });

    await expect(createMatchRequest(request, 43)).resolves.toEqual({
      matchRequestId: 90,
      status: 'WAITING',
    });
    expect(request).toHaveBeenCalledWith('/match-requests', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': 'csrf-token' },
      body: JSON.stringify({ voteAnswerId: 43 }),
    });
  });

  it('reads the matched chat room only when the server returns MATCHED', async () => {
    const request = vi.fn().mockResolvedValue({
      data: { matchRequestId: 90, status: 'MATCHED', chatRoomId: 41 },
    });

    await expect(getMatchRequestState(request, 90)).resolves.toEqual({
      matchRequestId: 90,
      status: 'MATCHED',
      chatRoomId: 41,
    });
    expect(request).toHaveBeenCalledWith('/match-requests/90');
  });

  it('restores the existing request by vote answer and accepts terminal FAILED without a room', async () => {
    const request = vi.fn().mockResolvedValue({
      data: { matchRequestId: 91, status: 'FAILED', chatRoomId: null },
    });

    await expect(getMatchRequestByVoteAnswer(request, 43)).resolves.toEqual({
      matchRequestId: 91,
      status: 'FAILED',
      chatRoomId: null,
    });
    expect(request).toHaveBeenCalledWith('/match-requests/by-vote-answer/43');
  });

  it('rejects a by-vote-answer response with an invalid room/status combination', async () => {
    const request = vi.fn().mockResolvedValue({
      data: { matchRequestId: 91, status: 'WAITING', chatRoomId: 42 },
    });

    await expect(getMatchRequestByVoteAnswer(request, 43)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('rejects a MATCHED response without a chat room id', async () => {
    await expect(
      getMatchRequestState(
        vi.fn().mockResolvedValue({
          data: { matchRequestId: 90, status: 'MATCHED', chatRoomId: null },
        }),
        90,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 502 });
  });

  it('accepts FAILED with a null chat room id', async () => {
    const request = vi.fn().mockResolvedValue({
      data: { matchRequestId: 90, status: 'FAILED', chatRoomId: null },
    });

    await expect(getMatchRequestState(request, 90)).resolves.toEqual({
      matchRequestId: 90,
      status: 'FAILED',
      chatRoomId: null,
    });
  });

  it('rejects FAILED when the server includes a chat room id', async () => {
    await expect(
      getMatchRequestState(
        vi.fn().mockResolvedValue({
          data: { matchRequestId: 90, status: 'FAILED', chatRoomId: 41 },
        }),
        90,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 502 });
  });
});
