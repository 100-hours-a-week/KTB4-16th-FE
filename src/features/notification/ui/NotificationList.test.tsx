import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { NotificationList } from './NotificationList';

const mocks = vi.hoisted(() => ({ getCsrfToken: vi.fn() }));
vi.mock('../../../shared/api/csrf', () => ({ getCsrfToken: mocks.getCsrfToken }));

const unread = {
  notificationId: 7,
  type: 'FRIEND_REQUEST',
  targetId: 12,
  targetType: 'FRIEND_REQUEST',
  title: '친구 요청',
  content: '민준님이 친구 요청을 보냈어요.',
  createdAt: '2026-10-11T12:00:00',
  readAt: null,
};

/** 실제 알림 UI와 API 파서를 실행하고 HTTP 경계만 대체한다. */
function renderList(request: AuthenticatedApiClient['fetchJson']) {
  return render(
    <MemoryRouter>
      <NotificationList request={request} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCsrfToken.mockResolvedValue('csrf-test');
});

describe('NotificationList', () => {
  it('keeps newly opened notifications highlighted until the page is reopened', async () => {
    let serverReadAt: string | null = null;
    const request = vi.fn().mockImplementation(async (path: string) => {
      if (path === '/notifications/read') {
        serverReadAt = '2026-10-12T16:03:00';
        return { message: '읽음 처리 성공' };
      }
      return {
        message: '성공',
        data: { notifications: [{ ...unread, readAt: serverReadAt }], nextCursor: null },
      };
    });
    const firstVisit = renderList(request);
    const firstCard = (await screen.findByText(unread.content)).closest('article');

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/notifications/read', expect.anything()),
    );
    expect(firstCard).toHaveClass('is-unread');

    firstVisit.unmount();
    renderList(request);
    const revisitedCard = (await screen.findByText(unread.content)).closest('article');
    expect(revisitedCard).not.toHaveClass('is-unread');
  });

  it('marks only unread items from each loaded page, without dropping earlier notifications', async () => {
    const user = userEvent.setup();
    const request = vi.fn().mockImplementation(async (path: string) => {
      if (path === '/notifications/read') return { message: '읽음 처리 성공' };
      if (path.includes('cursor='))
        return {
          message: '성공',
          data: {
            notifications: [
              { ...unread, notificationId: 5, content: '두 번째 페이지', targetId: null },
            ],
            nextCursor: null,
          },
        };
      return {
        message: '성공',
        data: {
          notifications: [
            unread,
            {
              ...unread,
              notificationId: 6,
              content: '이미 확인한 알림',
              readAt: '2026-10-11T12:30:00',
            },
          ],
          nextCursor: 'next',
        },
      };
    });
    renderList(request);

    expect(await screen.findByText(unread.content)).toBeInTheDocument();
    expect(screen.getAllByText('10월 11일 오후 12:00')[0]).toHaveAttribute(
      'datetime',
      '2026-10-11T03:00:00.000Z',
    );
    for (const link of screen.getAllByRole('link', { name: '받은 요청 보기' })) {
      expect(link).toHaveAttribute('href', '/friends?tab=received');
    }
    await waitFor(() => expect(screen.getByRole('button', { name: '더 보기' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: '더 보기' }));

    expect(await screen.findByText('두 번째 페이지')).toBeInTheDocument();
    expect(screen.getByText(unread.content)).toBeInTheDocument();
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/notifications/read',
        expect.objectContaining({ body: '{"notificationIds":[5]}' }),
      ),
    );
    expect(request).toHaveBeenCalledWith(
      '/notifications/read',
      expect.objectContaining({ body: '{"notificationIds":[7]}' }),
    );
    expect(screen.queryByRole('button', { name: '더 보기' })).not.toBeInTheDocument();
  });

  it('shows an empty state without issuing a read mutation', async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ message: '성공', data: { notifications: [], nextCursor: null } });
    renderList(request);
    expect(await screen.findByText('아직 도착한 알림이 없어요')).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('keeps fetched notifications visible when marking read fails, and offers a retry', async () => {
    let failRead = true;
    const request = vi.fn().mockImplementation(async (path: string) => {
      if (path === '/notifications/read') {
        if (failRead) throw new Error('Network unavailable');
        return { message: '읽음 처리 성공' };
      }
      return { message: '성공', data: { notifications: [unread], nextCursor: null } };
    });
    const user = userEvent.setup();
    renderList(request);
    expect(await screen.findByText(unread.content)).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('읽음 상태를 저장하지 못했어요.');
    failRead = false;
    await user.click(screen.getByRole('button', { name: '읽음 처리 다시 시도' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('lets a failed first page be retried without treating it as an empty list', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValue({ message: '성공', data: { notifications: [], nextCursor: null } });
    const user = userEvent.setup();
    renderList(request);
    expect(await screen.findByRole('alert')).toHaveTextContent('알림을 불러오지 못했어요.');
    expect(screen.queryByText('아직 도착한 알림이 없어요')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다시 불러오기' }));
    expect(await screen.findByText('아직 도착한 알림이 없어요')).toBeInTheDocument();
  });

  it('confirms deletion and removes the card only after the server succeeds', async () => {
    const user = userEvent.setup();
    let finishDelete: ((value: unknown) => void) | undefined;
    const request = vi.fn().mockImplementation((path: string) => {
      if (path === '/notifications/read') return Promise.resolve({ message: '읽음 처리 성공' });
      if (path === '/notifications/7')
        return new Promise((resolve) => {
          finishDelete = resolve;
        });
      return Promise.resolve({
        message: '성공',
        data: { notifications: [unread], nextCursor: null },
      });
    });
    renderList(request);
    await screen.findByText(unread.content);
    await screen.findByRole('button', { name: '알림 삭제' });
    await user.click(screen.getByRole('button', { name: '알림 삭제' }));
    const dialog = screen.getByRole('dialog', { name: '알림을 삭제할까요?' });
    expect(dialog.closest('article')).toBeNull();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(request).not.toHaveBeenCalledWith('/notifications/7', expect.anything());
    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.getByText(unread.content)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '알림 삭제' }));
    await user.click(screen.getByRole('button', { name: '삭제 확인' }));
    expect(screen.getByText(unread.content)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '삭제 중…' })).toBeDisabled();
    finishDelete?.({ message: '알림이 삭제되었습니다.' });
    expect(await screen.findByText('아직 도착한 알림이 없어요')).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith(
      '/notifications/7',
      expect.objectContaining({ method: 'DELETE', headers: { 'X-XSRF-TOKEN': 'csrf-test' } }),
    );
  });

  it('keeps a notification visible when deletion fails and allows a retry', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const request = vi.fn().mockImplementation(async (path: string) => {
      if (path === '/notifications/read') return { message: '읽음 처리 성공' };
      if (path === '/notifications/7') {
        attempts += 1;
        if (attempts === 1) throw new Error('Network unavailable');
        return { message: '알림이 삭제되었습니다.' };
      }
      return { message: '성공', data: { notifications: [unread], nextCursor: null } };
    });
    renderList(request);
    await screen.findByText(unread.content);
    await screen.findByRole('button', { name: '알림 삭제' });
    await user.click(screen.getByRole('button', { name: '알림 삭제' }));
    await user.click(screen.getByRole('button', { name: '삭제 확인' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('알림을 삭제하지 못했어요.');
    expect(screen.getByText(unread.content)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '삭제 확인' }));
    expect(await screen.findByText('아직 도착한 알림이 없어요')).toBeInTheDocument();
  });

  it('focuses the separate deletion dialog and restores focus after Escape', async () => {
    const user = userEvent.setup();
    const request = vi.fn().mockImplementation(async (path: string) => {
      if (path === '/notifications/read') return { message: '읽음 처리 성공' };
      return { message: '성공', data: { notifications: [unread], nextCursor: null } };
    });
    renderList(request);
    const trigger = await screen.findByRole('button', { name: '알림 삭제' });
    await waitFor(() => expect(trigger).toBeEnabled());
    await user.click(trigger);
    expect(screen.getByRole('button', { name: '취소' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: '삭제 확인' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(request).not.toHaveBeenCalledWith('/notifications/7', expect.anything());
  });
});
