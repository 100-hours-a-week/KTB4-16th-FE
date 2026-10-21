import type {
  PreferenceVoteResult,
  TodayPreferenceVote,
} from '../../../features/preference-vote/api/preferenceVoteApi';
import { PreferenceVote } from '../../../features/preference-vote/ui/PreferenceVote';
import './preferenceVoteResultPreviewPage.css';

/** 실제 API나 투표 상태를 건드리지 않고 결과 그래프 디자인만 확인한다. */
export function PreferenceVoteResultPreviewPage() {
  const previewVote: TodayPreferenceVote = {
    voteQuestionId: 1,
    question: '음악을 고를 때 더 중요한 것은 무엇인가요?',
    optionA: '가사에 꽂혀서 저장',
    optionB: '멜로디에 꽂혀서 저장',
    myAnswer: '가사에 꽂혀서 저장',
    voteAnswerId: 1,
  };
  const previewResult: PreferenceVoteResult = {
    voteAnswerId: 1,
    myAnswer: previewVote.optionA,
    optionAPercent: 60,
    optionBPercent: 40,
  };

  return (
    <main className="static-page preference-vote-preview-page">
      <div className="static-page-content">
        <header className="static-page-header">
          <h1 className="static-page-title">취향 투표 결과 미리보기</h1>
          <span className="static-page-chip">개발 전용</span>
        </header>
        <p className="preference-vote-preview-notice" role="note">
          화면 확인용 예시입니다. 실제 투표나 매칭 요청은 전송되지 않습니다.
        </p>
        <PreferenceVote
          vote={previewVote}
          isLoading={false}
          isSubmitting={false}
          result={previewResult}
          errorMessage={null}
          onSubmit={() => undefined}
          onRetry={() => undefined}
          isMatching={false}
          matchStatus="MATCHED"
          onStartMatching={() => undefined}
        />
      </div>
    </main>
  );
}
