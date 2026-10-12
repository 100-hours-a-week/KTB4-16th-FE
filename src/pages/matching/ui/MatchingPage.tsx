import { Link } from 'react-router';

import { PreferenceVote } from '../../../features/preference-vote/ui/PreferenceVote';
import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import '../../pageShell.css';
import './matchingPage.css';

/** 랜덤 매칭 기능의 준비 상태를 안내한다. */
export function MatchingPage() {
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
        <PreferenceVote question={null} />
      </div>
      <MainNavigation activeItem="home" />
    </main>
  );
}
