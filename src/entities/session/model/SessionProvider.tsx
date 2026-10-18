import {
  useEffect,
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
  getAccessToken: () => string | null;
}

/** React 상태와 요청 시점 토큰을 같은 Provider 수명 안에서 동기화하는 컨트롤러를 만든다. */
function createSessionController(
  setAccessToken: Dispatch<SetStateAction<string | null>>,
  setSessionVersion: Dispatch<SetStateAction<number>>,
): SessionController {
  let currentAccessToken: string | null = null;
  let currentSessionVersion = 0;

  /** 같은 로그인 안의 토큰 갱신을 화면과 현재 요청에 함께 반영한다. */
  const applyRefreshedAccessToken = (nextAccessToken: string) => {
    currentAccessToken = nextAccessToken;
    setAccessToken(nextAccessToken);
  };

  /** 명시적 로그인 교체를 갱신과 구별해 이전 비동기 작업을 무효화한다. */
  const advanceSessionVersion = () => {
    currentSessionVersion += 1;
    setSessionVersion(currentSessionVersion);
  };

  /** 새로운 로그인에 속한 token을 저장하고 기존 연결의 교체를 알린다. */
  const updateAccessToken = (nextAccessToken: string) => {
    advanceSessionVersion();
    applyRefreshedAccessToken(nextAccessToken);
  };

  /** 인증 실패 시 화면 상태와 보호 API용 token 값을 함께 비운다. */
  const clearSession = () => {
    advanceSessionVersion();
    currentAccessToken = null;
    setAccessToken(null);
  };

  return {
    authenticatedApi: createAuthenticatedApi({
      getAccessToken: () => currentAccessToken,
      getSessionVersion: () => currentSessionVersion,
      setAccessToken: applyRefreshedAccessToken,
      clearSession,
    }),
    updateAccessToken,
    clearSession,
    getAccessToken: () => currentAccessToken,
  };
}

/** access token을 브라우저 영구 저장소가 아닌 Provider 생명주기 동안만 보관한다. */
export function SessionProvider({ children }: PropsWithChildren) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sessionVersion, setSessionVersion] = useState(0);
  const [sessionController] = useState(() =>
    createSessionController(setAccessToken, setSessionVersion),
  );
  const [isSessionRestoring, setIsSessionRestoring] = useState(true);

  /** 앱 시작 시 HttpOnly Refresh Cookie로 access token을 복원하고 라우팅 대기를 끝낸다. */
  useEffect(() => {
    let isActive = true;

    void sessionController.authenticatedApi
      .restoreSession()
      .catch(() => undefined)
      .finally(() => {
        if (isActive) {
          setIsSessionRestoring(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [sessionController]);

  const value = useMemo<SessionContextValue>(
    () => ({
      accessToken,
      sessionVersion,
      isAuthenticated: accessToken !== null,
      isSessionRestoring,
      setAccessToken: sessionController.updateAccessToken,
      clearSession: sessionController.clearSession,
      fetchAuthenticatedJson: sessionController.authenticatedApi.fetchJson,
      getAccessToken: sessionController.getAccessToken,
      refreshAccessToken: sessionController.authenticatedApi.refreshAccessToken,
    }),
    [accessToken, sessionVersion, isSessionRestoring, sessionController],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}
