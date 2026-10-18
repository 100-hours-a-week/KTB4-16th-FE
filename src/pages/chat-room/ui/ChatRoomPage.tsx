import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { useSession } from '../../../entities/session/model/useSession';
import {
  enterChatRoom,
  getChatRoomDetails,
  getChatRoomHistory,
  leaveChatRoom,
  type ChatRoomHistoryMessage,
} from '../../../features/chat-room/api/chatRoomApi';
import {
  ChatRoomContent,
  type ChatMessage,
  type ChatRoomLoadState,
  type ChatRoomStatus,
} from '../../../features/chat-room/ui/ChatRoomContent';
import { readMatchRequestUserId } from '../../../features/matching/model/matchRequestSnapshot';
import { ApiError } from '../../../shared/api/apiError';
import './chatRoomPage.css';

type ChatRoomState = {
  hasOlderMessages: boolean;
  historyErrorMessage?: string;
  isLeaving: boolean;
  isLoadingOlderMessages: boolean;
  loadErrorMessage?: string;
  loadState: ChatRoomLoadState;
  messages: ChatMessage[];
  nextCursor: string | null;
  partnerNickname?: string;
  participantCount?: number;
  roomStatus: ChatRoomStatus;
};

const initialChatRoomState: ChatRoomState = {
  hasOlderMessages: false,
  isLeaving: false,
  isLoadingOlderMessages: false,
  loadState: 'loading',
  messages: [],
  nextCursor: null,
  roomStatus: 'active',
};
const MAX_SIGNED_LONG = 9223372036854775807n;

/** API의 양의 64-bit 정수 식별자 형식에 맞는 경로 파라미터인지 확인한다. */
function isValidChatRoomId(value: string | undefined): value is string {
  if (!value || !/^\d+$/.test(value)) return false;
  try {
    const numericValue = BigInt(value);
    return numericValue > 0n && numericValue <= MAX_SIGNED_LONG;
  } catch {
    return false;
  }
}

/** 서버 이력 DTO를 프레젠테이션용 메시지로 바꾸되 식별자는 문자열로 보존한다. */
function toChatMessage(message: ChatRoomHistoryMessage, currentUserId: string): ChatMessage {
  return {
    id: String(message.chatMessageId),
    sender: String(message.userId) === currentUserId ? 'me' : 'partner',
    nickname: message.nickname,
    content: message.content,
    createdAt: message.createdAt,
  };
}

/** chatMessageId 기준으로 병합해 페이지 경계의 중복 응답을 화면에 남기지 않는다. */
function mergeMessages(
  current: readonly ChatMessage[],
  added: readonly ChatMessage[],
): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  [...current, ...added].forEach((message) => byId.set(message.id, message));
  return [...byId.values()];
}

/** Chat Server 오류를 재시도 가능 여부와 UI 상태가 드러나는 안내로 변환한다. */
function getLoadFailure(
  error: unknown,
): Pick<ChatRoomState, 'loadState' | 'loadErrorMessage' | 'roomStatus'> {
  if (!(error instanceof ApiError)) {
    return {
      loadState: 'error',
      loadErrorMessage: '네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
      roomStatus: 'active',
    };
  }
  if (error.status === 401 || error.code === 'UNAUTHORIZED') {
    return { loadState: 'unauthorized', loadErrorMessage: error.message, roomStatus: 'active' };
  }
  if (error.code === 'CHAT_ROOM_EXPIRED') {
    return { loadState: 'forbidden', loadErrorMessage: error.message, roomStatus: 'expired' };
  }
  if (error.code === 'CHAT_REENTRY_FORBIDDEN' || error.code === 'CHAT_ALREADY_LEFT') {
    return { loadState: 'forbidden', loadErrorMessage: error.message, roomStatus: 'self-left' };
  }
  if (error.status === 404 || error.code === 'CHAT_ROOM_NOT_FOUND') {
    return { loadState: 'not-found', loadErrorMessage: error.message, roomStatus: 'active' };
  }
  if (error.status === 403 || error.code === 'FORBIDDEN') {
    return { loadState: 'forbidden', loadErrorMessage: error.message, roomStatus: 'active' };
  }
  return {
    loadState: error.status === 0 ? 'error' : 'server-error',
    loadErrorMessage: error.message,
    roomStatus: 'active',
  };
}

