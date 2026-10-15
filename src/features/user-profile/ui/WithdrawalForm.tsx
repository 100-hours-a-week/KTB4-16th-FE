import { useState, type FormEvent } from 'react';

import { ApiError } from '../../../shared/api/apiError';
import { FormField } from '../../../shared/ui/FormField';
import { withdrawAccount } from '../api/userProfileApi';
import type { ProfileRequest } from '../model/userProfile.types';

interface WithdrawalFormProps {
  request: ProfileRequest;
  onSuccess: () => void;
}

/** 백엔드의 비밀번호 오류를 입력 필드에 연결하고 나머지 오류를 폼에 표시한다. */
function getWithdrawalError(error: unknown): { password: string | null; form: string | null } {
  if (error instanceof ApiError) {
    if (error.code === 'CURRENT_PASSWORD_MISMATCH') {
      return { password: '현재 비밀번호가 일치하지 않습니다.', form: null };
    }
    if (error.fieldErrors.password) {
      return { password: error.fieldErrors.password, form: null };
    }
    if (error.status === 401) {
      return {
        password: null,
        form: '로그인 상태를 확인해 주세요. 다시 로그인한 뒤 시도해 주세요.',
      };
    }
  }
  return {
    password: null,
    form: '회원 탈퇴 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  };
}

/** 현재 비밀번호를 검증해 탈퇴 API에 보내고 성공 후에만 세션 종료를 요청한다. */
export function WithdrawalForm({ request, onSuccess }: WithdrawalFormProps) {
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /** 비밀번호를 갱신하며 이전 입력 오류를 제거한다. */
  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setPasswordError(null);
    setFormError(null);
  };

  /** 중복 제출과 빈 입력을 막고 탈퇴 성공 응답 이후에만 완료 처리를 위임한다. */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (!password.trim()) {
      setPasswordError('비밀번호를 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    setPasswordError(null);
    setFormError(null);
    try {
      await withdrawAccount(request, password);
      onSuccess();
    } catch (error) {
      const nextError = getWithdrawalError(error);
      setPasswordError(nextError.password);
      setFormError(nextError.form);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="profile-change-form" noValidate onSubmit={(event) => void handleSubmit(event)}>
      <FormField
        autoComplete="current-password"
        error={passwordError ?? undefined}
        id="withdrawal-password"
        label="현재 비밀번호"
        onChange={(event) => handlePasswordChange(event.target.value)}
        placeholder="현재 비밀번호 입력"
        type="password"
        value={password}
      />
      {formError ? <p role="alert">{formError}</p> : null}
      <button className="primary-button withdrawal-submit" disabled={isSubmitting} type="submit">
        {isSubmitting ? '탈퇴 처리 중…' : '회원 탈퇴하기'}
      </button>
    </form>
  );
}
