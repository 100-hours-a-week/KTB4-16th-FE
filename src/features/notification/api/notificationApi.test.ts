import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCsrfToken } from '../../../shared/api/csrf';
import { getNotifications, markNotificationsRead } from './notificationApi';

vi.mock('../../../shared/api/csrf', () => ({ getCsrfToken: vi.fn() }));

const notification = {
  notificationId: 7,
  type: 'FRIEND_REQUEST',
  targetId: null,
  targetType: 'FRIEND_REQUEST',
  title: '친구 요청',
  content: '친구 요청이 도착했어요.',
  createdAt: '2026-10-11T12:00:00',
  readAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCsrfToken).mockResolvedValue('csrf-test');
});

describe('notificationApi', () => {
  it('encodes the cursor and preserves a deleted target as a readable notification', async () => {
    const request = vi.fn().mockResolvedValue({
      message: '알림 목록 조회 성공',
      data: { notifications: [notification], nextCursor: 'next' },
    });
    const signal = new AbortController().signal;

    await expect(getNotifications('a+b=', request, signal)).resolves.toEqual({
      items: [notification],
      nextCursor: 'next',
    });
    expect(request).toHaveBeenCalledWith('/notifications?size=20&cursor=a%2Bb%3D', { signal });
    expect(getCsrfToken).not.toHaveBeenCalled();
  });

  it.each([
    { ...notification, notificationId: -1 },
    { ...notification, targetId: '7' },
    { ...notification, type: 'AI_PLAYLIST' },
    { ...notification, createdAt: 'invalid' },
    { ...notification, readAt: false },
  ])('rejects malformed notification fields before rendering', async (item) => {
    const request = vi.fn().mockResolvedValue({
      message: '성공',
      data: { notifications: [item], nextCursor: null },
    });
    await expect(getNotifications(null, request, new AbortController().signal)).rejects.toThrow();
  });

  it('sends a CSRF-protected batch of distinct IDs only when there are unread notifications', async () => {
    const request = vi.fn().mockResolvedValue({ message: '읽음 처리 성공' });
    const signal = new AbortController().signal;
    await markNotificationsRead([], request, signal);
    expect(request).not.toHaveBeenCalled();
    await markNotificationsRead([7, 8, 7], request, signal);
    expect(request).toHaveBeenCalledWith('/notifications/read', {
      method: 'PATCH',
      credentials: 'include',
      signal,
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': 'csrf-test' },
      body: JSON.stringify({ notificationIds: [7, 8] }),
    });
  });
});
