import { createContext } from 'react';

export interface SessionContextValue {
  accessToken: string | null;
  isAuthenticated: boolean;
  setAccessToken: (token: string) => void;
  clearSession: () => void;
  fetchAuthenticatedJson: <T>(path: string, init?: RequestInit) => Promise<T>;
}

export const SessionContext = createContext<SessionContextValue | null>(null);
