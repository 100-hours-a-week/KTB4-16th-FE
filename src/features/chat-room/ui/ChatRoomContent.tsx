import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import './chatRoomContent.css';

export type ChatMessage = {
  id: string;
  sender: 'me' | 'partner';
  nickname?: string;
  content: string;
  createdAt: string;
};

export type ChatRoomLoadState =
  'loading' | 'ready' | 'error' | 'forbidden' | 'not-found' | 'server-error' | 'not-configured';
export type ChatConnectionState =
  'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'not-configured';
export type ChatRoomStatus = 'active' | 'expired' | 'partner-left' | 'self-left';
export type ChatSendHandler = (content: string) => void | Promise<void>;
export type ChatHistoryHandler = () => void | Promise<void>;

type ChatRoomContentProps = {
  chatRoomId: string;
  connectionState: ChatConnectionState;
  hasOlderMessages?: boolean;
  isLoadingOlderMessages?: boolean;
  loadState: ChatRoomLoadState;
  messages: readonly ChatMessage[];
  onLoadOlderMessages?: ChatHistoryHandler;
  onRetryLoad?: ChatHistoryHandler;
  onSendMessage?: ChatSendHandler;
  roomStatus: ChatRoomStatus;
};

const MAX_MESSAGE_LENGTH = 500;
const NEAR_BOTTOM_THRESHOLD = 72;

const connectionLabels: Record<ChatConnectionState, string> = {
  connecting: '채팅 서버에 연결하는 중',
  connected: '연결됨',
  disconnected: '연결이 끊겼어요',
  reconnecting: '채팅 서버에 다시 연결하는 중',
  'not-configured': '실시간 채팅 연동 준비 중',
};

const roomStatusLabels: Partial<Record<ChatRoomStatus, string>> = {
  expired: '이 채팅방은 만료되었어요.',
  'partner-left': '상대방이 채팅방을 나갔어요.',
  'self-left': '이미 퇴장한 채팅방입니다.',
};

const loadStateLabels: Partial<Record<ChatRoomLoadState, string>> = {
  loading: '메시지를 불러오는 중이에요.',
  error: '메시지를 불러오지 못했어요.',
  forbidden: '이 채팅방에 접근할 권한이 없어요.',
  'not-found': '채팅방을 찾을 수 없어요.',
  'server-error': '서버에 문제가 발생했어요. 잠시 후 다시 시도해 주세요.',
  'not-configured': '메시지 기능은 서버 연동 후 이용할 수 있어요.',
};

type ScrollSnapshot = {
  scrollHeight: number;
  scrollTop: number;
};

/** ISO 시각을 KST 기준 날짜/시간 라벨로 바꾸며 잘못된 값은 안전한 안내로 대체한다. */
function formatMessageDateTime(value: string): { dateLabel: string; timeLabel: string } {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { dateLabel: '날짜 정보 없음', timeLabel: '시간 정보 없음' };
  }

  return {
    dateLabel: new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date),
    timeLabel: new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date),
  };
}

/** 서버 메시지 배열의 원본 순서를 보존하면서 생성 시각 기준으로 정렬한다. */
function sortMessages(messages: readonly ChatMessage[]): ChatMessage[] {
  return [...messages].sort((first, second) => {
    const timestampDifference = Date.parse(first.createdAt) - Date.parse(second.createdAt);
    if (Number.isFinite(timestampDifference) && timestampDifference !== 0) {
      return timestampDifference;
    }
    return 0;
  });
}

