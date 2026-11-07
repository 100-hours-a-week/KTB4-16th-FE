import { afterEach, describe, expect, it, vi } from 'vitest';

import { connectNotificationSse, getJwtExpirationMs } from './notificationSseClient';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('notificationSseClient', () => {
  it('sends the current Bearer token and parses named events split across chunks', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('event: connected\r'));
        controller.enqueue(
          encoder.encode(
            '\ndata: {}\r\n\r\nevent: notification-created\ndata: {"notificationId":9}\n\n',
          ),
        );
        controller.close();
      },
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const events: string[] = [];

    await expect(
      connectNotificationSse('access-token', new AbortController().signal, (event) => {
        events.push(event);
      }),
    ).resolves.toBe('ended');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/notifications/stream');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        Authorization: 'Bearer access-token',
      },
    });
    expect(events).toEqual(['connected', 'notification-created']);
  });

  it('returns unauthorized for a 401 response so the session can refresh before reconnecting', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

    await expect(
      connectNotificationSse('expired-token', new AbortController().signal, vi.fn()),
    ).resolves.toBe('unauthorized');
  });

  it('cancels a pending stream reader when the session is aborted', async () => {
    let wasCancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      cancel() {
        wasCancelled = true;
      },
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }),
        ),
    );
    const controller = new AbortController();
    const connection = connectNotificationSse('access-token', controller.signal, vi.fn());

    await Promise.resolve();
    controller.abort();

    await expect(connection).rejects.toMatchObject({ name: 'AbortError' });
    expect(wasCancelled).toBe(true);
  });

  it('stops the stream when the auth-expired event is received', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: auth-expired\ndata: {}\n\n'));
      },
    });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }),
        ),
    );
    const onEvent = vi.fn();

    await expect(
      connectNotificationSse('access-token', new AbortController().signal, onEvent),
    ).resolves.toBe('auth-expired');
    expect(onEvent).toHaveBeenCalledWith('auth-expired');
  });

  it('reads the JWT expiration claim without treating an invalid token as expiring', () => {
    const payload = btoa(JSON.stringify({ exp: 1_800_000_000 }));
    expect(getJwtExpirationMs(`header.${payload}.signature`)).toBe(1_800_000_000_000);
    expect(getJwtExpirationMs('not-a-jwt')).toBeNull();
    expect(getJwtExpirationMs(`header.${btoa('{}')}.signature`)).toBeNull();
  });
});
