import { useNavigate } from 'react-router';

import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import '../../pageShell.css';
import './lockCreatePage.css';

/** 목업의 자물쇠 작성 폼을 API 저장 없이 화면으로 제공한다. */
export function LockCreatePage() {
  const navigate = useNavigate();

  return (
    <main className="static-page">
      <div className="static-page-content lock-create-content">
        <header className="lock-create-header">
          <button
            aria-label="이전 화면으로 돌아가기"
            className="lock-create-back"
            type="button"
            onClick={() => navigate(-1)}
          >
            ‹
          </button>
          <h1 className="static-page-title">자물쇠 만들기</h1>
          <span aria-hidden="true" className="lock-create-header-spacer" />
        </header>
        <p className="lock-create-draft">
          📝 이전에 작성하던 임시저장 내용이 있어요. 이어서 작성할까요?
        </p>
        <div className="lock-create-context">
          <article className="surface-card lock-create-card">
            <small>📍 장소</small>
            <strong>동탄역 카페거리</strong>
            <span>자동 인식됨</span>
          </article>
          <article className="surface-card lock-create-card">
            <small>☁️ 날씨</small>
            <strong>흐림 · 21°C</strong>
            <span>자동 반영됨</span>
          </article>
        </div>
        <section className="surface-card lock-create-card">
          <small>🖼️ 사진</small>
          <label className="lock-create-photo">
            <span aria-hidden="true">▧</span>사진 추가하기
            <input accept="image/jpeg,image/png" type="file" />
          </label>
          <button className="lock-create-ai" disabled type="button">
            🤖 사진으로 음악 추천받기
          </button>
        </section>
        <section className="surface-card lock-create-card">
          <small>🎧 지금 듣고 있는 음악 *</small>
          <label className="lock-create-song">
            <span aria-hidden="true">⌕</span>
            <input maxLength={50} placeholder="곡 제목이나 아티스트 검색" />
          </label>
        </section>
        <section className="surface-card lock-create-card">
          <small>😌 오늘 기분</small>
          <div className="lock-create-mood">
            <span aria-hidden="true">😐</span>
            <input aria-label="오늘 기분" defaultValue="0" max="50" min="-50" type="range" />
          </div>
        </section>
        <section className="surface-card lock-create-card">
          <small>✏️ 하고 싶은 말</small>
          <textarea maxLength={80} placeholder="이 순간을 1~2문장으로 남겨보세요" />
          <span className="lock-create-count">0 / 80</span>
        </section>
        <button className="lock-create-save" disabled type="button">
          🔒 자물쇠 저장하기
        </button>
        <p className="lock-create-autosave">작성 중인 내용은 자동으로 임시저장됩니다</p>
      </div>
      <MainNavigation activeItem="dashboard" />
    </main>
  );
}
