import { WEATHER_CONDITIONS, type WeatherCondition } from '../../../entities/weather/model/weather';
import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import type { LockDetailData } from '../model/lockDetail.types';

/** 로그인 사용자가 소유한 활성 자물쇠의 상세 정보를 조회한다. */
export async function getRecordDetail(
  recordId: number,
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
  signal: AbortSignal,
): Promise<LockDetailData> {
  if (!Number.isSafeInteger(recordId) || recordId <= 0) {
    throw new Error('올바른 자물쇠 ID가 필요합니다.');
  }

  const response = await fetchAuthenticatedJson<unknown>(
    `/records/${encodeURIComponent(String(recordId))}`,
    { signal },
  );

  return parseRecordDetailResponse(response);
}

/** 신뢰할 수 없는 상세조회 응답을 BE RecordDetailData 계약으로 검증한다. */
function parseRecordDetailResponse(value: unknown): LockDetailData {
  if (!isRecord(value) || typeof value.message !== 'string' || !isRecord(value.data)) {
    throw new Error('자물쇠 상세 응답 형식이 올바르지 않습니다.');
  }

  const data = value.data;
  if (
    !isPositiveInteger(data.recordId) ||
    !isPositiveInteger(data.userId) ||
    !isRecord(data.place) ||
    !isRecord(data.music) ||
    !isNullableWeatherCondition(data.weatherCondition) ||
    !isNullableFiniteNumber(data.temperature) ||
    !isMoodScore(data.moodScore) ||
    !isNullableString(data.comment) ||
    !isNonEmptyString(data.photoUrl) ||
    !isNonEmptyString(data.createdAt)
  ) {
    throw new Error('자물쇠 상세 데이터 형식이 올바르지 않습니다.');
  }

  const place = data.place;
  const music = data.music;
  if (
    !isPositiveInteger(place.placeId) ||
    !isNullableString(place.legalDongName) ||
    !isFiniteNumber(place.latitude) ||
    !isFiniteNumber(place.longitude) ||
    !isNullableString(place.legalDongCode) ||
    !isPositiveInteger(music.musicTrackId) ||
    !isNonEmptyString(music.title) ||
    !isNonEmptyString(music.artistName) ||
    !isNonEmptyString(music.albumImageUrl) ||
    !isNonEmptyString(music.externalUrl)
  ) {
    throw new Error('자물쇠 상세 장소 또는 음악 형식이 올바르지 않습니다.');
  }

  return {
    recordId: data.recordId,
    userId: data.userId,
    place: {
      placeId: place.placeId,
      legalDongName: place.legalDongName,
      latitude: place.latitude,
      longitude: place.longitude,
      legalDongCode: place.legalDongCode,
    },
    music: {
      musicTrackId: music.musicTrackId,
      title: music.title,
      artistName: music.artistName,
      albumImageUrl: music.albumImageUrl,
      externalUrl: music.externalUrl,
    },
    weatherCondition: data.weatherCondition,
    temperature: data.temperature,
    moodScore: data.moodScore,
    comment: data.comment,
    photoUrl: data.photoUrl,
    createdAt: data.createdAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableWeatherCondition(value: unknown): value is WeatherCondition | null {
  return value === null || WEATHER_CONDITIONS.some((condition) => condition === value);
}

function isMoodScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= -50 && value <= 50;
}
