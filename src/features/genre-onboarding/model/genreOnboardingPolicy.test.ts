import { beforeEach, describe, expect, it } from 'vitest';

import {
  canHideGenreOnboardingForToday,
  getKstDateKey,
  hideGenreOnboardingForToday,
  isGenreOnboardingHiddenToday,
  isLegacyGenreOnboardingUser,
  parseKstLocalDateTime,
  shouldAutomaticallyShowGenreOnboarding,
} from './genreOnboardingPolicy';

const legacyProfile = {
  createdAt: '2026-10-15T12:00:00',
  preferredGenres: null,
  genreOnboardingDone: false,
};

beforeEach(() => localStorage.clear());

describe('genreOnboardingPolicy', () => {
  it('KST 로컬 날짜 문자열을 브라우저 timezone과 무관하게 KST instant로 변환한다', () => {
    expect(parseKstLocalDateTime('2026-10-16T00:00:00')).toBe(
      Date.parse('2026-10-15T15:00:00.000Z'),
    );
    expect(parseKstLocalDateTime('2026-02-30T12:00:00')).toBeNull();
  });

  it('계정 생성 기준 시각 전후를 기존 사용자와 신규 사용자로 구분한다', () => {
    expect(isLegacyGenreOnboardingUser('2026-10-15T23:59:59.999')).toBe(true);
    expect(isLegacyGenreOnboardingUser('2026-10-16T00:00:00')).toBe(false);
  });

  it('기존 사용자는 KST 10월 25일 23:59까지 자동 노출한다', () => {
    expect(
      shouldAutomaticallyShowGenreOnboarding(legacyProfile, Date.parse('2026-10-25T14:59:00.000Z')),
    ).toBe(true);
  });

  it('기존 사용자는 KST 10월 26일 00:00부터 자동 노출하지 않는다', () => {
    expect(
      shouldAutomaticallyShowGenreOnboarding(legacyProfile, Date.parse('2026-10-25T15:00:00.000Z')),
    ).toBe(false);
  });

  it('신규 사용자는 10월 26일 이후에도 자동 노출한다', () => {
    expect(
      shouldAutomaticallyShowGenreOnboarding(
        { ...legacyProfile, createdAt: '2026-10-16T00:00:00' },
        Date.parse('2026-11-01T00:00:00.000Z'),
      ),
    ).toBe(true);
  });

  it('완료되었거나 선호 장르가 이미 저장된 사용자는 자동 노출하지 않는다', () => {
    expect(
      shouldAutomaticallyShowGenreOnboarding({ ...legacyProfile, genreOnboardingDone: true }),
    ).toBe(false);
    expect(
      shouldAutomaticallyShowGenreOnboarding({ ...legacyProfile, preferredGenres: ['재즈'] }),
    ).toBe(false);
  });

  it('오늘 숨김은 사용자별 KST 날짜로 저장하고 다음 날에는 만료한다', () => {
    const beforeKstMidnight = Date.parse('2026-10-23T15:30:00.000Z');
    const nextKstDate = Date.parse('2026-10-24T15:00:00.000Z');

    expect(getKstDateKey(beforeKstMidnight)).toBe('2026-10-24');
    hideGenreOnboardingForToday(35, beforeKstMidnight);
    expect(localStorage.getItem('mulo:genre-onboarding-hidden-date:35')).toBe('2026-10-24');
    expect(isGenreOnboardingHiddenToday(35, beforeKstMidnight)).toBe(true);
    expect(isGenreOnboardingHiddenToday(35, nextKstDate)).toBe(false);
    expect(isGenreOnboardingHiddenToday(36, beforeKstMidnight)).toBe(false);
  });

  it('오늘 숨김 액션은 기존 사용자 자동 노출 기간에만 허용한다', () => {
    expect(
      canHideGenreOnboardingForToday('2026-10-15T12:00:00', Date.parse('2026-10-25T14:59:00.000Z')),
    ).toBe(true);
    expect(
      canHideGenreOnboardingForToday('2026-10-16T00:00:00', Date.parse('2026-10-25T14:59:00.000Z')),
    ).toBe(false);
    expect(
      canHideGenreOnboardingForToday('2026-10-15T12:00:00', Date.parse('2026-10-25T15:00:00.000Z')),
    ).toBe(false);
  });
});
