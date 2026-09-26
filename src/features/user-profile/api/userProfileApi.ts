import type { UserProfile } from '../../../entities/user/model/user.types';
import { ApiError } from '../../../shared/api/apiError';
import { getCsrfToken } from '../../../shared/api/csrf';
import type {
  NicknameChangeValues,
  PasswordChangeValues,
  ProfileRequest,
} from '../model/userProfile.types';

/** 현재 인증 사용자의 프로필 응답을 런타임에서 검증한다. */
function parseUserProfileResponse(value: unknown): UserProfile {
  if (
    !isRecord(value) ||
    !isRecord(value.data) ||
    !isInteger(value.data.userId) ||
    !isNonEmptyString(value.data.nickname) ||
    !isNonEmptyString(value.data.email)
  ) {
    throw invalidResponseError();
  }

  return {
    userId: value.data.userId,
    nickname: value.data.nickname,
    email: value.data.email,
  };
}

/** 닉네임 변경 성공 응답의 최신 닉네임을 검증한다. */
function parseNicknameChangeResponse(value: unknown): { nickname: string } {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.message) ||
    !isRecord(value.data) ||
    !isNonEmptyString(value.data.nickname)
  ) {
    throw invalidResponseError();
  }

  return { nickname: value.data.nickname };
}

/** 비밀번호 변경 성공 응답에 완료 메시지가 있는지 검증한다. */
function parsePasswordChangeResponse(value: unknown): void {
  if (!isRecord(value) || !isNonEmptyString(value.message)) {
    throw invalidResponseError();
  }
}

/** 신뢰할 수 없는 외부 값이 키-값 객체인지 확인한다. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 숫자가 사용자 식별자로 사용할 수 있는 정수인지 확인한다. */
function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

/** 문자열이 빈값 없이 화면에 표시 가능한지 확인한다. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** 외부 API의 성공 응답 형식 오류를 공통 오류로 만든다. */
function invalidResponseError(): ApiError {
  return new ApiError(502, '서버 응답 형식을 확인할 수 없습니다.', 'INVALID_RESPONSE');
}

/** 현재 인증 사용자의 프로필을 조회하고 검증된 표시 모델로 반환한다. */
export async function getMyProfile(request: ProfileRequest): Promise<UserProfile> {
  const response = await request<unknown>('/users/me');
  return parseUserProfileResponse(response);
}

/** CSRF 토큰을 준비한 뒤 정규화한 닉네임 변경 요청을 전송한다. */
export async function changeNickname(
  request: ProfileRequest,
  values: NicknameChangeValues,
): Promise<{ nickname: string }> {
  const csrfToken = await getCsrfToken();
  const response = await request<unknown>('/users/me/nickname', {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': csrfToken,
    },
    body: JSON.stringify({ nickname: values.nickname.trim() }),
  });

  return parseNicknameChangeResponse(response);
}

/** CSRF 토큰을 준비한 뒤 확인값을 제외한 비밀번호 변경 계약만 전송한다. */
export async function changePassword(
  request: ProfileRequest,
  values: Pick<PasswordChangeValues, 'currentPassword' | 'newPassword'>,
): Promise<void> {
  const csrfToken = await getCsrfToken();
  const response = await request<unknown>('/users/me/password', {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': csrfToken,
    },
    body: JSON.stringify(values),
  });

  parsePasswordChangeResponse(response);
}
