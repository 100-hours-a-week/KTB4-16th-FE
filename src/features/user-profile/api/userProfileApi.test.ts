import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../../shared/api/apiError';
import { getCsrfToken } from '../../../shared/api/csrf';
import { changeNickname, changePassword, getMyProfile, withdrawAccount } from './userProfileApi';

vi.mock('../../../shared/api/csrf', () => ({ getCsrfToken: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

describe('userProfileApi', () => {
  it('완전한 현재 사용자 응답만 프로필로 변환한다', async () => {
    const request = vi.fn().mockResolvedValue({
      message: '회원 정보 조회 성공',
      data: {
        userId: 35,
        nickname: '뮤로',
        email: 'me@mulo.com',
        preferredGenres: ['인디음악', '재즈'],
        genreOnboardingDone: true,
        createdAt: '2026-10-15T12:30:00',
      },
    });

    await expect(getMyProfile(request)).resolves.toEqual({
      userId: 35,
      nickname: '뮤로',
      email: 'me@mulo.com',
      preferredGenres: ['인디음악', '재즈'],
      genreOnboardingDone: true,
      createdAt: '2026-10-15T12:30:00',
    });

    await expect(
      getMyProfile(vi.fn().mockResolvedValue({ data: { nickname: '뮤로' } })),
    ).rejects.toMatchObject({
      status: 502,
      code: 'INVALID_RESPONSE',
    } satisfies Partial<ApiError>);

    await expect(
      getMyProfile(
        vi.fn().mockResolvedValue({
          data: {
            userId: 35,
            nickname: '뮤로',
            email: 'me@mulo.com',
            preferredGenres: ['인디음악', '재즈', '댄스', 'POP'],
            genreOnboardingDone: false,
            createdAt: '2026-10-15T12:30:00',
          },
        }),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' } satisfies Partial<ApiError>);
  });

  it('미응답 사용자의 nullable 선호 장르 상태를 보존한다', async () => {
    const request = vi.fn().mockResolvedValue({
      message: '회원 정보 조회 성공',
      data: {
        userId: 36,
        nickname: '신규 사용자',
        email: 'new@mulo.com',
        preferredGenres: null,
        genreOnboardingDone: false,
        createdAt: '2026-10-16T00:00:00',
      },
    });

    await expect(getMyProfile(request)).resolves.toMatchObject({
      preferredGenres: null,
      genreOnboardingDone: false,
    });
  });

  it('생성 시각이 없는 프로필 응답을 거부한다', async () => {
    await expect(
      getMyProfile(
        vi.fn().mockResolvedValue({
          data: {
            userId: 35,
            nickname: '뮤로',
            email: 'me@mulo.com',
            preferredGenres: null,
            genreOnboardingDone: false,
            createdAt: '',
          },
        }),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' } satisfies Partial<ApiError>);
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

  it('현재 비밀번호와 CSRF를 포함해 회원 탈퇴 DELETE를 보내고 성공 응답을 확인한다', async () => {
    vi.mocked(getCsrfToken).mockResolvedValue('csrf-token');
    const request = vi.fn().mockResolvedValue({ message: '회원 탈퇴가 완료되었습니다.' });

    await expect(withdrawAccount(request, 'Current123!')).resolves.toBeUndefined();

    expect(request).toHaveBeenCalledWith('/users/me', {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-XSRF-TOKEN': 'csrf-token',
      },
      body: JSON.stringify({ password: 'Current123!' }),
    });
  });

  it('탈퇴 성공 응답 형식이 다르면 완료로 처리하지 않는다', async () => {
    vi.mocked(getCsrfToken).mockResolvedValue('csrf-token');

    await expect(
      withdrawAccount(vi.fn().mockResolvedValue({}), 'Current123!'),
    ).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    } satisfies Partial<ApiError>);
  });
});
