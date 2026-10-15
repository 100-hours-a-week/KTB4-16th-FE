import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';

import { ChatRoomContent, type ChatMessage } from './ChatRoomContent';

const messages: ChatMessage[] = [
  {
    id: 'later',
    sender: 'me',
    content: '나중 메시지',
    createdAt: 2,
    dateLabel: '2026년 10월 14일',
    timeLabel: '오후 3:22',
  },
  {
    id: 'first',
    sender: 'partner',
    content: '첫 메시지',
    createdAt: 1,
    dateLabel: '2026년 10월 13일',
    timeLabel: '오후 3:20',
  },
  {
    id: 'second',
    sender: 'partner',
    content: '두 번째 메시지',
    createdAt: 3,
    dateLabel: '2026년 10월 14일',
    timeLabel: '오후 3:23',
  },
];

/** 서버 연결 전의 상태별 채팅 UI를 렌더링한다. */
function renderContent(overrides: Partial<ComponentProps<typeof ChatRoomContent>> = {}) {
  return render(
    <ChatRoomContent
      connectionState="connecting"
      loadState="ready"
      messages={[]}
      roomStatus="active"
      {...overrides}
    />,
  );
}

describe('ChatRoomContent', () => {
  it('sorts messages by creation time and renders date dividers, bubbles, and times', () => {
    renderContent({ connectionState: 'connected', messages });

    const renderedMessages = screen.getAllByRole('article');
    expect(renderedMessages.map((message) => message.textContent)).toEqual([
      '첫 메시지오후 3:20',
      '나중 메시지오후 3:22',
      '두 번째 메시지오후 3:23',
    ]);
    expect(renderedMessages[0]).toHaveClass('is-partner');
    expect(renderedMessages[1]).toHaveClass('is-me');
    expect(screen.getAllByText('2026년 10월 14일')).toHaveLength(1);
  });

  it('shows an empty state and keeps sending disabled', async () => {
    const user = userEvent.setup();
    renderContent();

    const draft = '새로운 추천 곡이 있어요.';
    await user.type(screen.getByRole('textbox', { name: '메시지' }), draft);

    expect(screen.getByText('아직 주고받은 메시지가 없어요.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '메시지' })).toHaveValue(draft);
    expect(screen.getByRole('button', { name: '전송' })).toBeDisabled();
  });

  it('limits the message draft to 500 characters', async () => {
    const user = userEvent.setup();
    renderContent();

    await user.type(screen.getByRole('textbox', { name: '메시지' }), '가'.repeat(501));

    expect(screen.getByRole('textbox', { name: '메시지' })).toHaveValue('가'.repeat(500));
  });

  it.each([
    ['loading', 'connecting', 'active', '메시지를 불러오는 중이에요.'],
    ['error', 'disconnected', 'active', '메시지를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'],
    ['ready', 'connected', 'expired', '이 채팅방은 만료되었어요.'],
    ['ready', 'connected', 'partner-left', '상대방이 채팅방을 나갔어요.'],
  ] as const)('shows %s / %s / %s state', (loadState, connectionState, roomStatus, message) => {
    renderContent({ connectionState, loadState, roomStatus });

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(
      screen.getByText(
        connectionState === 'connecting'
          ? '채팅 서버에 연결하는 중'
          : connectionState === 'connected'
            ? '연결됨'
            : '연결이 끊겼어요',
      ),
    ).toBeInTheDocument();
  });
});
