import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useSession } from '../../../entities/session/model/useSession';
import {
  createMatchRequest,
  getMatchRequestState,
  type MatchRequestStatus,
} from '../../../features/matching/api/matchRequestApi';
import {
  clearMatchRequestSnapshot,
  loadMatchRequestSnapshot,
  readMatchRequestUserId,
  saveMatchRequestSnapshot,
} from '../../../features/matching/model/matchRequestSnapshot';
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
  isCreatingMatch: boolean;
  matchStatus: MatchRequestStatus | null;
  matchRequestId: number | null;
  matchErrorMessage: string | null;
}
const initialVotePageState: VotePageState = {
  vote: null,
  result: null,
  errorMessage: null,
  isLoading: true,
  isSubmitting: false,
  isCreatingMatch: false,
  matchStatus: null,
  matchRequestId: null,
  matchErrorMessage: null,
};

const MATCH_POLL_INTERVAL_MS = 3_000;

/** 오늘의 취향 투표를 조회하고, 한 번의 답변 제출 흐름을 조립한다. */
export function MatchingPage() {
  const { accessToken, fetchAuthenticatedJson } = useSession();
  const navigate = useNavigate();
  const [state, setState] = useState<VotePageState>(initialVotePageState);
  const activeMatchRequestIdRef = useRef<number | null>(null);
  const matchRequestPromiseRef = useRef<Promise<void> | null>(null);
  const voteRequestRef = useRef<Promise<void> | null>(null);
  const voteRequestIdRef = useRef(0);
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
    }));
    const request = (async () => {
      try {
        const vote = await getTodayPreferenceVote(fetchAuthenticatedJson);
        if (voteRequestIdRef.current !== requestId) return;
        setState((current) => ({
          ...current,
          vote,
          result: null,
          errorMessage: null,
          isLoading: false,
          isSubmitting: false,
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

  /** 저장된 같은 사용자 요청을 복원하고, 이미 종료된 요청은 다음 새로고침에 남기지 않는다. */
  const applyMatchState = useCallback(
    (matchRequestId: number, status: MatchRequestStatus, chatRoomId: number | null) => {
      activeMatchRequestIdRef.current =
        status === 'WAITING' || status === 'MATCHING' ? matchRequestId : null;
      setState((current) => ({
        ...current,
        isCreatingMatch: false,
        matchErrorMessage: null,
        matchRequestId,
        matchStatus: status,
      }));
      if (status === 'EXPIRED') {
        clearMatchRequestSnapshot();
      }
      if (status === 'MATCHED' && chatRoomId !== null) {
        clearMatchRequestSnapshot();
        navigate(`/chat/${chatRoomId}`, { replace: true });
      }
    },
    [navigate],
  );

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
          clearMatchRequestSnapshot();
          setState((current) => ({
            ...current,
            matchRequestId: null,
            matchStatus: null,
            matchErrorMessage: '매칭 요청을 찾을 수 없어요. 다시 요청해 주세요.',
          }));
          return;
        }
        setState((current) => ({ ...current, matchErrorMessage: getMatchErrorMessage(error) }));
      }
    },
    [applyMatchState, fetchAuthenticatedJson],
  );

  useEffect(() => {
    if (!accessToken) return;
    const userId = readMatchRequestUserId(accessToken);
    if (!userId) {
      clearMatchRequestSnapshot();
      return;
    }
    const snapshot = loadMatchRequestSnapshot(userId);
    if (!snapshot) return;
    activeMatchRequestIdRef.current = snapshot.matchRequestId;
    void refreshMatchState(snapshot.matchRequestId);
  }, [accessToken, refreshMatchState]);

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
    setState((current) => ({ ...current, isCreatingMatch: true, matchErrorMessage: null }));
    const promise = createMatchRequest(fetchAuthenticatedJson, state.vote.voteAnswerId)
      .then((created) => {
        saveMatchRequestSnapshot(userId, { matchRequestId: created.matchRequestId });
        applyMatchState(created.matchRequestId, created.status, null);
      })
      .catch((error: unknown) => {
        setState((current) => ({
          ...current,
          isCreatingMatch: false,
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
    state.isCreatingMatch,
    state.matchStatus,
    state.vote,
  ]);
  /** 매칭 오류는 기존 요청 상태를 다시 읽거나, 생성 실패라면 같은 답변으로 다시 요청한다. */
  const retryMatching = useCallback(() => {
    if (state.matchRequestId !== null) {
      activeMatchRequestIdRef.current = state.matchRequestId;
      void refreshMatchState(state.matchRequestId);
      return;
    }
    startMatching();
  }, [refreshMatchState, startMatching, state.matchRequestId]);
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
          isMatching={state.isCreatingMatch}
          isSubmitting={state.isSubmitting}
          matchStatus={state.matchStatus}
          result={state.result}
          vote={state.vote}
          onRetry={state.matchErrorMessage ? retryMatching : () => void loadVote()}
          onStartMatching={startMatching}
          onSubmit={(selectedOption) => void submitVote(selectedOption)}
        />
      </div>
      <MainNavigation activeItem="home" />
    </main>
  );
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
