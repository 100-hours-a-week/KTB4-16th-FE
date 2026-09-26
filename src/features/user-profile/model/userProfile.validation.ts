import type {
  NicknameChangeValues,
  PasswordChangeValues,
  ProfileFieldErrors,
} from './userProfile.types';

const NICKNAME_PATTERN = /^[A-Za-z0-9가-힣]{2,10}$/;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,16}$/;

/** 닉네임 형식과 현재 닉네임 중복 여부를 전송 전에 검증한다. */
export function validateNicknameChange(
  values: NicknameChangeValues,
  currentNickname: string,
): ProfileFieldErrors {
  const nickname = values.nickname.trim();

  if (!NICKNAME_PATTERN.test(nickname)) {
    return { nickname: '닉네임은 한글, 영문, 숫자로 2~10자까지 입력해 주세요.' };
  }

  if (nickname === currentNickname) {
    return { nickname: '현재 닉네임과 동일합니다.' };
  }

  return {};
}

/** 새 비밀번호의 형식, 현재 값 중복, 확인값 일치를 전송 전에 검증한다. */
export function validatePasswordChange(values: PasswordChangeValues): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {};

  if (!values.currentPassword) {
    errors.currentPassword = '현재 비밀번호를 입력해 주세요.';
  }

  if (!PASSWORD_PATTERN.test(values.newPassword)) {
    errors.newPassword =
      '비밀번호는 영문 대·소문자, 숫자, 특수문자를 포함해 8~16자로 입력해 주세요.';
  } else if (values.newPassword === values.currentPassword) {
    errors.newPassword = '새 비밀번호는 현재 비밀번호와 달라야 합니다.';
  }

  if (values.newPasswordConfirm !== values.newPassword) {
    errors.newPasswordConfirm = '비밀번호가 일치하지 않습니다.';
  }

  return errors;
}
