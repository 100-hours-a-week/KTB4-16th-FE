import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { getMyMarkers } from '../api/getMyMarkers';
import { getMyPlaceRecords, type MyPlaceRecord } from '../api/getMyPlaceRecords';
import { getPopularMarkers } from '../api/getPopularMarkers';
import { useSession } from '../../../entities/session/model/useSession';
import { env } from '../../../shared/config/env';
import { MyLocksSheet } from './MyLocksSheet';
import {
  type KakaoCluster,
  type KakaoCustomOverlay,
  type KakaoMarker,
  type KakaoMarkerClusterer,
  type KakaoMaps,
  loadKakaoMapSdk,
} from '../lib/kakaoMap';
import './homeMap.css';

type MapMode = 'popular' | 'mine';
type MapLoadState = 'idle' | 'ready' | 'error';
type MarkersLoadState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';
type MyLocksLoadState = 'loading' | 'ready' | 'empty' | 'error';
export type MapCenter = {
  latitude: number;
  longitude: number;
};

type HomeMapProps = {
  children?: ReactNode;
  onInitialCenterResolved?: (center: MapCenter) => void;
};

const DEFAULT_CENTER: MapCenter = {
  latitude: 37.2002,
  longitude: 127.098,
};

/** 위치 권한·지원 여부와 관계없이 지도 생성에 사용할 초기 중심 좌표를 반환한다. */
function getInitialMapCenter(): Promise<MapCenter> {
  if (!navigator.geolocation) {
    return Promise.resolve(DEFAULT_CENTER);
  }

  return new Promise((resolve) => {
    try {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          resolve({
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
        },
        () => {
          resolve(DEFAULT_CENTER);
        },
        { timeout: 10_000 },
      );
    } catch {
      resolve(DEFAULT_CENTER);
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

/** 기본 Marker와 Cluster 색상을 맞추기 위한 MULO 음악 노트 핀 이미지를 생성한다. */
function createMusicNoteMarkerImage(kakao: KakaoMaps) {
  const source = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(MUSIC_NOTE_PIN_SVG)}`;

  return new kakao.maps.MarkerImage(source, new kakao.maps.Size(42, 52), {
    offset: new kakao.maps.Point(21, 50),
  });
}

/** 선택된 Marker가 같은 좌표 anchor를 유지한 채 강조되도록 이미지를 만든다. */
function createSelectedMusicNoteMarkerImage(kakao: KakaoMaps) {
  const source = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(SELECTED_MUSIC_NOTE_PIN_SVG)}`;

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
export function HomeMap({ children, onInitialCenterResolved }: HomeMapProps) {
  const navigate = useNavigate();
  const { fetchAuthenticatedJson, isAuthenticated } = useSession();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const initialCenterPromiseRef = useRef<Promise<MapCenter> | null>(null);
  const mapModeRef = useRef<MapMode>('popular');
  const refreshMarkersRef = useRef<(() => void) | null>(null);
  const openMyLocksSheetRef = useRef<(placeIds: number[]) => void>(() => undefined);
  const closeMyLocksSheetRef = useRef<() => void>(() => undefined);
  const clearMapSelectionRef = useRef<() => void>(() => undefined);
  const myLocksRequestControllerRef = useRef<AbortController | null>(null);
  const myLocksRequestIdRef = useRef(0);
  const [mapMode, setMapMode] = useState<MapMode>('popular');
  const [mapLoadState, setMapLoadState] = useState<MapLoadState>('idle');
  const [markersLoadState, setMarkersLoadState] = useState<MarkersLoadState>('idle');
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<number[]>([]);
  const [myLocksRecords, setMyLocksRecords] = useState<MyPlaceRecord[]>([]);
  const [myLocksLoadState, setMyLocksLoadState] = useState<MyLocksLoadState>('loading');
  const [nextMyLocksCursor, setNextMyLocksCursor] = useState<string | null>(null);
  const [isMyLocksSheetOpen, setIsMyLocksSheetOpen] = useState(false);
  const [isMyLocksSheetVisible, setIsMyLocksSheetVisible] = useState(false);
  const [isLoadingNextPage, setIsLoadingNextPage] = useState(false);

  useEffect(() => {
    mapModeRef.current = mapMode;
    refreshMarkersRef.current?.();
  }, [mapMode]);

  useEffect(
    () => () => {
      myLocksRequestControllerRef.current?.abort();
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

      setSelectedPlaceIds(uniquePlaceIds);
      setMyLocksRecords([]);
      setNextMyLocksCursor(null);
      setIsMyLocksSheetVisible(true);
      requestAnimationFrame(() => setIsMyLocksSheetOpen(true));
      void loadMyLocks(uniquePlaceIds, null, false);
    },
    [loadMyLocks],
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
    let removeIdleListener: (() => void) | undefined;
    let removeMapClickListener: (() => void) | undefined;
    let removeClusterClickListener: (() => void) | undefined;
    let removeMarkerClickListeners: (() => void)[] = [];
    const markerPlaceIds = new Map<KakaoMarker, number>();
    let selectedMarker: KakaoMarker | undefined;
    let selectedClusterOverlay: KakaoCustomOverlay | undefined;
    let selectedClusterMarker: KakaoCustomOverlay | undefined;
    let resetSelectedMarkerImage: ((marker: KakaoMarker) => void) | undefined;

    /** 현재 viewport의 Cluster와 선택된 지도 모드의 Marker를 모두 제거한다. */
    function removeMapMarkers() {
      clearMapSelection();
      markerClusterer?.clear();
      removeMarkerClickListeners.forEach((removeListener) => removeListener());
      removeMarkerClickListeners = [];
      markerPlaceIds.clear();
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

    /** 현재 위치 또는 fallback 중심 좌표를 기준으로 지도를 생성한다. */
    async function initializeMap() {
      try {
        const initialCenterPromise = initialCenterPromiseRef.current ?? getInitialMapCenter();
        initialCenterPromiseRef.current = initialCenterPromise;
        const initialCenter = await initialCenterPromise;

        if (!isMounted) {
          return;
        }

        onInitialCenterResolved?.(initialCenter);

        const kakao = await loadKakaoMapSdk(env.kakaoMapAppKey);

        if (!isMounted) {
          return;
        }

        const center = new kakao.maps.LatLng(initialCenter.latitude, initialCenter.longitude);
        const map = new kakao.maps.Map(mapContainer, { center, level: 5 });
        const currentMarkerClusterer = new kakao.maps.MarkerClusterer({
          map,
          averageCenter: true,
          minLevel: 6,
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
        const musicNoteMarkerImage = createMusicNoteMarkerImage(kakao);
        const selectedMusicNoteMarkerImage = createSelectedMusicNoteMarkerImage(kakao);
        resetSelectedMarkerImage = (marker) => marker.setImage(musicNoteMarkerImage);
        clearMapSelectionRef.current = clearMapSelection;
        setMapLoadState('ready');

        /** 현재 모드와 viewport에 맞는 Place 목록을 조회해 Marker와 Cluster를 교체한다. */
        async function refreshMapMarkers() {
          activeRequestController?.abort();
          if (mapModeRef.current === 'mine') {
            closeMyLocksSheetRef.current();
          }
          removeMapMarkers();

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

            markers = mapMarkers.map((marker) => {
              const kakaoMarker = new kakao.maps.Marker({
                position: new kakao.maps.LatLng(marker.latitude, marker.longitude),
                image: musicNoteMarkerImage,
                clickable: true,
              });
              markerPlaceIds.set(kakaoMarker, marker.placeId);
              const handleMarkerClick = () => {
                if (mapModeRef.current !== 'mine') {
                  return;
                }
                clearMapSelection();
                selectedMarker = kakaoMarker;
                selectedMarker.setImage(selectedMusicNoteMarkerImage);
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
          if (mapModeRef.current !== 'mine') {
            return;
          }

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

          openMyLocksSheetRef.current(
            cluster.getMarkers().flatMap((marker) => {
              const placeId = markerPlaceIds.get(marker);
              return placeId === undefined ? [] : [placeId];
            }),
          );
        };
        kakao.maps.event.addListener(currentMarkerClusterer, 'clusterclick', handleClusterClick);
        removeClusterClickListener = () => {
          kakao.maps.event.removeListener(
            currentMarkerClusterer,
            'clusterclick',
            handleClusterClick,
          );
        };

        const handleMapIdle = () => {
          void refreshMapMarkers();
        };

        const handleMapClick = () => {
          closeMyLocksSheetRef.current();
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
      removeIdleListener?.();
      removeMapClickListener?.();
      removeClusterClickListener?.();
      if (refreshMarkersRef.current) {
        refreshMarkersRef.current = null;
      }
      removeMapMarkers();
      clearMapSelectionRef.current = () => undefined;
    };
  }, [fetchAuthenticatedJson, onInitialCenterResolved]);

  const isMissingMapAppKey = !env.kakaoMapAppKey;

  function handleMapModeChange(nextMapMode: MapMode) {
    if (nextMapMode === 'mine' && !isAuthenticated) {
      navigate('/login');
      return;
    }

    if (nextMapMode === 'popular') {
      closeMyLocksSheet();
    }

    setMapMode(nextMapMode);
  }

  useEffect(() => {
    openMyLocksSheetRef.current = openMyLocksSheet;
  }, [openMyLocksSheet]);

  useEffect(() => {
    closeMyLocksSheetRef.current = closeMyLocksSheet;
  }, [closeMyLocksSheet]);

  function finishClosingMyLocksSheet() {
    if (!isMyLocksSheetOpen) {
      setIsMyLocksSheetVisible(false);
    }
  }

  return (
    <section className="home-map-section" aria-label="자물쇠 지도">
      <div className="home-map-toggle" role="group" aria-label="지도 보기 모드">
        <button
          className={mapMode === 'popular' ? 'is-active is-popular' : ''}
          type="button"
          onClick={() => handleMapModeChange('popular')}
        >
          🔥 인기 자물쇠
        </button>
        <button
          className={mapMode === 'mine' ? 'is-active is-mine' : ''}
          type="button"
          onClick={() => handleMapModeChange('mine')}
        >
          🔒 내 자물쇠 보기
        </button>
      </div>

      <div className="home-map-canvas">
        <div className="home-map-instance" ref={mapContainerRef} />
        {isMissingMapAppKey ? (
          <div className="home-map-notice" role="status">
            <span aria-hidden="true">🗺️</span>
            <strong>카카오맵을 준비하고 있어요</strong>
            <p>`.env`에 VITE_KAKAO_MAP_APP_KEY를 설정하면 지도가 표시됩니다.</p>
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
        {!isMissingMapAppKey && mapLoadState === 'idle' ? (
          <div className="home-map-notice" role="status">
            <span aria-hidden="true">🗺️</span>
            <strong>지도를 불러오는 중이에요</strong>
          </div>
        ) : null}
        {children}
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
      </div>
    </section>
  );
}
