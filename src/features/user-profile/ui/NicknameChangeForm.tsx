import { useState, type FormEvent } from 'react';

import { FormField } from '../../../shared/ui/FormField';
import { ApiError } from '../../../shared/api/apiError';
import { changeNickname } from '../api/userProfileApi';
import type {
  NicknameChangeValues,
  ProfileFieldErrors,
  ProfileRequest,
} from '../model/userProfile.types';
import { validateNicknameChange } from '../model/userProfile.validation';

interface NicknameChangeFormProps {
  currentNickname: string;
  request: ProfileRequest;
  onSuccess: () => void;
}

/** 닉네임 API 오류를 사용자가 고칠 수 있는 입력 오류와 공통 오류로 분리한다. */
function toNicknameErrors(error: unknown): {
  fieldErrors: ProfileFieldErrors;
  formError: string | null;
} {
  if (!(error instanceof ApiError)) {
    return {
      fieldErrors: {},
      formError: '닉네임을 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    };
  }

  if (error.code === 'NICKNAME_DUPLICATED') {
    return { fieldErrors: { nickname: error.message }, formError: null };
  }

  if (error.fieldErrors.nickname) {
    return { fieldErrors: { nickname: error.fieldErrors.nickname }, formError: null };
  }

  return { fieldErrors: {}, formError: error.message };
}

/** 새 닉네임을 검증하고 변경 API에 전송하는 입력 폼이다. */
export function NicknameChangeForm({
  currentNickname,
  request,
  onSuccess,
}: NicknameChangeFormProps) {
  const [values, setValues] = useState<NicknameChangeValues>({ nickname: '' });
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /** 입력 변경 시 이전 서버 오류를 지우고 새 값을 저장한다. */
  const handleNicknameChange = (nickname: string) => {
    setValues({ nickname });
    setFieldErrors({});
    setFormError(null);
  };

  /** 클라이언트 검증 성공 시에만 닉네임 변경을 요청하고 완료 화면으로 이동시킨다. */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors = validateNicknameChange(values, currentNickname);

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    setFormError(null);

    try {
      await changeNickname(request, values);
      onSuccess();
    } catch (error) {
      const nextErrors = toNicknameErrors(error);
      setFieldErrors(nextErrors.fieldErrors);
      setFormError(nextErrors.formError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="profile-change-form" noValidate onSubmit={(event) => void handleSubmit(event)}>
      <FormField
        autoComplete="nickname"
        error={fieldErrors.nickname}
        helperText="한글, 영문, 숫자로 2~10자까지 입력해 주세요."
        id="nickname"
        label="새 닉네임"
        maxLength={10}
        onChange={(event) => handleNicknameChange(event.target.value)}
        placeholder="새 닉네임 입력"
        type="text"
        value={values.nickname}
      />
      {formError ? <p role="alert">{formError}</p> : null}
      <button className="primary-button" disabled={isSubmitting} type="submit">
        {isSubmitting ? '변경 중…' : '닉네임 변경'}
      </button>
    </form>
  );
}
