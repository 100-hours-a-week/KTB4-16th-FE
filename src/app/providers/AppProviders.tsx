import type { PropsWithChildren } from 'react';
import { BrowserRouter } from 'react-router';

import { SessionProvider } from '../../entities/session/model/SessionProvider';

/** 애플리케이션 전역 라우터와 메모리 세션의 Provider 순서를 정의한다. */
export function AppProviders({ children }: PropsWithChildren) {
  return (
    <BrowserRouter>
      <SessionProvider>{children}</SessionProvider>
    </BrowserRouter>
  );
}