/** 이전 메시지 요청 실패는 현재 방을 닫지 않고 해당 요청에만 안내를 표시한다. */
function getHistoryErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError))
    return '네트워크 연결을 확인한 뒤 이전 메시지를 다시 불러와 주세요.';
  if (error.code === 'INVALID_CURSOR')
    return '이전 메시지 위치가 올바르지 않아요. 채팅방을 다시 불러와 주세요.';
  return error.message;
}

/** 채팅방 진입, 이력 조회, 퇴장 REST 흐름을 기존 프레젠테이션 UI에 연결한다. */
export function ChatRoomPage() {
  const { chatRoomId } = useParams();
  const { accessToken, fetchAuthenticatedJson } = useSession();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [state, setState] = useState<ChatRoomState>(initialChatRoomState);
  const activeRequestId = useRef(0);
  const enterPromiseRef = useRef<Promise<void> | null>(null);
  const historyPromiseRef = useRef<Promise<void> | null>(null);
  const leavePromiseRef = useRef<Promise<void> | null>(null);
  const validChatRoomId = isValidChatRoomId(chatRoomId);
  const currentUserId = accessToken ? readMatchRequestUserId(accessToken) : null;

  const loadChatRoom = useCallback(async () => {
    if (!validChatRoomId || !chatRoomId || !currentUserId || enterPromiseRef.current) return;
    const requestId = ++activeRequestId.current;
    setState({ ...initialChatRoomState, loadState: 'loading' });
    const promise = (async () => {
      try {
        await enterChatRoom(fetchAuthenticatedJson, chatRoomId);
        const [details, history] = await Promise.all([
          getChatRoomDetails(fetchAuthenticatedJson, chatRoomId),
          getChatRoomHistory(fetchAuthenticatedJson, chatRoomId),
        ]);
        if (requestId !== activeRequestId.current) return;
        const partner = details.participants.find(
          (participant) => String(participant.userId) !== currentUserId,
        );
        if (!partner)
          throw new ApiError(502, '서버 응답 형식을 확인할 수 없습니다.', 'INVALID_RESPONSE');
        setState({
          hasOlderMessages: history.hasNext,
          isLeaving: false,
          isLoadingOlderMessages: false,
          loadState: 'ready',
          messages: mergeMessages(
            [],
            history.messages.map((message) => toChatMessage(message, currentUserId)),
          ),
          nextCursor: history.nextCursor,
          partnerNickname: partner.nickname,
          participantCount: details.participants.length,
          roomStatus: 'active',
        });
      } catch (error: unknown) {
        if (requestId !== activeRequestId.current) return;
        setState((current) => ({ ...current, ...getLoadFailure(error) }));
      }
    })();
    enterPromiseRef.current = promise;
    try {
      await promise;
    } finally {
      if (enterPromiseRef.current === promise) enterPromiseRef.current = null;
    }
  }, [chatRoomId, currentUserId, fetchAuthenticatedJson, validChatRoomId]);

  useEffect(() => {
    void loadChatRoom();
    return () => {
      activeRequestId.current += 1;
    };
  }, [loadChatRoom]);

  /** 서버가 발급한 cursor만 그대로 사용해 이전 이력 한 페이지를 앞에 병합한다. */
  const loadOlderMessages = useCallback(async () => {
    if (
      !validChatRoomId ||
      !chatRoomId ||
      !currentUserId ||
      !state.hasOlderMessages ||
      !state.nextCursor ||
      historyPromiseRef.current
    )
      return;
    const cursor = state.nextCursor;
    setState((current) => ({
      ...current,
      historyErrorMessage: undefined,
      isLoadingOlderMessages: true,
    }));
    const promise = getChatRoomHistory(fetchAuthenticatedJson, chatRoomId, cursor)
      .then((history) => {
        setState((current) => ({
          ...current,
          hasOlderMessages: history.hasNext,
          isLoadingOlderMessages: false,
          messages: mergeMessages(
            current.messages,
            history.messages.map((message) => toChatMessage(message, currentUserId)),
          ),
          nextCursor: history.nextCursor,
        }));
      })
      .catch((error: unknown) => {
        setState((current) => ({
          ...current,
          historyErrorMessage: getHistoryErrorMessage(error),
          isLoadingOlderMessages: false,
        }));
        throw error;
      });
    historyPromiseRef.current = promise;
    try {
      await promise;
    } finally {
      if (historyPromiseRef.current === promise) historyPromiseRef.current = null;
    }
  }, [
    chatRoomId,
    currentUserId,
    fetchAuthenticatedJson,
    state.hasOlderMessages,
    state.nextCursor,
    validChatRoomId,
  ]);

  /** 성공한 퇴장만 매칭 화면으로 이동시키며 실패하면 현재 방과 이력을 그대로 유지한다. */
  const leaveRoom = useCallback(async () => {
    if (!validChatRoomId || !chatRoomId || leavePromiseRef.current) return;
    setState((current) => ({ ...current, isLeaving: true, loadErrorMessage: undefined }));
    const promise = leaveChatRoom(fetchAuthenticatedJson, chatRoomId)
      .then(() => navigate('/matching', { replace: true }))
      .catch((error: unknown) => {
        setState((current) => ({
          ...current,
          isLeaving: false,
          loadErrorMessage:
            error instanceof ApiError
              ? error.message
              : '채팅방을 나가지 못했어요. 다시 시도해 주세요.',
        }));
      });
    leavePromiseRef.current = promise;
    try {
      await promise;
    } finally {
      if (leavePromiseRef.current === promise) leavePromiseRef.current = null;
    }
  }, [chatRoomId, fetchAuthenticatedJson, navigate, validChatRoomId]);

  if (!validChatRoomId) {
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

  return (
    <main className="chat-room-page">
      <header className="chat-room-header">
        <Link aria-label="취향 투표로 돌아가기" className="chat-room-back-button" to="/matching">
          ‹
        </Link>
        <div className="chat-room-title" title={state.partnerNickname}>
          <div className="chat-room-title-copy">
            <h1>채팅방</h1>
            <p className="chat-room-partner">
              {state.partnerNickname ?? '상대방 정보는 연동 후 표시됩니다.'}
            </p>
            <p className="chat-room-meta">
              {state.participantCount !== undefined
                ? `참여자 ${state.participantCount}명`
                : '참여자 정보 대기 중'}
              <span aria-hidden="true"> · </span>종료 시간 대기 중
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
              <button
                disabled={state.isLeaving}
                onClick={() => void leaveRoom()}
                role="menuitem"
                type="button"
              >
                {state.isLeaving ? '채팅방 나가는 중…' : '채팅방 나가기'}
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <ChatRoomContent
        chatRoomId={chatRoomId}
        connectionState="not-configured"
        hasOlderMessages={state.hasOlderMessages}
        historyErrorMessage={state.historyErrorMessage}
        isLoadingOlderMessages={state.isLoadingOlderMessages}
        loadErrorMessage={state.loadErrorMessage}
        loadState={state.loadState}
        messages={state.messages}
        onLoadOlderMessages={loadOlderMessages}
        onRetryLoad={
          state.loadState === 'error' || state.loadState === 'server-error'
            ? loadChatRoom
            : undefined
        }
        roomStatus={state.roomStatus}
      />
    </main>
  );
}
