import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HomeMap } from './HomeMap';

const mocks = vi.hoisted(() => {
  type Listener = (...args: unknown[]) => void;
  let listeners = new Map<object, Map<string, Listener>>();
  const markers: Array<{ setImage: ReturnType<typeof vi.fn>; setMap: ReturnType<typeof vi.fn> }> =
    [];
  const markerOptions: Array<Record<string, unknown>> = [];
  const markerImageSources: string[] = [];
  const clusterers: Array<{
    addMarkers: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  }> = [];
  const clustererOptions: Array<Record<string, unknown>> = [];
  const customOverlayOptions: Array<Record<string, unknown>> = [];
  const customOverlayContainers: HTMLElement[] = [];
  const mapOptions: Array<Record<string, unknown>> = [];

  const addListener = (target: object, eventName: string, listener: Listener) => {
    const targetListeners = listeners.get(target) ?? new Map<string, Listener>();
    targetListeners.set(eventName, listener);
    listeners.set(target, targetListeners);
  };

  return {
    getMyMarkers: vi.fn(),
    getMyPlaceRecords: vi.fn(),
    getPopularMarkers: vi.fn(),
    getPopularTracks: vi.fn(),
    fetchAuthenticatedJson: vi.fn(),
    addListener,
    markers,
    markerOptions,
    markerImageSources,
    clusterers,
    clustererOptions,
    customOverlayOptions,
    customOverlayContainers,
    mapOptions,
    reset() {
      listeners = new Map<object, Map<string, Listener>>();
      markers.splice(0);
      markerOptions.splice(0);
      markerImageSources.splice(0);
      clusterers.splice(0);
      clustererOptions.splice(0);
      customOverlayOptions.splice(0);
      customOverlayContainers.splice(0);
      mapOptions.splice(0);
    },
    triggerMarker(index: number) {
      const marker = markers[index];
      listeners.get(marker)?.get('click')?.();
    },
    triggerCluster(markerIndexes: number[]) {
      const clusterer = clusterers[0];
      const cluster = {
        getMarkers: () => markerIndexes.map((index) => markers[index]),
        getCenter: () => ({ getLat: () => 37.2, getLng: () => 127.1 }),
        getClusterMarker: () => ({ setMap: vi.fn(), setZIndex: vi.fn() }),
      };
      listeners.get(clusterer)?.get('clusterclick')?.(cluster);
    },
  };
});

vi.mock('../../../entities/session/model/useSession', () => ({
  useSession: () => ({
    fetchAuthenticatedJson: mocks.fetchAuthenticatedJson,
    isAuthenticated: true,
  }),
}));
vi.mock('../api/getMyMarkers', () => ({ getMyMarkers: mocks.getMyMarkers }));
vi.mock('../api/getMyPlaceRecords', () => ({ getMyPlaceRecords: mocks.getMyPlaceRecords }));
vi.mock('../api/getPopularMarkers', () => ({ getPopularMarkers: mocks.getPopularMarkers }));
vi.mock('../api/getPopularTracks', () => ({ getPopularTracks: mocks.getPopularTracks }));
vi.mock('../../../shared/config/env', () => ({
  env: { apiBaseUrl: '/api', kakaoMapAppKey: 'test' },
}));
vi.mock('../lib/kakaoMap', () => {
  class Marker {
    setImage = vi.fn();
    setMap = vi.fn();

    constructor(options: Record<string, unknown>) {
      mocks.markers.push(this);
      mocks.markerOptions.push(options);
    }
  }

  class MarkerClusterer {
    addMarkers = vi.fn();
    clear = vi.fn();

    constructor(options: Record<string, unknown>) {
      mocks.clusterers.push(this);
      mocks.clustererOptions.push(options);
    }
  }

  const event = {
    addListener: mocks.addListener,
    removeListener: vi.fn(),
  };

  return {
    loadKakaoMapSdk: vi.fn().mockResolvedValue({
      maps: {
        LatLng: class {
          constructor(
            public latitude: number,
            public longitude: number,
          ) {}

          getLat() {
            return this.latitude;
          }

          getLng() {
            return this.longitude;
          }
        },
        Point: class {},
        Size: class {},
        MarkerImage: class {
          constructor(source: string) {
            mocks.markerImageSources.push(source);
          }
        },
        Map: class {
          constructor(_container: HTMLElement, options: Record<string, unknown>) {
            mocks.mapOptions.push(options);
          }

          getBounds() {
            return {
              getSouthWest: () => ({ getLat: () => 37, getLng: () => 127 }),
              getNorthEast: () => ({ getLat: () => 38, getLng: () => 128 }),
            };
          }
        },
        Marker,
        CustomOverlay: class {
          setMap = vi.fn();
          setZIndex = vi.fn();

          constructor(options: Record<string, unknown>) {
            mocks.customOverlayOptions.push(options);
            if (options.content instanceof HTMLElement) {
              const wrapper = document.createElement('div');
              wrapper.append(options.content);
              mocks.customOverlayContainers.push(wrapper);
            }
          }
        },
        MarkerClusterer,
        event,
      },
    }),
  };
});

