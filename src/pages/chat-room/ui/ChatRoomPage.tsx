import { useState } from 'react';
import { Link, useParams } from 'react-router';

import {
  ChatRoomContent,
  type ChatMessage,
  type ChatHistoryHandler,
  type ChatConnectionState,
  type ChatRoomLoadState,
  type ChatRoomStatus,
  type ChatSendHandler,
} from '../../../features/chat-room/ui/ChatRoomContent';
import './chatRoomPage.css';

export type ChatRoomHeaderInfo = {
  partnerNickname?: string;
  participantCount?: number;
  expiresAt?: string;
};

type ChatRoomPageProps = {
  connectionState?: ChatConnectionState;
  hasOlderMessages?: boolean;
  isLoadingOlderMessages?: boolean;
  loadState?: ChatRoomLoadState;
  messages?: readonly ChatMessage[];
  onLoadOlderMessages?: ChatHistoryHandler;
  onRetryLoad?: ChatHistoryHandler;
  onSendMessage?: ChatSendHandler;
  roomInfo?: ChatRoomHeaderInfo;
  roomStatus?: ChatRoomStatus;
};

const DEFAULT_LOAD_STATE: ChatRoomLoadState = 'not-configured';
const DEFAULT_CONNECTION_STATE: ChatConnectionState = 'not-configured';
const DEFAULT_ROOM_STATUS: ChatRoomStatus = 'active';
const MAX_SIGNED_LONG = 9223372036854775807n;

/** API의 양의 64-bit 정수 식별자 형식에 맞는 경로 파라미터인지 확인한다. */
function isValidChatRoomId(value: string | undefined): value is string {
  if (!value || !/^\d+$/.test(value)) {
    return false;
  }

  try {
    const numericValue = BigInt(value);
    return numericValue > 0n && numericValue <= MAX_SIGNED_LONG;
  } catch {
    return false;
  }
}

/** KST 기준 만료 시각 표시 문자열을 만든다. */
function formatExpiration(expiresAt: string | undefined): string | undefined {
  if (!expiresAt) {
    return undefined;
  }

  const parsedDate = new Date(expiresAt);
  if (Number.isNaN(parsedDate.getTime())) {
    return undefined;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsedDate);
}

/** 채팅방 route id를 검증하고, API 연결 전에는 비활성 프레젠테이션 UI를 제공한다. */
export function ChatRoomPage({
  connectionState = DEFAULT_CONNECTION_STATE,
  hasOlderMessages,
  isLoadingOlderMessages,
  loadState = DEFAULT_LOAD_STATE,
  messages = [],
  onLoadOlderMessages,
  onRetryLoad,
  onSendMessage,
  roomInfo,
  roomStatus = DEFAULT_ROOM_STATUS,
}: ChatRoomPageProps = {}) {
  const { chatRoomId } = useParams();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (!isValidChatRoomId(chatRoomId)) {
    return (
      <main className="chat-room-page chat-room-invalid-page">
        <section className="chat-room-terminal-state" role="alert">
          <h1>채팅방에 접근할 수 없어요.</h1>
          <p>채팅방 주소를 확인한 뒤 다시 시도해 주세요.</p>
          <Link to="/matching">취향 투표로 돌아가기</Link>
        </section>
      </main>
    );
  }

  const expirationLabel = formatExpiration(roomInfo?.expiresAt);

  return (
    <main className="chat-room-page">
      <header className="chat-room-header">
        <Link aria-label="취향 투표로 돌아가기" className="chat-room-back-button" to="/matching">
          ‹
        </Link>
        <div className="chat-room-title" title={roomInfo?.partnerNickname}>
          <div className="chat-room-title-copy">
            <h1>채팅방</h1>
            <p className="chat-room-partner">
              {roomInfo?.partnerNickname ?? '상대방 정보는 연동 후 표시됩니다.'}
            </p>
            <p className="chat-room-meta">
              {roomInfo?.participantCount !== undefined
                ? `참여자 ${roomInfo.participantCount}명`
                : '참여자 정보 대기 중'}
              <span aria-hidden="true"> · </span>
              {expirationLabel ? `종료 ${expirationLabel}` : '종료 시간 대기 중'}
            </p>
          </div>
        </div>
        <div className="chat-room-menu-container">
          <button
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
            aria-label="채팅방 메뉴"
            className="chat-room-menu"
            onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
            type="button"
          >
            ⋮
          </button>
          {isMenuOpen ? (
            <div className="chat-room-menu-popover" role="menu">
              <button disabled role="menuitem" type="button">
                채팅방 나가기 (연동 준비 중)
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <ChatRoomContent
        chatRoomId={chatRoomId}
        connectionState={connectionState}
        hasOlderMessages={hasOlderMessages}
        isLoadingOlderMessages={isLoadingOlderMessages}
        loadState={loadState}
        messages={messages}
        onLoadOlderMessages={onLoadOlderMessages}
        onRetryLoad={onRetryLoad}
        onSendMessage={onSendMessage}
        roomStatus={roomStatus}
      />
    </main>
  );
}
