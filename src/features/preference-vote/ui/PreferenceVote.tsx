import { useState } from 'react';

import type { PreferenceVoteResult, TodayPreferenceVote } from '../api/preferenceVoteApi';
import './preferenceVote.css';

type PreferenceVoteOption = 'A' | 'B';
type MatchStatus = 'WAITING' | 'MATCHING' | 'MATCHED' | 'EXPIRED' | 'FAILED';

interface PreferenceVoteProps {
  vote: TodayPreferenceVote | null;
  isLoading: boolean;
  isSubmitting: boolean;
  result: PreferenceVoteResult | null;
  errorMessage: string | null;
  onSubmit: (selectedOption: PreferenceVoteOption) => void;
  onRetry: () => void;
  isMatching: boolean;
  matchStatus: MatchStatus | null;
  onStartMatching: () => void;
}

/** 오늘의 질문, 기존 응답과 제출 결과를 표시하고 A/B 답변을 선택하게 한다. */
export function PreferenceVote({
  vote,
  isLoading,
  isSubmitting,
  result,
  errorMessage,
  onSubmit,
  onRetry,
  isMatching,
  matchStatus,
  onStartMatching,
}: PreferenceVoteProps) {
  const [selection, setSelection] = useState<{
    voteQuestionId: number;
    selectedOption: PreferenceVoteOption;
  } | null>(null);
  const restoredOption = vote ? optionForAnswer(vote) : null;
  const isAnswered = vote !== null && vote.voteAnswerId != null;
  const selectedOption =
    vote && selection?.voteQuestionId === vote.voteQuestionId ? selection.selectedOption : null;
  const currentOption = isAnswered ? restoredOption : selectedOption;

  const canSubmit = vote !== null && currentOption !== null && !isAnswered && !isSubmitting;
  return (
    <section aria-label="취향 투표" className="preference-vote">
      <section aria-labelledby="preference-vote-question" className="preference-vote-hero">
        <span className="preference-vote-tag">PREFERENCE VOTE</span>
        <h2 id="preference-vote-question">
          {isLoading
            ? '오늘의 취향 투표를 불러오고 있어요.'
            : (vote?.question ?? '취향 투표 질문을 준비하고 있어요.')}
        </h2>
      </section>
      <fieldset
        className="preference-vote-choices"
        disabled={vote === null || isAnswered || isSubmitting}
      >
        <legend className="preference-vote-visually-hidden">질문에 대한 답을 선택하세요</legend>
        <button
          aria-pressed={currentOption === 'A'}
          className={
            currentOption === 'A' ? 'preference-vote-choice is-selected' : 'preference-vote-choice'
          }
          type="button"
          onClick={() =>
            vote && setSelection({ voteQuestionId: vote.voteQuestionId, selectedOption: 'A' })
          }
        >
          <span aria-hidden="true">⭕</span> {vote?.optionA ?? '그렇다'}
        </button>
        <button
          aria-pressed={currentOption === 'B'}
          className={
            currentOption === 'B' ? 'preference-vote-choice is-selected' : 'preference-vote-choice'
          }
          type="button"
          onClick={() =>
            vote && setSelection({ voteQuestionId: vote.voteQuestionId, selectedOption: 'B' })
          }
        >
          <span aria-hidden="true">❌</span> {vote?.optionB ?? '아니다'}
        </button>
      </fieldset>
      {vote !== null ? (
        <section
          aria-labelledby="preference-vote-result-title"
          className="preference-vote-result surface-card"
        >
          <h2 id="preference-vote-result-title">투표 결과</h2>
          {result ? (
            <p role="status">
              {vote.optionA} {result.optionAPercent}% · {vote.optionB} {result.optionBPercent}%
            </p>
          ) : isAnswered ? (
            <p role="status">이미 참여한 투표입니다. 선택: {vote.myAnswer}</p>
          ) : (
            <p role="status">투표하면 현재 결과 비율을 확인할 수 있어요.</p>
          )}
        </section>
      ) : null}
      {errorMessage ? (
        <div className="preference-vote-error" role="alert">
          <p>{errorMessage}</p>
          {!isSubmitting && (
            <button type="button" onClick={onRetry}>
              다시 시도
            </button>
          )}
        </div>
      ) : null}
      <div className="preference-vote-actions">
        <button
          className="preference-vote-vote-button"
          disabled={!canSubmit}
          type="button"
          onClick={() => currentOption && onSubmit(currentOption)}
        >
          {isSubmitting ? '투표 중...' : isAnswered ? '투표 완료' : '투표하기'}
        </button>
        <button
          className="preference-vote-match-button"
          disabled={vote?.voteAnswerId == null || isMatching || matchStatus !== null}
          type="button"
          onClick={() => onStartMatching()}
        >
          {isMatching ? '매칭 요청 중...' : '의견 다른 사람과 채팅하기'}
        </button>
      </div>
      {matchStatus ? <MatchStatusNotice status={matchStatus} /> : null}
    </section>
  );
}

/** 서버가 확정한 매칭 상태만 사용자에게 안내하고, 완료 이동은 페이지가 처리한다. */
function MatchStatusNotice({ status }: { status: MatchStatus }) {
  const message =
    status === 'WAITING'
      ? '의견이 다른 상대를 찾고 있어요.'
      : status === 'MATCHING'
        ? '상대를 찾았어요. 채팅방을 준비하고 있어요.'
        : status === 'MATCHED'
          ? '채팅방으로 이동하고 있어요.'
          : status === 'FAILED'
            ? '채팅방을 만드는 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.'
            : '오늘의 매칭 요청이 만료되었어요.';
  return (
    <p className="preference-vote-unavailable" role="status">
      {message}
    </p>
  );
}

/** 서버가 반환한 실제 선택지 텍스트를 화면의 A/B 상태로 변환한다. */
function optionForAnswer(vote: TodayPreferenceVote): PreferenceVoteOption | null {
  if (vote.myAnswer === vote.optionA) return 'A';
  if (vote.myAnswer === vote.optionB) return 'B';
  return null;
}
