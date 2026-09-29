import { useEffect, useRef } from 'react';
import './homePlaylistSheet.css';
import { FeatureUnavailableNotice } from '../../../shared/ui/FeatureUnavailableNotice';

type HomePlaylistSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  onExited: () => void;
};

/** 추천 API 연동 전 플레이리스트를 가짜 곡 없이 구현 예정으로 안내한다. */
export function HomePlaylistSheet({ isOpen, onClose, onExited }: HomePlaylistSheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const activeElement = document.activeElement;
    const previousFocus =
      activeElement instanceof HTMLElement && activeElement !== document.body
        ? activeElement
        : null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen]);

  return (
    <section
      className={`home-playlist-sheet${isOpen ? ' is-open' : ''}`}
      aria-label="AI 추천 플레이리스트"
      aria-hidden={!isOpen}
      inert={!isOpen}
      role="region"
      onClick={(event) => event.stopPropagation()}
      onTransitionEnd={(event) => {
        if (!isOpen && event.target === event.currentTarget && event.propertyName === 'transform') {
          onExited();
        }
      }}
    >
      <span className="home-playlist-handle" aria-hidden="true" />
      <button
        ref={closeButtonRef}
        className="home-playlist-close"
        type="button"
        aria-label="플레이리스트 안내 닫기"
        onClick={onClose}
      >
        ×
      </button>
      <FeatureUnavailableNotice
        description="추천 플레이리스트 기능을 구현할 예정이에요."
        title="AI 추천 플레이리스트"
      />
    </section>
  );
}
