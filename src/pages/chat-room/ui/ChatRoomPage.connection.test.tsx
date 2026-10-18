import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SessionContext,
  type SessionContextValue,
} from '../../../entities/session/model/sessionContext';
import { FakeStompSocket } from '../../../features/chat-room/test/fakeStompTransport';
import { ChatRoomPage } from './ChatRoomPage';

const chatApi = vi.hoisted(() => ({
  enterChatRoom: vi.fn(),
  getChatRoomDetails: vi.fn(),
  getChatRoomHistory: vi.fn(),
  leaveChatRoom: vi.fn(),
}));
vi.mock('../../../features/chat-room/api/chatRoomApi', () => chatApi);

const testAccessToken = `header.${btoa(JSON.stringify({ sub: '17' }))}.signature`;

beforeEach(() => {
  vi.clearAllMocks();
  chatApi.enterChatRoom.mockResolvedValue(undefined);
  chatApi.getChatRoomDetails.mockResolvedValue({
    chatRoomId: 123,
    participants: [
      { userId: 17, nickname: '나' },
      { userId: 28, nickname: '상대방' },
    ],
  });
  chatApi.getChatRoomHistory.mockResolvedValue({ messages: [], nextCursor: null, hasNext: false });
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

/** 최신 UI의 입력 계약과 실제 연결 제어기를 함께 렌더링해 전송 경계만 대체한다. */
function renderPage({
  path = '/chat/123',
  restoring = false,
  authenticated = true,
  pageProps = {},
}: {
  path?: string;
  restoring?: boolean;
  authenticated?: boolean;
  pageProps?: ComponentProps<typeof ChatRoomPage>;
} = {}) {
  const session: SessionContextValue = {
    accessToken: authenticated ? testAccessToken : null,
    sessionVersion: 1,
    isAuthenticated: authenticated,
    isSessionRestoring: restoring,
    getAccessToken: () => (authenticated ? testAccessToken : null),
    refreshAccessToken: vi.fn(),
    setAccessToken: vi.fn(),
    clearSession: vi.fn(),
    fetchAuthenticatedJson: vi.fn(),
  };
  return render(
    <SessionContext value={session}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/chat/:chatRoomId" element={<ChatRoomPage {...pageProps} />} />
        </Routes>
      </MemoryRouter>
    </SessionContext>,
  );
}

/** 실 StompJS가 보낸 CONNECT 이후 서버 CONNECTED 응답을 전달한다. */
async function connectPage(): Promise<FakeStompSocket> {
  await waitFor(() => expect(FakeStompSocket.connections).toHaveLength(1));
  const socket = FakeStompSocket.connections[0];
  act(() => socket.open());
  expect(socket.sentFrames[0]).toContain(`Authorization:Bearer ${testAccessToken}`);
  act(() => socket.connected());
  return socket;
}

describe('ChatRoomPage live connection', () => {
  it.each(['0', '-3', '12.5', 'abc', '9223372036854775808'])(
    'does not connect an invalid room ID %s',
    async (chatRoomId) => {
      renderPage({ path: `/chat/${chatRoomId}` });
      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.getByRole('alert')).toHaveTextContent('채팅방 주소를 확인');
      expect(FakeStompSocket.connections).toHaveLength(0);
    },
  );

  it.each(['9007199254740992', '9223372036854775807'])(
    'preserves the signed-64-bit room ID %s without Number conversion',
    async (chatRoomId) => {
      renderPage({ path: `/chat/${chatRoomId}` });
      await connectPage();
      expect(
        screen.getByRole('region', { name: `채팅 메시지, 채팅방 ${chatRoomId}` }),
      ).toBeInTheDocument();
      expect(screen.getByText('연결됨')).toBeInTheDocument();
    },
  );

  it.each([
    [true, true],
    [false, false],
  ])('waits for restoration %s and authentication %s', async (restoring, authenticated) => {
    renderPage({ restoring, authenticated });
    await act(async () => {
      await Promise.resolve();
    });
    expect(FakeStompSocket.connections).toHaveLength(0);
  });

  it('keeps REST loaded header and disabled message preparation state after CONNECTED', async () => {
    renderPage();
    const socket = await connectPage();
    expect(screen.getByText('상대방')).toBeInTheDocument();
    expect(screen.getByText(/참여자 2명/)).toBeInTheDocument();
    expect(screen.getByText('아직 주고받은 메시지가 없어요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '전송' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: '메시지' })).toBeDisabled();
    expect(socket.sentFrames.filter((frame) => frame.startsWith('SUBSCRIBE'))).toHaveLength(3);
  });

  it('does not enable SEND with a loaded history until a send handler exists', async () => {
    renderPage();
    await connectPage();
    expect(screen.getByRole('button', { name: '전송' })).toBeDisabled();
    expect(screen.getByText('아직 주고받은 메시지가 없어요.')).toBeInTheDocument();
  });

  it('does not open a second transport for an externally owned connection state', async () => {
    renderPage({ pageProps: { connectionState: 'connected' } });
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('연결됨')).toBeInTheDocument();
    expect(FakeStompSocket.connections).toHaveLength(0);
  });

  it('closes the page-owned session without UNSUBSCRIBE when the page unmounts', async () => {
    const { unmount } = renderPage();
    const socket = await connectPage();
    unmount();
    await waitFor(() => expect(socket.readyState).toBe(3));
    expect(socket.sentFrames.some((frame) => frame.startsWith('DISCONNECT'))).toBe(true);
    expect(socket.sentFrames.some((frame) => frame.startsWith('UNSUBSCRIBE'))).toBe(false);
  });
});
