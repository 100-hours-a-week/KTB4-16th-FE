import type { AuthFieldErrors, LoginValues, SignupValues } from './auth.types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NICKNAME_PATTERN = /^[A-Za-z0-9가-힣]{2,10}$/;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,16}$/;

/** 로그인 폼의 이메일 형식과 필수 입력을 검증한다. */
export function validateLogin(values: LoginValues): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  const email = values.email.trim();

  if (!email) {
    errors.email = '이메일을 입력해 주세요.';
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = '이메일 형식이 올바르지 않습니다.';
  }

  if (!values.password) {
    errors.password = '비밀번호를 입력해 주세요.';
  }

  return errors;
}

/** 백엔드 가입 제약과 비밀번호 확인 일치 여부를 함께 검증한다. */
export function validateSignup(values: SignupValues): AuthFieldErrors {
  const errors = validateLogin(values);

  if (!NICKNAME_PATTERN.test(values.nickname.trim())) {
    errors.nickname = '닉네임은 한글, 영문, 숫자로 2~10자까지 입력해 주세요.';
  }

  if (!PASSWORD_PATTERN.test(values.password)) {
    errors.password = '비밀번호는 영문 대·소문자, 숫자, 특수문자를 포함해 8~16자로 입력해 주세요.';
  }

  if (values.passwordConfirm !== values.password) {
    errors.passwordConfirm = '비밀번호가 일치하지 않습니다.';
  }

  return errors;
}
