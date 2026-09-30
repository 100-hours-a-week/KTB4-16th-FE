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

/** Converts a weather condition to MULO's emoji using the browser's local time for clear skies. */
export function getWeatherEmoji(
  weatherCondition: WeatherCondition,
  localTime: Date = new Date(),
): string {
  switch (weatherCondition) {
    case 'CLEAR':
      return localTime.getHours() >= 6 && localTime.getHours() < 19 ? '☀️' : '🌙';
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
