import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import type { SelectedMusic } from '../model/recordCreate.types';

/** 선택 가능한 Spotify 트랙 메타데이터를 검색한다. */
export async function searchMusic(
  query: string,
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
): Promise<SelectedMusic[]> {
  const normalizedQuery = query.trim().replaceAll(/\s+/g, ' ');
  if ([...normalizedQuery].length < 2 || [...normalizedQuery].length > 255) {
    throw new Error('음악 검색어는 2자 이상 255자 이하여야 합니다.');
  }
  const value = await fetchAuthenticatedJson<unknown>(
    `/music/search?${new URLSearchParams({ q: normalizedQuery }).toString()}`,
  );
  if (!isRecord(value) || !Array.isArray(value.data))
    throw new Error('음악 검색 응답 형식이 올바르지 않습니다.');
  return value.data.map(parseMusic);
}
function parseMusic(value: unknown): SelectedMusic {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.externalTrackId) ||
    !isNonEmptyString(value.title) ||
    !isNonEmptyString(value.artistName) ||
    !isNonEmptyString(value.albumImageUrl) ||
    !isNonEmptyString(value.externalUrl)
  )
    throw new Error('음악 검색 결과 형식이 올바르지 않습니다.');
  return {
    externalTrackId: value.externalTrackId,
    title: value.title,
    artistName: value.artistName,
    albumImageUrl: value.albumImageUrl,
    externalUrl: value.externalUrl,
  };
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
