import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { useSession } from '../../../entities/session/model/useSession';
import {
  createMatchRequest,
  getMatchRequestByVoteAnswer,
  getMatchRequestState,
  type MatchRequestStatus,
} from '../../../features/matching/api/matchRequestApi';
import { joinGroupChat } from '../../../features/chat-room/api/groupChatApi';
import {
  clearMatchRequestSnapshot,
  readMatchRequestUserId,
  saveMatchRequestSnapshot,
} from '../../../features/matching/model/matchRequestSnapshot';
import {
  clearMatchedChatRoomSnapshot,
  saveMatchedChatRoomSnapshot,
} from '../../../features/matching/model/matchedChatRoomSnapshot';
import {
  getTodayPreferenceVote,
  submitPreferenceVote,
  type PreferenceVoteResult,
  type TodayPreferenceVote,
} from '../../../features/preference-vote/api/preferenceVoteApi';
import { PreferenceVote } from '../../../features/preference-vote/ui/PreferenceVote';
import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import { ChatRoomPage } from '../../chat-room/ui/ChatRoomPage';
import { ApiError } from '../../../shared/api/apiError';
import '../../pageShell.css';
import './matchingPage.css';

interface VotePageState {
  vote: TodayPreferenceVote | null;
  result: PreferenceVoteResult | null;
  errorMessage: string | null;
  isLoading: boolean;
  isSubmitting: boolean;
  isCreatingMatch: boolean;
  isJoiningGroupChat: boolean;
  isRestoringMatch: boolean;
  matchLookupFailed: boolean;
  matchStatus: MatchRequestStatus | null;
  matchRequestId: number | null;
  matchErrorMessage: string | null;
  chatEntryFailed: boolean;
}
const initialVotePageState: VotePageState = {
  vote: null,
  result: null,
  errorMessage: null,
  isLoading: true,
  isSubmitting: false,
  isCreatingMatch: false,
  isJoiningGroupChat: false,
  isRestoringMatch: false,
  matchLookupFailed: false,
  matchStatus: null,
  matchRequestId: null,
  matchErrorMessage: null,
  chatEntryFailed: false,
};

const MATCH_POLL_INTERVAL_MS = 3_000;