const popularMarkers = [
  {
    placeId: 10,
    recordsCount: 1,
    legalDongCode: null,
    legalDongName: null,
    latitude: 37.2,
    longitude: 127.1,
  },
  {
    placeId: 11,
    recordsCount: 1,
    legalDongCode: null,
    legalDongName: null,
    latitude: 37.21,
    longitude: 127.11,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.reset();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  setGeolocation(null);
  mocks.getPopularMarkers.mockResolvedValue(popularMarkers);
  mocks.getPopularTracks.mockResolvedValue({
    recordCount: 1,
    music: [{ rank: 1, musicTrackId: 7, title: '밤편지', artistName: '아이유', count: 1 }],
  });
  mocks.getMyMarkers.mockResolvedValue([
    {
      placeId: 22,
      legalDongName: '테스트동',
      myRecordsCount: 1,
      latitude: 37.2,
      longitude: 127.1,
    },
  ]);
  mocks.getMyPlaceRecords.mockResolvedValue({ records: [], nextCursor: null });
});

describe('HomeMap current location overlay', () => {
  it('uses the successful geolocation coordinates for a separate current location overlay', async () => {
    const getCurrentPosition = useSuccessfulGeolocation(37.501, 127.031);
    const onInitialCenterResolved = vi.fn();

    renderHomeMap({ onInitialCenterResolved });

    await waitFor(() => expect(currentLocationOverlay()).toBeDefined());

    expect(currentLocationOverlay()).toMatchObject({
      position: { latitude: 37.501, longitude: 127.031 },
      clickable: false,
      zIndex: 10,
    });
    const content = currentLocationOverlay()?.content;
    expect(content).toBeInstanceOf(HTMLElement);
    expect((content as HTMLElement).style.pointerEvents).toBe('none');
    expect((content as HTMLElement).parentElement?.style.pointerEvents).toBe('none');
    expect(onInitialCenterResolved).toHaveBeenCalledWith({ latitude: 37.501, longitude: 127.031 });
    expect(getCurrentPosition).toHaveBeenCalledOnce();
    expect(mocks.markers).toHaveLength(2);
    expect(mocks.markerOptions.every((options) => options.zIndex === 1)).toBe(true);
    expect(mocks.clusterers[0].addMarkers).toHaveBeenCalledWith(mocks.markers);
  });

  it('does not show a current location overlay when geolocation permission is denied', async () => {
    useFailedGeolocation(1);
    const onInitialCenterResolved = vi.fn();

    renderHomeMap({ onInitialCenterResolved });

    await waitFor(() => expect(mocks.mapOptions).toHaveLength(1));

    expect(currentLocationOverlay()).toBeUndefined();
    expect(onInitialCenterResolved).toHaveBeenCalledWith({ latitude: 37.2002, longitude: 127.098 });
  });

  it('does not show a current location overlay when geolocation fails', async () => {
    useFailedGeolocation(2);

    renderHomeMap();

    await waitFor(() => expect(mocks.mapOptions).toHaveLength(1));

    expect(currentLocationOverlay()).toBeUndefined();
  });

  it('does not show a current location overlay for the fallback center when geolocation is unavailable', async () => {
    renderHomeMap();

    await waitFor(() => expect(mocks.mapOptions).toHaveLength(1));

    expect(mocks.mapOptions[0]).toMatchObject({
      center: { latitude: 37.2002, longitude: 127.098 },
    });
    expect(currentLocationOverlay()).toBeUndefined();
  });

  it('keeps the current location overlay while switching between popular and mine modes', async () => {
    const user = userEvent.setup();
    const getCurrentPosition = useSuccessfulGeolocation(37.501, 127.031);

    renderHomeMap();
    await waitFor(() => expect(currentLocationOverlay()).toBeDefined());

    await user.click(screen.getByRole('button', { name: '🔒 내 자물쇠 보기' }));
    await waitFor(() => expect(mocks.markers).toHaveLength(3));

    expect(mocks.customOverlayOptions.filter(isCurrentLocationOverlay)).toHaveLength(1);
    expect(getCurrentPosition).toHaveBeenCalledOnce();
  });
});

