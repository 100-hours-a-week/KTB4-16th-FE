import { createContext, useContext } from 'react';

export interface NotificationSseContextValue {
  hasUnread: boolean;
  refreshUnreadStatus: () => void;
  subscribeToNotificationUpdates: (listener: () => void) => () => void;
}

export const NotificationSseContext = createContext<NotificationSseContextValue>({
  hasUnread: false,
  refreshUnreadStatus: () => undefined,
  subscribeToNotificationUpdates: () => () => undefined,
});

export function useNotificationSse(): NotificationSseContextValue {
  return useContext(NotificationSseContext);
}
