import { describe, expect, it } from 'vitest';

import { getWeatherEmoji, WEATHER_CONDITIONS } from './weather';

describe('getWeatherEmoji', () => {
  it.each([
    ['CLEAR', '☀️'],
    ['CLOUDY', '☁️'],
    ['OVERCAST', '☁️'],
    ['RAIN', '🌧️'],
    ['SHOWER', '🌧️'],
    ['SNOW', '❄️'],
    ['RAIN_SNOW', '🌨️'],
  ] as const)('maps %s to %s', (condition, emoji) => {
    expect(getWeatherEmoji(condition)).toBe(emoji);
  });

  it('contains only the existing supported weather conditions', () => {
    expect(WEATHER_CONDITIONS).toEqual([
      'CLEAR',
      'CLOUDY',
      'OVERCAST',
      'RAIN',
      'SNOW',
      'RAIN_SNOW',
      'SHOWER',
    ]);
  });
});
