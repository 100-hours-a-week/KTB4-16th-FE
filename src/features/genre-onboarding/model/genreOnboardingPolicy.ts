import type { UserProfile } from '../../../entities/user/model/user.types';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Backend LocalDateTime 값은 Asia/Seoul 기준으로 해석한다. */
export function parseKstLocalDateTime(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?$/.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fractionText = ''] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const localDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  if (
    localDate.getUTCFullYear() !== year ||
    localDate.getUTCMonth() !== month - 1 ||
    localDate.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }

  const milliseconds = Number(fractionText.slice(0, 3).padEnd(3, '0'));
  return Date.UTC(year, month - 1, day, hour, minute, second, milliseconds) - KST_OFFSET_MS;
}

/** 계정 생성 시각을 정해진 KST 도입 기준과 비교해 기존 사용자인지 판단한다. */
export function isLegacyGenreOnboardingUser(createdAt: string): boolean {
  const createdAtMs = parseKstLocalDateTime(createdAt);
  return createdAtMs !== null && createdAtMs < LEGACY_USER_CUTOFF_MS;
}

/** 기본 완료 조건과 계정 유형별 자동 노출 기간을 적용한다. */
export function shouldAutomaticallyShowGenreOnboarding(
  profile: Pick<UserProfile, 'createdAt' | 'preferredGenres' | 'genreOnboardingDone'>,
  nowMs = Date.now(),
): boolean {
  if (profile.genreOnboardingDone || profile.preferredGenres !== null) return false;

  const createdAtMs = parseKstLocalDateTime(profile.createdAt);
  if (createdAtMs === null) return false;

  return createdAtMs >= LEGACY_USER_CUTOFF_MS || nowMs < LEGACY_ONBOARDING_END_MS;
}

/** 기존 사용자가 한시적 노출 기간에 있는지 확인해 숨김 액션 범위를 제한한다. */
export function canHideGenreOnboardingForToday(createdAt: string, nowMs = Date.now()): boolean {
  return isLegacyGenreOnboardingUser(createdAt) && nowMs < LEGACY_ONBOARDING_END_MS;
}

/** 현재 시각을 브라우저 시간대와 무관한 KST 날짜 키로 변환한다. */
export function getKstDateKey(nowMs = Date.now()): string {
  return new Date(nowMs + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 사용자별 오늘 숨김 상태를 KST 날짜 기준으로 읽는다. */
export function isGenreOnboardingHiddenToday(userId: number, nowMs = Date.now()): boolean {
  try {
    return localStorage.getItem(getHiddenDateStorageKey(userId)) === getKstDateKey(nowMs);
  } catch {
    return false;
  }
}

/** 사용자별 오늘 숨김 날짜만 저장하며 프로필/서버 상태는 변경하지 않는다. */
export function hideGenreOnboardingForToday(userId: number, nowMs = Date.now()): void {
  try {
    localStorage.setItem(getHiddenDateStorageKey(userId), getKstDateKey(nowMs));
  } catch {
    // 저장소를 사용할 수 없는 브라우저에서는 현재 화면만 닫는다.
  }
}

function getHiddenDateStorageKey(userId: number): string {
  return `mulo:genre-onboarding-hidden-date:${userId}`;
}

const LEGACY_USER_CUTOFF_MS = Date.parse('2026-10-16T00:00:00+09:00');
const LEGACY_ONBOARDING_END_MS = Date.parse('2026-10-26T00:00:00+09:00');
