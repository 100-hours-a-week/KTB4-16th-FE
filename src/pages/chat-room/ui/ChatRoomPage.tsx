import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';

import { useSession } from '../../../entities/session/model/useSession';
import { getMyProfile } from '../../../features/user-profile/api/userProfileApi';
import { ApiError } from '../../../shared/api/apiError';
import {
  enterChatRoom,
  getChatRoomDetail,
  getChatRoomMessageHistory,
  leaveChatRoom,
  type ChatRoomDetail,
  type ChatRoomMessageHistory,
  type ChatRoomMessageRecord,
} from '../../../features/chat-room/api/chatRoomApi';
import { useChatConnection } from '../../../features/chat-room/model/useChatConnection';
import type { ChatDestination } from '../../../features/chat-room/model/chatConnection.types';
import { ChatSendFailure } from '../../../features/chat-room/model/chatSendFailure';
import {
  ChatRoomContent,
  type ChatMessage,
  type ChatSystemNotice,
  type ChatHistoryHandler,
  type ChatConnectionState,
  type ChatRoomLoadState,
  type ChatRoomStatus,
  type ChatSendHandler,
} from '../../../features/chat-room/ui/ChatRoomContent';
import './chatRoomPage.css';

export type ChatRoomHeaderInfo = {
  roomType?: 'DIRECT' | 'GROUP';
  roomSequence?: number | null;
  partnerNickname?: string;
  participantCount?: number;
  admittedParticipantCount?: number;
  capacity?: number;
  expiresAt?: string;
};

