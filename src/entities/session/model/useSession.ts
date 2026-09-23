import { use } from 'react';

import { SessionContext, type SessionContextValue } from './sessionContext';

/** 현재 메모리 세션을 반환하고 잘못된 Provider 사용을 즉시 알린다. */
export function useSession(): SessionContextValue {
  const session = use(SessionContext);

  if (!session) {
    throw new Error('useSession은 SessionProvider 안에서 사용해야 합니다.');
  }

  return session;
}
