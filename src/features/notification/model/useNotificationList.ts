import { useCallback, useEffect, useRef, useState } from 'react';

import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import {
  deleteNotification,
  getNotifications,
  markNotificationsRead,
  type NotificationItem,
} from '../api/notificationApi';

/** 알림 cursor 조회와 페이지별 읽음 처리를 관리하고 실패한 읽음은 목록과 독립적으로 재시도한다. */
export function useNotificationList(request: AuthenticatedApiClient['fetchJson']) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [readError, setReadError] = useState('');
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteErrorId, setDeleteErrorId] = useState<number | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const pendingReadIds = useRef(new Set<number>());
  const deleteInFlight = useRef(false);

  /** 서버에는 즉시 읽음을 저장하되 이번 방문에서 본 새 알림의 강조는 화면을 떠날 때까지 유지한다. */
  const saveRead = useCallback(
    async (signal: AbortSignal) => {
      const ids = [...pendingReadIds.current];
      if (ids.length === 0) return;
      try {
        await markNotificationsRead(ids, request, signal);
        if (signal.aborted) return;
        ids.forEach((id) => pendingReadIds.current.delete(id));
        setReadError('');
      } catch {
        if (!signal.aborted) setReadError('읽음 상태를 저장하지 못했어요.');
      }
    },
    [request],
  );

  /** 동시에 한 페이지씩 읽어 cursor 역전과 빠른 중복 클릭을 방지한다. */
  const loadPage = useCallback(
    async (cursor: string | null) => {
      if (controllerRef.current !== null || deleteInFlight.current) return;
      const controller = new AbortController();
      controllerRef.current = controller;
      setBusy(true);
      setError('');
      if (cursor === null) setStatus('loading');
      try {
        const page = await getNotifications(cursor, request, controller.signal);
        if (controller.signal.aborted) return;
        setItems((current) => {
          const merged = new Map(
            (cursor === null ? [] : current).map((item) => [item.notificationId, item]),
          );
          page.items.forEach((item) => {
            if (!merged.has(item.notificationId)) merged.set(item.notificationId, item);
          });
          return [...merged.values()];
        });
        setNextCursor(page.nextCursor);
        setStatus('ready');
        page.items
          .filter((item) => item.readAt === null)
          .forEach((item) => pendingReadIds.current.add(item.notificationId));
        await saveRead(controller.signal);
      } catch {
        if (controller.signal.aborted) return;
        setError('알림을 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
        if (cursor === null) setStatus('error');
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
          setBusy(false);
        }
      }
    },
    [request, saveRead],
  );

  useEffect(() => {
    const unreadIds = pendingReadIds.current;
    const frame = requestAnimationFrame(() => void loadPage(null));
    return () => {
      cancelAnimationFrame(frame);
      controllerRef.current?.abort();
      controllerRef.current = null;
      unreadIds.clear();
    };
  }, [loadPage]);

  /** 목록을 다시 조회하지 않고 실패한 읽음 저장만 사용자의 명시적 행동으로 재시도한다. */
  async function retryRead() {
    if (controllerRef.current !== null || deleteInFlight.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(true);
    await saveRead(controller.signal);
    if (controllerRef.current === controller) {
      controllerRef.current = null;
      setBusy(false);
    }
  }

  /** 삭제 확인 대상을 바꾸고 이전 삭제 오류를 지운다. */
  function startDelete(notificationId: number) {
    setConfirmingId(notificationId);
    setDeleteErrorId(null);
  }

  /** 확인 상태를 취소해 서버 요청 없이 목록을 유지한다. */
  function cancelDelete() {
    setConfirmingId(null);
    setDeleteErrorId(null);
  }

  /** 삭제 성공 후에만 목록을 갱신하고, 실패 시 해당 카드를 남겨 재시도하게 한다. */
  async function confirmDelete(notificationId: number) {
    if (deleteInFlight.current || controllerRef.current !== null) return;
    deleteInFlight.current = true;
    setDeletingId(notificationId);
    setDeleteErrorId(null);
    try {
      await deleteNotification(notificationId, request);
      pendingReadIds.current.delete(notificationId);
      setItems((current) => current.filter((item) => item.notificationId !== notificationId));
      setConfirmingId(null);
    } catch {
      setDeleteErrorId(notificationId);
    } finally {
      deleteInFlight.current = false;
      setDeletingId(null);
    }
  }

  return {
    items,
    nextCursor,
    status,
    busy,
    error,
    readError,
    confirmingId,
    deletingId,
    deleteErrorId,
    loadPage,
    retryRead,
    startDelete,
    cancelDelete,
    confirmDelete,
  };
}
