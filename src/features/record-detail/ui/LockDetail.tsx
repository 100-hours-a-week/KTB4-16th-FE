import { useRef, useState } from 'react';

import { getMoodEmoji } from '../../../entities/record/model/mood';
import type { LockDetailData } from '../model/lockDetail.types';
import './lockDetail.css';

type Props = {
  detail: LockDetailData;
  isOwner: boolean;
  onClose: () => void;
  onSaveComment: (comment: string | null) => Promise<string | null>;
  onDelete: () => Promise<void>;
  onDeleted: () => void;
};

/** 자물쇠 상세 정보와 소유자용 코멘트 수정·삭제 UI를 제공한다. */
export function LockDetail({
  detail,
  isOwner,
  onClose,
  onSaveComment,
  onDelete,
  onDeleted,
}: Props) {
  const [comment, setComment] = useState<string | null>(detail.comment);
  const [commentDraft, setCommentDraft] = useState('');
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const commentSaveInFlightRef = useRef(false);
  const deleteInFlightRef = useRef(false);

  const startCommentEditing = () => {
    setCommentDraft(comment ?? '');
    setCommentError('');
    setIsEditingComment(true);
  };

  const cancelCommentEditing = () => {
    setCommentDraft(comment ?? '');
    setCommentError('');
    setIsEditingComment(false);
  };

  /** 서버 저장이 성공한 뒤에만 마지막 성공 코멘트와 읽기 모드를 갱신한다. */
  const saveComment = async () => {
    if (commentSaveInFlightRef.current) return;

    commentSaveInFlightRef.current = true;
    setIsSavingComment(true);
    setCommentError('');

    try {
      const savedComment = await onSaveComment(commentDraft.trim() || null);
      setComment(savedComment);
      setCommentDraft(savedComment ?? '');
      setIsEditingComment(false);
    } catch {
      setCommentError('코멘트를 저장하지 못했어요. 다시 시도해주세요.');
    } finally {
      commentSaveInFlightRef.current = false;
      setIsSavingComment(false);
    }
  };

  /** 삭제가 성공한 뒤에만 상세 화면을 떠나고, 실패하면 모달을 유지한다. */
  const confirmDelete = async () => {
    if (deleteInFlightRef.current) return;

    deleteInFlightRef.current = true;
    setIsDeleting(true);
    setDeleteError('');

    try {
      await onDelete();
      setIsDeleteDialogOpen(false);
      onDeleted();
    } catch {
      setDeleteError('자물쇠를 삭제하지 못했어요. 다시 시도해주세요.');
    } finally {
      deleteInFlightRef.current = false;
      setIsDeleting(false);
    }
  };

  return (
    <>
      <article className="lock-detail">
        <header className="lock-detail-photo">
          {detail.photoUrl ? (
            <img
              alt={`${detail.place.legalDongName ?? '위치 정보 없음'}에 남긴 자물쇠 사진`}
              src={detail.photoUrl}
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />
          ) : null}
          <button
            aria-label="자물쇠 상세 닫기"
            className="lock-detail-close"
            type="button"
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
          <span className="lock-detail-place">
            📍 {detail.place.legalDongName ?? '확인할 수 없음'}
          </span>
        </header>

        <div className="lock-detail-body">
          <time className="lock-detail-date" dateTime={detail.createdAt}>
            {formatRecordDateTime(detail.createdAt)}
          </time>

          <section className="lock-detail-music" aria-label="등록된 음악">
            <span className="lock-detail-album">
              <img
                alt={`${detail.music.title} - ${detail.music.artistName} 앨범 커버`}
                src={detail.music.albumImageUrl}
                onError={(event) => {
                  event.currentTarget.hidden = true;
                }}
              />
            </span>
            <span>
              <strong>{detail.music.title}</strong>
              <small>{detail.music.artistName}</small>
            </span>
            <span aria-hidden="true" className="lock-detail-music-note">
              ♪
            </span>
          </section>

          <div className="lock-detail-meta">
            <section>
              <small>WEATHER</small>
              <strong>{formatWeather(detail.weatherCondition, detail.temperature)}</strong>
            </section>
            <section>
              <small>MOOD</small>
              <strong className="lock-detail-mood-emoji" role="img" aria-label="현재 기분">
                {getMoodEmoji(detail.moodScore)}
              </strong>
            </section>
          </div>

          <section className="lock-detail-comment">
            <div className="lock-detail-section-heading">
              <h2>{isEditingComment ? '코멘트 (수정 중)' : '코멘트'}</h2>
              {isOwner && !isEditingComment ? (
                <button type="button" onClick={startCommentEditing}>
                  {comment ? '수정' : '코멘트 추가'}
                </button>
              ) : null}
            </div>

            {isEditingComment ? (
              <div className="lock-detail-comment-editor">
                <textarea
                  aria-label="코멘트 입력"
                  disabled={isSavingComment}
                  maxLength={80}
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                />
                <span className="lock-detail-comment-count">{commentDraft.length} / 80</span>
                {commentError ? (
                  <p className="lock-detail-comment-error" role="alert">
                    {commentError}
                  </p>
                ) : null}
                <div className="lock-detail-comment-actions">
                  <button type="button" disabled={isSavingComment} onClick={cancelCommentEditing}>
                    취소
                  </button>
                  <button
                    type="button"
                    disabled={isSavingComment}
                    onClick={() => void saveComment()}
                  >
                    {isSavingComment ? '저장 중…' : '저장'}
                  </button>
                </div>
              </div>
            ) : comment ? (
              <p>“{comment}”</p>
            ) : (
              <p className="lock-detail-empty-comment">아직 남긴 코멘트가 없어요.</p>
            )}
          </section>

          {isOwner ? (
            <button
              className="lock-detail-delete"
              type="button"
              disabled={isDeleting}
              onClick={() => {
                setDeleteError('');
                setIsDeleteDialogOpen(true);
              }}
            >
              자물쇠 삭제
            </button>
          ) : null}
        </div>
      </article>

      {isDeleteDialogOpen ? (
        <div className="lock-detail-dialog-backdrop">
          <section
            aria-describedby="lock-delete-description"
            aria-labelledby="lock-delete-title"
            aria-modal="true"
            className="lock-detail-dialog"
            role="dialog"
          >
            <h2 id="lock-delete-title">이 자물쇠를 삭제하시겠어요?</h2>
            <p id="lock-delete-description">삭제한 자물쇠는 복구할 수 없어요.</p>
            {deleteError ? (
              <p className="lock-detail-delete-error" role="alert">
                {deleteError}
              </p>
            ) : null}
            <div>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                취소
              </button>
              <button
                className="danger"
                type="button"
                disabled={isDeleting}
                onClick={() => void confirmDelete()}
              >
                {isDeleting ? '삭제 중…' : '삭제'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function formatRecordDateTime(createdAt: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(createdAt);
  return match ? `${match[1]}.${match[2]}.${match[3]} · ${match[4]}:${match[5]}` : createdAt;
}

function formatWeather(
  weatherCondition: LockDetailData['weatherCondition'],
  temperature: number | null,
): string {
  const values: string[] = [];
  if (weatherCondition !== null) values.push(weatherCondition);
  if (temperature !== null) values.push(`${temperature}°C`);
  return values.length > 0 ? values.join(' · ') : '날씨 정보 없음';
}
