export const WEATHER_CONDITIONS = [
  'CLEAR',
  'CLOUDY',
  'OVERCAST',
  'RAIN',
  'SNOW',
  'RAIN_SNOW',
  'SHOWER',
] as const;

export type WeatherCondition = (typeof WEATHER_CONDITIONS)[number];

/** Converts a validated weather condition to the emoji used across MULO. */
export function getWeatherEmoji(weatherCondition: WeatherCondition): string {
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
