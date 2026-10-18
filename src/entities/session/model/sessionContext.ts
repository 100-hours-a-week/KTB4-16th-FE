import { createContext } from 'react';

export interface SessionContextValue {
  accessToken: string | null;
  sessionVersion: number;
  isAuthenticated: boolean;
  isSessionRestoring: boolean;
  setAccessToken: (token: string) => void;
  clearSession: () => void;
  fetchAuthenticatedJson: <T>(path: string, init?: RequestInit) => Promise<T>;
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<void>;
}

export const SessionContext = createContext<SessionContextValue | null>(null);
