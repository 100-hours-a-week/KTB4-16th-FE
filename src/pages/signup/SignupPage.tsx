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
  const liveErrors = validateSignup(values);

  /** 지정한 필드만 갱신해 입력별 상태 책임을 유지한다. */
  const handleChange = (field: keyof SignupValues) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
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
      <section className="auth-card auth-card--signup" aria-labelledby="signup-title">
        <header className="auth-topbar">
          <Link className="back-button" to="/login" aria-label="로그인으로 돌아가기">
            <span aria-hidden="true">‹</span>
          </Link>
          <h1 id="signup-title">회원가입</h1>
          <span className="topbar-spacer" aria-hidden="true" />
        </header>

        <form className="auth-form" noValidate onSubmit={handleSubmit}>
          <AuthFormField
            id="nickname"
            label="닉네임"
            type="text"
            value={values.nickname}
            onChange={handleChange('nickname')}
            error={
              fieldErrors.nickname ??
              (values.nickname && liveErrors.nickname ? '2~10자로 입력해주세요.' : undefined)
            }
            helperText="2~10자로 입력해주세요."
            successText={
              values.nickname && !liveErrors.nickname ? '사용할 수 있는 닉네임입니다.' : undefined
            }
            placeholder="닉네임 입력"
            maxLength={10}
            autoComplete="nickname"
          />
          <AuthFormField
            id="email"
            label="이메일"
            type="email"
            value={values.email}
            onChange={handleChange('email')}
            error={
              fieldErrors.email ??
              (values.email && liveErrors.email
                ? '올바른 이메일 형식으로 입력해주세요.'
                : undefined)
            }
            placeholder="example@mulo.com"
            maxLength={254}
            autoComplete="email"
          />
          <AuthFormField
            id="password"
            label="비밀번호"
            type="password"
            value={values.password}
            onChange={handleChange('password')}
            error={
              fieldErrors.password ??
              (values.password && liveErrors.password
                ? '영문 대소문자, 숫자, 특수문자를 포함해 8~16자로 입력해주세요.'
                : undefined)
            }
            helperText="영문 대소문자, 숫자, 특수문자를 포함해 8~16자로 입력해주세요."
            successText={
              values.password && !liveErrors.password ? '사용할 수 있는 비밀번호입니다.' : undefined
            }
            placeholder="비밀번호 입력"
            maxLength={16}
            autoComplete="new-password"
          />
          <AuthFormField
            id="passwordConfirm"
            label="비밀번호 확인"
            type="password"
            value={values.passwordConfirm}
            onChange={handleChange('passwordConfirm')}
            error={
              fieldErrors.passwordConfirm ??
              (values.passwordConfirm && liveErrors.passwordConfirm
                ? '비밀번호가 일치하지 않습니다.'
                : undefined)
            }
            placeholder="비밀번호 재입력"
            maxLength={16}
            autoComplete="new-password"
          />

          {formError ? <p role="alert">{formError}</p> : null}
          {isSubmitting ? <p role="status">가입 정보를 확인하고 있습니다.</p> : null}

          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? '가입 중…' : '가입 완료'}
          </button>
        </form>
      </section>
    </main>
  );
}
