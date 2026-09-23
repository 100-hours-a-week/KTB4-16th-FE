import { getCsrfToken } from '../../../shared/api/csrf';
import { fetchJson } from '../../../shared/api/fetchJson';
import type { LoginResponse, LoginValues, SignupResponse, SignupValues } from '../model/auth.types';

/** CSRF 토큰을 포함해 로그인하고 access token 응답을 반환한다. */
export async function login(values: LoginValues): Promise<LoginResponse> {
  const csrfToken = await getCsrfToken();

  return fetchJson<LoginResponse>('/auth/login', {
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
}

/** 비밀번호 확인 값을 제외한 가입 계약만 서버에 전송한다. */
export async function signup(values: SignupValues): Promise<SignupResponse> {
  return fetchJson<SignupResponse>('/users/signup', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nickname: values.nickname.trim(),
      email: values.email.trim().toLowerCase(),
      password: values.password,
    }),
  });
}
