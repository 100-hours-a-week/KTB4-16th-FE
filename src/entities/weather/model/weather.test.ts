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
    expect(getWeatherEmoji(condition, localTime(12, 0))).toBe(emoji);
  });

  it.each([
    [5, 59, '🌙'],
    [6, 0, '☀️'],
    [18, 59, '☀️'],
    [19, 0, '🌙'],
    [0, 0, '🌙'],
    [12, 0, '☀️'],
  ] as const)('maps CLEAR at %02d:%02d to %s', (hour, minute, emoji) => {
    expect(getWeatherEmoji('CLEAR', localTime(hour, minute))).toBe(emoji);
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

function localTime(hour: number, minute: number): Date {
  return new Date(2026, 8, 30, hour, minute);
}
