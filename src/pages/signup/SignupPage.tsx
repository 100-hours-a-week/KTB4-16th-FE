import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';

import { signup } from '../../features/auth/api/authApi';
import type {
  AuthField,
  AuthFieldErrors,
  SignupValues,
} from '../../features/auth/model/auth.types';
import { validateSignup } from '../../features/auth/model/auth.validation';
import { AuthFormField } from '../../features/auth/ui/AuthFormField';
import { ApiError } from '../../shared/api/apiError';

const INITIAL_VALUES: SignupValues = {
  nickname: '',
  email: '',
  password: '',
  passwordConfirm: '',
};

const SIGNUP_FIELDS: ReadonlySet<AuthField> = new Set([
  'nickname',
  'email',
  'password',
  'passwordConfirm',
]);

/** 서버 필드 오류에서 회원가입 폼이 소유한 필드만 추출한다. */
function selectSignupFieldErrors(fieldErrors: Readonly<Record<string, string>>): AuthFieldErrors {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter(([field]) => SIGNUP_FIELDS.has(field as AuthField)),
  ) as AuthFieldErrors;
}

/** API 실패 종류를 사용자가 다음 행동을 결정할 수 있는 안내로 변환한다. */
function getSignupErrorMessage(error: unknown): string | null {
  if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
    return null;
  }

  if (error instanceof ApiError && error.status === 0) {
    return '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.';
  }

  return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

/** 회원가입 입력 검증, 서버 오류 연결, 로그인 화면 이동을 관리한다. */
export function SignupPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState<SignupValues>(INITIAL_VALUES);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /** 지정한 필드만 갱신해 입력별 상태 책임을 유지한다. */
  const handleChange = (field: keyof SignupValues) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
  };

  /** 검증을 통과한 가입 요청을 한 번만 전송하고 결과를 화면 상태로 반영한다. */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setFieldErrors({});
    setFormError(null);

    const validationErrors = validateSignup(values);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      await signup(values);
      navigate('/login', {
        replace: true,
        state: { signupMessage: '가입이 완료되었습니다. 로그인해 주세요.' },
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setFieldErrors(selectSignupFieldErrors(error.fieldErrors));
      }
      setFormError(getSignupErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="signup-title">
        <div className="auth-heading">
          <p className="eyebrow">Join MULO</p>
          <h1 id="signup-title">회원가입</h1>
          <p>새 계정을 만들고 함께 시작해 보세요.</p>
        </div>

        <form className="auth-form" noValidate onSubmit={handleSubmit}>
          <AuthFormField
            id="nickname"
            label="닉네임"
            type="text"
            value={values.nickname}
            onChange={handleChange('nickname')}
            error={fieldErrors.nickname}
            autoComplete="nickname"
          />
          <AuthFormField
            id="email"
            label="이메일"
            type="email"
            value={values.email}
            onChange={handleChange('email')}
            error={fieldErrors.email}
            autoComplete="email"
          />
          <AuthFormField
            id="password"
            label="비밀번호"
            type="password"
            value={values.password}
            onChange={handleChange('password')}
            error={fieldErrors.password}
            autoComplete="new-password"
          />
          <AuthFormField
            id="passwordConfirm"
            label="비밀번호 확인"
            type="password"
            value={values.passwordConfirm}
            onChange={handleChange('passwordConfirm')}
            error={fieldErrors.passwordConfirm}
            autoComplete="new-password"
          />

          {formError ? <p role="alert">{formError}</p> : null}
          {isSubmitting ? <p role="status">가입 정보를 확인하고 있습니다.</p> : null}

          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? '가입 중…' : '회원가입'}
          </button>
        </form>

        <p className="auth-switch">
          이미 계정이 있나요? <Link to="/login">로그인</Link>
        </p>
      </section>
    </main>
  );
}