type ChatRoomPageProps = {
  embeddedRoomId?: string;
  expanded?: boolean;
  inlineMode?: boolean;
  onLeaveSuccess?: () => void;
  onRoomSnapshotInvalidated?: (chatRoomId: string) => void;
  onToggleExpanded?: (expanded: boolean) => void;
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
const DEFAULT_ROOM_STATUS: ChatRoomStatus = 'active';
const MAX_SIGNED_LONG = 9223372036854775807n;
const MESSAGE_ACK_TIMEOUT_MS = 20_000;

type PendingMessage = {
  content: string;
  resolve: () => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

type StompMessage = {
  type: 'MESSAGE';
  chatRoomId: number;
  chatMessageId: number;
  clientMessageId: string;
  userId: number;
  content: string;
  createdAt: string;
  voteChoice?: 'A' | 'B' | null;
};

type StompMessageError = {
  code: string;
  message: string;
  clientMessageId: string | null;
};

type ParticipantLeftEvent = {
  type: 'PARTICIPANT_LEFT';
  chatRoomId: number;
  userId: number;
  nickname: string;
  leftAt: string;
};

type ParticipantJoinedEvent = {
  type: 'PARTICIPANT_JOINED';
  chatRoomId: number;
  userId: number;
  nickname: string;
  voteChoice: 'A' | 'B';
  activeParticipantCount: number;
  occurredAt: string;
};

type ParticipantNicknameChangedEvent = {
  type: 'PARTICIPANT_NICKNAME_CHANGED';
  chatRoomId: number;
  userId: number;
  nickname: string;
};

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

/** 최신 채팅 UI의 입력 계약을 유지하면서 인증된 화면 수명에 실제 연결을 조립한다. */
export function ChatRoomPage({
  embeddedRoomId,
  expanded = false,
  inlineMode = false,
  onLeaveSuccess,
  onRoomSnapshotInvalidated,
  onToggleExpanded,
  connectionState,
  hasOlderMessages,
  isLoadingOlderMessages: suppliedIsLoadingOlderMessages,
  loadState: suppliedLoadState,
  messages: suppliedMessages,
  onLoadOlderMessages,
  onRetryLoad,
  onSendMessage,
  roomInfo,
  roomStatus: suppliedRoomStatus,
}: ChatRoomPageProps = {}) {
  const { chatRoomId: routeChatRoomId } = useParams();
  const chatRoomId = embeddedRoomId ?? routeChatRoomId;
  const location = useLocation();
  const navigate = useNavigate();
  const {
    isAuthenticated,
    isSessionRestoring,
    sessionVersion,
    getAccessToken,
    refreshAccessToken,
    clearSession,
    fetchAuthenticatedJson,
  } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLeaveConfirmationOpen, setIsLeaveConfirmationOpen] = useState(false);
  const [loadedRoom, setLoadedRoom] = useState<{
    chatRoomId: string;
    detail: ChatRoomDetail;
    history: ChatRoomMessageHistory;
    messages: ChatMessage[];
    systemNotices: ChatSystemNotice[];
    roomInfo: ChatRoomHeaderInfo;
    currentUserId: number;
  } | null>(null);
  const [loadResult, setLoadResult] = useState<{
    chatRoomId: string | undefined;
    state: ChatRoomLoadState;
  }>({
    chatRoomId: undefined,
    state: isAuthenticated && !isSessionRestoring ? 'loading' : DEFAULT_LOAD_STATE,
  });
  const [roomResult, setRoomResult] = useState<{
    chatRoomId: string | undefined;
    status: ChatRoomStatus;
  }>({ chatRoomId: undefined, status: DEFAULT_ROOM_STATUS });
  const [isRequestingOlderPage, setIsRequestingOlderPage] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [transportError, setTransportError] = useState('');
  const pendingMessages = useRef(new Map<string, PendingMessage>());
  const leaveMenuButtonRef = useRef<HTMLButtonElement>(null);
  const cancelLeaveButtonRef = useRef<HTMLButtonElement>(null);
  const leaveInFlightRef = useRef(false);
  const retryIdsByContent = useRef(new Map<string, string>());
  const currentRoom = useRef<{ chatRoomId: string | undefined; loadedRoom: typeof loadedRoom }>({
    chatRoomId,
    loadedRoom,
  });
  const frameHandler = useRef<(destination: ChatDestination, body: string) => void>(
    () => undefined,
  );
  const handledRoomEvents = useRef(new Set<string>());

  useEffect(() => {
    if (!isLeaveConfirmationOpen) return;

    const menuButton = leaveMenuButtonRef.current;
    cancelLeaveButtonRef.current?.focus();
    return () => {
      if (menuButton?.isConnected) menuButton.focus();
    };
  }, [isLeaveConfirmationOpen]);

  useEffect(() => {
    if (!isLeaveConfirmationOpen) return;

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLeaving) {
        event.preventDefault();
        setIsLeaveConfirmationOpen(false);
      }
    };

    document.addEventListener('keydown', handleDialogKeyDown);
    return () => document.removeEventListener('keydown', handleDialogKeyDown);
  }, [isLeaveConfirmationOpen, isLeaving]);
  const validRoomId = isValidChatRoomId(chatRoomId);
  const hasInjectedRoomData =
    suppliedLoadState !== undefined ||
    suppliedMessages !== undefined ||
    roomInfo !== undefined ||
    suppliedRoomStatus !== undefined ||
    hasOlderMessages !== undefined ||
    suppliedIsLoadingOlderMessages !== undefined;
  // 외부 소유 연결 상태가 주입된 화면에는 별도 소켓을 중복 생성하지 않는다.
  const ownsConnection = connectionState === undefined;
  const onFrame = useCallback((destination: ChatDestination, body: string) => {
    frameHandler.current(destination, body);
  }, []);
  const { connection, retryConnection, publish } = useChatConnection({
    enabled:
      ownsConnection &&
      validRoomId &&
      isAuthenticated &&
      !isSessionRestoring &&
      (loadedRoom?.chatRoomId === chatRoomId || hasInjectedRoomData),
    sessionVersion,
    getAccessToken,
    refreshAccessToken,
    onFrame,
  });

  /** 재연결 또는 GROUP 입퇴장 후 상세 응답으로 최신 참가자 상태와 닉네임을 반영한다. */
  const refreshRoomDetail = useCallback(
    async (requestedRoomId: string): Promise<ChatRoomDetail | null> => {
      try {
        const detail = await getChatRoomDetail(fetchAuthenticatedJson, requestedRoomId);
        setLoadedRoom((current) => {
          if (!current || current.chatRoomId !== requestedRoomId) return current;
          const partner = detail.participants.find(
            (participant) => participant.userId !== current.currentUserId,
          );
          return {
            ...current,
            detail,
            roomInfo: roomInfoFromDetail(detail, partner?.nickname),
            messages: current.messages.map((message) => {
              const participant = detail.participants.find(
                (item) => item.userId === message.userId,
              );
              return participant ? withCurrentParticipant(message, participant) : message;
            }),
          };
        });
        const activeRoom = currentRoom.current.loadedRoom;
        if (!activeRoom || activeRoom.chatRoomId !== requestedRoomId) return null;
        const currentUserId = activeRoom.currentUserId;
        const hasLeftPartner =
          detail.roomType === 'DIRECT' &&
          detail.participants.some(
            (participant) => participant.userId !== currentUserId && participant.hasLeft,
          );
        setRoomResult({
          chatRoomId: requestedRoomId,
          status:
            detail.roomType === 'GROUP'
              ? groupRoomStatus(detail, currentUserId)
              : hasLeftPartner
                ? 'partner-left'
                : 'active',
        });
        setTransportError('');
        return detail;
      } catch (error: unknown) {
        if (error instanceof ApiError && error.code === 'CHAT_ROOM_EXPIRED') {
          setRoomResult((current) =>
            current.chatRoomId === requestedRoomId && current.status === 'self-left'
              ? current
              : { chatRoomId: requestedRoomId, status: 'expired' },
          );
          setTransportError('');
          return null;
        }
        if (
          error instanceof ApiError &&
          (error.code === 'CHAT_ALREADY_LEFT' ||
            error.code === 'CHAT_ALREADY_LEFT_FORBIDDEN' ||
            error.code === 'CHAT_REENTRY_FORBIDDEN')
        ) {
          setRoomResult({ chatRoomId: requestedRoomId, status: 'self-left' });
          setTransportError('');
          return null;
        }
        setTransportError('참가자 정보를 새로고침하지 못했어요. 잠시 후 다시 확인해 주세요.');
        return null;
      }
    },
    [fetchAuthenticatedJson],
  );

  const settlePendingMessage = useCallback(
    (
      clientMessageId: string,
      status: 'failed',
      errorMessage: string,
      reuseIdOnRetry = true,
      showInlineNotice = true,
    ) => {
      const pending = pendingMessages.current.get(clientMessageId);
      if (!pending) return;
      clearTimeout(pending.timeoutId);
      pendingMessages.current.delete(clientMessageId);
      if (reuseIdOnRetry) retryIdsByContent.current.set(pending.content, clientMessageId);
      else retryIdsByContent.current.delete(pending.content);
      setLoadedRoom((current) =>
        current
          ? {
              ...current,
              messages: current.messages.map((message) =>
                message.clientMessageId === clientMessageId
                  ? { ...message, deliveryState: status }
                  : message,
              ),
            }
          : current,
      );
      pending.reject(new ChatSendFailure(errorMessage, showInlineNotice));
    },
    [],
  );

  useEffect(() => {
    currentRoom.current = { chatRoomId, loadedRoom };
  }, [chatRoomId, loadedRoom]);

  useEffect(() => {
    if (!loadedRoom || loadedRoom.detail.roomType !== 'GROUP') return;
    const expiresAt = Date.parse(loadedRoom.detail.expiresAt);
    if (!Number.isFinite(expiresAt)) return;

    const timeoutId = setTimeout(
      () => {
        setRoomResult((current) =>
          current.chatRoomId === loadedRoom.chatRoomId && current.status !== 'self-left'
            ? { chatRoomId: loadedRoom.chatRoomId, status: 'expired' }
            : current,
        );
      },
      Math.max(0, expiresAt - Date.now()),
    );
    return () => clearTimeout(timeoutId);
  }, [loadedRoom]);

  useEffect(() => {
    frameHandler.current = (destination, body) => {
      let frame: unknown;
      try {
        frame = JSON.parse(body) as unknown;
      } catch {
        setTransportError('채팅 서버 응답을 확인할 수 없어요.');
        return;
      }

      if (!isRecord(frame)) {
        setTransportError('채팅 서버 응답을 확인할 수 없어요.');
        return;
      }

      const activeRoom = currentRoom.current.loadedRoom;
      const activeRoomId = currentRoom.current.chatRoomId;
      if (destination === '/user/queue/chat-messages') {
        const message = parseStompMessage(frame);
        if (!message || String(message.chatRoomId) !== activeRoomId) return;
        const loaded = activeRoom?.chatRoomId === activeRoomId ? activeRoom : null;
        if (!loaded) return;

        const participant = loaded.detail.participants.find(
          (item) => item.userId === message.userId,
        );
        const mapped: ChatMessage = {
          id: String(message.chatMessageId),
          clientMessageId: message.clientMessageId,
          userId: message.userId,
          sender: message.userId === loaded.currentUserId ? 'me' : 'partner',
          nickname: participant?.nickname,
          voteChoice: message.voteChoice ?? participant?.voteChoice,
          content: message.content,
          createdAt: message.createdAt,
          deliveryState: 'success',
        };
        setLoadedRoom((current) => {
          if (!current || current.chatRoomId !== activeRoomId) return current;
          const existingIndex = current.messages.findIndex(
            (item) => item.id === mapped.id || item.clientMessageId === message.clientMessageId,
          );
          if (existingIndex < 0) return { ...current, messages: [...current.messages, mapped] };
          const messages = [...current.messages];
          messages[existingIndex] = mapped;
          return { ...current, messages };
        });

        const pending = pendingMessages.current.get(message.clientMessageId);
        if (pending) {
          clearTimeout(pending.timeoutId);
          pendingMessages.current.delete(message.clientMessageId);
          retryIdsByContent.current.delete(pending.content);
          pending.resolve();
        }
        setTransportError('');
        return;
      }

      if (destination === '/user/queue/chat-errors') {
        const error = parseStompMessageError(frame);
        if (!error) {
          setTransportError('메시지 처리 결과를 확인할 수 없어요.');
          return;
        }
        const message = errorMessageForCode(error.code);
        const correlatedPendingId = error.clientMessageId
          ? pendingMessages.current.has(error.clientMessageId)
            ? error.clientMessageId
            : null
          : pendingMessages.current.size === 1
            ? pendingMessages.current.keys().next().value
            : null;
        if (error.code === 'CHAT_ROOM_EXPIRED' && activeRoomId) {
          setRoomResult((current) =>
            activeRoom?.detail.roomType === 'GROUP' && current.status === 'self-left'
              ? current
              : { chatRoomId: activeRoomId, status: 'expired' },
          );
        } else if (error.code === 'CHAT_PEER_NOT_JOINED' && activeRoomId && correlatedPendingId) {
          setRoomResult({ chatRoomId: activeRoomId, status: 'peer-waiting' });
        } else if (error.code === 'CHAT_SEND_FORBIDDEN' && activeRoomId) {
          setRoomResult({ chatRoomId: activeRoomId, status: 'send-blocked' });
        }
        if (correlatedPendingId) {
          settlePendingMessage(
            correlatedPendingId,
            'failed',
            message,
            error.code !== 'CLIENT_MESSAGE_ID_CONFLICT',
            error.code !== 'CHAT_PEER_NOT_JOINED' && error.code !== 'CHAT_ROOM_EXPIRED',
          );
        } else if (error.code !== 'CHAT_PEER_NOT_JOINED') {
          setTransportError(message);
        }
        return;
      }

      if (destination === '/user/queue/chat-events') {
        const nicknameChanged = parseParticipantNicknameChangedEvent(frame);
        if (nicknameChanged) {
          if (
            String(nicknameChanged.chatRoomId) !== activeRoomId ||
            activeRoom?.chatRoomId !== activeRoomId
          )
            return;
          setLoadedRoom((current) => {
            if (!current || current.chatRoomId !== activeRoomId) return current;
            const participant = current.detail.participants.find(
              (item) => item.userId === nicknameChanged.userId,
            );
            if (!participant || participant.nickname === nicknameChanged.nickname) return current;
            const participants = current.detail.participants.map((item) =>
              item.userId === nicknameChanged.userId
                ? { ...item, nickname: nicknameChanged.nickname }
                : item,
            );
            const detail = { ...current.detail, participants };
            const partner = participants.find((item) => item.userId !== current.currentUserId);
            return {
              ...current,
              detail,
              roomInfo: roomInfoFromDetail(detail, partner?.nickname),
              messages: current.messages.map((message) =>
                message.userId === nicknameChanged.userId
                  ? { ...message, nickname: nicknameChanged.nickname }
                  : message,
              ),
            };
          });
          return;
        }

        const joined = parseParticipantJoinedEvent(frame);
        const left = parseParticipantLeftEvent(frame);
        const event = joined ?? left;
        if (
          !event ||
          String(event.chatRoomId) !== activeRoomId ||
          activeRoom?.chatRoomId !== activeRoomId
        )
          return;
        if (event.userId === activeRoom.currentUserId) return;
        if (activeRoom.detail.roomType === 'DIRECT') {
          if (left) setRoomResult({ chatRoomId: activeRoomId, status: 'partner-left' });
          return;
        }
        const occurredAt = joined?.occurredAt ?? left?.leftAt;
        if (!occurredAt) return;
        const eventKey = `${event.type}:${event.chatRoomId}:${event.userId}:${occurredAt}`;
        if (handledRoomEvents.current.has(eventKey)) return;
        handledRoomEvents.current.add(eventKey);
        const eventParticipant = activeRoom.detail.participants.find(
          (participant) => participant.userId === event.userId,
        );
        const notice: ChatSystemNotice = {
          id: eventKey,
          text: joined
            ? `${joined.nickname}님이 입장했습니다.`
            : `${left?.nickname ?? ''}님이 퇴장했습니다.`,
          createdAt: occurredAt,
          voteChoice: joined?.voteChoice ?? eventParticipant?.voteChoice,
        };
        setLoadedRoom((current) =>
          current && current.chatRoomId === activeRoomId
            ? { ...current, systemNotices: [...current.systemNotices, notice] }
            : current,
        );
        void refreshRoomDetail(activeRoomId);
      }
    };
  }, [refreshRoomDetail, settlePendingMessage]);

  const previousConnectionState = useRef(connection.state);
  useEffect(() => {
    const previousState = previousConnectionState.current;
    previousConnectionState.current = connection.state;
    if (
      connection.state !== 'connected' ||
      (previousState !== 'reconnecting' && previousState !== 'disconnected') ||
      loadedRoom?.chatRoomId !== chatRoomId ||
      !chatRoomId
    ) {
      return;
    }

    void refreshRoomDetail(chatRoomId)
      .then((detail) => {
        if (!detail) return;
        return getChatRoomMessageHistory(fetchAuthenticatedJson, chatRoomId).then((history) => {
          setLoadedRoom((current) => {
            if (!current || current.chatRoomId !== chatRoomId) return current;
            const merged = new Map(
              current.messages.map((message) => [
                message.id,
                withCurrentParticipants(message, detail),
              ]),
            );
            for (const record of history.messages) {
              const message = mapMessage(record, current.currentUserId, detail);
              const duplicate = [...merged.entries()].find(
                ([, existing]) => existing.clientMessageId === message.clientMessageId,
              );
              if (duplicate) merged.delete(duplicate[0]);
              merged.set(message.id, message);
            }
            return { ...current, detail, messages: [...merged.values()] };
          });
        });
      })
      .catch(() => setTransportError('연결이 복구되었지만 최신 정보를 불러오지 못했어요.'));
  }, [
    chatRoomId,
    connection.state,
    fetchAuthenticatedJson,
    loadedRoom?.chatRoomId,
    refreshRoomDetail,
  ]);

  useEffect(
    () => () => {
      for (const [clientMessageId, pending] of pendingMessages.current) {
        clearTimeout(pending.timeoutId);
        pending.reject(new ChatSendFailure('채팅 화면을 나가 메시지 확인이 중단되었어요.'));
        pendingMessages.current.delete(clientMessageId);
      }
      retryIdsByContent.current.clear();
    },
    [chatRoomId],
  );

  useEffect(() => {
    if (
      hasInjectedRoomData ||
      !validRoomId ||
      !chatRoomId ||
      !isAuthenticated ||
      isSessionRestoring
    ) {
      return;
    }

    const requestedRoomId = chatRoomId;
    const controller = new AbortController();
    let isCurrent = true;

    async function loadRoom(): Promise<void> {
      try {
        await enterChatRoom(fetchAuthenticatedJson, requestedRoomId, controller.signal);
        const [profile, detail, history] = await Promise.all([
          getMyProfile(fetchAuthenticatedJson),
          getChatRoomDetail(fetchAuthenticatedJson, requestedRoomId, controller.signal),
          getChatRoomMessageHistory(
            fetchAuthenticatedJson,
            requestedRoomId,
            undefined,
            controller.signal,
          ),
        ]);
        const self = detail.participants.find(
          (participant) => participant.userId === profile.userId,
        );
        const partner = detail.participants.find(
          (participant) => participant.userId !== profile.userId,
        );
        if (!self || (detail.roomType === 'DIRECT' && !partner)) {
          throw new ApiError(502, '채팅방 참가자 정보를 확인할 수 없습니다.', 'INVALID_RESPONSE');
        }

        if (!isCurrent) return;
        setLoadedRoom({
          chatRoomId: requestedRoomId,
          detail,
          history,
          messages: history.messages.map((message) => mapMessage(message, profile.userId, detail)),
          systemNotices: [],
          roomInfo: roomInfoFromDetail(detail, partner?.nickname),
          currentUserId: profile.userId,
        });
        setRoomResult({
          chatRoomId: requestedRoomId,
          status:
            detail.roomType === 'GROUP'
              ? groupRoomStatus(detail, profile.userId)
              : partner?.hasLeft
                ? 'partner-left'
                : 'active',
        });
        setLoadResult({ chatRoomId: requestedRoomId, state: 'ready' });
      } catch (error: unknown) {
        if (!isCurrent || controller.signal.aborted) return;
        let nextLoadState: ChatRoomLoadState = 'error';
        let nextRoomStatus: ChatRoomStatus = 'active';
        if (error instanceof ApiError) {
          if (isSnapshotInvalidatingError(error.code)) {
            onRoomSnapshotInvalidated?.(requestedRoomId);
          }
          if (error.code === 'CHAT_ROOM_EXPIRED') {
            nextRoomStatus = 'expired';
            nextLoadState = 'ready';
          } else if (
            error.code === 'CHAT_REENTRY_FORBIDDEN' ||
            error.code === 'CHAT_ALREADY_LEFT' ||
            error.code === 'CHAT_ALREADY_LEFT_FORBIDDEN'
          ) {
            nextRoomStatus = 'self-left';
            nextLoadState = 'ready';
          } else if (error.status === 404 || error.code === 'CHAT_ROOM_NOT_FOUND') {
            nextLoadState = 'not-found';
          } else if (error.status === 403) {
            nextLoadState = 'forbidden';
          } else if (error.status >= 500) {
            nextLoadState = 'server-error';
          }
        }
        setRoomResult((current) =>
          current.chatRoomId === requestedRoomId &&
          current.status === 'self-left' &&
          nextRoomStatus !== 'self-left'
            ? current
            : { chatRoomId: requestedRoomId, status: nextRoomStatus },
        );
        setLoadResult({ chatRoomId: requestedRoomId, state: nextLoadState });
      }
    }

    void loadRoom();
    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [
    chatRoomId,
    fetchAuthenticatedJson,
    hasInjectedRoomData,
    isAuthenticated,
    isSessionRestoring,
    onRoomSnapshotInvalidated,
    retryKey,
    validRoomId,
  ]);

  const loadOlderMessages = useCallback(async () => {
    const requestedRoomId = chatRoomId;
    if (
      !loadedRoom ||
      loadedRoom.chatRoomId !== requestedRoomId ||
      !loadedRoom.history.hasNext ||
      !loadedRoom.history.nextCursor ||
      !requestedRoomId
    )
      return;
    const history = await getChatRoomMessageHistory(
      fetchAuthenticatedJson,
      requestedRoomId,
      loadedRoom.history.nextCursor,
    );
    const existingIds = new Set(loadedRoom.messages.map((message) => message.id));
    const existingClientMessageIds = new Set(
      loadedRoom.messages.flatMap((message) =>
        message.clientMessageId ? [message.clientMessageId] : [],
      ),
    );
    const olderMessages = history.messages
      .map((message) => mapMessage(message, loadedRoom.currentUserId, loadedRoom.detail))
      .filter(
        (message) =>
          !existingIds.has(message.id) &&
          (!message.clientMessageId || !existingClientMessageIds.has(message.clientMessageId)),
      );
    setLoadedRoom((current) =>
      current?.chatRoomId === requestedRoomId
        ? {
            ...current,
            history,
            messages: [...olderMessages, ...current.messages],
          }
        : current,
    );
  }, [chatRoomId, fetchAuthenticatedJson, loadedRoom]);

  async function handleLoadOlderMessages(): Promise<void> {
    if (isRequestingOlderPage) return;
    setIsRequestingOlderPage(true);
    try {
      await loadOlderMessages();
    } finally {
      setIsRequestingOlderPage(false);
    }
  }

  async function handleLeaveRoom(): Promise<void> {
    if (!validRoomId || !chatRoomId || leaveInFlightRef.current) return;
    leaveInFlightRef.current = true;
    setIsLeaving(true);
    setLeaveError('');
    try {
      await leaveChatRoom(fetchAuthenticatedJson, chatRoomId);
      if (inlineMode) {
        onLeaveSuccess?.();
      } else {
        navigate('/matching', { replace: true });
      }
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === 'CHAT_ROOM_EXPIRED') {
        setRoomResult({ chatRoomId, status: 'expired' });
        setLeaveError('만료된 채팅방에서는 퇴장할 수 없습니다.');
      } else if (error instanceof ApiError && error.code === 'CHAT_ALREADY_LEFT') {
        setRoomResult({ chatRoomId, status: 'self-left' });
        setLeaveError('이미 퇴장한 채팅방입니다.');
      } else {
        setLeaveError('채팅방에서 나가지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
      setIsLeaveConfirmationOpen(false);
    } finally {
      leaveInFlightRef.current = false;
      setIsLeaving(false);
    }
  }

  const activeLoadedRoom = loadedRoom?.chatRoomId === chatRoomId ? loadedRoom : null;
  const resolvedLoadState =
    suppliedLoadState ??
    (loadResult.chatRoomId === chatRoomId
      ? loadResult.state
      : isAuthenticated && !isSessionRestoring
        ? 'loading'
        : DEFAULT_LOAD_STATE);
  const resolvedMessages = suppliedMessages ?? activeLoadedRoom?.messages ?? [];
  const resolvedRoomInfo =
    roomInfo ?? activeLoadedRoom?.roomInfo ?? roomInfoFromNavigationState(location.state);
  const resolvedRoomStatus =
    suppliedRoomStatus ??
    (roomResult.chatRoomId === chatRoomId ? roomResult.status : DEFAULT_ROOM_STATUS);
  const resolvedHasOlderMessages = hasOlderMessages ?? activeLoadedRoom?.history.hasNext ?? false;
  const resolvedIsLoadingOlderMessages = suppliedIsLoadingOlderMessages ?? isRequestingOlderPage;
  const canLeaveRoom =
    !hasInjectedRoomData &&
    resolvedLoadState === 'ready' &&
    (resolvedRoomStatus === 'active' ||
      (activeLoadedRoom?.detail.roomType === 'GROUP' && resolvedRoomStatus === 'peer-waiting'));

  async function sendMessage(content: string): Promise<void> {
    if (
      !validRoomId ||
      !chatRoomId ||
      !activeLoadedRoom ||
      connection.state !== 'connected' ||
      resolvedRoomStatus !== 'active'
    ) {
      throw new ChatSendFailure('연결된 채팅방에서만 메시지를 보낼 수 있어요.');
    }
    if (
      activeLoadedRoom.detail.roomType === 'GROUP' &&
      activeLoadedRoom.detail.activeParticipantCount < 2
    ) {
      throw new ChatSendFailure('다른 참가자가 입장하면 채팅을 시작할 수 있어요.');
    }
    if (content.trim().length === 0 || content.length > 500) {
      throw new ChatSendFailure('메시지는 공백이 아닌 1~500자로 입력해 주세요.');
    }

    const clientMessageId = retryIdsByContent.current.get(content) ?? crypto.randomUUID();
    if (pendingMessages.current.has(clientMessageId)) return;
    setTransportError('');
    const pendingMessage: ChatMessage = {
      id: `pending:${clientMessageId}`,
      clientMessageId,
      userId: activeLoadedRoom.currentUserId,
      sender: 'me',
      nickname: activeLoadedRoom.detail.participants.find(
        (item) => item.userId === activeLoadedRoom.currentUserId,
      )?.nickname,
      voteChoice: activeLoadedRoom.detail.participants.find(
        (item) => item.userId === activeLoadedRoom.currentUserId,
      )?.voteChoice,
      content,
      createdAt: new Date().toISOString(),
      deliveryState: 'pending',
    };
    setLoadedRoom((current) =>
      current?.chatRoomId === chatRoomId
        ? {
            ...current,
            messages: [
              ...current.messages.filter((message) => message.clientMessageId !== clientMessageId),
              pendingMessage,
            ],
          }
        : current,
    );

    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        settlePendingMessage(
          clientMessageId,
          'failed',
          '서버 확인이 늦어지고 있어요. 같은 메시지로 다시 시도해 주세요.',
        );
      }, MESSAGE_ACK_TIMEOUT_MS);
      pendingMessages.current.set(clientMessageId, { content, resolve, reject, timeoutId });
      try {
        publish(
          `/app/chat-rooms/${chatRoomId}/messages`,
          JSON.stringify({ clientMessageId, content }),
        );
      } catch {
        settlePendingMessage(
          clientMessageId,
          'failed',
          '채팅 서버에 연결되지 않았어요. 연결 후 다시 시도해 주세요.',
        );
      }
    });
  }

  if (!validRoomId) {
    return (
      <div className={`chat-room-page chat-room-invalid-page${inlineMode ? ' is-inline' : ''}`}>
        <section className="chat-room-terminal-state" role="alert">
          <h1>채팅방에 접근할 수 없어요.</h1>
          <p>채팅방 주소를 확인한 뒤 다시 시도해 주세요.</p>
          <Link to="/matching">취향 투표로 돌아가기</Link>
        </section>
      </div>
    );
  }

  const expirationLabel = formatExpiration(resolvedRoomInfo?.expiresAt);
  const Root: 'section' | 'main' = inlineMode ? 'section' : 'main';

  return (
    <Root
      aria-label={inlineMode ? '매칭된 채팅방' : undefined}
      className={`chat-room-page${inlineMode ? ' is-inline' : ''}${expanded ? ' is-expanded' : ''}`}
    >
      <header className="chat-room-header">
        {inlineMode ? (
          <span aria-hidden="true" className="chat-room-header-spacer" />
        ) : (
          <Link aria-label="취향 투표로 돌아가기" className="chat-room-back-button" to="/matching">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="m15 5-7 7 7 7" />
            </svg>
          </Link>
        )}
        <div className="chat-room-title" title={resolvedRoomInfo?.partnerNickname}>
          <div className="chat-room-title-copy">
            <h1>
              {resolvedRoomInfo?.roomType === 'GROUP'
                ? `그룹 채팅${resolvedRoomInfo.roomSequence ? ` ${resolvedRoomInfo.roomSequence}번 방` : ''}`
                : '채팅방'}
            </h1>
            <p className="chat-room-partner">
              {resolvedRoomInfo?.roomType === 'GROUP'
                ? `오늘의 취향 투표 · 참여 인원 ${resolvedRoomInfo.admittedParticipantCount ?? '—'}/${resolvedRoomInfo.capacity ?? '—'}명`
                : (resolvedRoomInfo?.partnerNickname ?? '상대방 정보는 연동 후 표시됩니다.')}
            </p>
            <p className="chat-room-meta">
              {resolvedRoomInfo?.roomType === 'GROUP'
                ? expirationLabel
                  ? `종료 ${expirationLabel}`
                  : '종료 시간 대기 중'
                : `${resolvedRoomInfo?.participantCount !== undefined ? `참여자 ${resolvedRoomInfo.participantCount}명` : '참여자 정보 대기 중'} · ${expirationLabel ? `종료 ${expirationLabel}` : '종료 시간 대기 중'}`}
            </p>
          </div>
        </div>
        {inlineMode ? (
          <button
            aria-label={expanded ? '채팅창 축소' : '채팅 전체보기'}
            className="chat-room-expand-button"
            onClick={() => onToggleExpanded?.(!expanded)}
            type="button"
          >
            {expanded ? '×' : '전체보기'}
          </button>
        ) : null}
        <div className="chat-room-menu-container">
          <button
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
            aria-label="채팅방 메뉴"
            className="chat-room-menu"
            onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
            ref={leaveMenuButtonRef}
            type="button"
          >
            ⋮
          </button>
          {isMenuOpen ? (
            <div className="chat-room-menu-popover" role="menu">
              <button
                disabled={!canLeaveRoom || isLeaving}
                onClick={() => {
                  setIsMenuOpen(false);
                  setLeaveError('');
                  setIsLeaveConfirmationOpen(true);
                }}
                role="menuitem"
                type="button"
              >
                {canLeaveRoom
                  ? isLeaving
                    ? '나가는 중…'
                    : '채팅방 나가기'
                  : '채팅방 나가기 (연동 준비 중)'}
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {leaveError ? (
        <p className="chat-room-leave-error" role="alert">
          {leaveError}
        </p>
      ) : null}
      {transportError ? (
        <p className="chat-room-leave-error" role="alert">
          {transportError}
        </p>
      ) : null}

      {isLeaveConfirmationOpen ? (
        <div className="chat-room-leave-dialog-backdrop">
          <section
            aria-describedby="chat-room-leave-description"
            aria-labelledby="chat-room-leave-title"
            aria-modal="true"
            className="chat-room-leave-dialog"
            role="dialog"
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key !== 'Tab') return;

              const buttons = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
              );
              const firstButton = buttons[0];
              const lastButton = buttons[buttons.length - 1];

              if (!firstButton || !lastButton) {
                event.preventDefault();
                event.currentTarget.focus();
              } else if (event.shiftKey && document.activeElement === firstButton) {
                event.preventDefault();
                lastButton.focus();
              } else if (!event.shiftKey && document.activeElement === lastButton) {
                event.preventDefault();
                firstButton.focus();
              }
            }}
          >
            <h2 id="chat-room-leave-title">
              {resolvedRoomInfo?.roomType === 'GROUP'
                ? '채팅방에서 나가시겠어요?'
                : '채팅방을 나가시겠어요?'}
            </h2>
            <p id="chat-room-leave-description">
              {resolvedRoomInfo?.roomType === 'GROUP' ? (
                '채팅방을 나가면 오늘은 다시 입장할 수 없어요.'
              ) : (
                <>
                  채팅방을 나가면 다시 입장할 수 없으며,
                  <br />
                  상대방과 더 이상 메시지를 주고받을 수 없어요.
                </>
              )}
            </p>
            {leaveError ? (
              <p className="chat-room-leave-dialog-error" role="alert">
                {leaveError}
              </p>
            ) : null}
            <div className="chat-room-leave-dialog-actions">
              <button
                ref={cancelLeaveButtonRef}
                type="button"
                disabled={isLeaving}
                onClick={() => setIsLeaveConfirmationOpen(false)}
              >
                취소
              </button>
              <button
                className="danger"
                type="button"
                disabled={isLeaving}
                onClick={() => void handleLeaveRoom()}
              >
                {isLeaving ? '나가는 중…' : '나가기'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {ownsConnection && connection.stopReason === 'authentication' ? (
        <Link to="/login" onClick={clearSession}>
          다시 로그인
        </Link>
      ) : null}
      <ChatRoomContent
        chatRoomId={chatRoomId}
        connectionState={connectionState ?? connection.state}
        connectionStatus={ownsConnection ? connection : undefined}
        onRetryConnection={ownsConnection ? retryConnection : undefined}
        hasOlderMessages={resolvedHasOlderMessages}
        isLoadingOlderMessages={resolvedIsLoadingOlderMessages}
        loadState={resolvedLoadState}
        messages={resolvedMessages}
        onLoadOlderMessages={hasInjectedRoomData ? onLoadOlderMessages : handleLoadOlderMessages}
        onRetryLoad={
          hasInjectedRoomData
            ? onRetryLoad
            : () => {
                setLoadResult({ chatRoomId, state: 'loading' });
                setRetryKey((key) => key + 1);
              }
        }
        onSendMessage={hasInjectedRoomData ? onSendMessage : sendMessage}
        roomStatus={resolvedRoomStatus}
        roomType={activeLoadedRoom?.detail.roomType ?? resolvedRoomInfo?.roomType}
        activeParticipantCount={activeLoadedRoom?.detail.activeParticipantCount}
        systemNotices={activeLoadedRoom?.systemNotices}
      />
    </Root>
  );
}