/** 오늘의 취향 투표를 조회하고, 한 번의 답변 제출 흐름을 조립한다. */
export function MatchingPage() {
  const { accessToken, fetchAuthenticatedJson } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<VotePageState>(initialVotePageState);
  const [matchedChatRoomId, setMatchedChatRoomId] = useState<number | null>(null);
  const activeMatchRequestIdRef = useRef<number | null>(null);
  const matchRequestPromiseRef = useRef<Promise<void> | null>(null);
  const voteRequestRef = useRef<Promise<void> | null>(null);
  const voteRequestIdRef = useRef(0);
  const matchRestoreRef = useRef<{
    voteAnswerId: number;
    voteRequestId: number;
    promise: Promise<void>;
  } | null>(null);
  const chatEntryInFlightRef = useRef(false);

  /** Keeps the request snapshot synchronized with server-confirmed match state. */
  const applyMatchState = useCallback(
    (matchRequestId: number, status: MatchRequestStatus, chatRoomId: number | null) => {
      activeMatchRequestIdRef.current =
        status === 'WAITING' || status === 'MATCHING' ? matchRequestId : null;
      setState((current) => ({
        ...current,
        isCreatingMatch: false,
        isRestoringMatch: false,
        matchLookupFailed: false,
        matchErrorMessage: null,
        matchRequestId,
        matchStatus: status,
      }));
      if (status === 'EXPIRED') clearMatchRequestSnapshot();
      if (status === 'MATCHED' && chatRoomId !== null) {
        clearMatchRequestSnapshot();
        setMatchedChatRoomId(chatRoomId);
        const userId = accessToken ? readMatchRequestUserId(accessToken) : null;
        if (userId) saveMatchedChatRoomSnapshot(userId, { chatRoomId });
      } else {
        setMatchedChatRoomId(null);
      }
    },
    [accessToken],
  );

  /** Recovers an existing request by the server-owned vote answer instead of creating a duplicate. */
  const restoreMatchForVote = useCallback(
    async (voteAnswerId: number, voteRequestId: number): Promise<void> => {
      if (
        matchRestoreRef.current?.voteAnswerId === voteAnswerId &&
        matchRestoreRef.current.voteRequestId === voteRequestId
      ) {
        return matchRestoreRef.current.promise;
      }
      const userId = accessToken ? readMatchRequestUserId(accessToken) : null;
      if (!userId) {
        setState((current) => ({
          ...current,
          isRestoringMatch: false,
          matchLookupFailed: true,
          matchErrorMessage: '로그인 정보를 확인하지 못했어요. 다시 로그인해 주세요.',
        }));
        return;
      }

      setState((current) => ({
        ...current,
        isRestoringMatch: true,
        matchLookupFailed: false,
        matchErrorMessage: null,
      }));
      const request = (async () => {
        try {
          const existing = await getMatchRequestByVoteAnswer(fetchAuthenticatedJson, voteAnswerId);
          if (voteRequestIdRef.current !== voteRequestId) return;
          saveMatchRequestSnapshot(userId, { matchRequestId: existing.matchRequestId });
          applyMatchState(existing.matchRequestId, existing.status, existing.chatRoomId);
        } catch (error: unknown) {
          if (voteRequestIdRef.current !== voteRequestId) return;
          if (
            error instanceof ApiError &&
            error.status === 404 &&
            error.code === 'MATCH_REQUEST_NOT_FOUND'
          ) {
            activeMatchRequestIdRef.current = null;
            clearMatchRequestSnapshot();
            clearMatchedChatRoomSnapshot({ userId });
            setMatchedChatRoomId(null);
            setState((current) => ({
              ...current,
              isRestoringMatch: false,
              matchLookupFailed: false,
              matchRequestId: null,
              matchStatus: null,
              matchErrorMessage: null,
            }));
            return;
          }
          setState((current) => ({
            ...current,
            isRestoringMatch: false,
            matchLookupFailed: true,
            matchErrorMessage: getMatchErrorMessage(error),
          }));
        }
      })();
      const entry = { voteAnswerId, voteRequestId, promise: request };
      matchRestoreRef.current = entry;
      try {
        await request;
      } finally {
        if (matchRestoreRef.current === entry) matchRestoreRef.current = null;
      }
    },
    [accessToken, applyMatchState, fetchAuthenticatedJson],
  );

  const loadVote = useCallback((): Promise<void> => {
    if (voteRequestRef.current) return voteRequestRef.current;

    const requestId = ++voteRequestIdRef.current;
    activeMatchRequestIdRef.current = null;
    setState((current) => ({
      ...current,
      vote: null,
      result: null,
      errorMessage: null,
      isLoading: true,
      isSubmitting: false,
      isRestoringMatch: false,
      matchLookupFailed: false,
      matchStatus: null,
      matchRequestId: null,
      matchErrorMessage: null,
    }));
    setMatchedChatRoomId(null);
    const request = (async () => {
      try {
        const vote = await getTodayPreferenceVote(fetchAuthenticatedJson);
        if (voteRequestIdRef.current !== requestId) return;
        setState((current) => ({
          ...current,
          vote,
          result:
            vote.voteAnswerId !== null && vote.myAnswer !== null && vote.result
              ? {
                  voteAnswerId: vote.voteAnswerId,
                  myAnswer: vote.myAnswer,
                  ...vote.result,
                }
              : null,
          errorMessage: null,
          isLoading: false,
          isSubmitting: false,
          isRestoringMatch: vote.voteAnswerId !== null,
          matchLookupFailed: false,
        }));
        if (vote.voteAnswerId !== null) {
          await restoreMatchForVote(vote.voteAnswerId, requestId);
        } else {
          activeMatchRequestIdRef.current = null;
          clearMatchRequestSnapshot();
          setMatchedChatRoomId(null);
          setState((current) => ({
            ...current,
            matchRequestId: null,
            matchStatus: null,
            isRestoringMatch: false,
            matchLookupFailed: false,
            matchErrorMessage: null,
          }));
        }
      } catch (error: unknown) {
        if (voteRequestIdRef.current !== requestId) return;
        setState((current) => ({
          ...current,
          vote: null,
          result: null,
          errorMessage: getVoteErrorMessage(error),
          isLoading: false,
          isSubmitting: false,
          isRestoringMatch: false,
        }));
      }
    })();
    voteRequestRef.current = request;
    void request.finally(() => {
      if (voteRequestRef.current === request) voteRequestRef.current = null;
    });
    return request;
  }, [fetchAuthenticatedJson, restoreMatchForVote]);
  useEffect(() => {
    void loadVote();
  }, [loadVote]);

  /** 현재 요청 ID와 일치하는 서버 상태만 화면에 반영해 늦은 응답 경합을 막는다. */
  const refreshMatchState = useCallback(
    async (matchRequestId: number): Promise<void> => {
      if (activeMatchRequestIdRef.current !== matchRequestId) return;
      try {
        const matchState = await getMatchRequestState(fetchAuthenticatedJson, matchRequestId);
        if (activeMatchRequestIdRef.current !== matchRequestId) return;
        applyMatchState(matchState.matchRequestId, matchState.status, matchState.chatRoomId);
      } catch (error: unknown) {
        if (activeMatchRequestIdRef.current !== matchRequestId) return;
        if (error instanceof ApiError && error.code === 'MATCH_REQUEST_NOT_FOUND') {
          activeMatchRequestIdRef.current = null;
          const voteAnswerId = state.vote?.voteAnswerId;
          if (voteAnswerId != null) {
            void restoreMatchForVote(voteAnswerId, voteRequestIdRef.current);
          } else {
            setState((current) => ({
              ...current,
              matchLookupFailed: true,
              matchErrorMessage: '매칭 상태를 확인하지 못했어요. 다시 조회해 주세요.',
            }));
          }
          return;
        }
        setState((current) => ({ ...current, matchErrorMessage: getMatchErrorMessage(error) }));
      }
    },
    [applyMatchState, fetchAuthenticatedJson, restoreMatchForVote, state.vote],
  );

  /** Allows a user-triggered GET refresh for terminal states without enabling another POST. */
  const refreshCurrentMatchStatus = useCallback(() => {
    const matchRequestId = state.matchRequestId;
    if (matchRequestId === null) return;
    activeMatchRequestIdRef.current = matchRequestId;
    void refreshMatchState(matchRequestId);
  }, [refreshMatchState, state.matchRequestId]);

  useEffect(() => {
    if (
      state.matchRequestId === null ||
      (state.matchStatus !== 'WAITING' && state.matchStatus !== 'MATCHING')
    ) {
      return;
    }
    const refreshWhenVisible = () => {
      if (!document.hidden) void refreshMatchState(state.matchRequestId!);
    };
    const interval = window.setInterval(refreshWhenVisible, MATCH_POLL_INTERVAL_MS);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refreshMatchState, state.matchRequestId, state.matchStatus]);
  const submitVote = useCallback(
    async (selectedOption: 'A' | 'B') => {
      if (!state.vote || state.isSubmitting || state.vote.voteAnswerId !== null) return;
      setState((current) => ({ ...current, errorMessage: null, isSubmitting: true }));
      try {
        const result = await submitPreferenceVote(
          fetchAuthenticatedJson,
          state.vote.voteQuestionId,
          selectedOption,
        );
        setState((current) => ({
          ...current,
          vote: { ...current.vote!, myAnswer: result.myAnswer, voteAnswerId: result.voteAnswerId },
          result,
          isSubmitting: false,
        }));
      } catch (error: unknown) {
        if (error instanceof ApiError && error.code === 'VOTE_ALREADY_ANSWERED') {
          void loadVote();
          return;
        }
        setState((current) => ({
          ...current,
          errorMessage: getVoteErrorMessage(error),
          isSubmitting: false,
        }));
      }
    },
    [fetchAuthenticatedJson, loadVote, state.isSubmitting, state.vote],
  );
  /** 동일 voteAnswerId로 매칭 요청을 한 번만 생성하고, 성공하면 상태 polling을 시작한다. */
  const startMatching = useCallback(() => {
    if (
      !state.vote?.voteAnswerId ||
      state.isCreatingMatch ||
      state.isRestoringMatch ||
      state.matchLookupFailed ||
      state.matchStatus !== null ||
      matchRequestPromiseRef.current
    ) {
      return;
    }
    const userId = accessToken ? readMatchRequestUserId(accessToken) : null;
    if (!userId) {
      setState((current) => ({
        ...current,
        matchErrorMessage: '로그인 정보를 확인하지 못했어요. 다시 로그인해 주세요.',
      }));
      return;
    }
    setState((current) => ({
      ...current,
      isCreatingMatch: true,
      matchErrorMessage: null,
      chatEntryFailed: false,
    }));
    const voteAnswerId = state.vote.voteAnswerId;
    const promise = createMatchRequest(fetchAuthenticatedJson, voteAnswerId)
      .then((created) => {
        saveMatchRequestSnapshot(userId, { matchRequestId: created.matchRequestId });
        applyMatchState(created.matchRequestId, created.status, null);
      })
      .catch(async (error: unknown) => {
        if (
          error instanceof ApiError &&
          error.status === 409 &&
          error.code === 'MATCH_REQUEST_ALREADY_EXISTS'
        ) {
          await restoreMatchForVote(voteAnswerId, voteRequestIdRef.current);
          return;
        }
        setState((current) => ({
          ...current,
          isCreatingMatch: false,
          matchLookupFailed: true,
          matchErrorMessage: getMatchErrorMessage(error),
        }));
      })
      .finally(() => {
        if (matchRequestPromiseRef.current === promise) matchRequestPromiseRef.current = null;
      });
    matchRequestPromiseRef.current = promise;
  }, [
    accessToken,
    applyMatchState,
    fetchAuthenticatedJson,
    restoreMatchForVote,
    state.isRestoringMatch,
    state.matchLookupFailed,
    state.isCreatingMatch,
    state.matchStatus,
    state.vote,
  ]);
  /** 매칭 오류는 기존 요청 상태를 다시 읽거나, 생성 실패라면 같은 답변으로 다시 요청한다. */
  const retryMatching = useCallback(() => {
    if (state.matchLookupFailed && state.vote?.voteAnswerId != null) {
      void restoreMatchForVote(state.vote.voteAnswerId, voteRequestIdRef.current);
      return;
    }
    if (state.matchRequestId !== null) {
      activeMatchRequestIdRef.current = state.matchRequestId;
      void refreshMatchState(state.matchRequestId);
      return;
    }
    startMatching();
  }, [
    refreshMatchState,
    restoreMatchForVote,
    startMatching,
    state.matchLookupFailed,
    state.matchRequestId,
    state.vote,
  ]);

  /** 신규 채팅 참여는 사용자 클릭 시 그룹 채팅방 배정 API로 진행한다. */
  const startChatEntry = useCallback(async () => {
    const voteAnswerId = state.vote?.voteAnswerId;
    if (voteAnswerId == null || chatEntryInFlightRef.current || state.isJoiningGroupChat) {
      return;
    }

    chatEntryInFlightRef.current = true;
    setState((current) => ({ ...current, isJoiningGroupChat: true, matchErrorMessage: null }));
    try {
      const room = await joinGroupChat(fetchAuthenticatedJson, voteAnswerId);
      navigate(`/chat/${room.chatRoomId}`, {
        state: {
          roomInfo: {
            roomType: 'GROUP',
            roomSequence: room.roomSequence,
            admittedParticipantCount: room.admittedParticipantCount,
            expiresAt: room.expiresAt,
          },
        },
      });
    } catch (error: unknown) {
      setState((current) => ({
        ...current,
        isJoiningGroupChat: false,
        matchErrorMessage: getGroupChatErrorMessage(error),
        chatEntryFailed: true,
      }));
    } finally {
      chatEntryInFlightRef.current = false;
    }
  }, [fetchAuthenticatedJson, navigate, state.isJoiningGroupChat, state.vote]);

  const isChatExpanded = isRecord(location.state) && location.state.inlineChatExpanded === true;
  const setChatExpanded = useCallback(
    (expanded: boolean, replace = false) => {
      navigate('/matching', {
        replace,
        state: {
          ...(isRecord(location.state) ? location.state : {}),
          inlineChatExpanded: expanded,
        },
      });
    },
    [location.state, navigate],
  );

  useEffect(() => {
    if (!isChatExpanded) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        event.defaultPrevented ||
        document.querySelector('[role="dialog"], [role="menu"]')
      ) {
        return;
      }
      event.preventDefault();
      setChatExpanded(false, true);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isChatExpanded, setChatExpanded]);

  const handleInlineChatLeave = useCallback(() => {
    const userId = accessToken ? readMatchRequestUserId(accessToken) : null;
    if (userId && matchedChatRoomId !== null) {
      clearMatchedChatRoomSnapshot({ userId, chatRoomId: matchedChatRoomId });
    }
    setMatchedChatRoomId(null);
    setChatExpanded(false, true);
  }, [accessToken, matchedChatRoomId, setChatExpanded]);

  const handleInlineChatSnapshotInvalidated = useCallback(
    (chatRoomId: string) => {
      const userId = accessToken ? readMatchRequestUserId(accessToken) : null;
      const numericRoomId = Number(chatRoomId);
      if (!userId || !Number.isSafeInteger(numericRoomId) || numericRoomId <= 0) return;
      clearMatchedChatRoomSnapshot({ userId, chatRoomId: numericRoomId });
    },
    [accessToken],
  );
  return (
    <main className="static-page">
      <div className="static-page-content matching-page-content">
        <header className="matching-page-header">
          <Link aria-label="홈으로 돌아가기" className="matching-page-back-button" to="/">
            ‹
          </Link>
          <h1 className="static-page-title">취향 투표</h1>
          <span aria-hidden="true" className="matching-page-header-spacer" />
        </header>
        <PreferenceVote
          errorMessage={state.errorMessage ?? state.matchErrorMessage}
          isLoading={state.isLoading}
          isJoiningGroupChat={state.isJoiningGroupChat}
          isSubmitting={state.isSubmitting}
          matchStatus={state.matchStatus}
          onRefreshMatchStatus={refreshCurrentMatchStatus}
          result={state.result}
          vote={state.vote}
          onRetry={
            state.chatEntryFailed
              ? startChatEntry
              : state.matchErrorMessage
                ? retryMatching
                : () => void loadVote()
          }
          onJoinGroupChat={startChatEntry}
          onSubmit={(selectedOption) => void submitVote(selectedOption)}
        />
        {matchedChatRoomId !== null ? (
          <div className={`matching-inline-chat-shell${isChatExpanded ? ' is-expanded' : ''}`}>
            {isChatExpanded ? (
              <div aria-hidden="true" className="matching-inline-chat-backdrop" />
            ) : null}
            <ChatRoomPage
              key={matchedChatRoomId}
              embeddedRoomId={String(matchedChatRoomId)}
              inlineMode
              expanded={isChatExpanded}
              onToggleExpanded={(expanded) => setChatExpanded(expanded, !expanded)}
              onLeaveSuccess={handleInlineChatLeave}
              onRoomSnapshotInvalidated={handleInlineChatSnapshotInvalidated}
            />
          </div>
        ) : null}
      </div>
      <MainNavigation activeItem="home" />
    </main>
  );
}

