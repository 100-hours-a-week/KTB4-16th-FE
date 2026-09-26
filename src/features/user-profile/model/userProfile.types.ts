import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';

/** 페이지가 주입하는 보호 API 요청 함수다. */
export type ProfileRequest = AuthenticatedApiClient['fetchJson'];

/** 닉네임 변경 화면이 전송 전 보유하는 입력값이다. */
export interface NicknameChangeValues {
  nickname: string;
}

/** 비밀번호 변경 화면이 전송 전 보유하는 입력값이다. */
export interface PasswordChangeValues {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirm: string;
}

/** 사용자 설정 입력에 연결할 오류 메시지다. */
export type ProfileFieldErrors = Partial<
  Record<keyof NicknameChangeValues | keyof PasswordChangeValues, string>
>;
