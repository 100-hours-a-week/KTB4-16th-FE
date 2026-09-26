import { useState, type FormEvent } from 'react';

import { ApiError } from '../../../shared/api/apiError';
import { FormField } from '../../../shared/ui/FormField';
import { changePassword } from '../api/userProfileApi';
import type {
  PasswordChangeValues,
  ProfileFieldErrors,
  ProfileRequest,
} from '../model/userProfile.types';
import { validatePasswordChange } from '../model/userProfile.validation';

interface PasswordChangeFormProps {
  request: ProfileRequest;
  onSuccess: () => void;
}

const INITIAL_VALUES: PasswordChangeValues = {
  currentPassword: '',
  newPassword: '',
  newPasswordConfirm: '',
};

/** 비밀번호 API 오류를 해당 입력 오류 또는 공통 오류로 변환한다. */
function toPasswordErrors(error: unknown): {
  fieldErrors: ProfileFieldErrors;
  formError: string | null;
} {
  if (!(error instanceof ApiError)) {
    return {
      fieldErrors: {},
      formError: '비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    };
  }

  if (error.code === 'SAME_PASSWORD') {
    return { fieldErrors: { newPassword: error.message }, formError: null };
  }

  const fieldErrors: ProfileFieldErrors = {};
  for (const field of ['currentPassword', 'newPassword', 'newPasswordConfirm'] as const) {
    if (error.fieldErrors[field]) {
      fieldErrors[field] = error.fieldErrors[field];
    }
  }

  return Object.keys(fieldErrors).length > 0
    ? { fieldErrors, formError: null }
    : { fieldErrors: {}, formError: error.message };
}

/** 현재·새 비밀번호와 확인값을 검증하고 비밀번호 변경 API에 전송한다. */
export function PasswordChangeForm({ request, onSuccess }: PasswordChangeFormProps) {
  const [values, setValues] = useState<PasswordChangeValues>(INITIAL_VALUES);
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /** 지정한 비밀번호 입력값을 갱신하면서 이전 오류를 지운다. */
  const handleValueChange = (field: keyof PasswordChangeValues, value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    setFieldErrors({});
    setFormError(null);
  };

  /** 확인값을 제외한 비밀번호 계약만 서버로 보내고 성공 시 상위 화면에 완료를 알린다. */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors = validatePasswordChange(values);

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    setFormError(null);

    try {
      await changePassword(request, {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      onSuccess();
    } catch (error) {
      const nextErrors = toPasswordErrors(error);
      setFieldErrors(nextErrors.fieldErrors);
      setFormError(nextErrors.formError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="profile-change-form" noValidate onSubmit={(event) => void handleSubmit(event)}>
      <FormField
        autoComplete="current-password"
        error={fieldErrors.currentPassword}
        id="current-password"
        label="현재 비밀번호"
        onChange={(event) => handleValueChange('currentPassword', event.target.value)}
        placeholder="현재 비밀번호 입력"
        type="password"
        value={values.currentPassword}
      />
      <FormField
        autoComplete="new-password"
        error={fieldErrors.newPassword}
        helperText="영문 대소문자, 숫자, 특수문자를 포함해 8~16자로 입력해 주세요."
        id="new-password"
        label="새 비밀번호"
        maxLength={16}
        onChange={(event) => handleValueChange('newPassword', event.target.value)}
        placeholder="새 비밀번호 입력"
        type="password"
        value={values.newPassword}
      />
      <FormField
        autoComplete="new-password"
        error={fieldErrors.newPasswordConfirm}
        id="new-password-confirm"
        label="새 비밀번호 확인"
        maxLength={16}
        onChange={(event) => handleValueChange('newPasswordConfirm', event.target.value)}
        placeholder="새 비밀번호 재입력"
        type="password"
        value={values.newPasswordConfirm}
      />
      {formError ? <p role="alert">{formError}</p> : null}
      <button className="primary-button" disabled={isSubmitting} type="submit">
        {isSubmitting ? '변경 중…' : '비밀번호 변경'}
      </button>
    </form>
  );
}
