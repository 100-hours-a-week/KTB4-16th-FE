import { FormEvent, useState } from 'react';
import { Link } from 'react-router';

import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import '../../pageShell.css';
import './memorySearchPage.css';

/** 목업의 입력 흐름만 재현하며 외부 검색 요청은 수행하지 않는다. */
export function MemorySearchPage() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();

    if (trimmedQuery) {
      setSubmittedQuery(trimmedQuery);
    }
  }

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
        <section className="memory-search-results" aria-live="polite">
          {submittedQuery ? (
            <>
              <p className="memory-query">{submittedQuery}</p>
              <article className="memory-answer">
                홍대 근처에서 비 오는 날 저장하신 자물쇠 2건을 찾았어요.
                <div className="memory-result-card">
                  <span className="memory-result-cover" aria-hidden="true" />
                  <span>
                    <strong>비 오는 날엔 — 헤이즈</strong>
                    <small>홍대입구 · 2026.03.14 · 🌧️</small>
                  </span>
                </div>
              </article>
            </>
          ) : (
            <p className="memory-search-empty">기억나는 단서로 음악과 장소를 찾아보세요.</p>
          )}
        </section>
        <form className="memory-search-form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="memory-query">
            기억 단서
          </label>
          <input
            id="memory-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="기억나는 단서로 물어보세요"
          />
          <button aria-label="기억 검색" disabled={!query.trim()} type="submit">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m5 12 14-7-7 14-2-5-5-2Z" />
            </svg>
          </button>
        </form>
      </div>
      <MainNavigation activeItem="home" />
    </main>
  );
}
