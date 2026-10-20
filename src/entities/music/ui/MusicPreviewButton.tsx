import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getSpotifyTrackId } from '../lib/spotifyTrack';
import './musicPreview.css';

type Props = {
  title: string;
  artistName: string;
  externalUrl?: string | null;
  externalTrackId?: string | null;
};

/** 곡 옆 진입 버튼과 닫을 때 재생 수명이 끝나는 공통 Spotify 패널을 제공한다. */
export function MusicPreviewButton({ title, artistName, externalUrl, externalTrackId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const trackId = getSpotifyTrackId(externalUrl, externalTrackId);

  return (
    <>
      <button
        ref={triggerRef}
        className="music-preview-trigger"
        type="button"
        disabled={!trackId}
        aria-label={`${title} 미리듣기${trackId ? '' : ' 제공 불가'}`}
        title={trackId ? 'Spotify 플레이어 열기' : '이 곡은 미리듣기를 제공할 수 없어요.'}
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen(true);
        }}
      >
        <span aria-hidden="true">▶</span> 미리듣기
      </button>
      {isOpen && trackId
        ? createPortal(
            <MusicPreviewPanel
              trackId={trackId}
              title={title}
              artistName={artistName}
              onClose={() => {
                setIsOpen(false);
                triggerRef.current?.focus();
              }}
            />,
            document.body,
          )
        : null}
    </>
  );
}

/** native modal의 top layer로 기존 시트 위에 한 곡만 띄우고 iframe 제거로 재생을 종료한다. */
function MusicPreviewPanel({
  trackId,
  title,
  artistName,
  onClose,
}: {
  trackId: string;
  title: string;
  artistName: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  /** 배경의 재생 버튼이 다시 초점을 받을 수 있도록 native modal을 먼저 닫는다. */
  const closePanel = () => {
    dialogRef.current?.close();
    onClose();
  };

  useEffect(() => {
    dialogRef.current?.showModal();
    const previousOverflow = document.body.style.overflow;
    // 추천 창이 이미 잠갔다면 그 창의 스크롤 수명에 관여하지 않는다.
    if (previousOverflow === 'hidden') return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      className="music-preview-dialog"
      onCancel={(event) => {
        event.preventDefault();
        closePanel();
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) closePanel();
      }}
      onKeyDown={(event) => {
        // 기존 추천 모달의 ESC/Tab 처리로 이벤트가 전달되지 않게 한다.
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          closePanel();
        }
      }}
    >
      <section className="music-preview-panel">
        <div className="music-preview-heading">
          <div>
            <h2 id={headingId}>미리듣기</h2>
            <p>
              {title} · {artistName}
            </p>
          </div>
          <button type="button" aria-label="미리듣기 닫기" onClick={closePanel}>
            ×
          </button>
        </div>
        {/* locale는 실측에서 동작한 ko를 사용한다. 재생과 번역 제공 범위는 Spotify가 담당한다. */}
        <iframe
          key={trackId}
          title={`${title} Spotify 플레이어`}
          src={`https://open.spotify.com/embed/track/${trackId}?locale=ko`}
          width="100%"
          height="152"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
        />
        <p className="music-preview-help">
          플레이어의 재생 버튼을 눌러 들어보세요. 재생 가능 여부와 길이는 Spotify 제공 범위에 따라
          달라요.
        </p>
      </section>
    </dialog>
  );
}
