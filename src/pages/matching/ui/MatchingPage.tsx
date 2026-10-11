import { Link } from 'react-router';

import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import { FeatureUnavailableNotice } from '../../../shared/ui/FeatureUnavailableNotice';
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
          <h1 className="static-page-title">밸런스 게임</h1>
          <span aria-hidden="true" className="matching-page-header-spacer" />
        </header>
        <FeatureUnavailableNotice
          description="랜덤 매칭 채팅 기능은 준비 중이에요."
          title="랜덤 매칭 채팅"
        />
      </div>
      <MainNavigation activeItem="home" />
    </main>
  );
}
