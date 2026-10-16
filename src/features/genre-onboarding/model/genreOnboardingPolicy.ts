import { PREFERRED_GENRES, type UserProfile } from '../../../entities/user/model/user.types';

/** 프로필에 허용된 선호 장르가 하나 이상 저장된 경우에만 온보딩을 완료 상태로 본다. */
export function hasRequiredPreferredGenres(profile: Pick<UserProfile, 'preferredGenres'>): boolean {
  const { preferredGenres } = profile;
  return (
    preferredGenres !== null &&
    preferredGenres.length >= 1 &&
    preferredGenres.length <= 3 &&
    preferredGenres.every((genre) => PREFERRED_GENRES.some((allowed) => allowed === genre)) &&
    new Set(preferredGenres).size === preferredGenres.length
  );
}
