import { useEffect, useRef, type KeyboardEvent } from 'react';

interface SheetFocusOptions {
  open: boolean;
  onClose: () => void;
  restoreFocus: () => void;
}

/** 전체보기의 초기 초점·키보드 순환·닫기 후 복귀를 현재 화면 수명 안에서 관리한다. */
export function useMemorySearchSheetFocus({ open, onClose, restoreFocus }: SheetFocusOptions) {
  const sheetRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // 배경이 inert로 바뀐 뒤 시트에 초점을 주고, 닫혀 배경이 활성화된 뒤 원래 버튼으로 돌린다.
  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus({ preventScroll: true });
    return restoreFocus;
  }, [open, restoreFocus]);

  /** Esc는 전체보기만 닫고, Tab과 Shift+Tab은 시트의 버튼 사이에서 순환시킨다. */
  function handleSheetKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    // 현재 전체보기의 상호작용 요소는 닫기 버튼과 자물쇠 상세보기 버튼이다.
    const buttons = sheetRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
    if (!buttons?.length) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return { sheetRef, closeButtonRef, handleSheetKeyDown };
}
