import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useSession } from '../../../entities/session/model/useSession';
import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import type { MusicSearchResult } from '../../../features/music-search/model/musicSearch.types';
import { MusicSearchField } from '../../../features/music-search/ui/MusicSearchField';
import '../../pageShell.css';
import './lockCreatePage.css';

/** 음악 검색 선택만 실제 연동하고 저장·사진 기능은 미구현으로 유지하는 자물쇠 작성 화면이다. */
export function LockCreatePage() {
  const navigate = useNavigate();
  const { fetchAuthenticatedJson } = useSession();
  const [selectedTrack, setSelectedTrack] = useState<MusicSearchResult | null>(null);

  /** 검색 결과에서 선택한 음악을 현재 작성 화면에만 보관한다. */
  const handleTrackSelect = (track: MusicSearchResult) => {
    setSelectedTrack(track);
  };

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
          <div className="lock-create-photo" role="status">
            <span aria-hidden="true">▧</span>사진 추가 기능은 미구현입니다.
          </div>
          <button className="lock-create-ai" disabled type="button">
            🤖 사진으로 음악 추천받기
          </button>
        </section>
        <section className="surface-card lock-create-card">
          <small>🎧 지금 듣고 있는 음악 *</small>
          <MusicSearchField onSelect={handleTrackSelect} request={fetchAuthenticatedJson} />
          {selectedTrack ? (
            <p className="lock-create-selected-song">
              선택한 음악: {selectedTrack.title} — {selectedTrack.artistName}
            </p>
          ) : null}
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
        <p className="lock-create-autosave">자물쇠 저장 기능은 미구현입니다.</p>
      </div>
      <MainNavigation activeItem="dashboard" />
    </main>
  );
}
