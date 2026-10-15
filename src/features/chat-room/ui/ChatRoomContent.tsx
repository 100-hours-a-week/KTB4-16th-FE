import { useMemo, useState } from 'react';

import './chatRoomContent.css';

export type ChatMessage = {
  id: string;
  sender: 'me' | 'partner';
  content: string;
  createdAt: number;
  dateLabel: string;
  timeLabel: string;
};

export type ChatRoomLoadState = 'loading' | 'ready' | 'error';
export type ChatConnectionState = 'connecting' | 'connected' | 'disconnected';
export type ChatRoomStatus = 'active' | 'expired' | 'partner-left';

type ChatRoomContentProps = {
  connectionState: ChatConnectionState;
  loadState: ChatRoomLoadState;
  messages: readonly ChatMessage[];
  roomStatus: ChatRoomStatus;
};

const connectionLabels: Record<ChatConnectionState, string> = {
  connecting: '채팅 서버에 연결하는 중',
  connected: '연결됨',
  disconnected: '연결이 끊겼어요',
};

const roomStatusLabels: Partial<Record<ChatRoomStatus, string>> = {
  expired: '이 채팅방은 만료되었어요.',
  'partner-left': '상대방이 채팅방을 나갔어요.',
};

/** 서버 데이터 주입 전에도 채팅방의 메시지 및 상태 표현을 일관되게 렌더링한다. */
export function ChatRoomContent({
  connectionState,
  loadState,
  messages,
  roomStatus,
}: ChatRoomContentProps) {
  const [draft, setDraft] = useState('');
  const sortedMessages = useMemo(
    () => [...messages].sort((first, second) => first.createdAt - second.createdAt),
    [messages],
  );
  const roomNotice = roomStatusLabels[roomStatus];

  return (
    <>
      <section aria-label="채팅 메시지" className="chat-room-messages">
        <p className={`chat-room-connection is-${connectionState}`} role="status">
          {connectionLabels[connectionState]}
        </p>
        {roomNotice ? (
          <p className="chat-room-room-status" role="status">
            {roomNotice}
          </p>
        ) : null}
        {loadState === 'loading' ? (
          <p className="chat-room-state" role="status">
            메시지를 불러오는 중이에요.
          </p>
        ) : null}
        {loadState === 'error' ? (
          <p className="chat-room-state is-error" role="alert">
            메시지를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
          </p>
        ) : null}
        {loadState === 'ready' && sortedMessages.length === 0 ? (
          <p className="chat-room-state" role="status">
            아직 주고받은 메시지가 없어요.
          </p>
        ) : null}
        {loadState === 'ready' && sortedMessages.length > 0 ? (
          <ol className="chat-room-message-list">
            {sortedMessages.map((message, index) => {
              const previousMessage = sortedMessages[index - 1];
              const shouldShowDate = previousMessage?.dateLabel !== message.dateLabel;

              return (
                <li key={message.id}>
                  {shouldShowDate ? <p className="chat-room-date">{message.dateLabel}</p> : null}
                  <article className={`chat-room-message is-${message.sender}`}>
                    <p>{message.content}</p>
                    <time>{message.timeLabel}</time>
                  </article>
                </li>
              );
            })}
          </ol>
        ) : null}
      </section>

      <div aria-label="메시지 작성" className="chat-room-compose">
        <label className="chat-room-visually-hidden" htmlFor="chat-message">
          메시지
        </label>
        <input
          autoComplete="off"
          id="chat-message"
          maxLength={500}
          placeholder="메시지를 입력하세요"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button disabled type="button">
          전송
        </button>
      </div>
    </>
  );
}
