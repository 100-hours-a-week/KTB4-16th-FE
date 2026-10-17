import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';

import { useSession } from '../../../entities/session/model/useSession';
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
}
const initialVotePageState: VotePageState = {
  vote: null,
  result: null,
  errorMessage: null,
  isLoading: true,
  isSubmitting: false,
};

/** 오늘의 취향 투표를 조회하고, 한 번의 답변 제출 흐름을 조립한다. */
export function MatchingPage() {
  const { fetchAuthenticatedJson } = useSession();
  const [state, setState] = useState<VotePageState>(initialVotePageState);
  const loadVote = useCallback(async () => {
    setState((current) => ({ ...current, errorMessage: null, isLoading: true }));
    try {
      const vote = await getTodayPreferenceVote(fetchAuthenticatedJson);
      setState({ vote, result: null, errorMessage: null, isLoading: false, isSubmitting: false });
    } catch (error: unknown) {
      setState((current) => ({
        ...current,
        errorMessage: getVoteErrorMessage(error),
        isLoading: false,
        isSubmitting: false,
      }));
    }
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
          isSubmitting={state.isSubmitting}
          result={state.result}
          vote={state.vote}
          onRetry={() => void loadVote()}
          onSubmit={(selectedOption) => void submitVote(selectedOption)}
        />
      </div>
      <MainNavigation activeItem="home" />
    </main>
  );
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
