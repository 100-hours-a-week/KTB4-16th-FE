import { getCsrfToken } from '../../../shared/api/csrf';
import { ApiError } from '../../../shared/api/apiError';
import { fetchJson } from '../../../shared/api/fetchJson';
import type { LoginResponse, LoginValues, SignupResponse, SignupValues } from '../model/auth.types';

/** 외부 응답이 필드 접근 가능한 객체인지 확인한다. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 로그인 성공 응답의 필수 문자열을 검증해 메모리 세션 오염을 막는다. */
function parseLoginResponse(value: unknown): LoginResponse {
  if (
    !isRecord(value) ||
    typeof value.message !== 'string' ||
    typeof value.accessToken !== 'string' ||
    !value.accessToken
  ) {
    throw new ApiError(502, '서버 응답 형식을 확인할 수 없습니다.', 'INVALID_RESPONSE');
  }

  return { message: value.message, accessToken: value.accessToken };
}

/** 회원가입 성공 응답의 필수 메시지를 검증한다. */
function parseSignupResponse(value: unknown): SignupResponse {
  if (!isRecord(value) || typeof value.message !== 'string') {
    throw new ApiError(502, '서버 응답 형식을 확인할 수 없습니다.', 'INVALID_RESPONSE');
  }

  return { message: value.message };
}

/** CSRF 토큰을 포함해 로그인하고 access token 응답을 반환한다. */
export async function login(values: LoginValues): Promise<LoginResponse> {
  const csrfToken = await getCsrfToken();

  const response = await fetchJson<unknown>('/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': csrfToken,
    },
    body: JSON.stringify({
      email: values.email.trim().toLowerCase(),
      password: values.password,
    }),
  });

  return parseLoginResponse(response);
}

/** 비밀번호 확인 값을 제외한 가입 계약만 서버에 전송한다. */
export async function signup(values: SignupValues): Promise<SignupResponse> {
  const response = await fetchJson<unknown>('/users/signup', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nickname: values.nickname.trim(),
      email: values.email.trim().toLowerCase(),
      password: values.password,
    }),
  });

  return parseSignupResponse(response);
}
