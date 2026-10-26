import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { getMyMarkers } from '../api/getMyMarkers';
import { getMyPlaceRecords, type MyPlaceRecord } from '../api/getMyPlaceRecords';
import { getPopularMarkers } from '../api/getPopularMarkers';
import { getPopularTracks, type PopularTracksResult } from '../api/getPopularTracks';
import { useSession } from '../../../entities/session/model/useSession';
import { env } from '../../../shared/config/env';
import { MyLocksSheet } from './MyLocksSheet';
import { PopularTracksSheet } from './PopularTracksSheet';
import {
  type KakaoCluster,
  type KakaoCustomOverlay,
  type KakaoMarker,
  type KakaoMarkerClusterer,
  type KakaoMaps,
  loadKakaoMapSdk,
} from '../lib/kakaoMap';
import { observeMapResize } from '../lib/observeMapResize';
import './homeMap.css';

type MapMode = 'popular' | 'mine';
type MapLoadState = 'idle' | 'ready' | 'error';
type LocationLoadState =
  'loading' | 'ready' | 'permission-denied' | 'position-unavailable' | 'timeout' | 'unsupported';
type MarkersLoadState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';
type MyLocksLoadState = 'loading' | 'ready' | 'empty' | 'error';
type PopularTracksLoadState = 'loading' | 'ready' | 'empty' | 'error';
export type MapCenter = {
  latitude: number;
  longitude: number;
};

type HomeMapProps = {
  children?: ReactNode;
  overview?: ReactNode;
  primaryAction?: ReactNode;
  isPlaylistRequested?: boolean;
  isPlaylistVisible?: boolean;
  onPlaylistReady?: () => void;
  onClosePlaylist?: () => void;
  onInitialCenterResolved?: (center: MapCenter) => void;
  onCurrentLocationResolved?: (location: MapCenter | null) => void;
};

type PendingMapSheet = {
  mapMode: MapMode;
  placeIds: number[];
};

/** 위치 버튼과 권한 안내에서 글꼴에 영향받지 않는 중앙 정렬 아이콘을 표시한다. */
function CurrentLocationIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
    </svg>
  );
}

function getMapModeFromLocationState(state: unknown): MapMode {
  if (typeof state !== 'object' || state === null || !('mapMode' in state)) {
    return 'popular';
  }

  return state.mapMode === 'mine' || state.mapMode === 'popular' ? state.mapMode : 'popular';
}

function withMapModeInLocationState(state: unknown, mapMode: MapMode) {
  return {
    ...(typeof state === 'object' && state !== null ? state : {}),
    mapMode,
  };
}

/** GPS를 요청하고 성공 좌표 또는 위치 실패 이유를 반환한다. */
function getCurrentLocation(): Promise<
  { kind: 'ready'; center: MapCenter } | { kind: Exclude<LocationLoadState, 'loading' | 'ready'> }
> {
  return new Promise((resolve) => {
    try {
      const geolocation = navigator.geolocation;
      if (!geolocation) {
        resolve({ kind: 'unsupported' });
        return;
      }

      geolocation.getCurrentPosition(
        ({ coords }) => {
          const center = {
            latitude: coords.latitude,
            longitude: coords.longitude,
          };
          resolve({ kind: 'ready', center });
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            resolve({ kind: 'permission-denied' });
          } else if (error.code === error.TIMEOUT) {
            resolve({ kind: 'timeout' });
          } else {
            resolve({ kind: 'position-unavailable' });
          }
        },
        { timeout: 10_000, maximumAge: 0 },
      );
    } catch {
      resolve({ kind: 'position-unavailable' });
    }
  });
}

const MULO_PIN_PATH =
  'M21 2C10.5 2 2 10.5 2 21c0 14.1 19 29 19 29s19-14.9 19-29C40 10.5 31.5 2 21 2Z';

const MUSIC_NOTE_PIN_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="42" height="52" viewBox="0 0 42 52">
    <defs>
      <filter id="pin-shadow" x="-20%" y="-20%" width="140%" height="145%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="#7a5cbe" flood-opacity=".3"/>
      </filter>
    </defs>
    <path d="${MULO_PIN_PATH}" fill="#a78bde" stroke="#fff" stroke-width="2" filter="url(#pin-shadow)"/>
    <g transform="translate(-1.5 0)">
      <path d="M19 28V15l10-3v12.8M19 15l10-3" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <ellipse cx="16.3" cy="28.1" rx="3.5" ry="2.7" fill="#fff"/>
      <ellipse cx="26.3" cy="24.9" rx="3.5" ry="2.7" fill="#fff"/>
    </g>
  </svg>
