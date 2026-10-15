import type { PreferredGenre } from '../../../entities/user/model/user.types';
import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { getCsrfToken } from '../../../shared/api/csrf';

type GenrePreferenceRequest = AuthenticatedApiClient['fetchJson'];

/** 선택한 선호 장르를 인증된 현재 사용자 설정에 저장한다. */
export async function updatePreferredGenres(
  request: GenrePreferenceRequest,
  preferredGenres: readonly PreferredGenre[],
): Promise<void> {
  const csrfToken = await getCsrfToken();

  await request<unknown>('/users/me/preferences/genres', {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': csrfToken,
    },
    body: JSON.stringify({ preferredGenres }),
  });
}
