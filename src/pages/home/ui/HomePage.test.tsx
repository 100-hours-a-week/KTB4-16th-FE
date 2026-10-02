import { render } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.fn();

vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}));
vi.mock('../../../features/home-map/ui/HomeMap', () => ({
  HomeMap: ({
    onCurrentLocationResolved,
    onInitialCenterResolved,
  }: {
    onCurrentLocationResolved?: (location: { latitude: number; longitude: number } | null) => void;
    onInitialCenterResolved?: (center: { latitude: number; longitude: number }) => void;
  }) => {
    useEffect(() => {
      onInitialCenterResolved?.({ latitude: 37.2002, longitude: 127.098 });
      onCurrentLocationResolved?.(null);
    }, [onCurrentLocationResolved, onInitialCenterResolved]);

    return null;
  },
}));
vi.mock('../../../features/home-playlist/ui/HomePlaylistSheet', () => ({
  HomePlaylistSheet: () => null,
}));
vi.mock('../../../features/main-navigation/ui/MainNavigation', () => ({
  MainNavigation: () => null,
}));

import { HomePage } from './HomePage';

describe('HomePage weather location handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('does not request weather when geolocation is unavailable', async () => {
    render(<HomePage />);

    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(fetch).not.toHaveBeenCalled();
  });
});
