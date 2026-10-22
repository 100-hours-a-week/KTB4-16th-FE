import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type {
  ChatConnectionSnapshot,
  ChatConnectionState as LiveChatConnectionState,
  ChatConnectionStopReason,
} from '../model/chatConnection.types';
import { ChatSendFailure } from '../model/chatSendFailure';
import './chatRoomContent.css';

export type ChatMessage = {
  id: string;
  clientMessageId?: string;
  userId?: number;
  sender: 'me' | 'partner';
  nickname?: string;
  voteChoice?: 'A' | 'B' | null;
  content: string;
  createdAt: string;
  deliveryState?: 'pending' | 'success' | 'failed';
};
export type ChatSystemNotice = {
  id: string;
  text: string;
  createdAt: string;
  voteChoice?: 'A' | 'B' | null;
};

export type ChatRoomLoadState =
  'loading' | 'ready' | 'error' | 'forbidden' | 'not-found' | 'server-error' | 'not-configured';
export type ChatConnectionState = LiveChatConnectionState | 'not-configured';
export type ChatRoomStatus =
  'active' | 'expired' | 'partner-left' | 'peer-waiting' | 'self-left' | 'send-blocked';
export type ChatSendHandler = (content: string) => void | Promise<void>;
export type ChatHistoryHandler = () => void | Promise<void>;

type ChatRoomContentProps = {
  chatRoomId: string;
  connectionState: ChatConnectionState;
  connectionStatus?: Omit<ChatConnectionSnapshot, 'state'>;
  onRetryConnection?: () => void;
  hasOlderMessages?: boolean;
  isLoadingOlderMessages?: boolean;
  loadState: ChatRoomLoadState;
  messages: readonly ChatMessage[];
  onLoadOlderMessages?: ChatHistoryHandler;
  onRetryLoad?: ChatHistoryHandler;
  onSendMessage?: ChatSendHandler;
  roomStatus: ChatRoomStatus;
  roomType?: 'DIRECT' | 'GROUP';
  activeParticipantCount?: number;
  systemNotices?: readonly ChatSystemNotice[];
};

const MAX_MESSAGE_LENGTH = 500;
const NEAR_BOTTOM_THRESHOLD = 72;
const HISTORY_TOP_THRESHOLD = 48;

const connectionLabels: Record<ChatConnectionState, string> = {
  idle: '연결 준비 중',
  connecting: '채팅 서버에 연결하는 중',
  connected: '연결됨',
  disconnected: '연결이 끊겼어요',
  reconnecting: '채팅 서버에 다시 연결하는 중',
  'not-configured': '실시간 채팅 연동 준비 중',
};

const stopLabels: Record<Exclude<ChatConnectionStopReason, null>, string> = {
  'retry-exhausted': '자동 연결 시도를 마쳤어요. 다시 연결해 주세요.',
  authentication: '로그인 상태를 확인해 주세요.',
  protocol: '채팅 연결을 확인하지 못했어요. 다시 시도해 주세요.',
  temporary: '잠시 연결할 수 없어요. 다시 시도해 주세요.',
};

