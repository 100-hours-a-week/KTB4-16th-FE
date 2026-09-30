import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getCurrentWeather } from '../api/getCurrentWeather';
import { HomeWeather } from './HomeWeather';

vi.mock('../api/getCurrentWeather', () => ({
  getCurrentWeather: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe('HomeWeather', () => {
  it('keeps the existing weather emoji and temperature, with a readable label without raw condition codes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 30, 12, 0));
    vi.mocked(getCurrentWeather).mockResolvedValue({
      forecastAt: '2026-09-30T12:00:00',
      temperature: 19,
      weatherCondition: 'CLEAR',
    });

    render(<HomeWeather coordinates={{ latitude: 37.2, longitude: 127.1 }} />);

    expect(await screen.findByText('19°C')).toBeInTheDocument();
    expect(screen.getByText('☀️')).toBeInTheDocument();
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-label', '현재 날씨 ☀️, 기온 19도');
    expect(status.getAttribute('aria-label')).not.toContain('CLEAR');
  });
});