/** Only definitive room lifecycle errors invalidate the saved matched-room hint. */
function isSnapshotInvalidatingError(code: string | undefined): boolean {
  return (
    code === 'CHAT_ROOM_EXPIRED' ||
    code === 'CHAT_REENTRY_FORBIDDEN' ||
    code === 'CHAT_ALREADY_LEFT' ||
    code === 'CHAT_ALREADY_LEFT_FORBIDDEN' ||
    code === 'CHAT_ROOM_NOT_FOUND'
  );
}

/** REST 메시지 DTO를 현재 말풍선 컴포넌트의 표시 모델로 변환한다. */
function mapMessage(
  message: ChatRoomMessageRecord,
  currentUserId: number,
  detail?: ChatRoomDetail,
): ChatMessage {
  const participant = detail?.participants.find((item) => item.userId === message.userId);
  return {
    id: String(message.chatMessageId),
    clientMessageId: message.clientMessageId,
    userId: message.userId,
    sender: message.userId === currentUserId ? 'me' : 'partner',
    nickname: participant?.nickname ?? message.nickname,
    voteChoice: message.voteChoice ?? participant?.voteChoice,
    content: message.content,
    createdAt: message.createdAt,
    deliveryState: 'success',
  };
}

/** 보유 중인 메시지의 표시 이름을 최신 참가자 DTO에 맞춰 갱신한다. */
function withCurrentParticipant(
  message: ChatMessage,
  participant: ChatRoomDetail['participants'][number],
): ChatMessage {
  return { ...message, nickname: participant.nickname, voteChoice: participant.voteChoice };
}

