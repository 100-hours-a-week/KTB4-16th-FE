import { useEffect, useId, useRef, type ReactNode } from 'react';

/** 친구 추가·관리·삭제에서 포커스와 Escape, 원래 버튼 복귀를 일관되게 처리한다. */
export function FriendsDialog({
  title,
  children,
  busy = false,
  onClose,
  returnFocusTo,
}: {
  title: string;
  children: ReactNode;
  busy?: boolean;
  onClose: () => void;
  returnFocusTo: HTMLElement | null;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const handlerRef = useRef({ onClose, busy });
  useEffect(() => {
    handlerRef.current = { onClose, busy };
  }, [onClose, busy]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = returnFocusTo;
    /** 활성 입력·버튼만 순회해 Tab이 모달 바깥으로 나가지 않게 한다. */
    function focusable() {
      return Array.from(
        dialog!.querySelectorAll<HTMLElement>(
          'input:not(:disabled), button:not(:disabled), a[href]',
        ),
      );
    }
    /** 닫을 수 있을 때 Escape를 처리하고 모달 내부에 키보드 포커스를 유지한다. */
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !handlerRef.current.busy) {
        event.preventDefault();
        handlerRef.current.onClose();
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    dialog.addEventListener('keydown', onKeyDown);
    return () => {
      dialog.removeEventListener('keydown', onKeyDown);
      // inert 해제가 반영된 뒤 복귀하며 StrictMode의 열림 중 정리에서는 배경을 건드리지 않는다.
      queueMicrotask(() => {
        const target = previousFocus?.isConnected
          ? previousFocus
          : document.querySelector<HTMLElement>('.friends-add-button');
        if (target && !target.closest('[inert]')) target.focus();
      });
    };
  }, [returnFocusTo]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    (
      dialog.querySelector<HTMLElement>('input, [data-dialog-autofocus]') ??
      dialog.querySelector<HTMLElement>('button') ??
      dialog
    ).focus();
  }, [title]);

  return (
    <div className="friends-dialog-backdrop">
      <section
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-modal="true"
        className="friends-dialog"
        role="dialog"
        tabIndex={-1}
      >
        <header className="friends-dialog-header">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="friend-icon-button"
            aria-label="창 닫기"
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