`;

const SELECTED_MUSIC_NOTE_PIN_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="46" height="56" viewBox="0 0 42 52">
    <defs>
      <filter id="selected-pin-glow" x="-40%" y="-35%" width="180%" height="180%">
        <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#a78bde" flood-opacity=".62"/>
        <feDropShadow dx="0" dy="2" stdDeviation="1.8" flood-color="#7a5cbe" flood-opacity=".28"/>
      </filter>
    </defs>
    <path d="${MULO_PIN_PATH}" fill="#a78bde" stroke="#fff" stroke-width="4" filter="url(#selected-pin-glow)"/>
    <path d="${MULO_PIN_PATH}" fill="#a78bde" stroke="#fff" stroke-width="2"/>
    <g transform="translate(-1.5 0)">
      <path d="M19 28V15l10-3v12.8M19 15l10-3" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <ellipse cx="16.3" cy="28.1" rx="3.5" ry="2.7" fill="#fff"/>
      <ellipse cx="26.3" cy="24.9" rx="3.5" ry="2.7" fill="#fff"/>
    </g>
  </svg>
`;

/** 같은 Place에 저장된 내 자물쇠 수는 Cluster 수와 별도로 Marker 위에 표시한다. */
function addMyRecordsCountBadge(markerSvg: string, myRecordsCount: number) {
  if (myRecordsCount <= 1) {
    return markerSvg;
  }

  const countBadge = `
    <g data-my-records-count="${myRecordsCount}">
      <rect x="23" y="6" width="16" height="15" rx="7.5" fill="#7a5cbe" stroke="#fff" stroke-width="1.5"/>
      <text x="31" y="16.7" fill="#fff" font-family="Arial, sans-serif" font-size="9" font-weight="800" text-anchor="middle">${myRecordsCount}</text>
    </g>`;

  return markerSvg.replace('</svg>', `${countBadge}\n  </svg>`);
}

const CLUSTER_PIN_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="42" height="52" viewBox="0 0 42 52">
    <defs>
      <filter id="cluster-shadow" x="-20%" y="-20%" width="140%" height="145%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="#7a5cbe" flood-opacity=".3"/>
      </filter>
    </defs>
    <path d="${MULO_PIN_PATH}" fill="#a78bde" stroke="#fff" stroke-width="2" filter="url(#cluster-shadow)"/>
  </svg>
`;

const SELECTED_CLUSTER_HALO_CONTENT = `
  <span class="home-map-selected-cluster-halo" aria-hidden="true"></span>
`;

function createCurrentLocationOverlayContent() {
  const content = document.createElement('span');
  content.className = 'home-map-current-location';
  content.setAttribute('aria-hidden', 'true');
  content.style.pointerEvents = 'none';

  const dot = document.createElement('span');
  content.append(dot);

  return content;
}

/** 기본 Marker와 Cluster 색상을 맞추기 위한 MULO 음악 노트 핀 이미지를 생성한다. */
function createMusicNoteMarkerImage(kakao: KakaoMaps, myRecordsCount = 1) {
  const source = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    addMyRecordsCountBadge(MUSIC_NOTE_PIN_SVG, myRecordsCount),
  )}`;

  return new kakao.maps.MarkerImage(source, new kakao.maps.Size(42, 52), {
    offset: new kakao.maps.Point(21, 50),
  });
}

/** 선택된 Marker가 같은 좌표 anchor를 유지한 채 강조되도록 이미지를 만든다. */
function createSelectedMusicNoteMarkerImage(kakao: KakaoMaps, myRecordsCount = 1) {
  const source = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    addMyRecordsCountBadge(SELECTED_MUSIC_NOTE_PIN_SVG, myRecordsCount),
  )}`;

  return new kakao.maps.MarkerImage(source, new kakao.maps.Size(46, 56), {
    offset: new kakao.maps.Point(23, 54),
  });
}

/** Cluster 숫자를 핀 상단 body 중앙에 표시할 수 있는 배경 이미지를 만든다. */
function createClusterPinBackground() {
  const source = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(CLUSTER_PIN_SVG)}`;

  return `url("${source}") center / contain no-repeat`;
}