/** REST 상세 재조회 결과로 이 메시지의 닉네임과 그룹 선택 표시를 최신화한다. */
function withCurrentParticipants(message: ChatMessage, detail: ChatRoomDetail): ChatMessage {
  const participant = detail.participants.find((item) => item.userId === message.userId);
  return participant ? withCurrentParticipant(message, participant) : message;
}

/** Chat Server의 메시지 성공 프레임을 신뢰 가능한 화면 DTO로 좁힌다. */
function parseStompMessage(value: Record<string, unknown>): StompMessage | null {
  if (
    value.type !== 'MESSAGE' ||
    !isPositiveSafeInteger(value.chatRoomId) ||
    !isPositiveSafeInteger(value.chatMessageId) ||
    !isUuid(value.clientMessageId) ||
    !isPositiveSafeInteger(value.userId) ||
    typeof value.content !== 'string' ||
    value.content.length < 1 ||
    value.content.length > 500 ||
    !(
      value.voteChoice === undefined ||
      value.voteChoice === null ||
      isVoteChoice(value.voteChoice)
    ) ||
    !isDateTime(value.createdAt)
  ) {
    return null;
  }
  return {
    type: 'MESSAGE',
    chatRoomId: value.chatRoomId,
    chatMessageId: value.chatMessageId,
    clientMessageId: value.clientMessageId,
    userId: value.userId,
    content: value.content,
    createdAt: value.createdAt,
    voteChoice: value.voteChoice,
  };
}