describe('HomeMap popular music selection', () => {
  it('starts clustering at the initial map level so visually overlapping Places are selectable', async () => {
    renderHomeMap();

    await waitFor(() => expect(mocks.clusterers).toHaveLength(1));

    expect(mocks.clustererOptions[0]).toMatchObject({
      averageCenter: true,
      minLevel: 5,
      disableClickZoom: true,
    });
  });

  it('loads popular tracks for one clicked popular marker', async () => {
    renderHomeMap();
    await waitFor(() => expect(mocks.markers).toHaveLength(2));

    act(() => mocks.triggerMarker(0));

    await waitFor(() => expect(mocks.getPopularTracks).toHaveBeenCalledOnce());
    expect(mocks.getPopularTracks).toHaveBeenCalledWith([10], expect.any(AbortSignal));
    expect(await screen.findByText('밤편지')).toBeInTheDocument();
    expect(mocks.fetchAuthenticatedJson).not.toHaveBeenCalled();
  });

  it('deduplicates Cluster place IDs before loading popular tracks', async () => {
    renderHomeMap();
    await waitFor(() => expect(mocks.markers).toHaveLength(2));

    act(() => mocks.triggerCluster([0, 0, 1]));

    await waitFor(() => expect(mocks.getPopularTracks).toHaveBeenCalledOnce());
    expect(mocks.getPopularTracks).toHaveBeenCalledWith([10, 11], expect.any(AbortSignal));
  });

  it('keeps the latest popular marker response when selections occur quickly', async () => {
    let resolveFirst: ((value: { recordCount: number; music: never[] }) => void) | undefined;
    let resolveSecond:
      ((value: { recordCount: number; music: Array<Record<string, unknown>> }) => void) | undefined;
    mocks.getPopularTracks
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );
    renderHomeMap();
    await waitFor(() => expect(mocks.markers).toHaveLength(2));

    act(() => mocks.triggerMarker(0));
    await waitFor(() => expect(mocks.getPopularTracks).toHaveBeenCalledTimes(1));
    act(() => mocks.triggerMarker(1));
    await waitFor(() => expect(mocks.getPopularTracks).toHaveBeenCalledTimes(2));

    await act(async () =>
      resolveSecond?.({
        recordCount: 1,
        music: [
          { rank: 1, musicTrackId: 8, title: '두 번째 곡', artistName: '아티스트', count: 1 },
        ],
      }),
    );
    expect(await screen.findByText('두 번째 곡')).toBeInTheDocument();

    await act(async () => resolveFirst?.({ recordCount: 1, music: [] }));
    expect(screen.getByText('두 번째 곡')).toBeInTheDocument();
  });

  it('keeps mine marker selection on the existing MyLocksSheet request', async () => {
    const user = userEvent.setup();
    renderHomeMap();
    await waitFor(() => expect(mocks.markers).toHaveLength(2));

    await user.click(screen.getByRole('button', { name: '🔒 내 자물쇠 보기' }));
    await waitFor(() => expect(mocks.markers).toHaveLength(3));
    act(() => mocks.triggerMarker(2));

    await waitFor(() => expect(mocks.getMyPlaceRecords).toHaveBeenCalledOnce());
    expect(mocks.getMyPlaceRecords).toHaveBeenCalledWith(
      [22],
      null,
      mocks.fetchAuthenticatedJson,
      expect.any(AbortSignal),
    );
    expect(mocks.getPopularTracks).not.toHaveBeenCalled();
  });

  it('shows the per-Place record count on a mine marker when it has multiple records', async () => {
    const user = userEvent.setup();
    mocks.getMyMarkers.mockResolvedValue([
      {
        placeId: 22,
        legalDongName: '테스트동',
        myRecordsCount: 2,
        latitude: 37.2,
        longitude: 127.1,
      },
    ]);

    renderHomeMap();
    await waitFor(() => expect(mocks.markers).toHaveLength(2));
    await user.click(screen.getByRole('button', { name: '🔒 내 자물쇠 보기' }));
    await waitFor(() => expect(mocks.markers).toHaveLength(3));

    const markerSvgSources = mocks.markerImageSources.map((source) =>
      decodeURIComponent(source.slice(source.indexOf(',') + 1)),
    );

    expect(markerSvgSources).toContainEqual(expect.stringContaining('data-my-records-count="2"'));
    expect(markerSvgSources).toContainEqual(expect.stringContaining('>2</text>'));
  });

  it('keeps mine Cluster selection on the existing MyLocksSheet request', async () => {
    const user = userEvent.setup();
    renderHomeMap();
    await waitFor(() => expect(mocks.markers).toHaveLength(2));
    await user.click(screen.getByRole('button', { name: '🔒 내 자물쇠 보기' }));
    await waitFor(() => expect(mocks.markers).toHaveLength(3));

    act(() => mocks.triggerCluster([2, 2]));

    await waitFor(() => expect(mocks.getMyPlaceRecords).toHaveBeenCalledOnce());
    expect(mocks.getMyPlaceRecords).toHaveBeenCalledWith(
      [22],
      null,
      mocks.fetchAuthenticatedJson,
      expect.any(AbortSignal),
    );
    expect(mocks.getPopularTracks).not.toHaveBeenCalled();
  });
});

