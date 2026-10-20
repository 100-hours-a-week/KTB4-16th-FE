import { useCallback, useEffect, useRef, useState } from 'react';

import type { CursorPage } from '../api/friendApi';

type Loader<T> = (cursor: string | null, signal: AbortSignal) => Promise<CursorPage<T>>;
type ListState<T> = {
  items: T[];
  nextCursor: string | null;
  status: 'loading' | 'ready' | 'error';
  error: unknown;
  loadingMore: boolean;
};

/** 한 종류의 친구 목록만 갱신하고 이전 세대의 늦은 페이지 응답을 무시한다. */
export function useFriendList<T>(loader: Loader<T>, idOf: (item: T) => number) {
  const controllerRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<ListState<T>>({
    items: [],
    nextCursor: null,
    status: 'loading',
    error: null,
    loadingMore: false,
  });

  /** 갱신·삭제·화면 종료 전에 실행 중인 조회가 목록을 덮어쓰지 못하게 한다. */
  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  /** 첫 페이지는 기존 카드를 유지하며 갱신하고 다음 페이지는 ID 중복 없이 추가한다. */
  const load = useCallback(
    async (cursor: string | null) => {
      cancel();
      const controller = new AbortController();
      controllerRef.current = controller;
      setState((current) => ({
        ...current,
        error: null,
        loadingMore: cursor !== null,
        status: current.status === 'error' ? 'loading' : current.status,
      }));
      try {
        const page = await loader(cursor, controller.signal);
        if (controller.signal.aborted || controllerRef.current !== controller) return;
        setState((current) => ({
          items: cursor === null ? page.items : appendDistinct(current.items, page.items, idOf),
          nextCursor: page.nextCursor,
          status: 'ready',
          error: null,
          loadingMore: false,
        }));
      } catch (error: unknown) {
        if (controller.signal.aborted || controllerRef.current !== controller) return;
        setState((current) => ({
          ...current,
          error,
          loadingMore: false,
          status: current.status === 'ready' ? 'ready' : 'error',
        }));
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
      }
    },
    [cancel, loader, idOf],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => void load(null));
    return () => {
      cancelAnimationFrame(frame);
      cancel();
    };
  }, [load, cancel]);

  /** 서버에서 삭제가 확인된 항목을 제거하고 삭제 전 조회의 재등장을 방지한다. */
  function remove(id: number) {
    cancel();
    setState((current) => ({
      ...current,
      items: current.items.filter((item) => idOf(item) !== id),
      loadingMore: false,
    }));
  }

  /** 현재 커서 요청이 진행 중이면 동일 페이지를 중복 호출하지 않는다. */
  function loadMore() {
    if (state.nextCursor !== null && controllerRef.current === null) void load(state.nextCursor);
  }

  return { ...state, refresh: () => load(null), loadMore, remove };
}

/** 실시간 변경으로 페이지가 겹쳐도 같은 사용자·요청을 한 번만 표시한다. */
function appendDistinct<T>(current: T[], incoming: T[], idOf: (item: T) => number): T[] {
  const ids = new Set(current.map(idOf));
  return [
    ...current,
    ...incoming.filter((item) => {
      const id = idOf(item);
      if (ids.has(id)) return false;
      ids.add(id);
      return true;
    }),
  ];
}
