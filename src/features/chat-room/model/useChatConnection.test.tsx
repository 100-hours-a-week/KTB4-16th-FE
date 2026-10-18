import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FakeStompSocket } from '../test/fakeStompTransport';
import { useChatConnection } from './useChatConnection';

beforeEach(() => {
  FakeStompSocket.connections = [];
  vi.stubGlobal('WebSocket', FakeStompSocket);
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
});
afterEach(async () => {
  cleanup();
  await act(async () => {
    await Promise.resolve();
  });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useChatConnection', () => {
  it('waits for enabled and keeps its transport through a routine refresh', async () => {
    let token = 'first-token';
    const options = {
      enabled: false,
      sessionVersion: 1,
      getAccessToken: () => token,
      refreshAccessToken: vi.fn(),
    };
    const { result, rerender } = renderHook(useChatConnection, { initialProps: options });
    expect(FakeStompSocket.connections).toHaveLength(0);
    rerender({ ...options, enabled: true });
    await waitFor(() => expect(FakeStompSocket.connections).toHaveLength(1));
    const first = FakeStompSocket.connections[0];
    act(() => {
      first.open();
      first.connected();
    });
    expect(result.current.connection.state).toBe('connected');
    token = 'refreshed-token';
    rerender({ ...options, enabled: true });
    expect(FakeStompSocket.connections).toHaveLength(1);
    rerender({ ...options, enabled: true, sessionVersion: 2 });
    await waitFor(() => expect(FakeStompSocket.connections).toHaveLength(2));
    expect(first.readyState).toBe(3);
    const next = FakeStompSocket.connections[1];
    act(() => next.open());
    expect(next.sentFrames[0]).toContain('Authorization:Bearer refreshed-token');
  });

  it('cleans up StrictMode transports and ignores a discarded client callback', async () => {
    const options = {
      enabled: true,
      sessionVersion: 1,
      getAccessToken: () => 'token',
      refreshAccessToken: vi.fn(),
    };
    const { result, rerender, unmount } = renderHook(useChatConnection, {
      initialProps: options,
      wrapper: StrictMode,
    });
    await waitFor(() => expect(FakeStompSocket.connections).toHaveLength(1));
    const first = FakeStompSocket.connections[0];
    act(() => {
      first.open();
      first.connected();
    });
    rerender({ ...options, sessionVersion: 2 });
    await waitFor(() => expect(FakeStompSocket.connections).toHaveLength(2));
    act(() => first.connected());
    expect(result.current.connection.state).toBe('connecting');
    const second = FakeStompSocket.connections[1];
    act(() => {
      second.open();
      second.connected();
    });
    unmount();
    await waitFor(() => expect(second.readyState).toBe(3));
    expect(second.sentFrames.some((frame) => frame.startsWith('DISCONNECT'))).toBe(true);
  });

  it('does not start a connection after an offline screen has unmounted', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const options = {
      enabled: true,
      sessionVersion: 1,
      getAccessToken: () => 'token',
      refreshAccessToken: vi.fn(),
    };
    const { result, unmount } = renderHook(useChatConnection, { initialProps: options });
    await waitFor(() => expect(result.current.connection.isOffline).toBe(true));
    unmount();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    expect(FakeStompSocket.connections).toHaveLength(0);
  });
});
