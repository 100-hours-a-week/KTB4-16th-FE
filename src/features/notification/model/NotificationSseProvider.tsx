import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import { useSession } from '../../../entities/session/model/useSession';
import { getUnreadNotificationStatus } from '../api/notificationApi';
import { connectNotificationSse } from '../api/notificationSseClient';
import { NotificationSseContext } from './notificationSseContext';

export function NotificationSseProvider({ children }: PropsWithChildren) {
  const {
    fetchAuthenticatedJson,
    getAccessToken,
    isAuthenticated,
    isSessionRestoring,
    refreshAccessToken,
    sessionVersion,
  } = useSession();
  const [unreadSnapshot, setUnreadSnapshot] = useState({ sessionVersion: -1, hasUnread: false });
  const listenersRef = useRef(new Set<() => void>());
  const refreshUnreadSyncRef = useRef<() => void>(() => undefined);
  const refreshUnreadStatus = useCallback(() => refreshUnreadSyncRef.current(), []);
  const subscribeToNotificationUpdates = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  useEffect(() => {
    if (isSessionRestoring || !isAuthenticated || getAccessToken() === null) {
      return;
    }

    const controller = new AbortController();
    let isActive = true;
    let unreadSyncPending = false;
    let unreadSyncRunning = false;
    let unreadSyncRevision = 0;
    let hasConnected = false;
    let consecutiveAuthFailures = 0;
    let pendingListRefresh = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const syncUnreadStatus = () => {
      unreadSyncRevision += 1;
      unreadSyncPending = true;
      if (unreadSyncRunning) return;
      unreadSyncRunning = true;
      void (async () => {
        try {
          while (unreadSyncPending && !controller.signal.aborted) {
            unreadSyncPending = false;
            const requestRevision = unreadSyncRevision;
            try {
              const result = await getUnreadNotificationStatus(
                fetchAuthenticatedJson,
                controller.signal,
              );
              if (
                isActive &&
                !controller.signal.aborted &&
                requestRevision === unreadSyncRevision
              ) {
                setUnreadSnapshot({ sessionVersion, hasUnread: result.hasUnread });
              }
            } catch {
              if (!controller.signal.aborted) break;
            }
          }
        } finally {
          unreadSyncRunning = false;
          if (unreadSyncPending && !controller.signal.aborted) syncUnreadStatus();
        }
      })();
    };

    const scheduleSync = (refreshList: boolean) => {
      pendingListRefresh ||= refreshList;
      if (refreshTimer !== null) return;
      refreshTimer = globalThis.setTimeout(() => {
        refreshTimer = null;
        syncUnreadStatus();
        if (pendingListRefresh) {
          pendingListRefresh = false;
          listenersRef.current.forEach((listener) => listener());
        }
      }, 150);
    };

    refreshUnreadSyncRef.current = syncUnreadStatus;
    syncUnreadStatus();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') scheduleSync(true);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const runConnection = async () => {
      let retryAttempt = 0;
      while (!controller.signal.aborted) {
        const token = getAccessToken();
        if (!token) return;
        try {
          const result = await connectNotificationSse(token, controller.signal, (event) => {
            if (!isActive || controller.signal.aborted) return;
            if (event === 'connected') {
              consecutiveAuthFailures = 0;
              syncUnreadStatus();
              if (hasConnected) scheduleSync(true);
              hasConnected = true;
            }
            if (event === 'notification-created') scheduleSync(true);
          });
          if (controller.signal.aborted || result === 'forbidden') return;
          if (
            result === 'unauthorized' ||
            result === 'auth-expired' ||
            result === 'token-expired'
          ) {
            consecutiveAuthFailures += 1;
            if (consecutiveAuthFailures > 1) return;
            try {
              await refreshAccessToken();
            } catch {
              if (controller.signal.aborted) return;
              retryAttempt += 1;
              await waitForReconnect(retryDelay(retryAttempt), controller.signal);
              continue;
            }
            if (getAccessToken() === token) {
              retryAttempt += 1;
              await waitForReconnect(retryDelay(retryAttempt), controller.signal);
            } else {
              retryAttempt = 0;
            }
            continue;
          }
          retryAttempt += 1;
        } catch {
          if (controller.signal.aborted) return;
          retryAttempt += 1;
        }
        await waitForReconnect(retryDelay(retryAttempt), controller.signal);
      }
    };

    queueMicrotask(() => {
      if (!controller.signal.aborted) void runConnection();
    });

    return () => {
      isActive = false;
      controller.abort();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (refreshTimer !== null) globalThis.clearTimeout(refreshTimer);
      if (refreshUnreadSyncRef.current === syncUnreadStatus) {
        refreshUnreadSyncRef.current = () => undefined;
      }
    };
  }, [
    fetchAuthenticatedJson,
    getAccessToken,
    isAuthenticated,
    isSessionRestoring,
    refreshAccessToken,
    sessionVersion,
  ]);

  const value = useMemo(
    () => ({
      hasUnread: unreadSnapshot.sessionVersion === sessionVersion && unreadSnapshot.hasUnread,
      refreshUnreadStatus,
      subscribeToNotificationUpdates,
    }),
    [refreshUnreadStatus, sessionVersion, subscribeToNotificationUpdates, unreadSnapshot],
  );

  return <NotificationSseContext value={value}>{children}</NotificationSseContext>;
}

function retryDelay(attempt: number): number {
  const ceiling = Math.min(30_000, 1_000 * 2 ** Math.min(attempt - 1, 5));
  return 250 + Math.floor(Math.random() * ceiling);
}

function waitForReconnect(delay: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timeout = globalThis.setTimeout(() => {
      signal.removeEventListener('abort', cancel);
      resolve();
    }, delay);
    const cancel = () => {
      globalThis.clearTimeout(timeout);
      signal.removeEventListener('abort', cancel);
      resolve();
    };
    signal.addEventListener('abort', cancel, { once: true });
  });
}
