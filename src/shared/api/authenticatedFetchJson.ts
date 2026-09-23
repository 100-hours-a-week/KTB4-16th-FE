import { ApiError } from './apiError';
import { getCsrfToken } from './csrf';
import { fetchJson } from './fetchJson';

interface RefreshResponse {
  accessToken: string;
}

export interface AuthenticatedApiAdapter {
  getAccessToken: () => string | null;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
}

export interface AuthenticatedApiClient {
  fetchJson: <T>(path: string, init?: RequestInit) => Promise<T>;
}

/** 주입된 메모리 세션을 사용하는 보호 API 클라이언트를 생성한다. */
export function createAuthenticatedApi(adapter: AuthenticatedApiAdapter): AuthenticatedApiClient {
  let refreshPromise: Promise<void> | null = null;

  /** 보호 API에 Bearer token을 붙이고 401이면 토큰 갱신 뒤 원 요청을 한 번만 재시도한다. */
  async function fetchAuthenticatedJson<T>(path: string, init?: RequestInit): Promise<T> {
    return requestWithRefresh<T>(path, init, false);
  }

  /** access token을 반영한 요청을 보내고 최초 401에만 refresh 흐름을 적용한다. */
  async function requestWithRefresh<T>(
    path: string,
    init: RequestInit | undefined,
    hasRetried: boolean,
  ): Promise<T> {
    const attemptedAccessToken = adapter.getAccessToken();

    try {
      return await fetchJson<T>(path, withAuthorization(init, attemptedAccessToken));
    } catch (error: unknown) {
      if (!(error instanceof ApiError) || error.status !== 401 || hasRetried) {
        throw error;
      }

      if (attemptedAccessToken !== adapter.getAccessToken()) {
        return requestWithRefresh<T>(path, init, true);
      }

      await refreshAccessToken();
      return requestWithRefresh<T>(path, init, true);
    }
  }

  /** 동시에 발생한 401 요청이 하나의 refresh 요청을 공유하도록 제어한다. */
  function refreshAccessToken(): Promise<void> {
    if (!refreshPromise) {
      refreshPromise = requestAccessTokenRefresh().finally(() => {
        refreshPromise = null;
      });
    }

    return refreshPromise;
  }

  /** HttpOnly refresh Cookie로 새 access token을 받아 메모리 세션을 교체한다. */
  async function requestAccessTokenRefresh(): Promise<void> {
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetchJson<unknown>('/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-XSRF-TOKEN': csrfToken },
      });
      adapter.setAccessToken(parseRefreshResponse(response).accessToken);
    } catch (error: unknown) {
      adapter.clearSession();
      throw error;
    }
  }

  return { fetchJson: fetchAuthenticatedJson };
}

/** 기존 요청 옵션을 보존하면서 현재 access token만 Authorization 헤더에 추가한다. */
function withAuthorization(init: RequestInit | undefined, accessToken: string | null): RequestInit {
  const headers = new Headers(init?.headers);

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return { ...init, headers };
}

/** refresh 응답의 access token 문자열을 런타임에서 검증한다. */
function parseRefreshResponse(value: unknown): RefreshResponse {
  if (!isRecord(value) || typeof value.accessToken !== 'string' || !value.accessToken) {
    throw new ApiError(502, '서버 응답 형식을 확인할 수 없습니다.', 'INVALID_RESPONSE');
  }

  return { accessToken: value.accessToken };
}

/** 외부 JSON 값이 필드 접근 가능한 객체인지 확인한다. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