const roomStatusLabels: Partial<Record<ChatRoomStatus, string>> = {
  expired: '이 채팅방은 만료되었어요.',
  'partner-left': '상대방이 채팅방을 나갔어요.',
  'peer-waiting': '상대방을 기다리고 있어요',
  'self-left': '이미 퇴장한 채팅방입니다.',
  'send-blocked': '현재 채팅방에서는 메시지를 보낼 수 없어요.',
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

type ChatTimelineItem =
  | { type: 'message'; key: string; createdAt: string; message: ChatMessage }
  | { type: 'notice'; key: string; createdAt: string; notice: ChatSystemNotice };

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
  connectionStatus,
  onRetryConnection,
  hasOlderMessages = false,
  isLoadingOlderMessages = false,
  loadState,
  messages,
  onLoadOlderMessages,
  onRetryLoad,
  onSendMessage,
  roomStatus,
  roomType = 'DIRECT',
  activeParticipantCount,
  systemNotices = [],
}: ChatRoomContentProps) {
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRequestingOlderMessages, setIsRequestingOlderMessages] = useState(false);
  const [historyLoadError, setHistoryLoadError] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [sendNotice, setSendNotice] = useState('');
  const isComposing = useRef(false);
  const isSendingRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendButtonRef = useRef<HTMLButtonElement>(null);
  const shouldRestoreInputFocus = useRef(false);
  const messagesRegionRef = useRef<HTMLElement>(null);
  const historySentinelRef = useRef<HTMLLIElement>(null);
  const shouldStayAtBottom = useRef(true);
  const previousMessages = useRef<ChatMessage[] | null>(null);
  const previousChatRoomId = useRef(chatRoomId);
  const roomGeneration = useRef(0);
  const prependSnapshot = useRef<ScrollSnapshot | null>(null);
  const isRequestingOlderRef = useRef(false);
  const sortedMessages = useMemo(() => sortMessages(messages), [messages]);
  const timelineItems = useMemo<ChatTimelineItem[]>(
    () =>
      [
        ...sortedMessages.map((message) => ({
          type: 'message' as const,
          key: `message:${message.id}`,
          createdAt: message.createdAt,
          message,
        })),
        ...systemNotices.map((notice) => ({
          type: 'notice' as const,
          key: `notice:${notice.id}`,
          createdAt: notice.createdAt,
          notice,
        })),
      ].sort((first, second) => Date.parse(first.createdAt) - Date.parse(second.createdAt)),
    [sortedMessages, systemNotices],
  );

  const hasTerminalLoadState =
    loadState === 'forbidden' || loadState === 'not-found' || loadState === 'server-error';
  const visibleRoomStatus: ChatRoomStatus =
    roomType === 'GROUP'
      ? roomStatus === 'self-left'
        ? 'self-left'
        : roomStatus === 'expired'
          ? 'expired'
          : (activeParticipantCount ?? 0) < 2
            ? 'peer-waiting'
            : roomStatus === 'peer-waiting'
              ? 'active'
              : roomStatus
      : roomStatus;
  const roomAllowsMessaging = visibleRoomStatus === 'active';
  const canCompose =
    loadState === 'ready' &&
    connectionState === 'connected' &&
    roomAllowsMessaging &&
    onSendMessage !== undefined;
  const trimmedDraft = draft.trim();
  const canSend =
    canCompose && trimmedDraft.length > 0 && draft.length <= MAX_MESSAGE_LENGTH && !isSending;

  useEffect(() => {
    if (isSending || !shouldRestoreInputFocus.current) return;

    shouldRestoreInputFocus.current = false;
    const activeElement = document.activeElement;
    if (
      activeElement === document.body ||
      activeElement === inputRef.current ||
      activeElement === sendButtonRef.current
    ) {
      inputRef.current?.focus();
    }
  }, [isSending]);

  /** 메시지 목록이 추가/앞쪽 삽입될 때 읽던 위치를 보존하고 하단 근처에서만 따라간다. */
  useLayoutEffect(() => {
    const region = messagesRegionRef.current;
    if (previousChatRoomId.current !== chatRoomId) {
      previousChatRoomId.current = chatRoomId;
      roomGeneration.current += 1;
      previousMessages.current = sortedMessages;
      prependSnapshot.current = null;
      shouldStayAtBottom.current = true;
      isRequestingOlderRef.current = false;
      setIsRequestingOlderMessages(false);
      setHistoryLoadError(false);
      if (region) region.scrollTop = region.scrollHeight;
      return;
    }
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
  }, [chatRoomId, sortedMessages]);

  /** 핸들러가 연결된 경우에만 전송을 시도하며 성공 메시지를 낙관적으로 목록에 추가하지 않는다. */
  async function sendDraft(restoreInputFocus = false) {
    if (!canSend || !onSendMessage || isSendingRef.current) {
      return;
    }

    shouldRestoreInputFocus.current = restoreInputFocus;
    const content = trimmedDraft;
    isSendingRef.current = true;
    setIsSending(true);
    setSendError(false);
    setSendNotice('');

    try {
      await onSendMessage(content);
      setDraft('');
      setSendNotice('메시지를 전송했어요.');
    } catch (error: unknown) {
      if (error instanceof ChatSendFailure && !error.showInlineNotice) {
        setSendError(false);
        setSendNotice('');
      } else {
        setSendError(true);
        setSendNotice(
          error instanceof ChatSendFailure
            ? error.message
            : '메시지를 보내지 못했어요. 다시 시도해 주세요.',
        );
      }
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  }

  /** 과거 메시지 요청 직전의 스크롤 좌표를 기억해 prepend 뒤 화면 위치를 유지한다. */
  const loadOlderMessages = useCallback(async () => {
    const region = messagesRegionRef.current;
    if (
      !region ||
      !hasOlderMessages ||
      isLoadingOlderMessages ||
      isRequestingOlderRef.current ||
      !onLoadOlderMessages
    ) {
      return;
    }

    isRequestingOlderRef.current = true;
    const requestGeneration = roomGeneration.current;
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
      if (requestGeneration === roomGeneration.current) {
        prependSnapshot.current = null;
        setHistoryLoadError(true);
      }
    } finally {
      if (requestGeneration === roomGeneration.current) {
        isRequestingOlderRef.current = false;
        setIsRequestingOlderMessages(false);
      }
    }
  }, [hasOlderMessages, isLoadingOlderMessages, onLoadOlderMessages]);

  useEffect(() => {
    if (!hasOlderMessages || !onLoadOlderMessages || historyLoadError) return;

    const sentinel = historySentinelRef.current;
    const region = messagesRegionRef.current;
    if (!sentinel || !region || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadOlderMessages();
      },
      { root: region, rootMargin: '48px 0px 0px', threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [chatRoomId, hasOlderMessages, historyLoadError, loadOlderMessages, onLoadOlderMessages]);

  function handleMessagesScroll(region: HTMLElement) {
    shouldStayAtBottom.current =
      region.scrollHeight - region.scrollTop - region.clientHeight <= NEAR_BOTTOM_THRESHOLD;
    if (typeof IntersectionObserver === 'undefined' && region.scrollTop <= HISTORY_TOP_THRESHOLD) {
      void loadOlderMessages();
    }
  }

  const roomNotice = roomStatusLabels[visibleRoomStatus];
  const loadNotice = loadStateLabels[loadState];
  const connectionLabel = connectionStatus?.isOffline
    ? '네트워크 연결을 기다리는 중'
    : connectionStatus?.isRefreshingToken
      ? '인증 정보를 갱신하는 중'
      : connectionState === 'reconnecting' && connectionStatus
        ? `다시 연결하는 중 (${connectionStatus.retryCount}/5)`
        : connectionLabels[connectionState];
  const stopReason = connectionStatus?.stopReason;
  const showMessages = loadState === 'ready' && !hasTerminalLoadState;
  const inputDisabled =
    loadState !== 'ready' || connectionState !== 'connected' || !roomAllowsMessaging || isSending;

  return (
    <>
      <section
        aria-label={`채팅 메시지, 채팅방 ${chatRoomId}`}
        className="chat-room-messages"
        onScroll={(event) => handleMessagesScroll(event.currentTarget)}
        ref={messagesRegionRef}
      >
        <p className={`chat-room-connection is-${connectionState}`} role="status">
          {connectionLabel}
        </p>
        {connectionState === 'disconnected' && stopReason ? (
          <div className="chat-room-recovery">
            <p>{stopLabels[stopReason]}</p>
            {stopReason !== 'authentication' && onRetryConnection ? (
              <button type="button" onClick={onRetryConnection}>
                다시 연결
              </button>
            ) : null}
          </div>
        ) : null}
        {roomType === 'GROUP' && visibleRoomStatus === 'self-left' ? (
          <div className="chat-room-terminal-overlay is-left" role="status">
            <p>이미 퇴장한 채팅방입니다.</p>
            <p>오늘은 이 채팅방에 다시 입장할 수 없어요.</p>
          </div>
        ) : null}
        {roomType === 'GROUP' && visibleRoomStatus === 'expired' ? (
          <div className="chat-room-room-status is-expired" role="status">
            <p>오늘의 채팅이 종료되었어요.</p>
          </div>
        ) : null}
        {roomNotice &&
        !(
          roomType === 'GROUP' &&
          (visibleRoomStatus === 'self-left' ||
            visibleRoomStatus === 'expired' ||
            visibleRoomStatus === 'peer-waiting')
        ) ? (
          <div
            className={`chat-room-room-status${visibleRoomStatus === 'peer-waiting' ? ' is-peer-waiting' : ''}`}
            role="status"
          >
            <p>{roomNotice}</p>
            {visibleRoomStatus === 'peer-waiting' ? (
              <p className="chat-room-room-status-detail">
                두 사람 모두 입장하면 채팅을 시작할 수 있어요.
              </p>
            ) : null}
          </div>
        ) : null}
        {roomType === 'GROUP' &&
        (activeParticipantCount ?? 0) < 2 &&
        visibleRoomStatus === 'peer-waiting' ? (
          <div className="chat-room-room-status is-peer-waiting" role="status">
            <p>현재 채팅방에 1명만 참여 중이에요.</p>
            <p className="chat-room-room-status-detail">
              다른 참여자가 입장하면 채팅을 시작할 수 있어요.
            </p>
          </div>
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
        {historyLoadError && showMessages && sortedMessages.length > 0 ? (
          <div className="chat-room-state is-error" role="alert">
            <p>이전 메시지를 불러오지 못했어요.</p>
            <button
              className="chat-room-secondary-button"
              onClick={() => void loadOlderMessages()}
              type="button"
            >
              다시 시도
            </button>
          </div>
        ) : null}
        {showMessages && visibleRoomStatus === 'active' && sortedMessages.length === 0 ? (
          <p className="chat-room-state" role="status">
            아직 주고받은 메시지가 없어요.
          </p>
        ) : null}
        {showMessages && timelineItems.length > 0 && visibleRoomStatus !== 'self-left' ? (
          <>
            <ol className="chat-room-message-list">
              {hasOlderMessages && onLoadOlderMessages ? (
                <li
                  aria-hidden="true"
                  className="chat-room-history-sentinel"
                  ref={historySentinelRef}
                >
                  {isLoadingOlderMessages || isRequestingOlderMessages ? (
                    <span className="chat-room-history-loading" role="status">
                      이전 메시지를 불러오는 중…
                    </span>
                  ) : null}
                </li>
              ) : null}
              {timelineItems.map((item, index) => {
                const formattedTime = formatMessageDateTime(item.createdAt);
                const previousItem = timelineItems[index - 1];
                const previousDate = previousItem
                  ? formatMessageDateTime(previousItem.createdAt).dateLabel
                  : undefined;
                const shouldShowDate = previousDate !== formattedTime.dateLabel;
                return (
                  <li key={item.key}>
                    {shouldShowDate ? (
                      <p className="chat-room-date">{formattedTime.dateLabel}</p>
                    ) : null}
                    {item.type === 'notice' ? (
                      <p className="chat-room-system-notice" role="status">
                        {roomType === 'GROUP' && item.notice.voteChoice ? (
                          <span
                            aria-label={`${item.notice.voteChoice} 선택`}
                            className={`chat-room-vote-dot is-${item.notice.voteChoice.toLowerCase()}`}
                          />
                        ) : null}
                        {item.notice.text}
                        <time dateTime={item.notice.createdAt}>{formattedTime.timeLabel}</time>
                      </p>
                    ) : (
                      <article className={`chat-room-message is-${item.message.sender}`}>
                        <div className="chat-room-message-body">
                          {(roomType === 'GROUP' || item.message.sender === 'partner') &&
                          item.message.nickname ? (
                            <p className="chat-room-sender-name" title={item.message.nickname}>
                              {roomType === 'GROUP' && item.message.voteChoice ? (
                                <span
                                  aria-label={`${item.message.voteChoice} 선택`}
                                  className={`chat-room-vote-dot is-${item.message.voteChoice.toLowerCase()}`}
                                />
                              ) : null}
                              <span className="chat-room-sender-label">
                                {item.message.nickname}
                              </span>
                            </p>
                          ) : null}
                          <p className="chat-room-message-content">{item.message.content}</p>
                          {item.message.deliveryState === 'pending' ? (
                            <span className="chat-room-message-delivery is-pending">전송 중</span>
                          ) : null}
                          {item.message.deliveryState === 'failed' ? (
                            <span className="chat-room-message-delivery is-failed">전송 실패</span>
                          ) : null}
                        </div>
                        <time dateTime={item.message.createdAt}>{formattedTime.timeLabel}</time>
                      </article>
                    )}
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
          void sendDraft(true);
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
          ref={inputRef}
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
            void sendDraft(true);
          }}
          placeholder={
            roomType === 'GROUP'
              ? visibleRoomStatus === 'expired'
                ? '종료된 채팅방입니다'
                : visibleRoomStatus === 'self-left'
                  ? '이미 퇴장한 채팅방입니다'
                  : visibleRoomStatus === 'peer-waiting'
                    ? '다른 참여자를 기다리고 있어요'
                    : inputDisabled
                      ? '채팅 기능 연동 후 입력할 수 있어요'
                      : '메시지를 입력하세요'
              : inputDisabled
                ? '채팅 기능 연동 후 입력할 수 있어요'
                : '메시지를 입력하세요'
          }
          rows={1}
          value={draft}
        />
        <button disabled={!canSend} ref={sendButtonRef} type="submit">
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
