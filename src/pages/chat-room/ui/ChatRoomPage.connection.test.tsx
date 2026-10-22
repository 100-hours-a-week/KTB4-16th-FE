import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SessionContext,
  type SessionContextValue,
} from '../../../entities/session/model/sessionContext';
import { FakeStompSocket } from '../../../features/chat-room/test/fakeStompTransport';
import { ApiError } from '../../../shared/api/apiError';
import { ChatRoomPage } from './ChatRoomPage';

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
  vi.useRealTimers();
});

/** 최신 UI의 입력 계약과 실제 연결 제어기를 함께 렌더링해 전송 경계만 대체한다. */
function renderPage({
  path = '/chat/123',
  restoring = false,
  authenticated = true,
  pageProps = {},
  useRestApi = false,
  fetchAuthenticatedJson = vi.fn(),
  locationState,
}: {
  path?: string;
  restoring?: boolean;
  authenticated?: boolean;
  pageProps?: ComponentProps<typeof ChatRoomPage>;
  useRestApi?: boolean;
  fetchAuthenticatedJson?: SessionContextValue['fetchAuthenticatedJson'];
  locationState?: unknown;
} = {}) {
  const session: SessionContextValue = {
    accessToken: authenticated ? 'token' : null,
    sessionVersion: 1,
    isAuthenticated: authenticated,
    isSessionRestoring: restoring,
    getAccessToken: () => (authenticated ? 'token' : null),
    refreshAccessToken: vi.fn(),
    setAccessToken: vi.fn(),
    clearSession: vi.fn(),
    fetchAuthenticatedJson,
  };
  return render(
    <SessionContext value={session}>
      <MemoryRouter
        initialEntries={[
          locationState === undefined ? path : { pathname: path, state: locationState },
        ]}
      >
        <Routes>
          <Route
            path="/chat/:chatRoomId"
            element={
              useRestApi ? (
                <ChatRoomPage {...pageProps} />
              ) : (
                <ChatRoomPage
                  loadState="not-configured"
                  messages={[]}
                  roomStatus="active"
                  {...pageProps}
                />
              )
            }
          />
        </Routes>
      </MemoryRouter>
    </SessionContext>,
  );
}

/** 실제 REST 진입·상세·이력 응답을 제공해 페이지 소유 STOMP 연결 흐름을 검증한다. */
function createRestRequest({
  roomType = 'DIRECT',
  activeCounts = [2],
  expiresAt = '2026-10-23T00:00:00+09:00',
  failEntry,
  failHistory,
  failLeave,
  detailRefreshError,
}: {
  roomType?: 'DIRECT' | 'GROUP';
  activeCounts?: number[];
  expiresAt?: string;
  failEntry?: ApiError;
  failHistory?: ApiError;
  failLeave?: Error;
  detailRefreshError?: ApiError;
} = {}) {
  const requests: string[] = [];
  let detailRequestCount = 0;
  const fetchAuthenticatedJson: SessionContextValue['fetchAuthenticatedJson'] = async <T,>(
    path: string,
  ) => {
    requests.push(path);
    if (path === '/chat-rooms/123/members') {
      if (failEntry) throw failEntry;
      return { message: 'ok' } as T;
    }
    if (path === '/chat-rooms/123/leave') {
      if (failLeave) throw failLeave;
      return { message: 'ok' } as T;
    }
    if (path === '/users/me') {
      return {
        message: 'ok',
        data: {
          userId: 7,
          nickname: 'me',
          email: 'me@example.com',
          preferredGenres: [],
          genreOnboardingDone: true,
          createdAt: '2026-10-18T00:00:00+09:00',
        },
      } as T;
    }
    if (path === '/chat-rooms/123') {
      if (detailRequestCount > 0 && detailRefreshError) throw detailRefreshError;
      const activeParticipantCount =
        activeCounts[Math.min(detailRequestCount++, activeCounts.length - 1)];
      return {
        message: 'ok',
        data: {
          chatRoomId: 123,
          roomType,
          groupDate: roomType === 'GROUP' ? '2026-10-21' : null,
          voteQuestionId: roomType === 'GROUP' ? 12 : null,
          roomSequence: roomType === 'GROUP' ? 3 : null,
          capacity: roomType === 'GROUP' ? 30 : 2,
          admittedParticipantCount: roomType === 'GROUP' ? 9 : 2,
          activeParticipantCount,
          expiresAt,
          participants: [
            {
              userId: 7,
              nickname: 'me',
              voteChoice: roomType === 'GROUP' ? 'A' : null,
              hasLeft: false,
            },
            {
              userId: 8,
              nickname: 'partner',
              voteChoice: roomType === 'GROUP' ? 'B' : null,
              hasLeft: false,
            },
            ...(roomType === 'GROUP'
              ? Array.from({ length: 7 }, (_, index) => ({
                  userId: index + 9,
                  nickname: `participant-${index + 1}`,
                  voteChoice: index % 2 === 0 ? ('A' as const) : ('B' as const),
                  hasLeft: true,
                }))
              : []),
          ],
        },
      } as T;
    }
    if (path === '/chat-rooms/123/messages') {
      if (failHistory) throw failHistory;
      return { message: 'ok', data: { messages: [], nextCursor: null, hasNext: false } } as T;
    }
    throw new Error(`Unexpected request: ${path}`);
  };
  return { fetchAuthenticatedJson, requests };
}

