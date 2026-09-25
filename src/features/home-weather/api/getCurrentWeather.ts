import { env } from '../../../shared/config/env';

export type WeatherCoordinates = {
  latitude: number;
  longitude: number;
};

const WEATHER_CONDITIONS = [
  'CLEAR',
  'CLOUDY',
  'OVERCAST',
  'RAIN',
  'SNOW',
  'RAIN_SNOW',
  'SHOWER',
] as const;

export type WeatherCondition = (typeof WEATHER_CONDITIONS)[number];

export type CurrentWeather = {
  forecastAt: string;
  temperature: number;
  weatherCondition: WeatherCondition;
};

type CurrentWeatherResponse = {
  message: string;
  data: CurrentWeather;
};

/** 현재 좌표와 시각을 기준으로 홈 상단에 표시할 날씨를 조회한다. */
export async function getCurrentWeather(
  coordinates: WeatherCoordinates,
  signal: AbortSignal,
): Promise<CurrentWeather> {
  const response = await fetch(createCurrentWeatherUrl(coordinates), { signal });

  if (!response.ok) {
    throw new Error('현재 날씨를 조회하지 못했습니다.');
  }

  return parseCurrentWeatherResponse(await response.json()).data;
}

/** API base URL, 현재 좌표 및 요청 시각을 날씨 조회 URL로 변환한다. */
function createCurrentWeatherUrl(coordinates: WeatherCoordinates): URL {
  const apiBaseUrl = env.apiBaseUrl.endsWith('/') ? env.apiBaseUrl.slice(0, -1) : env.apiBaseUrl;
  const requestUrl = new URL(`${apiBaseUrl}/weather`, window.location.origin);

  requestUrl.search = new URLSearchParams({
    latitude: String(coordinates.latitude),
    longitude: String(coordinates.longitude),
    at: new Date().toISOString(),
  }).toString();

  return requestUrl;
}

/** 신뢰할 수 없는 HTTP 응답을 홈 날씨 계약으로 검증한다. */
function parseCurrentWeatherResponse(value: unknown): CurrentWeatherResponse {
  if (!isRecord(value) || typeof value.message !== 'string' || !isRecord(value.data)) {
    throw new Error('현재 날씨 응답 형식이 올바르지 않습니다.');
  }

  const { forecastAt, temperature, weatherCondition } = value.data;

  if (
    typeof forecastAt !== 'string' ||
    !forecastAt ||
    !isFiniteNumber(temperature) ||
    !isWeatherCondition(weatherCondition)
  ) {
    throw new Error('현재 날씨 항목 형식이 올바르지 않습니다.');
  }

  return {
    message: value.message,
    data: { forecastAt, temperature, weatherCondition },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isWeatherCondition(value: unknown): value is WeatherCondition {
  return typeof value === 'string' && WEATHER_CONDITIONS.some((condition) => condition === value);
}
