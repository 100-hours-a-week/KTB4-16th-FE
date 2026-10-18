import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ChatRoomContent, type ChatMessage } from './ChatRoomContent';

const messages: ChatMessage[] = [
  {
    id: '2',
    sender: 'me',
    content: '나중 메시지',
    createdAt: '2026-10-14T06:22:00Z',
  },
  {
    id: '1',
    sender: 'partner',
    nickname: '상대방닉네임',
    content: '첫 메시지',
    createdAt: '2026-10-13T06:20:00Z',
  },
  {
    id: '3',
    sender: 'partner',
    nickname: '상대방닉네임',
    content: '두 번째 메시지',
    createdAt: '2026-10-14T06:23:00Z',
  },
];

/** API를 호출하지 않고 feature의 상태별 프레젠테이션을 렌더링한다. */
function renderContent(overrides: Partial<ComponentProps<typeof ChatRoomContent>> = {}) {
  return render(
    <ChatRoomContent
      chatRoomId="12"
      connectionState="connected"
      loadState="ready"
      messages={[]}
      roomStatus="active"
      {...overrides}
    />,
  );
}

/** 브라우저 레이아웃이 없는 DOM에서 스크롤 계산에 필요한 치수를 지정한다. */
function setScrollMetrics(
  element: HTMLElement,
  values: { scrollHeight: number; clientHeight: number },
) {
  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    value: values.scrollHeight,
  });
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    value: values.clientHeight,
  });
}

