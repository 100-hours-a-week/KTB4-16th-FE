import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCsrfToken } from '../../../shared/api/csrf';
import { updatePreferredGenres } from './genreOnboardingApi';

vi.mock('../../../shared/api/csrf', () => ({ getCsrfToken: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

describe('genreOnboardingApi', () => {
  it('CSRF와 인증 API client로 선택 장르를 PUT 저장한다', async () => {
    vi.mocked(getCsrfToken).mockResolvedValue('csrf-token');
    const request = vi.fn().mockResolvedValue({ message: '선호 장르 저장 성공' });

    await updatePreferredGenres(request, ['인디음악', '재즈']);

    expect(request).toHaveBeenCalledWith('/users/me/preferences/genres', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-XSRF-TOKEN': 'csrf-token',
      },
      body: JSON.stringify({ preferredGenres: ['인디음악', '재즈'] }),
    });
  });

  it('선호 장르가 없으면 저장 요청을 보내지 않는다', async () => {
    const request = vi.fn().mockResolvedValue({ message: '선호 장르 저장 성공' });

    await expect(updatePreferredGenres(request, [])).rejects.toThrow(
      '선호 장르는 1개 이상 3개 이하로 선택해야 합니다.',
    );

    expect(getCsrfToken).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });
});
