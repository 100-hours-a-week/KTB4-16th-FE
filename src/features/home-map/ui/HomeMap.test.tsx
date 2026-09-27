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
  const clusterers: Array<{
    addMarkers: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  }> = [];

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
    clusterers,
    reset() {
      listeners = new Map<object, Map<string, Listener>>();
      markers.splice(0);
      clusterers.splice(0);
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

    constructor() {
      mocks.markers.push(this);
    }
  }

  class MarkerClusterer {
    addMarkers = vi.fn();
    clear = vi.fn();

    constructor() {
      mocks.clusterers.push(this);
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
        MarkerImage: class {},
        Map: class {
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
  mocks.getPopularMarkers.mockResolvedValue(popularMarkers);
  mocks.getPopularTracks.mockResolvedValue({
    recordCount: 1,
    music: [{ rank: 1, musicTrackId: 7, title: '밤편지', artistName: '아이유', count: 1 }],
  });
  mocks.getMyMarkers.mockResolvedValue([
    { placeId: 22, legalDongName: '테스트동', latitude: 37.2, longitude: 127.1 },
  ]);
  mocks.getMyPlaceRecords.mockResolvedValue({ records: [], nextCursor: null });
});

describe('HomeMap popular music selection', () => {
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

function renderHomeMap() {
  return render(
    <MemoryRouter>
      <HomeMap />
    </MemoryRouter>,
  );
}