/** 서버의 사용자별 오류 프레임을 clientMessageId 기준으로 검증한다. */
function parseStompMessageError(value: Record<string, unknown>): StompMessageError | null {
  if (
    typeof value.code !== 'string' ||
    typeof value.message !== 'string' ||
    !(value.clientMessageId === null || isUuid(value.clientMessageId))
  ) {
    return null;
  }
  return {
    code: value.code,
    message: value.message,
    clientMessageId: value.clientMessageId,
  };
}

/** 퇴장 이벤트는 현재 방의 상대 참가자일 때만 화면 상태에 반영한다. */
function parseParticipantLeftEvent(value: Record<string, unknown>): ParticipantLeftEvent | null {
  if (
    value.type !== 'PARTICIPANT_LEFT' ||
    !isPositiveSafeInteger(value.chatRoomId) ||
    !isPositiveSafeInteger(value.userId) ||
    typeof value.nickname !== 'string' ||
    !isDateTime(value.leftAt)
  ) {
    return null;
  }
  return {
    type: 'PARTICIPANT_LEFT',
    chatRoomId: value.chatRoomId,
    userId: value.userId,
    nickname: value.nickname,
    leftAt: value.leftAt,
  };
}

/** 그룹 참가자 입장 이벤트의 서버 필드만 검증해 시스템 안내와 상세 재조회를 시작한다. */
function parseParticipantJoinedEvent(
  value: Record<string, unknown>,
): ParticipantJoinedEvent | null {
  if (
    value.type !== 'PARTICIPANT_JOINED' ||
    !isPositiveSafeInteger(value.chatRoomId) ||
    !isPositiveSafeInteger(value.userId) ||
    typeof value.nickname !== 'string' ||
    !isVoteChoice(value.voteChoice) ||
    !isNonNegativeSafeInteger(value.activeParticipantCount) ||
    !isDateTime(value.occurredAt)
  ) {
    return null;
  }
  return {
    type: 'PARTICIPANT_JOINED',
    chatRoomId: value.chatRoomId,
    userId: value.userId,
    nickname: value.nickname,
    voteChoice: value.voteChoice,
    activeParticipantCount: value.activeParticipantCount,
    occurredAt: value.occurredAt,
  };
}

