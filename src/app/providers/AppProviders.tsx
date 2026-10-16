import type { PropsWithChildren } from 'react';
import { BrowserRouter } from 'react-router';

import { SessionProvider } from '../../entities/session/model/SessionProvider';
import { MemorySearchConversationProvider } from '../../features/memory-search/model/MemorySearchConversationProvider';

/** 라우터·인증·기억 검색 Provider 순서로 상세 왕복 중 대화 상태를 유지한다. */
export function AppProviders({ children }: PropsWithChildren) {
  return (
    <BrowserRouter>
      <SessionProvider>
        <MemorySearchConversationProvider>{children}</MemorySearchConversationProvider>
      </SessionProvider>
    </BrowserRouter>
  );
}
