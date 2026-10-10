/** Backend가 선호 장르 저장에 사용하는 허용 값 목록이다. */
export const PREFERRED_GENRES = [
  '발라드',
  '댄스',
  '랩/힙합',
  'R&B/Soul',
  '인디음악',
  '록/메탈',
  '포크/블루스',
  '트로트',
  'POP',
  '일렉트로니카',
  'OST',
  '재즈',
  'J-POP',
] as const;

export type PreferredGenre = (typeof PREFERRED_GENRES)[number];

/** 여러 화면에서 표시하는 인증 사용자 정보다. */
export interface UserProfile {
  userId: number;
  nickname: string;
  email: string;
  preferredGenres: PreferredGenre[] | null;
  genreOnboardingDone: boolean;
}
