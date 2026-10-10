import { useEffect, useRef, useState } from 'react';

import { PREFERRED_GENRES, type PreferredGenre } from '../../../entities/user/model/user.types';
import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { updatePreferredGenres } from '../api/genreOnboardingApi';
import './genreOnboardingSheet.css';

type Props = {
  request: AuthenticatedApiClient['fetchJson'];
  onSaved: (preferredGenres: PreferredGenre[] | null) => void;
};

/** 홈에서 현재 사용자의 선호 장르를 최초 설정하는 modal sheet다. */
export function GenreOnboardingSheet({ request, onSaved }: Props) {
  const [selectedGenres, setSelectedGenres] = useState<PreferredGenre[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    const activeElement = document.activeElement;
    const previousFocus =
      activeElement instanceof HTMLElement && activeElement !== document.body
        ? activeElement
        : null;
    titleRef.current?.focus();

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      const buttons = Array.from(
        dialog?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
      );
      if (buttons.length === 0) return;

      const firstButton = buttons[0];
      const lastButton = buttons[buttons.length - 1];
      const activeElement = document.activeElement;
      if (dialog && !dialog.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? lastButton : firstButton).focus();
      } else if (
        event.shiftKey &&
        (activeElement === firstButton || activeElement === titleRef.current)
      ) {
        event.preventDefault();
        lastButton.focus();
      } else if (!event.shiftKey && activeElement === lastButton) {
        event.preventDefault();
        firstButton.focus();
      }
    };

    document.addEventListener('keydown', handleTabKey);
    return () => {
      document.removeEventListener('keydown', handleTabKey);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  /** 한 사용자의 장르 선택을 토글하고 세 개 상한을 지킨다. */
  function toggleGenre(genre: PreferredGenre) {
    setErrorMessage(null);
    setSelectedGenres((current) => {
      if (current.includes(genre)) {
        return current.filter((selected) => selected !== genre);
      }

      return current.length < 3 ? [...current, genre] : current;
    });
  }

  /** 서버 저장 성공 후에만 부모에게 완료 상태를 전달한다. */
  async function saveGenres(preferredGenres: PreferredGenre[]) {
    if (isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await updatePreferredGenres(request, preferredGenres);
      onSaved(preferredGenres.length > 0 ? preferredGenres : null);
    } catch {
      setErrorMessage('선호 장르를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  const isAtSelectionLimit = selectedGenres.length === 3;

  return (
    <div className="genre-onboarding-overlay">
      <section
        ref={dialogRef}
        aria-labelledby="genre-onboarding-title"
        aria-modal="true"
        aria-describedby="genre-onboarding-description"
        aria-busy={isSubmitting}
        className="genre-onboarding-sheet"
        role="dialog"
      >
        <span className="genre-onboarding-handle" aria-hidden="true" />
        <h2 id="genre-onboarding-title" ref={titleRef} tabIndex={-1}>
          🎧 어떤 음악을 좋아하세요?
        </h2>
        <p id="genre-onboarding-description" className="genre-onboarding-description">
          좋아하는 장르를 알려주시면
          <br />
          취향에 맞는 경험을 준비할게요.
        </p>
        <p className="genre-onboarding-limit">최대 3개까지 선택할 수 있어요.</p>

        <div className="genre-onboarding-grid" aria-label="선호 장르 선택">
          {PREFERRED_GENRES.map((genre) => {
            const isSelected = selectedGenres.includes(genre);

            return (
              <button
                key={genre}
                aria-pressed={isSelected}
                className={`genre-onboarding-chip${isSelected ? ' is-selected' : ''}`}
                disabled={isSubmitting || (isAtSelectionLimit && !isSelected)}
                type="button"
                onClick={() => toggleGenre(genre)}
              >
                {genre}
              </button>
            );
          })}
        </div>

        <p className="genre-onboarding-count" role="status" aria-live="polite">
          {selectedGenres.length} / 3 선택
        </p>
        {errorMessage ? (
          <p className="genre-onboarding-error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <button
          className="genre-onboarding-submit"
          disabled={selectedGenres.length === 0 || isSubmitting}
          type="button"
          onClick={() => void saveGenres(selectedGenres)}
        >
          {isSubmitting ? '저장 중…' : '완료'}
        </button>
        <button
          className="genre-onboarding-skip"
          disabled={isSubmitting}
          type="button"
          onClick={() => void saveGenres([])}
        >
          선택하지 않음
        </button>
      </section>
    </div>
  );
}
