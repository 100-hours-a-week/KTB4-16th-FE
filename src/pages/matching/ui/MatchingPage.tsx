import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useSession } from '../../../entities/session/model/useSession';
import { joinGroupChat } from '../../../features/chat-room/api/groupChatApi';
import {
  getTodayPreferenceVote,
  submitPreferenceVote,
  type PreferenceVoteResult,
  type TodayPreferenceVote,
} from '../../../features/preference-vote/api/preferenceVoteApi';
import { PreferenceVote } from '../../../features/preference-vote/ui/PreferenceVote';
import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import { ApiError } from '../../../shared/api/apiError';
import '../../pageShell.css';
import './matchingPage.css';

interface VotePageState {
  vote: TodayPreferenceVote | null;
  result: PreferenceVoteResult | null;
  errorMessage: string | null;
  isLoading: boolean;
  isSubmitting: boolean;
  isJoiningGroupChat: boolean;
  chatEntryFailed: boolean;
}

const initialVotePageState: VotePageState = {
  vote: null,
  result: null,
  errorMessage: null,
  isLoading: true,
  isSubmitting: false,
  isJoiningGroupChat: false,
  chatEntryFailed: false,
};

/** 오늘의 취향 투표와 사용자가 요청한 그룹 채팅 입장 흐름을 조립한다. */
export function MatchingPage() {
  const { fetchAuthenticatedJson } = useSession();
  const navigate = useNavigate();
  const [state, setState] = useState<VotePageState>(initialVotePageState);
  const voteRequestRef = useRef<Promise<void> | null>(null);
  const voteRequestIdRef = useRef(0);
  const chatEntryInFlightRef = useRef(false);

  const loadVote = useCallback((): Promise<void> => {
    if (voteRequestRef.current) return voteRequestRef.current;

    const requestId = ++voteRequestIdRef.current;
    setState((current) => ({
      ...current,
      vote: null,
      result: null,
      errorMessage: null,
      isLoading: true,
      isSubmitting: false,
      chatEntryFailed: false,
    }));
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
          chatEntryFailed: false,
        }));
      } catch (error: unknown) {
        if (voteRequestIdRef.current !== requestId) return;
        setState((current) => ({
          ...current,
          vote: null,
          result: null,
          errorMessage: getVoteErrorMessage(error),
          isLoading: false,
          isSubmitting: false,
          chatEntryFailed: false,
        }));
      }
    })();
    voteRequestRef.current = request;
    void request.finally(() => {
      if (voteRequestRef.current === request) voteRequestRef.current = null;
    });
    return request;
  }, [fetchAuthenticatedJson]);

  useEffect(() => {
    void loadVote();
  }, [loadVote]);

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

  /** 그룹 입장은 사용자의 명시적인 클릭으로만 요청하고 중복 호출을 막는다. */
  const startGroupChat = useCallback(async () => {
    const voteAnswerId = state.vote?.voteAnswerId;
    if (voteAnswerId == null || chatEntryInFlightRef.current || state.isJoiningGroupChat) return;

    chatEntryInFlightRef.current = true;
    setState((current) => ({
      ...current,
      isJoiningGroupChat: true,
      errorMessage: null,
      chatEntryFailed: false,
    }));
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
        errorMessage: getGroupChatErrorMessage(error),
        chatEntryFailed: true,
      }));
    } finally {
      chatEntryInFlightRef.current = false;
    }
  }, [fetchAuthenticatedJson, navigate, state.isJoiningGroupChat, state.vote]);

  const handleRetry = useCallback(() => {
    if (state.chatEntryFailed) {
      void startGroupChat();
      return;
    }
    void loadVote();
  }, [loadVote, startGroupChat, state.chatEntryFailed]);

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
          errorMessage={state.errorMessage}
          isLoading={state.isLoading}
          isJoiningGroupChat={state.isJoiningGroupChat}
          isSubmitting={state.isSubmitting}
          result={state.result}
          vote={state.vote}
          onRetry={handleRetry}
          onJoinGroupChat={() => void startGroupChat()}
          onSubmit={(selectedOption) => void submitVote(selectedOption)}
        />
      </div>
      <MainNavigation activeItem="home" />
    </main>
  );
}

/** API 오류 코드를 기능에 맞는 안내로 변환한다. */
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

/** 그룹 입장 오류를 사용자 안내로 변환하며 DIRECT 매칭으로 대체하지 않는다. */
function getGroupChatErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return '그룹 채팅에 참여하지 못했어요. 다시 시도해 주세요.';
  if (error.status === 401) return '로그인이 만료되었어요. 다시 로그인해 주세요.';
  if (error.code === 'GROUP_CHAT_VOTE_REQUIRED')
    return '오늘의 투표를 완료한 뒤 채팅에 참여할 수 있어요.';
  if (error.code === 'GROUP_CHAT_FEATURE_DISABLED')
    return '그룹 채팅을 사용할 수 없어요. 잠시 후 다시 시도해 주세요.';
  if (error.code === 'GROUP_CHAT_REENTRY_FORBIDDEN')
    return '이미 퇴장한 그룹 채팅방에는 다시 입장할 수 없어요.';
  if (error.status === 403) return '그룹 채팅에 참여할 권한이 없어요.';
  if (error.status >= 500) return '그룹 채팅 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.';
  return '그룹 채팅에 참여하지 못했어요. 다시 시도해 주세요.';
}
