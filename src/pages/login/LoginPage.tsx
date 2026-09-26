import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { useSession } from '../../entities/session/model/useSession';
import { login } from '../../features/auth/api/authApi';
import type { AuthFieldErrors, LoginValues } from '../../features/auth/model/auth.types';
import { validateLogin } from '../../features/auth/model/auth.validation';
import { FormField } from '../../shared/ui/FormField';
import { ApiError } from '../../shared/api/apiError';

const INITIAL_VALUES: LoginValues = { email: '', password: '' };

/** 회원가입 화면에서 전달한 문자열 안내만 안전하게 선택한다. */
function getSignupMessage(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || !('signupMessage' in state)) {
    return null;
  }

  return typeof state.signupMessage === 'string' ? state.signupMessage : null;
}

/** 로그인 API 실패를 상태별 사용자 안내로 변환한다. */
function getLoginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return '이메일 또는 비밀번호가 일치하지 않습니다.';
    }

    if (error.status === 403 || error.code === 'CSRF_TOKEN_MISSING') {
      return '보안 정보를 확인하지 못했습니다. 다시 시도해 주세요.';
    }

    if (error.status === 0) {
      return '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.';
    }
  }

  return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

/** 로그인 검증, 메모리 세션 저장, 인증 오류 표시를 관리한다. */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAccessToken } = useSession();
  const [values, setValues] = useState<LoginValues>(INITIAL_VALUES);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const signupMessage = getSignupMessage(location.state);

  /** 지정한 로그인 필드만 갱신하며 비밀번호 원문을 그대로 보존한다. */
  const handleChange = (field: keyof LoginValues) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
  };

  /** 검증된 로그인 요청을 전송하고 성공 토큰을 메모리 세션에 연결한다. */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setFieldErrors({});
    setFormError(null);

    const validationErrors = validateLogin(values);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await login(values);
      setAccessToken(response.accessToken);
      navigate('/', { replace: true });
    } catch (error: unknown) {
      setFormError(getLoginErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card auth-card--login" aria-labelledby="login-title">
        <h2 id="login-title" className="sr-only">
          로그인
        </h2>
        <div className="auth-brand">
          <h1>mulo</h1>
          <p>장소에 음악을 걸어두는 앱</p>
        </div>

        {signupMessage ? <p role="status">{signupMessage}</p> : null}

        <form className="auth-form" noValidate onSubmit={handleSubmit}>
          <FormField
            id="email"
            label="이메일"
            type="email"
            value={values.email}
            onChange={handleChange('email')}
            error={fieldErrors.email}
            placeholder="example@mulo.com"
            autoComplete="email"
          />
          <FormField
            id="password"
            label="비밀번호"
            type="password"
            value={values.password}
            onChange={handleChange('password')}
            error={fieldErrors.password}
            placeholder="비밀번호 입력"
            autoComplete="current-password"
          />

          {formError ? <p role="alert">{formError}</p> : null}
          {isSubmitting ? <p role="status">로그인하고 있습니다.</p> : null}

          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? '로그인 중…' : '로그인'}
          </button>
        </form>

        <p className="auth-switch">
          아직 계정이 없으신가요? <Link to="/signup">회원가입</Link>
        </p>
      </section>
    </main>
  );
}
