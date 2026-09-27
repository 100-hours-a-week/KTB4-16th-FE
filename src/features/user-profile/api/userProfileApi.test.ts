import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../../shared/api/apiError';
import { getCsrfToken } from '../../../shared/api/csrf';
import { changeNickname, changePassword, getMyProfile } from './userProfileApi';

vi.mock('../../../shared/api/csrf', () => ({ getCsrfToken: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

describe('userProfileApi', () => {
  it('완전한 현재 사용자 응답만 프로필로 변환한다', async () => {
    const request = vi.fn().mockResolvedValue({
      message: '회원 정보 조회 성공',
      data: { userId: 35, nickname: '뮤로', email: 'me@mulo.com' },
    });

    await expect(getMyProfile(request)).resolves.toEqual({
      userId: 35,
      nickname: '뮤로',
      email: 'me@mulo.com',
    });

    await expect(
      getMyProfile(vi.fn().mockResolvedValue({ data: { nickname: '뮤로' } })),
    ).rejects.toMatchObject({
      status: 502,
      code: 'INVALID_RESPONSE',
    } satisfies Partial<ApiError>);
  });

  it('CSRF, credentials, 정규화된 닉네임으로 PATCH 요청을 보낸다', async () => {
    vi.mocked(getCsrfToken).mockResolvedValue('csrf-token');
    const request = vi.fn().mockResolvedValue({
      message: '닉네임이 변경되었습니다.',
      data: { nickname: '새닉네임' },
    });

    await expect(changeNickname(request, { nickname: ' 새닉네임 ' })).resolves.toEqual({
      nickname: '새닉네임',
    });

    expect(request).toHaveBeenCalledWith('/users/me/nickname', {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-XSRF-TOKEN': 'csrf-token',
      },
      body: JSON.stringify({ nickname: '새닉네임' }),
    });
  });

  it('CSRF 준비에 실패하면 비밀번호 PATCH를 보내지 않는다', async () => {
    vi.mocked(getCsrfToken).mockRejectedValue(
      new ApiError(403, '보안 정보를 확인하지 못했습니다.', 'CSRF_TOKEN_MISSING'),
    );
    const request = vi.fn();

    await expect(
      changePassword(request, {
        currentPassword: 'Password1!',
        newPassword: 'NewPassword1!',
      }),
    ).rejects.toMatchObject({ code: 'CSRF_TOKEN_MISSING' } satisfies Partial<ApiError>);

    expect(request).not.toHaveBeenCalled();
  });
});