/** 현재 chat-events 계약의 닉네임 변경 이벤트만 검증해 표시 상태 갱신에 사용한다. */
function parseParticipantNicknameChangedEvent(
  value: Record<string, unknown>,
): ParticipantNicknameChangedEvent | null {
  if (
    value.type !== 'PARTICIPANT_NICKNAME_CHANGED' ||
    !isPositiveSafeInteger(value.chatRoomId) ||
    !isPositiveSafeInteger(value.userId) ||
    typeof value.nickname !== 'string' ||
    value.nickname.trim().length === 0
  ) {
    return null;
  }
  return {
    type: 'PARTICIPANT_NICKNAME_CHANGED',
    chatRoomId: value.chatRoomId,
    userId: value.userId,
    nickname: value.nickname,
  };
}

/** 상세 DTO의 서버 값을 헤더 표시 모델로 변환한다. */
function roomInfoFromDetail(detail: ChatRoomDetail, partnerNickname?: string): ChatRoomHeaderInfo {
  return {
    roomType: detail.roomType,
    roomSequence: detail.roomSequence,
    partnerNickname,
    participantCount: detail.participants.length,
    admittedParticipantCount: detail.admittedParticipantCount,
    capacity: detail.capacity,
    expiresAt: detail.expiresAt,
  };
}