/** 홈의 지도 표시 기반과 목업의 지도 모드 선택 UI를 제공한다. */
export function HomeMap({
  children,
  overview,
  primaryAction,
  isPlaylistRequested = false,
  isPlaylistVisible = false,
  onPlaylistReady = () => undefined,
  onClosePlaylist = () => undefined,
  onInitialCenterResolved,
  onCurrentLocationResolved,
}: HomeMapProps) {
  // 부모의 슬롯/콜백 재조립은 지도를 재생성하거나 GPS를 다시 요청할 이유가 아니다.
  const locationCallbacksRef = useRef({ onInitialCenterResolved, onCurrentLocationResolved });
  useEffect(() => {
    locationCallbacksRef.current = { onInitialCenterResolved, onCurrentLocationResolved };
  }, [onInitialCenterResolved, onCurrentLocationResolved]);
  const navigate = useNavigate();
  const location = useLocation();
  const { fetchAuthenticatedJson, isAuthenticated } = useSession();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const popularModeButtonRef = useRef<HTMLButtonElement>(null);
  const mineModeButtonRef = useRef<HTMLButtonElement>(null);
  const mapModeRef = useRef<MapMode>('popular');
  const refreshMarkersRef = useRef<(() => void) | null>(null);
  const openMyLocksSheetRef = useRef<(placeIds: number[]) => void>(() => undefined);
  const closeMyLocksSheetRef = useRef<() => void>(() => undefined);
  const openPopularTracksSheetRef = useRef<(placeIds: number[]) => void>(() => undefined);
  const closePopularTracksSheetRef = useRef<() => void>(() => undefined);
  const pendingMapSheetRef = useRef<PendingMapSheet | null>(null);
  const clearMapSelectionRef = useRef<() => void>(() => undefined);
  const recenterMapRef = useRef<((center: MapCenter) => void) | null>(null);
  const myLocksRequestControllerRef = useRef<AbortController | null>(null);
  const myLocksRequestIdRef = useRef(0);
  const popularTracksRequestControllerRef = useRef<AbortController | null>(null);
  const popularTracksRequestIdRef = useRef(0);
  const [mapMode, setMapMode] = useState<MapMode>(() =>
    getMapModeFromLocationState(location.state),
  );
  const [locationLoadState, setLocationLoadState] = useState<LocationLoadState>('loading');
  const [locationRetryKey, setLocationRetryKey] = useState(0);
  const [isRecentering, setIsRecentering] = useState(false);
  const [recenterFailed, setRecenterFailed] = useState(false);
  const [mapLoadState, setMapLoadState] = useState<MapLoadState>('idle');
  const [markersLoadState, setMarkersLoadState] = useState<MarkersLoadState>('idle');
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<number[]>([]);
  const [myLocksRecords, setMyLocksRecords] = useState<MyPlaceRecord[]>([]);
  const [myLocksLoadState, setMyLocksLoadState] = useState<MyLocksLoadState>('loading');
  const [nextMyLocksCursor, setNextMyLocksCursor] = useState<string | null>(null);
  const [isMyLocksSheetOpen, setIsMyLocksSheetOpen] = useState(false);
  const [isMyLocksSheetVisible, setIsMyLocksSheetVisible] = useState(false);
  const [isLoadingNextPage, setIsLoadingNextPage] = useState(false);
  const [selectedPopularPlaceIds, setSelectedPopularPlaceIds] = useState<number[]>([]);
  const [popularTracksResult, setPopularTracksResult] = useState<PopularTracksResult | null>(null);
  const [popularTracksLoadState, setPopularTracksLoadState] =
    useState<PopularTracksLoadState>('loading');
  const [isPopularTracksSheetOpen, setIsPopularTracksSheetOpen] = useState(false);
  const [isPopularTracksSheetVisible, setIsPopularTracksSheetVisible] = useState(false);

  useEffect(() => {
    mapModeRef.current = mapMode;
    refreshMarkersRef.current?.();
  }, [mapMode]);

  useEffect(
    () => () => {
      myLocksRequestControllerRef.current?.abort();
      popularTracksRequestControllerRef.current?.abort();
    },
    [],
  );

  /** 선택한 Place의 첫 페이지 또는 다음 Cursor 페이지를 최신 요청만 반영해 조회한다. */
  const loadMyLocks = useCallback(
    async (placeIds: number[], cursor: string | null, append: boolean) => {
      myLocksRequestControllerRef.current?.abort();
      const requestController = new AbortController();
      const requestId = myLocksRequestIdRef.current + 1;
      myLocksRequestIdRef.current = requestId;
      myLocksRequestControllerRef.current = requestController;

      if (append) {
        setIsLoadingNextPage(true);
      } else {
        setMyLocksLoadState('loading');
      }

      try {
        const page = await getMyPlaceRecords(
          placeIds,
          cursor,
          fetchAuthenticatedJson,
          requestController.signal,
        );

        if (requestController.signal.aborted || requestId !== myLocksRequestIdRef.current) {
          return;
        }

        setMyLocksRecords((currentRecords) =>
          append ? [...currentRecords, ...page.records] : page.records,
        );
        setNextMyLocksCursor(page.nextCursor);
        setMyLocksLoadState(page.records.length === 0 && !append ? 'empty' : 'ready');
      } catch {
        if (!requestController.signal.aborted && requestId === myLocksRequestIdRef.current) {
          setMyLocksLoadState('error');
        }
      } finally {
        if (requestId === myLocksRequestIdRef.current) {
          myLocksRequestControllerRef.current = null;
          setIsLoadingNextPage(false);
        }
      }
    },
    [fetchAuthenticatedJson],
  );

  /** Marker 또는 Cluster가 선택한 Place IDs로 목록 sheet의 첫 페이지를 연다. */
  const openMyLocksSheet = useCallback(
    (placeIds: number[]) => {
      const uniquePlaceIds = [...new Set(placeIds)];

      if (uniquePlaceIds.length === 0 || mapModeRef.current !== 'mine') {
        return;
      }

      if (isPlaylistVisible) {
        pendingMapSheetRef.current = { mapMode: 'mine', placeIds: uniquePlaceIds };
        onClosePlaylist();
        return;
      }

      closePopularTracksSheetRef.current();
      setSelectedPlaceIds(uniquePlaceIds);
      setMyLocksRecords([]);
      setNextMyLocksCursor(null);
      setIsMyLocksSheetVisible(true);
      requestAnimationFrame(() => setIsMyLocksSheetOpen(true));
      void loadMyLocks(uniquePlaceIds, null, false);
    },
    [isPlaylistVisible, loadMyLocks, onClosePlaylist],
  );

  const closeMyLocksSheet = useCallback(() => {
    myLocksRequestControllerRef.current?.abort();
    myLocksRequestControllerRef.current = null;
    myLocksRequestIdRef.current += 1;
    setIsMyLocksSheetOpen(false);
    clearMapSelectionRef.current();
    setSelectedPlaceIds([]);
    setMyLocksRecords([]);
    setNextMyLocksCursor(null);
    setIsLoadingNextPage(false);
  }, []);

  /** 선택한 Place들의 최근 7일 인기 음악을 최신 요청만 반영해 조회한다. */
  const loadPopularTracks = useCallback(async (placeIds: number[]) => {
    popularTracksRequestControllerRef.current?.abort();
    const requestController = new AbortController();
    const requestId = popularTracksRequestIdRef.current + 1;
    popularTracksRequestIdRef.current = requestId;
    popularTracksRequestControllerRef.current = requestController;
    setPopularTracksResult(null);
    setPopularTracksLoadState('loading');

    try {
      const result = await getPopularTracks(placeIds, requestController.signal);
      if (requestController.signal.aborted || requestId !== popularTracksRequestIdRef.current) {
        return;
      }

      setPopularTracksResult(result);
      setPopularTracksLoadState(result.music.length === 0 ? 'empty' : 'ready');
    } catch {
      if (!requestController.signal.aborted && requestId === popularTracksRequestIdRef.current) {
        setPopularTracksLoadState('error');
      }
    } finally {
      if (requestId === popularTracksRequestIdRef.current) {
        popularTracksRequestControllerRef.current = null;
      }
    }
  }, []);

  /** 인기 Marker 또는 Cluster가 선택한 Place IDs로 음악 집계 sheet를 연다. */
  const openPopularTracksSheet = useCallback(
    (placeIds: number[]) => {
      const uniquePlaceIds = [...new Set(placeIds)];

      if (uniquePlaceIds.length === 0 || mapModeRef.current !== 'popular') {
        return;
      }

      if (isPlaylistVisible) {
        pendingMapSheetRef.current = { mapMode: 'popular', placeIds: uniquePlaceIds };
        onClosePlaylist();
        return;
      }

      closeMyLocksSheetRef.current();
      setSelectedPopularPlaceIds(uniquePlaceIds);
      setPopularTracksResult(null);
      setIsPopularTracksSheetVisible(true);
      requestAnimationFrame(() => setIsPopularTracksSheetOpen(true));
      void loadPopularTracks(uniquePlaceIds);
    },
    [isPlaylistVisible, loadPopularTracks, onClosePlaylist],
  );

  useEffect(() => {
    if (!isPlaylistRequested) return;

    if (isMyLocksSheetOpen) closeMyLocksSheetRef.current();
    if (isPopularTracksSheetOpen) closePopularTracksSheetRef.current();

    if (
      !isMyLocksSheetVisible &&
      !isPopularTracksSheetVisible &&
      !isMyLocksSheetOpen &&
      !isPopularTracksSheetOpen
    ) {
      onPlaylistReady();
    }
  }, [
    isPlaylistRequested,
    isMyLocksSheetOpen,
    isMyLocksSheetVisible,
    isPopularTracksSheetOpen,
    isPopularTracksSheetVisible,
    onPlaylistReady,
  ]);

  useEffect(() => {
    if (isPlaylistVisible) return;

    const pendingSheet = pendingMapSheetRef.current;
    if (pendingSheet === null) return;

    pendingMapSheetRef.current = null;
    if (pendingSheet.mapMode === 'mine') {
      openMyLocksSheet(pendingSheet.placeIds);
    } else {
      openPopularTracksSheet(pendingSheet.placeIds);
    }
  }, [isPlaylistVisible, openMyLocksSheet, openPopularTracksSheet]);

  const closePopularTracksSheet = useCallback(() => {
    popularTracksRequestControllerRef.current?.abort();
    popularTracksRequestControllerRef.current = null;
    popularTracksRequestIdRef.current += 1;
    setIsPopularTracksSheetOpen(false);
    clearMapSelectionRef.current();
    setSelectedPopularPlaceIds([]);
    setPopularTracksResult(null);
    setPopularTracksLoadState('loading');
  }, []);

  useEffect(() => {
    const mapElement = mapContainerRef.current;

    if (!mapElement || !env.kakaoMapAppKey) {
      return;
    }

    const mapContainer: HTMLElement = mapElement;
    let isMounted = true;
    let markers: KakaoMarker[] = [];
    let markerClusterer: KakaoMarkerClusterer | undefined;
    let activeRequestController: AbortController | undefined;
    let resizeObserver: ReturnType<typeof observeMapResize> | undefined;
    let removeIdleListener: (() => void) | undefined;
    let removeMapClickListener: (() => void) | undefined;
    let removeClusterClickListener: (() => void) | undefined;
    let removeMarkerClickListeners: (() => void)[] = [];
    const markerPlaceIds = new Map<KakaoMarker, number>();
    const markerDefaultImages = new Map<
      KakaoMarker,
      ReturnType<typeof createMusicNoteMarkerImage>
    >();
    const markerSelectedImages = new Map<
      KakaoMarker,
      ReturnType<typeof createSelectedMusicNoteMarkerImage>
    >();
    let selectedMarker: KakaoMarker | undefined;
    let selectedClusterOverlay: KakaoCustomOverlay | undefined;
    let selectedClusterMarker: KakaoCustomOverlay | undefined;
    let currentLocationOverlay: KakaoCustomOverlay | undefined;
    let resetSelectedMarkerImage: ((marker: KakaoMarker) => void) | undefined;

    /** Marker를 교체하되 resize 갱신에서는 선택 장소의 시각적 표시 수명을 분리한다. */
    function removeMapMarkers(preserveSelection = false) {
      if (preserveSelection) {
        selectedMarker = undefined;
        selectedClusterMarker = undefined;
      } else {
        clearMapSelection();
      }
      markerClusterer?.clear();
      removeMarkerClickListeners.forEach((removeListener) => removeListener());
      removeMarkerClickListeners = [];
      markerPlaceIds.clear();
      markerDefaultImages.clear();
      markerSelectedImages.clear();
      markers.forEach((marker) => marker.setMap(null));
      markers = [];
    }

    /** 현재 Marker 또는 Cluster의 강조 표시를 하나만 유지한다. */
    function clearMapSelection() {
      if (selectedMarker) {
        resetSelectedMarkerImage?.(selectedMarker);
        selectedMarker = undefined;
      }
      selectedClusterOverlay?.setMap(null);
      selectedClusterOverlay = undefined;
      selectedClusterMarker?.setZIndex(0);
      selectedClusterMarker = undefined;
    }

    /** fetch 취소로 발생한 오류는 사용자에게 조회 실패로 표시하지 않는다. */
    function isAbortError(error: unknown) {
      return error instanceof Error && error.name === 'AbortError';
    }

    /** 실제 현재 위치를 확인한 뒤에만 지도를 초기화한다. */
    async function initializeMap() {
      setLocationLoadState('loading');
      setMapLoadState('idle');
      try {
        const locationResult = await getCurrentLocation();

        if (!isMounted) {
          return;
        }

        if (locationResult.kind !== 'ready') {
          locationCallbacksRef.current.onCurrentLocationResolved?.(null);
          setLocationLoadState(locationResult.kind);
          return;
        }

        const initialCenter = locationResult.center;
        locationCallbacksRef.current.onInitialCenterResolved?.(initialCenter);
        locationCallbacksRef.current.onCurrentLocationResolved?.(initialCenter);
        setLocationLoadState('ready');

        const kakao = await loadKakaoMapSdk(env.kakaoMapAppKey);

        if (!isMounted) {
          return;
        }

        const center = new kakao.maps.LatLng(initialCenter.latitude, initialCenter.longitude);
        const map = new kakao.maps.Map(mapContainer, { center, level: 5 });
        const currentMarkerClusterer = new kakao.maps.MarkerClusterer({
          map,
          averageCenter: true,
          minLevel: 5,
          disableClickZoom: true,
          styles: [
            {
              width: '42px',
              height: '52px',
              background: createClusterPinBackground(),
              borderRadius: '0',
              border: '0',
              boxShadow: 'none',
              color: '#fff',
              textAlign: 'center',
              lineHeight: '37px',
              fontSize: '12px',
              fontWeight: '800',
            },
          ],
        });
        markerClusterer = currentMarkerClusterer;
        // 실제 GPS 위치 표시는 Place Marker·Clusterer와 독립적으로 유지한다.
        const currentLocationContent = createCurrentLocationOverlayContent();
        currentLocationOverlay = new kakao.maps.CustomOverlay({
          map,
          position: new kakao.maps.LatLng(initialCenter.latitude, initialCenter.longitude),
          content: currentLocationContent,
          xAnchor: 0.5,
          yAnchor: 0.5,
          clickable: false,
          zIndex: 10,
        });
        currentLocationContent.parentElement?.style.setProperty('pointer-events', 'none');
        // 지도 이동과 현재 위치 표시가 항상 같은 새 GPS 좌표를 가리키도록 유지한다.
        recenterMapRef.current = (newCenter) => {
          const position = new kakao.maps.LatLng(newCenter.latitude, newCenter.longitude);
          currentLocationOverlay?.setPosition(position);
          map.setCenter(position);
        };
        const musicNoteMarkerImage = createMusicNoteMarkerImage(kakao);
        const selectedMusicNoteMarkerImage = createSelectedMusicNoteMarkerImage(kakao);
        resetSelectedMarkerImage = (marker) => marker.setImage(musicNoteMarkerImage);
        clearMapSelectionRef.current = clearMapSelection;
        setMapLoadState('ready');

        /** 현재 bounds를 조회하며 resize일 때는 선택 목록·초점과 응답 전 Marker를 보존한다. */
        async function refreshMapMarkers(preserveSelection = false) {
          activeRequestController?.abort();
          if (!preserveSelection) {
            if (mapModeRef.current === 'mine') {
              closeMyLocksSheetRef.current();
            } else {
              closePopularTracksSheetRef.current();
            }
            removeMapMarkers();
          }

          const requestController = new AbortController();
          activeRequestController = requestController;
          const requestedMode = mapModeRef.current;
          const bounds = map.getBounds();
          const southwest = bounds.getSouthWest();
          const northeast = bounds.getNorthEast();
          const mapBounds = {
            swLat: southwest.getLat(),
            swLng: southwest.getLng(),
            neLat: northeast.getLat(),
            neLng: northeast.getLng(),
          };

          setMarkersLoadState('loading');

          try {
            const mapMarkers =
              requestedMode === 'popular'
                ? await getPopularMarkers(mapBounds, requestController.signal)
                : await getMyMarkers(mapBounds, fetchAuthenticatedJson, requestController.signal);

            if (
              !isMounted ||
              requestController.signal.aborted ||
              activeRequestController !== requestController ||
              mapModeRef.current !== requestedMode
            ) {
              return;
            }

            const selectedPlaceId = selectedMarker ? markerPlaceIds.get(selectedMarker) : undefined;
            if (preserveSelection) removeMapMarkers(true);

            markers = mapMarkers.map((marker) => {
              const myRecordsCount = 'myRecordsCount' in marker ? marker.myRecordsCount : 1;
              const markerImage =
                requestedMode === 'mine'
                  ? createMusicNoteMarkerImage(kakao, myRecordsCount)
                  : musicNoteMarkerImage;
              const selectedMarkerImage =
                requestedMode === 'mine'
                  ? createSelectedMusicNoteMarkerImage(kakao, myRecordsCount)
                  : selectedMusicNoteMarkerImage;
              const kakaoMarker = new kakao.maps.Marker({
                position: new kakao.maps.LatLng(marker.latitude, marker.longitude),
                image: markerImage,
                clickable: true,
                zIndex: 1,
              });
              markerPlaceIds.set(kakaoMarker, marker.placeId);
              markerDefaultImages.set(kakaoMarker, markerImage);
              markerSelectedImages.set(kakaoMarker, selectedMarkerImage);
              if (preserveSelection && marker.placeId === selectedPlaceId) {
                selectedMarker = kakaoMarker;
                selectedMarker.setImage(selectedMarkerImage);
              }
              resetSelectedMarkerImage = (selected) =>
                selected.setImage(markerDefaultImages.get(selected) ?? musicNoteMarkerImage);
              const handleMarkerClick = () => {
                if (mapModeRef.current === 'popular') {
                  clearMapSelection();
                  openPopularTracksSheetRef.current([marker.placeId]);
                  return;
                }

                if (mapModeRef.current !== 'mine') return;

                clearMapSelection();
                selectedMarker = kakaoMarker;
                selectedMarker.setImage(
                  markerSelectedImages.get(kakaoMarker) ?? selectedMusicNoteMarkerImage,
                );
                openMyLocksSheetRef.current([marker.placeId]);
              };
              kakao.maps.event.addListener(kakaoMarker, 'click', handleMarkerClick);
              removeMarkerClickListeners.push(() => {
                kakao.maps.event.removeListener(kakaoMarker, 'click', handleMarkerClick);
              });

              return kakaoMarker;
            });
            currentMarkerClusterer.addMarkers(markers);
            setMarkersLoadState(mapMarkers.length === 0 ? 'empty' : 'ready');
          } catch (error: unknown) {
            if (
              isMounted &&
              activeRequestController === requestController &&
              !requestController.signal.aborted &&
              !isAbortError(error)
            ) {
              setMarkersLoadState('error');
            }
          } finally {
            if (activeRequestController === requestController) {
              activeRequestController = undefined;
            }
          }
        }

        refreshMarkersRef.current = () => {
          void refreshMapMarkers();
        };

        const handleClusterClick = (cluster: KakaoCluster) => {
          const placeIds = [
            ...new Set(
              cluster.getMarkers().flatMap((marker) => {
                const placeId = markerPlaceIds.get(marker);
                return placeId === undefined ? [] : [placeId];
              }),
            ),
          ];

          if (mapModeRef.current === 'popular') {
            clearMapSelection();
            openPopularTracksSheetRef.current(placeIds);
            return;
          }

          if (mapModeRef.current !== 'mine') return;

          clearMapSelection();
          selectedClusterMarker = cluster.getClusterMarker();
          selectedClusterMarker.setZIndex(3);
          selectedClusterOverlay = new kakao.maps.CustomOverlay({
            map,
            position: cluster.getCenter(),
            content: SELECTED_CLUSTER_HALO_CONTENT,
            xAnchor: 0.5,
            yAnchor: 0.5,
            zIndex: 2,
          });

          openMyLocksSheetRef.current(placeIds);
        };
        kakao.maps.event.addListener(currentMarkerClusterer, 'clusterclick', handleClusterClick);
        removeClusterClickListener = () => {
          kakao.maps.event.removeListener(
            currentMarkerClusterer,
            'clusterclick',
            handleClusterClick,
          );
        };

        resizeObserver = observeMapResize(mapContainer, map, () => {
          void refreshMapMarkers(true);
        });

        const handleMapIdle = () => {
          if (resizeObserver?.isResizeIdle()) return;
          void refreshMapMarkers();
        };

        const handleMapClick = () => {
          closeMyLocksSheetRef.current();
          closePopularTracksSheetRef.current();
        };

        kakao.maps.event.addListener(map, 'click', handleMapClick);
        removeMapClickListener = () => {
          kakao.maps.event.removeListener(map, 'click', handleMapClick);
        };

        kakao.maps.event.addListener(map, 'idle', handleMapIdle);
        removeIdleListener = () => {
          kakao.maps.event.removeListener(map, 'idle', handleMapIdle);
        };

        await refreshMapMarkers();
      } catch {
        if (isMounted) {
          setMapLoadState('error');
        }
      }
    }

    void initializeMap();

    return () => {
      isMounted = false;
      activeRequestController?.abort();
      resizeObserver?.disconnect();
      removeIdleListener?.();
      removeMapClickListener?.();
      removeClusterClickListener?.();
      currentLocationOverlay?.setMap(null);
      recenterMapRef.current = null;
      if (refreshMarkersRef.current) {
        refreshMarkersRef.current = null;
      }
      removeMapMarkers();
      clearMapSelectionRef.current = () => undefined;
    };
  }, [fetchAuthenticatedJson, locationRetryKey]);

  const isMissingMapAppKey = !env.kakaoMapAppKey;

  /** 버튼 클릭 시 GPS를 새로 조회하고 성공한 좌표로 지도와 홈 위치 정보를 갱신한다. */
  async function handleRecenterToCurrentLocation() {
    if (!recenterMapRef.current || isRecentering) return;

    setIsRecentering(true);
    setRecenterFailed(false);
    try {
      const result = await getCurrentLocation();
      if (!recenterMapRef.current) return;

      if (result.kind === 'ready') {
        recenterMapRef.current(result.center);
        onCurrentLocationResolved?.(result.center);
      } else if (result.kind === 'permission-denied') {
        onCurrentLocationResolved?.(null);
        setLocationLoadState(result.kind);
      } else {
        setRecenterFailed(true);
      }
    } finally {
      setIsRecentering(false);
    }
  }

  function handleMapModeChange(nextMapMode: MapMode) {
    if (nextMapMode === 'mine' && !isAuthenticated) {
      navigate('/login');
      return;
    }

    if (nextMapMode === 'popular') {
      closeMyLocksSheet();
    } else {
      closePopularTracksSheet();
    }

    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: withMapModeInLocationState(location.state, nextMapMode),
    });
    setMapMode(nextMapMode);
  }

  useEffect(() => {
    openMyLocksSheetRef.current = openMyLocksSheet;
  }, [openMyLocksSheet]);

  useEffect(() => {
    closeMyLocksSheetRef.current = closeMyLocksSheet;
  }, [closeMyLocksSheet]);

  useEffect(() => {
    openPopularTracksSheetRef.current = openPopularTracksSheet;
  }, [openPopularTracksSheet]);

  useEffect(() => {
    closePopularTracksSheetRef.current = closePopularTracksSheet;
  }, [closePopularTracksSheet]);

  function finishClosingMyLocksSheet() {
    if (!isMyLocksSheetOpen) {
      setIsMyLocksSheetVisible(false);
      (mapMode === 'popular' ? popularModeButtonRef : mineModeButtonRef).current?.focus();
    }
  }

  function finishClosingPopularTracksSheet() {
    if (!isPopularTracksSheetOpen) {
      setIsPopularTracksSheetVisible(false);
      (mapMode === 'popular' ? popularModeButtonRef : mineModeButtonRef).current?.focus();
    }
  }

  return (
    <section className="home-map-section" aria-label="자물쇠 지도">
      {/* 목록은 하단 시트이므로 추천·생성 영역을 창 너비에 따라 숨기지 않는다. */}
      {overview ? <div className="home-map-overview">{overview}</div> : null}
      <div className="home-map-toggle" role="group" aria-label="지도 보기 모드">
        <button
          ref={popularModeButtonRef}
          className={mapMode === 'popular' ? 'is-active is-popular' : ''}
          type="button"
          disabled={locationLoadState !== 'ready' || mapLoadState !== 'ready'}
          onClick={() => handleMapModeChange('popular')}
        >
          🔥 인기 자물쇠
        </button>
        <button
          ref={mineModeButtonRef}
          className={mapMode === 'mine' ? 'is-active is-mine' : ''}
          type="button"
          disabled={locationLoadState !== 'ready' || mapLoadState !== 'ready'}
          onClick={() => handleMapModeChange('mine')}
        >
          🔒 내 자물쇠 보기
        </button>
      </div>

      <div className="home-map-canvas">
        <div className="home-map-viewport">
          <div className="home-map-instance" ref={mapContainerRef} />
          {locationLoadState === 'ready' && mapLoadState === 'ready' ? (
            <button
              className="home-map-recenter"
              type="button"
              aria-label="내 위치로 이동"
              disabled={isRecentering}
              onClick={() => void handleRecenterToCurrentLocation()}
            >
              <CurrentLocationIcon />
            </button>
          ) : null}
          {recenterFailed ? (
            <p className="home-map-recenter-error" role="alert">
              현재 위치를 다시 확인하지 못했어요.
            </p>
          ) : null}
          {locationLoadState !== 'ready' ? (
            <div
              className="home-map-notice home-map-notice--location"
              role={locationLoadState === 'loading' ? 'status' : 'alert'}
            >
              <span className="home-map-location-icon" aria-hidden="true">
                <CurrentLocationIcon />
              </span>
              <strong>
                {locationLoadState === 'loading'
                  ? '현재 위치를 확인하는 중이에요'
                  : locationLoadState === 'permission-denied'
                    ? '위치 권한이 필요해요'
                    : locationLoadState === 'unsupported'
                      ? '위치 기능을 사용할 수 없어요'
                      : '현재 위치를 확인할 수 없어요'}
              </strong>
              <p>
                {locationLoadState === 'permission-denied'
                  ? '브라우저 설정에서 이 사이트의 위치 권한을 허용한 뒤 아래 버튼을 눌러주세요.'
                  : locationLoadState === 'unsupported'
                    ? '현재 브라우저에서는 위치 기반 기능을 이용할 수 없습니다.'
                    : locationLoadState === 'loading'
                      ? '잠시만 기다려주세요.'
                      : '위치를 다시 요청합니다. 권한 요청 창이 나타나면 브라우저에서 허용해주세요.'}
              </p>
              {locationLoadState !== 'loading' && locationLoadState !== 'unsupported' ? (
                <button type="button" onClick={() => setLocationRetryKey((key) => key + 1)}>
                  {locationLoadState === 'permission-denied'
                    ? '위치 권한 다시 확인'
                    : '위치 권한 허용하기'}
                </button>
              ) : null}
            </div>
          ) : null}
          {isMissingMapAppKey ? (
            <div className="home-map-notice" role="status">
              <span aria-hidden="true">🗺️</span>
              <strong>카카오맵을 불러오지 못했습니다</strong>
              <p>잠시 후 다시 시도해주세요.</p>
            </div>
          ) : null}
          {mapLoadState === 'error' ? (
            <div className="home-map-notice" role="alert">
              <span aria-hidden="true">⚠️</span>
              <strong>카카오맵을 불러오지 못했어요</strong>
              <p>카카오 JavaScript 앱 키와 등록 도메인을 확인한 뒤 다시 시도해주세요.</p>
            </div>
          ) : null}
          {mapLoadState === 'ready' && markersLoadState === 'error' ? (
            <div className="home-map-notice" role="alert">
              <span aria-hidden="true">⚠️</span>
              <strong>
                {mapMode === 'popular'
                  ? '인기 자물쇠를 불러오지 못했어요'
                  : '내 자물쇠를 불러오지 못했어요'}
              </strong>
              <p>잠시 후 다시 시도해주세요.</p>
            </div>
          ) : null}
          {!isMissingMapAppKey && locationLoadState === 'ready' && mapLoadState === 'idle' ? (
            <div className="home-map-notice" role="status">
              <span aria-hidden="true">🗺️</span>
              <strong>지도를 불러오는 중이에요</strong>
            </div>
          ) : null}
          {children}
        </div>
        {isMyLocksSheetVisible ? (
          <MyLocksSheet
            isOpen={isMyLocksSheetOpen}
            placeCount={selectedPlaceIds.length}
            records={myLocksRecords}
            loadState={myLocksLoadState}
            hasNextPage={nextMyLocksCursor !== null}
            isLoadingNextPage={isLoadingNextPage}
            onLoadNextPage={() => {
              if (nextMyLocksCursor !== null) {
                void loadMyLocks(selectedPlaceIds, nextMyLocksCursor, true);
              }
            }}
            onClose={closeMyLocksSheet}
            onExited={finishClosingMyLocksSheet}
          />
        ) : null}
        {isPopularTracksSheetVisible ? (
          <PopularTracksSheet
            isOpen={isPopularTracksSheetOpen}
            placeCount={selectedPopularPlaceIds.length}
            result={popularTracksResult}
            loadState={popularTracksLoadState}
            onRetry={() => {
              if (selectedPopularPlaceIds.length > 0) {
                void loadPopularTracks(selectedPopularPlaceIds);
              }
            }}
            onClose={closePopularTracksSheet}
            onExited={finishClosingPopularTracksSheet}
          />
        ) : null}
      </div>
      {primaryAction ? <div className="home-map-primary-action">{primaryAction}</div> : null}
    </section>
  );
}
