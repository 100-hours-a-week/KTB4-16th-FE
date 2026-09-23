import { ApiError } from './apiError';
import { fetchJson } from './fetchJson';

/** 브라우저 Cookie 문자열에서 지정한 Cookie 값을 안전하게 읽는다. */
function readCookie(name: string): string | undefined {
  const prefix = `${name}=`;
  const cookie = document.cookie
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : undefined;
}

/** 로그인 요청 전에 서버의 CSRF 상태와 헤더용 토큰을 준비한다. */
export async function getCsrfToken(): Promise<string> {
  await fetchJson<void>('/csrf', { credentials: 'include' });

  const token = readCookie('XSRF-TOKEN');
  if (!token) {
    throw new ApiError(
      403,
      '보안 정보를 확인하지 못했습니다. 다시 시도해 주세요.',
      'CSRF_TOKEN_MISSING',
    );
  }

  return token;
}