/** 연결 전에도 상태, 이력, 입력 프레젠테이션을 API 핸들러와 분리해 제공한다. */
export function ChatRoomContent({
  chatRoomId,
  connectionState,
  hasOlderMessages = false,
  isLoadingOlderMessages = false,
  loadState,
  messages,
  onLoadOlderMessages,
  onRetryLoad,
  onSendMessage,
  roomStatus,
}: ChatRoomContentProps) {
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRequestingOlderMessages, setIsRequestingOlderMessages] = useState(false);
  const [historyLoadError, setHistoryLoadError] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [sendNotice, setSendNotice] = useState('');
  const isComposing = useRef(false);
  const isSendingRef = useRef(false);
  const messagesRegionRef = useRef<HTMLElement>(null);
  const shouldStayAtBottom = useRef(true);
  const previousMessages = useRef<ChatMessage[] | null>(null);
  const prependSnapshot = useRef<ScrollSnapshot | null>(null);
  const sortedMessages = useMemo(() => sortMessages(messages), [messages]);

  const hasTerminalLoadState =
    loadState === 'forbidden' || loadState === 'not-found' || loadState === 'server-error';
  const roomAllowsMessaging = roomStatus === 'active';
  const canCompose =
    loadState === 'ready' &&
    connectionState === 'connected' &&
    roomAllowsMessaging &&
    onSendMessage !== undefined;
  const trimmedDraft = draft.trim();
  const canSend =
    canCompose && trimmedDraft.length > 0 && draft.length <= MAX_MESSAGE_LENGTH && !isSending;

  /** 메시지 목록이 추가/앞쪽 삽입될 때 읽던 위치를 보존하고 하단 근처에서만 따라간다. */
  useLayoutEffect(() => {
    const region = messagesRegionRef.current;
    if (!region) {
      previousMessages.current = sortedMessages;
      return;
    }

    const previous = previousMessages.current;
    const firstMessageId = sortedMessages[0]?.id;
    const previousFirstMessageId = previous?.[0]?.id;
    const isPrepend =
      prependSnapshot.current !== null &&
      sortedMessages.length > (previous?.length ?? 0) &&
      firstMessageId !== previousFirstMessageId;

    if (isPrepend && prependSnapshot.current) {
      const heightDifference = region.scrollHeight - prependSnapshot.current.scrollHeight;
      region.scrollTop = prependSnapshot.current.scrollTop + heightDifference;
      prependSnapshot.current = null;
    } else if (!previous || shouldStayAtBottom.current) {
      region.scrollTop = region.scrollHeight;
      prependSnapshot.current = null;
    }

    previousMessages.current = sortedMessages;
  }, [sortedMessages]);

  /** 핸들러가 연결된 경우에만 전송을 시도하며 성공 메시지를 낙관적으로 목록에 추가하지 않는다. */
  async function sendDraft() {
    if (!canSend || !onSendMessage || isSendingRef.current) {
      return;
    }

    const content = trimmedDraft;
    isSendingRef.current = true;
    setIsSending(true);
    setSendError(false);
    setSendNotice('');

    try {
      await onSendMessage(content);
      setDraft('');
      setSendNotice('전송 요청이 완료되었습니다. 메시지는 서버 확인 후 표시됩니다.');
    } catch {
      setSendError(true);
      setSendNotice('메시지를 보내지 못했어요. 다시 시도해 주세요.');
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  }

  /** 과거 메시지 요청 직전의 스크롤 좌표를 기억해 prepend 뒤 화면 위치를 유지한다. */
  async function loadOlderMessages() {
    const region = messagesRegionRef.current;
    if (
      !region ||
      !hasOlderMessages ||
      isLoadingOlderMessages ||
      isRequestingOlderMessages ||
      !onLoadOlderMessages
    ) {
      return;
    }

    prependSnapshot.current = {
      scrollHeight: region.scrollHeight,
      scrollTop: region.scrollTop,
    };
    shouldStayAtBottom.current = false;
    setHistoryLoadError(false);
    setIsRequestingOlderMessages(true);
    try {
      await onLoadOlderMessages();
    } catch {
      prependSnapshot.current = null;
      setHistoryLoadError(true);
    } finally {
      setIsRequestingOlderMessages(false);
    }
  }

  const roomNotice = roomStatusLabels[roomStatus];
  const loadNotice = loadStateLabels[loadState];
  const showMessages = loadState === 'ready' && !hasTerminalLoadState;
  const inputDisabled =
    loadState !== 'ready' || connectionState !== 'connected' || !roomAllowsMessaging || isSending;

  return (
    <>
      <section
        aria-label={`채팅 메시지, 채팅방 ${chatRoomId}`}
        className="chat-room-messages"
        onScroll={(event) => {
          const region = event.currentTarget;
          shouldStayAtBottom.current =
            region.scrollHeight - region.scrollTop - region.clientHeight <= NEAR_BOTTOM_THRESHOLD;
        }}
        ref={messagesRegionRef}
      >
        <p className={`chat-room-connection is-${connectionState}`} role="status">
          {connectionLabels[connectionState]}
        </p>
        {roomNotice ? (
          <p className="chat-room-room-status" role="status">
            {roomNotice}
          </p>
        ) : null}
        {loadNotice ? (
          <div
            className={`chat-room-state${loadState === 'error' || loadState === 'server-error' ? ' is-error' : ''}`}
          >
            <p role={loadState === 'error' || loadState === 'server-error' ? 'alert' : 'status'}>
              {loadNotice}
            </p>
            {loadState === 'not-configured' ? (
              <p className="chat-room-state-detail">채팅방 ID: {chatRoomId}</p>
            ) : null}
            {onRetryLoad && (loadState === 'error' || loadState === 'server-error') ? (
              <button className="chat-room-secondary-button" onClick={onRetryLoad} type="button">
                다시 불러오기
              </button>
            ) : null}
          </div>
        ) : null}
        {historyLoadError ? (
          <p className="chat-room-state is-error" role="alert">
            이전 메시지를 불러오지 못했어요.
          </p>
        ) : null}
        {showMessages && roomStatus !== 'self-left' && sortedMessages.length === 0 ? (
          <p className="chat-room-state" role="status">
            아직 주고받은 메시지가 없어요.
          </p>
        ) : null}
        {showMessages && sortedMessages.length > 0 && roomStatus !== 'self-left' ? (
          <>
            {hasOlderMessages && onLoadOlderMessages ? (
              <button
                className="chat-room-secondary-button chat-room-history-button"
                disabled={isLoadingOlderMessages || isRequestingOlderMessages}
                onClick={() => void loadOlderMessages()}
                type="button"
              >
                {isLoadingOlderMessages || isRequestingOlderMessages
                  ? '이전 메시지를 불러오는 중…'
                  : historyLoadError
                    ? '이전 메시지 다시 불러오기'
                    : '이전 메시지 불러오기'}
              </button>
            ) : null}
            <ol className="chat-room-message-list">
              {sortedMessages.map((message, index) => {
                const formattedTime = formatMessageDateTime(message.createdAt);
                const previousMessage = sortedMessages[index - 1];
                const previousDate = previousMessage
                  ? formatMessageDateTime(previousMessage.createdAt).dateLabel
                  : undefined;
                const shouldShowDate = previousDate !== formattedTime.dateLabel;

                return (
                  <li key={message.id}>
                    {shouldShowDate ? (
                      <p className="chat-room-date">{formattedTime.dateLabel}</p>
                    ) : null}
                    <article className={`chat-room-message is-${message.sender}`}>
                      <div className="chat-room-message-body">
                        {message.sender === 'partner' && message.nickname ? (
                          <p className="chat-room-sender-name" title={message.nickname}>
                            {message.nickname}
                          </p>
                        ) : null}
                        <p className="chat-room-message-content">{message.content}</p>
                      </div>
                      <time dateTime={message.createdAt}>{formattedTime.timeLabel}</time>
                    </article>
                  </li>
                );
              })}
            </ol>
          </>
        ) : null}
      </section>

      <form
        aria-label="메시지 작성"
        className="chat-room-compose"
        onSubmit={(event) => {
          event.preventDefault();
          void sendDraft();
        }}
      >
        <label className="chat-room-visually-hidden" htmlFor="chat-message">
          메시지
        </label>
        <textarea
          autoComplete="off"
          disabled={inputDisabled}
          id="chat-message"
          maxLength={MAX_MESSAGE_LENGTH}
          onChange={(event) => {
            setDraft(event.target.value);
            setSendError(false);
            setSendNotice('');
          }}
          onCompositionEnd={() => {
            isComposing.current = false;
          }}
          onCompositionStart={() => {
            isComposing.current = true;
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey) {
              return;
            }
            if (isComposing.current || event.nativeEvent.isComposing) {
              return;
            }
            event.preventDefault();
            void sendDraft();
          }}
          placeholder={inputDisabled ? '채팅 기능 연동 후 입력할 수 있어요' : '메시지를 입력하세요'}
          rows={1}
          value={draft}
        />
        <button disabled={!canSend} type="submit">
          {isSending ? '전송 중' : '전송'}
        </button>
        <span className="chat-room-character-count" aria-live="polite">
          {draft.length}/{MAX_MESSAGE_LENGTH}
        </span>
      </form>
      {sendNotice ? (
        <p
          className={`chat-room-send-notice${sendError ? ' is-error' : ''}`}
          role={sendError ? 'alert' : 'status'}
        >
          {sendNotice}
          {sendError && canCompose ? (
            <button onClick={() => void sendDraft()} type="button">
              다시 보내기
            </button>
          ) : null}
        </p>
      ) : null}
    </>
  );
}
