import { useState } from 'react';

import './preferenceVote.css';

type PreferenceVoteAnswer = 'O' | 'X';

interface PreferenceVoteProps {
  question: string | null;
  onVoteOnly?: (answer: PreferenceVoteAnswer) => void;
  onStartMatching?: (answer: PreferenceVoteAnswer) => void;
}

/** 질문이 없거나 투표 API가 연결되지 않은 상태를 포함해 취향 투표 UI를 표시한다. */
export function PreferenceVote({ question, onVoteOnly, onStartMatching }: PreferenceVoteProps) {
  const [selection, setSelection] = useState<{
    question: string;
    answer: PreferenceVoteAnswer;
  } | null>(null);
  const selectedAnswer =
    question !== null && selection?.question === question ? selection.answer : null;

  const canContinue = question !== null && selectedAnswer !== null;

  return (
    <section aria-label="취향 투표" className="preference-vote">
      <section aria-labelledby="preference-vote-question" className="preference-vote-hero">
        <span className="preference-vote-tag">PREFERENCE VOTE</span>
        <h2 id="preference-vote-question">{question ?? '취향 투표 질문을 준비하고 있어요.'}</h2>
      </section>

      <fieldset className="preference-vote-choices" disabled={question === null}>
        <legend className="preference-vote-visually-hidden">질문에 대한 답을 선택하세요</legend>
        <button
          aria-pressed={selectedAnswer === 'O'}
          className={
            selectedAnswer === 'O' ? 'preference-vote-choice is-selected' : 'preference-vote-choice'
          }
          type="button"
          onClick={() => question && setSelection({ question, answer: 'O' })}
        >
          <span aria-hidden="true">⭕</span> 그렇다
        </button>
        <button
          aria-pressed={selectedAnswer === 'X'}
          className={
            selectedAnswer === 'X' ? 'preference-vote-choice is-selected' : 'preference-vote-choice'
          }
          type="button"
          onClick={() => question && setSelection({ question, answer: 'X' })}
        >
          <span aria-hidden="true">❌</span> 아니다
        </button>
      </fieldset>

      <section
        aria-labelledby="preference-vote-result-title"
        className="preference-vote-result surface-card"
      >
        <h2 id="preference-vote-result-title">투표 결과</h2>
        <p role="status">투표 결과가 제공되면 여기에 표시돼요.</p>
      </section>

      <div className="preference-vote-actions">
        <button
          className="preference-vote-vote-button"
          disabled={!canContinue || onVoteOnly === undefined}
          type="button"
          onClick={() => selectedAnswer && onVoteOnly?.(selectedAnswer)}
        >
          투표만 하기
        </button>
        <button
          className="preference-vote-match-button"
          disabled={!canContinue || onStartMatching === undefined}
          type="button"
          onClick={() => selectedAnswer && onStartMatching?.(selectedAnswer)}
        >
          의견 다른 사람과 채팅하기
        </button>
      </div>
      <p className="preference-vote-unavailable" role="status">
        질문, 투표, 매칭 기능이 준비되면 이용할 수 있어요.
      </p>
    </section>
  );
}