/** GROUP 상세의 서버 상태를 퇴장, 만료, 대기 우선순위로 화면 상태에 매핑한다. */
function groupRoomStatus(detail: ChatRoomDetail, currentUserId: number): ChatRoomStatus {
  const currentParticipant = detail.participants.find(
    (participant) => participant.userId === currentUserId,
  );
  if (currentParticipant?.hasLeft) return 'self-left';
  if (Date.parse(detail.expiresAt) <= Date.now()) return 'expired';
  return detail.activeParticipantCount < 2 ? 'peer-waiting' : 'active';
}

/** 그룹 배정 직후 REST 상세 실패 화면에서도 이동 시 전달된 방 종류만 안전하게 복구한다. */
function roomInfoFromNavigationState(value: unknown): ChatRoomHeaderInfo | undefined {
  if (!isRecord(value) || !isRecord(value.roomInfo) || value.roomInfo.roomType !== 'GROUP') {
    return undefined;
  }
  const info = value.roomInfo;
  return {
    roomType: 'GROUP',
    roomSequence: isPositiveSafeInteger(info.roomSequence) ? info.roomSequence : null,
    admittedParticipantCount: isNonNegativeSafeInteger(info.admittedParticipantCount)
      ? info.admittedParticipantCount
      : undefined,
    expiresAt: isDateTime(info.expiresAt) ? info.expiresAt : undefined,
  };
}

