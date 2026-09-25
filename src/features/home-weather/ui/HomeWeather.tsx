import { useEffect, useState } from 'react';

import {
  getCurrentWeather,
  type CurrentWeather,
  type WeatherCondition,
  type WeatherCoordinates,
} from '../api/getCurrentWeather';

type HomeWeatherProps = {
  coordinates: WeatherCoordinates | null;
};

type WeatherResult = {
  coordinates: WeatherCoordinates;
  weather: CurrentWeather;
};

/** 현재 위치와 같은 좌표의 날씨를 홈 상단 chip에 표시한다. */
export function HomeWeather({ coordinates }: HomeWeatherProps) {
  const [weatherResult, setWeatherResult] = useState<WeatherResult | null>(null);
  const [failedCoordinates, setFailedCoordinates] = useState<WeatherCoordinates | null>(null);

  useEffect(() => {
    if (!coordinates) {
      return;
    }

    const requestController = new AbortController();

    void getCurrentWeather(coordinates, requestController.signal)
      .then((response) => {
        if (!requestController.signal.aborted) {
          setWeatherResult({ coordinates, weather: response });
        }
      })
      .catch(() => {
        if (!requestController.signal.aborted) {
          setFailedCoordinates(coordinates);
        }
      });

    return () => {
      requestController.abort();
    };
  }, [coordinates]);

  const weather = isWeatherForCoordinates(weatherResult, coordinates)
    ? weatherResult.weather
    : null;
  const isError = weather === null && isSameCoordinates(failedCoordinates, coordinates);
  const icon = weather ? weatherIcon(weather.weatherCondition) : '☁️';
  const temperature = weather ? `${formatTemperature(weather.temperature)}°C` : '--°C';
  const label = getWeatherLabel(weather, isError);

  return (
    <span className="home-weather-chip" role="status" aria-live="polite" aria-label={label}>
      <span aria-hidden="true">{icon}</span>
      <strong>{temperature}</strong>
    </span>
  );
}

/** 기상청 내부 상태를 홈 UI에서 사용하는 단순한 날씨 emoji로 변환한다. */
function weatherIcon(weatherCondition: WeatherCondition): string {
  switch (weatherCondition) {
    case 'CLEAR':
      return '☀️';
    case 'CLOUDY':
    case 'OVERCAST':
      return '☁️';
    case 'RAIN':
    case 'SHOWER':
      return '🌧️';
    case 'SNOW':
      return '❄️';
    case 'RAIN_SNOW':
      return '🌨️';
  }
}

/** API의 소수점 한 자리 기온을 홈 chip에 읽기 쉬운 형태로 표시한다. */
function formatTemperature(temperature: number): string {
  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 1,
    useGrouping: false,
  }).format(temperature);
}

/** 보조 정보인 날씨의 로딩·실패 상태를 화면 이동 없이 접근성 텍스트로 제공한다. */
function getWeatherLabel(weather: CurrentWeather | null, isError: boolean): string {
  if (isError) {
    return '현재 날씨를 불러오지 못했습니다.';
  }

  if (!weather) {
    return '현재 날씨를 불러오는 중입니다.';
  }

  return `${weather.weatherCondition}, ${formatTemperature(weather.temperature)}도`;
}

/** 응답이 현재 선택된 지도 중심을 위한 것인지 확인한다. */
function isWeatherForCoordinates(
  weatherResult: WeatherResult | null,
  coordinates: WeatherCoordinates | null,
): weatherResult is WeatherResult {
  return weatherResult !== null && isSameCoordinates(weatherResult.coordinates, coordinates);
}

function isSameCoordinates(
  first: WeatherCoordinates | null,
  second: WeatherCoordinates | null,
): boolean {
  return (
    first !== null &&
    second !== null &&
    first.latitude === second.latitude &&
    first.longitude === second.longitude
  );
}