/** STOMP user queue에 전달된 실제 서버 메시지 frame 형식을 재현한다. */
function receiveUserFrame(socket: FakeStompSocket, destination: string, body: unknown) {
  const subscription = socket.sentFrames
    .find((frame) => frame.startsWith('SUBSCRIBE') && frame.includes(`destination:${destination}`))
    ?.match(/\nid:([^\n]+)/)?.[1];
  if (!subscription) throw new Error(`Missing subscription for ${destination}`);
  socket.receive(
    `MESSAGE\nsubscription:${subscription}\nmessage-id:server-1\ndestination:${destination}\ncontent-type:application/json\n\n${JSON.stringify(body)}\u0000`,
  );
}

/** 실 StompJS가 보낸 CONNECT 이후 서버 CONNECTED 응답을 전달한다. */
async function connectPage(): Promise<FakeStompSocket> {
  await waitFor(() => expect(FakeStompSocket.connections).toHaveLength(1));
  const socket = FakeStompSocket.connections[0];
  act(() => socket.open());
  expect(socket.sentFrames[0]).toContain('Authorization:Bearer token');
  act(() => socket.connected());
  return socket;
}

describe('ChatRoomPage live connection', () => {
  it('shows the GROUP re-entry screen only for the explicit server left-room code', async () => {
    const groupLocationState = {
      roomInfo: {
        roomType: 'GROUP',
        roomSequence: 3,
        admittedParticipantCount: 9,
      },
    };
    const leftRoomApi = createRestRequest({
      roomType: 'GROUP',
      failHistory: new ApiError(403, 'already left', 'CHAT_ALREADY_LEFT'),
    });
    renderPage({
      useRestApi: true,
      fetchAuthenticatedJson: leftRoomApi.fetchAuthenticatedJson,
      locationState: groupLocationState,
    });

    expect(await screen.findByText('이미 퇴장한 채팅방입니다.')).toBeInTheDocument();
    expect(screen.getByText('오늘은 이 채팅방에 다시 입장할 수 없어요.')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '메시지' })).toBeDisabled();
    cleanup();

    const forbiddenApi = createRestRequest({
      roomType: 'GROUP',
      failEntry: new ApiError(403, 'forbidden', 'CHAT_ACCESS_FORBIDDEN'),
    });
    renderPage({
      useRestApi: true,
      fetchAuthenticatedJson: forbiddenApi.fetchAuthenticatedJson,
      locationState: groupLocationState,
    });
    expect(await screen.findByText('이 채팅방에 접근할 권한이 없어요.')).toBeInTheDocument();
    expect(screen.queryByText('오늘은 이 채팅방에 다시 입장할 수 없어요.')).not.toBeInTheDocument();
  });

  it('renders the GROUP expiry state for the explicit CHAT_ROOM_EXPIRED response', async () => {
    const api = createRestRequest({
      roomType: 'GROUP',
      failEntry: new ApiError(403, 'expired', 'CHAT_ROOM_EXPIRED'),
    });
    renderPage({
      useRestApi: true,
      fetchAuthenticatedJson: api.fetchAuthenticatedJson,
      locationState: { roomInfo: { roomType: 'GROUP', roomSequence: 3 } },
    });

    expect(await screen.findByText('오늘의 채팅이 종료되었어요.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '메시지' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: '메시지' })).toHaveAttribute(
      'placeholder',
      '종료된 채팅방입니다',
    );
    expect(screen.getByRole('button', { name: '전송' })).toBeDisabled();
  });

  it('automatically disables GROUP composition at the server expiresAt boundary', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-21T23:59:59+09:00'));
    const api = createRestRequest({
      roomType: 'GROUP',
      expiresAt: '2026-10-22T00:00:00+09:00',
    });
    renderPage({
      useRestApi: true,
      pageProps: { connectionState: 'connected' },
      fetchAuthenticatedJson: api.fetchAuthenticatedJson,
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole('heading', { name: '그룹 채팅 3번 방' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '메시지' })).toBeEnabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByText('오늘의 채팅이 종료되었어요.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '메시지' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: '메시지' })).toHaveAttribute(
      'placeholder',
      '종료된 채팅방입니다',
    );
  });

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

  it('keeps the latest header and message preparation state after CONNECTED', async () => {
    renderPage({
      pageProps: {
        roomInfo: {
          partnerNickname: '상대방',
          participantCount: 2,
          expiresAt: '2026-10-18T15:00:00Z',
        },
      },
    });
    const socket = await connectPage();
    expect(screen.getByText('상대방')).toBeInTheDocument();
    expect(screen.getByText(/참여자 2명/)).toBeInTheDocument();
    expect(screen.getByText('메시지 기능은 서버 연동 후 이용할 수 있어요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '전송' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: '메시지' })).toBeDisabled();
    expect(socket.sentFrames.filter((frame) => frame.startsWith('SUBSCRIBE'))).toHaveLength(3);
  });

  it('does not enable SEND with a loaded history until a send handler exists', async () => {
    renderPage({ pageProps: { loadState: 'ready' } });
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

  it('publishes a UUID message and confirms it only after the matching server message frame', async () => {
    const api = createRestRequest();
    renderPage({ useRestApi: true, fetchAuthenticatedJson: api.fetchAuthenticatedJson });
    const socket = await connectPage();
    expect(screen.getByText('partner')).toBeInTheDocument();
    const input = screen.getByRole('textbox', { name: '메시지' });
    const user = userEvent.setup();
    await user.type(input, '실시간 메시지');
    await user.click(screen.getByRole('button', { name: '전송' }));

    const sendFrame = socket.sentFrames.find((frame) => frame.startsWith('SEND'));
    expect(sendFrame).toContain('destination:/app/chat-rooms/123/messages');
    const payload = JSON.parse(sendFrame!.split('\n\n')[1].replace('\u0000', '')) as {
      clientMessageId: string;
      content: string;
    };
    expect(payload).toMatchObject({ content: '실시간 메시지' });
    expect(payload.clientMessageId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(input).toHaveValue('실시간 메시지');
    expect(screen.getAllByText('전송 중')).toHaveLength(2);

    const response = {
      type: 'MESSAGE',
      chatRoomId: 123,
      chatMessageId: 501,
      clientMessageId: payload.clientMessageId,
      userId: 7,
      content: '실시간 메시지',
      createdAt: '2026-10-18T12:00:00+09:00',
    };
    act(() => receiveUserFrame(socket, '/user/queue/chat-messages', response));
    await waitFor(() => expect(input).toHaveValue(''));
    expect(screen.getByText('메시지를 전송했어요.')).toBeInTheDocument();
    expect(screen.getAllByText('실시간 메시지')).toHaveLength(1);

    act(() => receiveUserFrame(socket, '/user/queue/chat-messages', response));
    expect(screen.getAllByText('실시간 메시지')).toHaveLength(1);
  });

  it.each([
    ['PROHIBITED_WORD', '전송할 수 없는 단어가 포함되어 있어요.'],
    ['SPAM_DETECTED', '스팸으로 의심되는 메시지는 전송할 수 없어요.'],
    ['MESSAGE_BLOCKED', '부적절한 내용이 포함되어 메시지를 전송할 수 없어요.'],
    ['MODERATION_UNAVAILABLE', '현재 메시지를 전송할 수 없어요. 잠시 후 다시 시도해 주세요.'],
  ])('restores the draft and marks the message failed for %s', async (code, message) => {
    const api = createRestRequest();
    renderPage({ useRestApi: true, fetchAuthenticatedJson: api.fetchAuthenticatedJson });
    const socket = await connectPage();
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const input = screen.getByRole('textbox', { name: '메시지' });
    await user.type(input, '차단될 수 있는 내용');
    await user.click(screen.getByRole('button', { name: '전송' }));
    const sendFrame = socket.sentFrames.find((frame) => frame.startsWith('SEND'))!;
    const payload = JSON.parse(sendFrame.split('\n\n')[1].replace('\u0000', '')) as {
      clientMessageId: string;
    };
    act(() =>
      receiveUserFrame(socket, '/user/queue/chat-errors', {
        code,
        message: 'server detail is not displayed',
        clientMessageId: payload.clientMessageId,
      }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(input).toHaveValue('차단될 수 있는 내용');
    expect(screen.getByText('전송 실패')).toBeInTheDocument();
    expect(screen.getAllByText('차단될 수 있는 내용')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: '다시 보내기' }));
    await waitFor(() =>
      expect(socket.sentFrames.filter((frame) => frame.startsWith('SEND'))).toHaveLength(2),
    );
    const retryFrame = socket.sentFrames.filter((frame) => frame.startsWith('SEND'))[1];
    const retryPayload = JSON.parse(retryFrame.split('\n\n')[1].replace('\u0000', '')) as {
      clientMessageId: string;
    };
    expect(retryPayload.clientMessageId).toBe(payload.clientMessageId);
    act(() =>
      receiveUserFrame(socket, '/user/queue/chat-messages', {
        type: 'MESSAGE',
        chatRoomId: 123,
        chatMessageId: 503,
        clientMessageId: retryPayload.clientMessageId,
        userId: 7,
        content: '차단될 수 있는 내용',
        createdAt: '2026-10-18T12:02:00+09:00',
      }),
    );
    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('ignores another room message and applies the participant-left event for this room', async () => {
    const api = createRestRequest();
    renderPage({ useRestApi: true, fetchAuthenticatedJson: api.fetchAuthenticatedJson });
    const socket = await connectPage();
    act(() =>
      receiveUserFrame(socket, '/user/queue/chat-messages', {
        type: 'MESSAGE',
        chatRoomId: 999,
        chatMessageId: 502,
        clientMessageId: '550e8400-e29b-41d4-a716-446655440002',
        userId: 8,
        content: '다른 방 메시지',
        createdAt: '2026-10-18T12:00:00+09:00',
      }),
    );
    expect(screen.queryByText('다른 방 메시지')).not.toBeInTheDocument();

    act(() =>
      receiveUserFrame(socket, '/user/queue/chat-events', {
        type: 'PARTICIPANT_LEFT',
        chatRoomId: 123,
        userId: 8,
        nickname: 'partner',
        leftAt: '2026-10-18T12:01:00+09:00',
      }),
    );
    expect(screen.getByText('상대방이 채팅방을 나갔어요.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '메시지' })).toBeDisabled();
  });

  it('updates GROUP active count from refreshed detail after JOINED and LEFT events', async () => {
    const api = createRestRequest({ roomType: 'GROUP', activeCounts: [1, 2, 1] });
    renderPage({ useRestApi: true, fetchAuthenticatedJson: api.fetchAuthenticatedJson });
    const socket = await connectPage();
    const input = screen.getByRole('textbox', { name: '메시지' });
    expect(input).toBeDisabled();
    expect(screen.getByRole('heading', { name: '그룹 채팅 3번 방' })).toBeInTheDocument();
    expect(screen.getByText('오늘의 취향 투표 · 참여 인원 9/30명')).toBeInTheDocument();
    expect(screen.queryByText(/접속\s*\d+명/)).not.toBeInTheDocument();
    expect(screen.queryByText(/누적 배정/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('참가자 목록')).not.toBeInTheDocument();
    expect(screen.getByText('현재 채팅방에 1명만 참여 중이에요.')).toBeInTheDocument();
    expect(screen.getByText('다른 참여자가 입장하면 채팅을 시작할 수 있어요.')).toBeInTheDocument();

    act(() =>
      receiveUserFrame(socket, '/user/queue/chat-events', {
        type: 'PARTICIPANT_JOINED',
        chatRoomId: 123,
        userId: 8,
        nickname: 'partner',
        voteChoice: 'B',
        activeParticipantCount: 2,
        occurredAt: '2026-10-21T12:00:00+09:00',
      }),
    );
    await waitFor(() => expect(input).toBeEnabled());
    expect(screen.getByText('오늘의 취향 투표 · 참여 인원 9/30명')).toBeInTheDocument();
    expect(screen.getByText(/partner님이 입장했습니다/)).toBeInTheDocument();
    expect(api.requests.filter((path) => path === '/chat-rooms/123')).toHaveLength(2);

    act(() =>
      receiveUserFrame(socket, '/user/queue/chat-events', {
        type: 'PARTICIPANT_LEFT',
        chatRoomId: 123,
        userId: 8,
        nickname: 'partner',
        leftAt: '2026-10-21T12:01:00+09:00',
      }),
    );
    await waitFor(() => expect(input).toBeDisabled());
    expect(screen.getByText('오늘의 취향 투표 · 참여 인원 9/30명')).toBeInTheDocument();
    expect(screen.getByText('현재 채팅방에 1명만 참여 중이에요.')).toBeInTheDocument();
    expect(screen.getByText(/partner님이 퇴장했습니다/)).toBeInTheDocument();
    expect(api.requests.filter((path) => path === '/chat-rooms/123')).toHaveLength(3);
  });

  it('uses an explicit expiry response from a GROUP detail refresh to stop composition', async () => {
    const api = createRestRequest({
      roomType: 'GROUP',
      detailRefreshError: new ApiError(403, 'expired', 'CHAT_ROOM_EXPIRED'),
    });
    renderPage({ useRestApi: true, fetchAuthenticatedJson: api.fetchAuthenticatedJson });
    const socket = await connectPage();

    act(() =>
      receiveUserFrame(socket, '/user/queue/chat-events', {
        type: 'PARTICIPANT_LEFT',
        chatRoomId: 123,
        userId: 8,
        nickname: 'partner',
        leftAt: '2026-10-21T23:59:59+09:00',
      }),
    );

    expect(await screen.findByText('오늘의 채팅이 종료되었어요.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '메시지' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: '메시지' })).toHaveAttribute(
      'placeholder',
      '종료된 채팅방입니다',
    );
  });

  it('uses the GROUP leave confirmation copy and calls leave only after confirmation', async () => {
    const api = createRestRequest({ roomType: 'GROUP' });
    const user = userEvent.setup();
    renderPage({ useRestApi: true, fetchAuthenticatedJson: api.fetchAuthenticatedJson });
    await connectPage();

    await user.click(screen.getByRole('button', { name: '채팅방 메뉴' }));
    await user.click(screen.getByRole('menuitem', { name: '채팅방 나가기' }));
    expect(screen.getByRole('dialog', { name: '채팅방에서 나가시겠어요?' })).toBeInTheDocument();
    expect(screen.getByText('채팅방을 나가면 오늘은 다시 입장할 수 없어요.')).toBeInTheDocument();
    expect(api.requests).not.toContain('/chat-rooms/123/leave');

    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.requests).not.toContain('/chat-rooms/123/leave');

    await user.click(screen.getByRole('button', { name: '채팅방 메뉴' }));
    await user.click(screen.getByRole('menuitem', { name: '채팅방 나가기' }));
    await user.click(screen.getByRole('button', { name: '나가기' }));
    await waitFor(() => expect(api.requests).toContain('/chat-rooms/123/leave'));
  });

  it('keeps the GROUP room active and reports an error when leave fails', async () => {
    const api = createRestRequest({ roomType: 'GROUP', failLeave: new Error('offline') });
    const user = userEvent.setup();
    renderPage({ useRestApi: true, fetchAuthenticatedJson: api.fetchAuthenticatedJson });
    await connectPage();

    await user.click(screen.getByRole('button', { name: '채팅방 메뉴' }));
    await user.click(screen.getByRole('menuitem', { name: '채팅방 나가기' }));
    await user.click(screen.getByRole('button', { name: '나가기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '채팅방에서 나가지 못했어요. 잠시 후 다시 시도해 주세요.',
    );
    expect(screen.getByRole('heading', { name: '그룹 채팅 3번 방' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '메시지' })).toBeEnabled();
  });

  it.each([
    ['CHAT_ROOM_EXPIRED', '이 채팅방은 만료되었어요.'],
    ['CHAT_SEND_FORBIDDEN', '현재 채팅방에서는 메시지를 보낼 수 없어요.'],
  ])('blocks further sending after server status %s', async (code, notice) => {
    const api = createRestRequest();
    renderPage({ useRestApi: true, fetchAuthenticatedJson: api.fetchAuthenticatedJson });
    const socket = await connectPage();
    const user = userEvent.setup();
    const input = screen.getByRole('textbox', { name: '메시지' });
    await user.type(input, '상태 변경 확인');
    await user.click(screen.getByRole('button', { name: '전송' }));
    const sendFrame = socket.sentFrames.find((frame) => frame.startsWith('SEND'))!;
    const payload = JSON.parse(sendFrame.split('\n\n')[1].replace('\u0000', '')) as {
      clientMessageId: string;
    };
    act(() =>
      receiveUserFrame(socket, '/user/queue/chat-errors', {
        code,
        message: 'server detail',
        clientMessageId: payload.clientMessageId,
      }),
    );

    expect(await screen.findByText(notice)).toBeInTheDocument();
    expect(input).toBeDisabled();
    expect(input).toHaveValue('상태 변경 확인');
    expect(screen.queryByRole('button', { name: '다시 보내기' })).not.toBeInTheDocument();
  });

  it('switches GROUP to the expired state when SEND is rejected at the server boundary', async () => {
    const api = createRestRequest({ roomType: 'GROUP', activeCounts: [2] });
    renderPage({ useRestApi: true, fetchAuthenticatedJson: api.fetchAuthenticatedJson });
    const socket = await connectPage();
    const user = userEvent.setup();
    const input = screen.getByRole('textbox', { name: '메시지' });
    await user.type(input, '만료 직전 메시지');
    await user.click(screen.getByRole('button', { name: '전송' }));
    const sendFrame = socket.sentFrames.find((frame) => frame.startsWith('SEND'))!;
    const payload = JSON.parse(sendFrame.split('\n\n')[1].replace('\u0000', '')) as {
      clientMessageId: string;
    };

    act(() =>
      receiveUserFrame(socket, '/user/queue/chat-errors', {
        code: 'CHAT_ROOM_EXPIRED',
        message: 'expired',
        clientMessageId: payload.clientMessageId,
      }),
    );

    expect(await screen.findByText('오늘의 채팅이 종료되었어요.')).toBeInTheDocument();
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('placeholder', '종료된 채팅방입니다');
    expect(input).toHaveValue('만료 직전 메시지');
  });

  it('shows a soft peer-waiting state and settles the rejected message', async () => {
    const api = createRestRequest();
    renderPage({ useRestApi: true, fetchAuthenticatedJson: api.fetchAuthenticatedJson });
    const socket = await connectPage();
    const user = userEvent.setup();
    const input = screen.getByRole('textbox', { name: '메시지' });
    await user.type(input, '상대방 입장 대기 확인');
    await user.click(screen.getByRole('button', { name: '전송' }));

    const sendFrame = socket.sentFrames.find((frame) => frame.startsWith('SEND'))!;
    const payload = JSON.parse(sendFrame.split('\n\n')[1].replace('\u0000', '')) as {
      clientMessageId: string;
    };
    act(() =>
      receiveUserFrame(socket, '/user/queue/chat-errors', {
        code: 'CHAT_PEER_NOT_JOINED',
        message: '상대방이 아직 채팅방에 입장하지 않았습니다.',
        clientMessageId: payload.clientMessageId,
      }),
    );

    expect(await screen.findByText('상대방을 기다리고 있어요')).toBeVisible();
    expect(screen.getByText('두 사람 모두 입장하면 채팅을 시작할 수 있어요.')).toBeVisible();
    expect(input).toBeDisabled();
    expect(input).toHaveValue('상대방 입장 대기 확인');
    expect(screen.getByText('전송 실패')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 보내기' })).not.toBeInTheDocument();
  });
});
