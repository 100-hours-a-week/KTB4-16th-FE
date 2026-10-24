import { type TransitionEvent, useCallback, useEffect, useRef } from 'react';

// 모바일의 260ms transform 전환 뒤 여유를 두고 PC·모션 감소 환경도 완료한다.
const EXIT_FALLBACK_MS = 300;

/** 시트의 닫힘을 이벤트 또는 타이머 중 한 번만 완료하고 재진입 시 취소한다. */
export function useMapSheetExit(isOpen: boolean, onExited: () => void) {
  const callbackRef = useRef(onExited);
  const wasOpenRef = useRef(isOpen);
  const closingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callbackRef.current = onExited;
  }, [onExited]);

  /** 같은 닫힘의 늦은 전환 이벤트와 타이머가 중복 통지하지 못하게 한다. */
  const completeExit = useCallback(() => {
    if (!closingRef.current) return;
    closingRef.current = false;
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    callbackRef.current();
  }, []);

  useEffect(() => {
    if (isOpen) {
      closingRef.current = false;
    } else if (wasOpenRef.current) {
      closingRef.current = true;
      timeoutRef.current = setTimeout(completeExit, EXIT_FALLBACK_MS);
    }
    wasOpenRef.current = isOpen;

    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    };
  }, [isOpen, completeExit]);

  /** 자식 전환은 무시하고 이 시트의 transform 종료만 완료 신호로 사용한다. */
  return useCallback(
    (event: TransitionEvent<HTMLElement>) => {
      if (event.target === event.currentTarget && event.propertyName === 'transform') {
        completeExit();
      }
    },
    [completeExit],
  );
}