/** Restricts navigation state reads to plain objects before merging UI-only flags. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** API 오류 코드를 매칭 화면에서 다음 행동이 명확한 안내로 변환한다. */
function getMatchErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return '매칭 요청을 처리하지 못했어요. 다시 시도해 주세요.';
  if (error.code === 'MATCH_REQUEST_ALREADY_EXISTS')
    return '이미 매칭 요청이 있어요. 이 탭을 새로고침해 상태를 확인해 주세요.';
  if (error.code === 'MATCH_REQUEST_CLOSED') return '오늘의 매칭 요청 시간은 종료되었어요.';
  if (error.code === 'MATCH_VOTE_ANSWER_NOT_OWNED')
    return '내 투표 답변으로만 매칭을 요청할 수 있어요.';
  if (error.code === 'MATCH_VOTE_ANSWER_NOT_FOUND' || error.code === 'MATCH_VOTE_ANSWER_NOT_TODAY')
    return '오늘의 유효한 투표 답변을 확인하지 못했어요. 새로고침 후 다시 시도해 주세요.';
  if (error.code === 'CSRF_TOKEN_INVALID' || error.code === 'CSRF_TOKEN_MISSING')
    return '보안 정보를 확인하지 못했어요. 다시 시도해 주세요.';
  return error.message || '매칭 요청을 처리하지 못했어요. 다시 시도해 주세요.';
}