describe('ChatRoomContent', () => {
  it('shows bounded retry exhaustion and delegates manual connection recovery', async () => {
    const retry = vi.fn();
    renderContent({
      connectionState: 'disconnected',
      connectionStatus: {
        retryCount: 5,
        stopReason: 'retry-exhausted',
        isOffline: false,
        isRefreshingToken: false,
      },
      onRetryConnection: retry,
    });
    expect(screen.getByText(/자동 연결 시도를 마쳤어요/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: '다시 연결' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it.each([
    [true, false, '네트워크 연결을 기다리는 중'],
    [false, true, '인증 정보를 갱신하는 중'],
    [false, false, '다시 연결하는 중 (2/5)'],
  ] as const)('distinguishes offline %s and refresh %s', (isOffline, isRefreshingToken, label) => {
    renderContent({
      connectionState: 'reconnecting',
      connectionStatus: { retryCount: 2, stopReason: null, isOffline, isRefreshingToken },
    });
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('sorts messages, formats timestamps in KST, and renders sender/date information', () => {
    renderContent({ messages });

    const renderedMessages = screen.getAllByRole('article');
    expect(renderedMessages.map((message) => message.textContent)).toEqual([
      '상대방닉네임첫 메시지오후 3:20',
      '나중 메시지오후 3:22',
      '상대방닉네임두 번째 메시지오후 3:23',
    ]);
    expect(renderedMessages[0]).toHaveClass('is-partner');
    expect(renderedMessages[1]).toHaveClass('is-me');
    expect(screen.getAllByText('2026년 10월 14일')).toHaveLength(1);
  });

  it('shows the empty state and disables composition without a send handler', () => {
    renderContent();

    const input = screen.getByRole('textbox', { name: '메시지' });

    expect(screen.getByText('아직 주고받은 메시지가 없어요.')).toBeInTheDocument();
    expect(input).toBeDisabled();
    expect(screen.getByRole('button', { name: '전송' })).toBeDisabled();
  });

  it('limits the draft to 500 characters and prevents whitespace-only sends', async () => {
    const onSendMessage = vi.fn();
    const user = userEvent.setup();
    renderContent({ connectionState: 'connected', onSendMessage });

    const input = screen.getByRole('textbox', { name: '메시지' });
    await user.type(input, ' '.repeat(3));
    expect(screen.getByRole('button', { name: '전송' })).toBeDisabled();
    await user.clear(input);
    await user.type(input, '가'.repeat(501));
    expect(input).toHaveValue('가'.repeat(500));
  });

  it('sends trimmed content on Enter, while Shift+Enter keeps a newline in the draft', async () => {
    const onSendMessage = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderContent({ connectionState: 'connected', onSendMessage });

    const input = screen.getByRole('textbox', { name: '메시지' });
    await user.type(input, '안녕{Shift>}{Enter}{/Shift}하세요');
    expect(input).toHaveValue('안녕\n하세요');
    expect(onSendMessage).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');
    await waitFor(() => expect(onSendMessage).toHaveBeenCalledWith('안녕\n하세요'));
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('does not submit while an IME composition is active', async () => {
    const onSendMessage = vi.fn();
    const user = userEvent.setup();
    renderContent({ connectionState: 'connected', onSendMessage });

    const input = screen.getByRole('textbox', { name: '메시지' });
    await user.type(input, '한글');
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent.compositionEnd(input);

    expect(onSendMessage).not.toHaveBeenCalled();
    expect(input).toHaveValue('한글');
  });

  it('blocks sends while disconnected, reconnecting, loading, or the room is closed', async () => {
    const user = userEvent.setup();
    const onSendMessage = vi.fn();

    for (const props of [
      { connectionState: 'disconnected' as const },
      { connectionState: 'reconnecting' as const },
      { loadState: 'loading' as const },
      { roomStatus: 'expired' as const },
      { roomStatus: 'partner-left' as const },
      { roomStatus: 'self-left' as const },
    ]) {
      const view = renderContent({ connectionState: 'connected', onSendMessage, ...props });
      expect(screen.getByRole('textbox', { name: '메시지' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '전송' })).toBeDisabled();
      view.unmount();
    }

    expect(onSendMessage).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
  });

  it('prevents duplicate sends and keeps the draft until the handler resolves', async () => {
    let resolveSend: (() => void) | undefined;
    const onSendMessage = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSend = resolve;
        }),
    );
    const user = userEvent.setup();
    renderContent({ connectionState: 'connected', onSendMessage });

    const input = screen.getByRole('textbox', { name: '메시지' });
    await user.type(input, '보낼 내용');
    await user.click(screen.getByRole('button', { name: '전송' }));
    fireEvent.submit(screen.getByRole('form', { name: '메시지 작성' }));

    expect(onSendMessage).toHaveBeenCalledTimes(1);
    expect(input).toBeDisabled();
    expect(input).toHaveValue('보낼 내용');

    resolveSend?.();
    await waitFor(() => expect(input).toHaveValue(''));
    expect(screen.getByText(/서버 확인 후 표시됩니다/)).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('shows a retry action after send failure and does not add a fake message', async () => {
    const onSendMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderContent({ connectionState: 'connected', onSendMessage });

    await user.type(screen.getByRole('textbox', { name: '메시지' }), '재시도할 내용');
    await user.click(screen.getByRole('button', { name: '전송' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('메시지를 보내지 못했어요.');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 보내기' }));
    await waitFor(() => expect(onSendMessage).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it.each([
    ['loading', 'connecting', 'active', '메시지를 불러오는 중이에요.'],
    ['ready', 'reconnecting', 'active', '채팅 서버에 다시 연결하는 중'],
    ['ready', 'disconnected', 'active', '연결이 끊겼어요'],
    ['ready', 'not-configured', 'active', '실시간 채팅 연동 준비 중'],
    ['ready', 'connected', 'expired', '이 채팅방은 만료되었어요.'],
    ['ready', 'connected', 'partner-left', '상대방이 채팅방을 나갔어요.'],
    ['ready', 'connected', 'self-left', '이미 퇴장한 채팅방입니다.'],
    ['forbidden', 'connected', 'active', '이 채팅방에 접근할 권한이 없어요.'],
    ['not-found', 'connected', 'active', '채팅방을 찾을 수 없어요.'],
    ['server-error', 'disconnected', 'active', '서버에 문제가 발생했어요.'],
  ] as const)('renders %s / %s / %s status', (loadState, connectionState, roomStatus, message) => {
    renderContent({ connectionState, loadState, roomStatus });
    expect(screen.getByText(new RegExp(message))).toBeInTheDocument();
  });

  it('shows a retry control only when a load retry handler is available', async () => {
    const onRetryLoad = vi.fn();
    const user = userEvent.setup();
    renderContent({ loadState: 'server-error', onRetryLoad });

    await user.click(screen.getByRole('button', { name: '다시 불러오기' }));
    expect(onRetryLoad).toHaveBeenCalledOnce();
  });

  it('keeps the view at the bottom for new messages only when the user was near the bottom', () => {
    const view = renderContent({ messages: [messages[1]] });
    const region = screen.getByRole('region', { name: /채팅 메시지/ });
    setScrollMetrics(region, { scrollHeight: 200, clientHeight: 100 });
    region.scrollTop = 190;
    fireEvent.scroll(region);

    view.rerender(
      <ChatRoomContent
        chatRoomId="12"
        connectionState="connected"
        loadState="ready"
        messages={[messages[1], messages[0]]}
        roomStatus="active"
      />,
    );
    expect(region.scrollTop).toBe(200);

    region.scrollTop = 0;
    fireEvent.scroll(region);
    setScrollMetrics(region, { scrollHeight: 300, clientHeight: 100 });
    view.rerender(
      <ChatRoomContent
        chatRoomId="12"
        connectionState="connected"
        loadState="ready"
        messages={[messages[1], messages[0], messages[2]]}
        roomStatus="active"
      />,
    );
    expect(region.scrollTop).toBe(0);
  });

  it('preserves the visible scroll position when older messages are prepended', async () => {
    const onLoadOlderMessages = vi.fn();
    const user = userEvent.setup();
    const view = renderContent({
      hasOlderMessages: true,
      messages: [messages[1], messages[0]],
      onLoadOlderMessages,
    });
    const region = screen.getByRole('region', { name: /채팅 메시지/ });
    setScrollMetrics(region, { scrollHeight: 500, clientHeight: 200 });
    region.scrollTop = 100;

    await user.click(screen.getByRole('button', { name: '이전 메시지 불러오기' }));
    expect(onLoadOlderMessages).toHaveBeenCalledOnce();
    setScrollMetrics(region, { scrollHeight: 600, clientHeight: 200 });

    view.rerender(
      <ChatRoomContent
        chatRoomId="12"
        connectionState="connected"
        hasOlderMessages
        loadState="ready"
        messages={[{ ...messages[1], id: 'oldest' }, messages[1], messages[0]]}
        onLoadOlderMessages={onLoadOlderMessages}
        roomStatus="active"
      />,
    );
    expect(region.scrollTop).toBe(200);
  });
});
