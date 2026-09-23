import { useMemo, useState, type PropsWithChildren } from 'react';

import { SessionContext, type SessionContextValue } from './sessionContext';

/** access token을 브라우저 영구 저장소가 아닌 Provider 생명주기 동안만 보관한다. */
export function SessionProvider({ children }: PropsWithChildren) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const value = useMemo<SessionContextValue>(
    () => ({
      accessToken,
      isAuthenticated: accessToken !== null,
      setAccessToken,
      clearSession: () => setAccessToken(null),
    }),
    [accessToken],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}