/** API 오류 코드를 기능에 맞는 짧은 사용자 안내로 변환한다. */
function getVoteErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return '취향 투표를 처리하지 못했어요. 다시 시도해 주세요.';
  if (error.code === 'VOTE_SNAPSHOT_NOT_READY') return '오늘의 취향 투표를 준비하고 있어요.';
  if (error.code === 'TODAY_VOTE_NOT_FOUND') return '오늘의 취향 투표 질문이 없어요.';
  if (error.code === 'VOTE_NOT_FOUND')
    return '투표 질문을 찾을 수 없어요. 새로고침 후 다시 시도해 주세요.';
  if (error.code === 'CSRF_TOKEN_INVALID' || error.code === 'CSRF_TOKEN_MISSING')
    return '보안 정보를 확인하지 못했어요. 다시 시도해 주세요.';
  return error.message || '취향 투표를 처리하지 못했어요. 다시 시도해 주세요.';
}

/** 그룹 입장 API에서 확인된 서버 오류를 임의의 1:1 fallback 없이 안내한다. */
function getGroupChatErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return '그룹 채팅에 참여하지 못했어요. 다시 시도해 주세요.';
  if (error.status === 401) return '로그인이 만료되었어요. 다시 로그인해 주세요.';
  if (error.code === 'GROUP_CHAT_VOTE_REQUIRED')
    return '오늘의 투표를 완료한 뒤 채팅에 참여할 수 있어요.';
  if (error.code === 'GROUP_CHAT_FEATURE_DISABLED')
    return '그룹 채팅을 사용할 수 없어요. 잠시 후 다시 시도해 주세요.';
  if (error.code === 'GROUP_CHAT_REENTRY_FORBIDDEN')
    return '이미 퇴장한 그룹 채팅방에는 다시 입장할 수 없어요.';
  if (error.code === 'ONE_TO_ONE_MATCHING_REPLACED')
    return '채팅 방식을 확인하지 못했어요. 다시 조회해 주세요.';
  if (error.status === 403) return '그룹 채팅에 참여할 권한이 없어요.';
  if (error.status >= 500) return '그룹 채팅 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.';
  return '그룹 채팅에 참여하지 못했어요. 다시 시도해 주세요.';
}
