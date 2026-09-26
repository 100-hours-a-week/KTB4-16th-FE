import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';

/** Spotify 프록시 검색 결과에서 자물쇠 작성 화면이 표시·선택할 음악 정보다. */
export interface MusicSearchResult {
  provider: 'SPOTIFY';
  externalTrackId: string;
  title: string;
  artistName: string;
  albumImageUrl: string;
  externalUrl: string;
}

/** 페이지가 주입하는 음악 검색용 보호 API 요청 함수다. */
export type MusicSearchRequest = AuthenticatedApiClient['fetchJson'];