function setGeolocation(getCurrentPosition: Geolocation['getCurrentPosition'] | null) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: getCurrentPosition === null ? undefined : { getCurrentPosition },
  });
}

function useSuccessfulGeolocation(latitude: number, longitude: number) {
  const position: GeolocationPosition = {
    coords: {
      accuracy: 0,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      latitude,
      longitude,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: 0,
    toJSON: () => ({}),
  };

  const getCurrentPosition: Geolocation['getCurrentPosition'] = vi.fn((success) => {
    success(position);
  });

  setGeolocation(getCurrentPosition);

  return getCurrentPosition;
}

function useFailedGeolocation(code: number) {
  const error: GeolocationPositionError = {
    code,
    message: '위치 정보를 가져올 수 없습니다.',
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  };

  setGeolocation((_success, failure) => failure?.(error));
}

function isCurrentLocationOverlay(options: Record<string, unknown>) {
  const content = options.content;
  return (
    (typeof content === 'string' && content.includes('home-map-current-location')) ||
    (content instanceof HTMLElement && content.classList.contains('home-map-current-location'))
  );
}

function currentLocationOverlay() {
  return mocks.customOverlayOptions.find(isCurrentLocationOverlay);
}

function renderHomeMap(props?: {
  onInitialCenterResolved?: (center: { latitude: number; longitude: number }) => void;
}) {
  return render(
    <MemoryRouter>
      <HomeMap {...props} />
    </MemoryRouter>,
  );
}
