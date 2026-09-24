import type { MyPlaceRecord } from '../api/getMyPlaceRecords';

import './myLocksSheet.css';

type MyLocksSheetProps = {
  isOpen: boolean;
  placeCount: number;
  records: MyPlaceRecord[];
  loadState: 'loading' | 'ready' | 'empty' | 'error';
  hasNextPage: boolean;
  isLoadingNextPage: boolean;
  onLoadNextPage: () => void;
  onClose: () => void;
  onExited: () => void;
};

/** 선택한 지도 Place들의 내 자물쇠 목록을 목업의 sheet 형태로 표시한다. */
export function MyLocksSheet({
  isOpen,
  placeCount,
  records,
  loadState,
  hasNextPage,
  isLoadingNextPage,
  onLoadNextPage,
  onClose,
  onExited,
}: MyLocksSheetProps) {
  return (
    <section
      className={`my-locks-sheet${isOpen ? ' is-open' : ''}`}
      aria-label="내 자물쇠 목록"
      onClick={(event) => event.stopPropagation()}
      onTransitionEnd={(event) => {
        if (!isOpen && event.target === event.currentTarget && event.propertyName === 'transform') {
          onExited();
        }
      }}
    >
      <span className="my-locks-sheet-handle" aria-hidden="true" />
      <div className="my-locks-sheet-title-row">
        <div>
          <h2>내 자물쇠</h2>
          <p>선택한 장소 {placeCount}곳</p>
        </div>
        <button type="button" aria-label="내 자물쇠 목록 닫기" onClick={onClose}>
          ×
        </button>
      </div>
      {loadState === 'loading' ? (
        <p className="my-locks-sheet-status">자물쇠를 불러오는 중이에요.</p>
      ) : null}
      {loadState === 'empty' ? (
        <p className="my-locks-sheet-status">이 장소에 남긴 자물쇠가 없어요.</p>
      ) : null}
      {loadState === 'error' ? (
        <p className="my-locks-sheet-status is-error">자물쇠를 불러오지 못했어요.</p>
      ) : null}
      {loadState === 'ready' ? (
        <div className="my-locks-sheet-list">
          {records.map((record) => (
            <article className="my-locks-sheet-row" key={record.recordId}>
              <span className="my-locks-sheet-cover" aria-hidden="true" />
              <span>
                <strong>{record.title}</strong>
                <small>
                  {record.artistName} · {record.createdAt.slice(0, 10).replaceAll('-', '.')}
                </small>
              </span>
            </article>
          ))}
          {hasNextPage ? (
            <button
              className="my-locks-sheet-more"
              type="button"
              onClick={onLoadNextPage}
              disabled={isLoadingNextPage}
            >
              {isLoadingNextPage ? '불러오는 중...' : '더 보기'}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
