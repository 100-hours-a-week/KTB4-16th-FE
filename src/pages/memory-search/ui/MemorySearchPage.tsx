import { Link } from 'react-router';

import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import { FeatureUnavailableNotice } from '../../../shared/ui/FeatureUnavailableNotice';
import '../../pageShell.css';
import './memorySearchPage.css';

/** V1 제외인 기억 검색을 가짜 결과 없이 구현 예정 상태로 제공한다. */
export function MemorySearchPage() {
  return (
    <main className="static-page">
      <div className="static-page-content memory-search-content">
        <header className="memory-search-header">
          <Link aria-label="홈으로 돌아가기" className="memory-search-back-button" to="/">
            ‹
          </Link>
          <h1 className="static-page-title">AI 기억 검색</h1>
          <span aria-hidden="true" className="memory-search-header-spacer" />
        </header>
        <FeatureUnavailableNotice
          description="기억 검색 기능은 V1 이후 구현할 예정이에요."
          title="AI 기억 검색"
        />
      </div>
      <MainNavigation activeItem="home" />
    </main>
  );
}