function isVoteChoice(value: unknown): value is 'A' | 'B' {
  return value === 'A' || value === 'B';
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** 서버 오류 코드를 고정된 사용자 안내로 변환하며 원문 내부 메시지는 노출하지 않는다. */
function errorMessageForCode(code: string): string {
  switch (code) {
    case 'PROHIBITED_WORD':
      return '전송할 수 없는 단어가 포함되어 있어요.';
    case 'SPAM_DETECTED':
      return '스팸으로 의심되는 메시지는 전송할 수 없어요.';
    case 'MESSAGE_BLOCKED':
      return '부적절한 내용이 포함되어 메시지를 전송할 수 없어요.';
    case 'MODERATION_UNAVAILABLE':
      return '현재 메시지를 전송할 수 없어요. 잠시 후 다시 시도해 주세요.';
    case 'CHAT_ROOM_EXPIRED':
      return '이 채팅방은 만료되어 메시지를 보낼 수 없어요.';
    case 'CHAT_SEND_FORBIDDEN':
      return '현재 채팅방에서는 메시지를 보낼 수 없어요.';
    case 'CHAT_PEER_NOT_JOINED':
      return '상대방이 입장하면 채팅을 시작할 수 있어요.';
    case 'CLIENT_MESSAGE_ID_CONFLICT':
      return '메시지 확인 정보가 충돌했어요. 다시 시도해 주세요.';
    case 'MESSAGE_TOO_LONG':
      return '메시지는 500자 이내로 입력해 주세요.';
    case 'INVALID_INPUT_VALUE':
      return '메시지 내용을 확인해 주세요.';
    case 'UNAUTHORIZED':
    case 'FORBIDDEN':
      return '로그인 또는 채팅방 권한을 확인해 주세요.';
    default:
      return '메시지를 보내지 못했어요. 잠시 후 다시 시도해 주세요.';
  }
}

/** 외부 JSON에서 메시지 DTO의 숫자 ID가 양의 안전 정수인지 확인한다. */
function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/** 메시지와 연결 이벤트의 UUID 식별자를 검증한다. */
function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

/** 서버 OffsetDateTime 문자열이 실제 날짜로 해석되는지 확인한다. */
function isDateTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/** JSON 파서 결과가 필드 접근 가능한 객체인지 확인한다. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
