import {
  useMemo,
  useState,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
} from 'react';

import {
  createAuthenticatedApi,
  type AuthenticatedApiClient,
} from '../../../shared/api/authenticatedFetchJson';
import { SessionContext, type SessionContextValue } from './sessionContext';

interface SessionController {
  authenticatedApi: AuthenticatedApiClient;
  updateAccessToken: (nextAccessToken: string) => void;
  clearSession: () => void;
}

/** React 상태와 요청 시점 토큰을 같은 Provider 수명 안에서 동기화하는 컨트롤러를 만든다. */
function createSessionController(
  setAccessToken: Dispatch<SetStateAction<string | null>>,
): SessionController {
  let currentAccessToken: string | null = null;

  /** 화면 상태와 보호 API 요청이 같은 최신 access token을 보도록 갱신한다. */
  const updateAccessToken = (nextAccessToken: string) => {
    currentAccessToken = nextAccessToken;
    setAccessToken(nextAccessToken);
  };

  /** 인증 실패 시 화면 상태와 보호 API용 token 값을 함께 비운다. */
  const clearSession = () => {
    currentAccessToken = null;
    setAccessToken(null);
  };

  return {
    authenticatedApi: createAuthenticatedApi({
      getAccessToken: () => currentAccessToken,
      setAccessToken: updateAccessToken,
      clearSession,
    }),
    updateAccessToken,
    clearSession,
  };
}

/** access token을 브라우저 영구 저장소가 아닌 Provider 생명주기 동안만 보관한다. */
export function SessionProvider({ children }: PropsWithChildren) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionController] = useState(() => createSessionController(setAccessToken));

  const value = useMemo<SessionContextValue>(
    () => ({
      accessToken,
      isAuthenticated: accessToken !== null,
      setAccessToken: sessionController.updateAccessToken,
      clearSession: sessionController.clearSession,
      fetchAuthenticatedJson: sessionController.authenticatedApi.fetchJson,
    }),
    [accessToken, sessionController],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}
