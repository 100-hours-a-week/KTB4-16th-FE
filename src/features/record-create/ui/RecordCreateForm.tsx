import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { useSession } from '../../../entities/session/model/useSession';
import { getMoodEmoji } from '../../../entities/record/model/mood';
import { MusicSearchField } from '../../music-search';
import { env } from '../../../shared/config/env';
import {
  loadKakaoMapSdk,
  type KakaoCustomOverlay,
  type KakaoMap,
  type KakaoMaps,
} from '../../home-map/lib/kakaoMap';
import { createRecord } from '../api/createRecord';
import {
  getPhotoMusicRecommendations,
  type PhotoMusicRecommendation,
} from '../api/getPhotoMusicRecommendations';
import { getUploadSignedUrl } from '../api/getUploadSignedUrl';
import { uploadPhoto } from '../api/uploadPhoto';
import type { RecordLocation, SelectedMusic } from '../model/recordCreate.types';
import { PhotoMusicRecommendationModal } from './PhotoMusicRecommendationModal';

const HEIC_IMAGE_TYPE = 'image/heic';
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', HEIC_IMAGE_TYPE, 'image/webp']);
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

type PhotoPreview = { kind: 'local' | 'signed'; url: string };

type Props = {
  onCoordinatesChange: (coordinates: { latitude: number; longitude: number }) => void;
  onCreated: (recordId: number) => void;
  weather: ReactNode;
};

type Coordinates = { latitude: number; longitude: number };
type LocationAccessState =
  | 'loading'
  | 'ready'
  | 'permission-denied'
  | 'position-unavailable'
  | 'timeout'
  | 'unsupported'
  | 'map-error';

type InitialCoordinatesResult =
  | { kind: 'ready'; coordinates: Coordinates }
  | { kind: Exclude<LocationAccessState, 'loading' | 'ready' | 'map-error'> };

/** 위치 권한 결과를 기존 위치 상태 모델로 변환해 최초 로드와 재조회에서 공유한다. */
function getCurrentCoordinates(): Promise<InitialCoordinatesResult> {
  return new Promise((resolve) => {
    try {
      const geolocation = navigator.geolocation;
      if (!geolocation) {
        resolve({ kind: 'unsupported' });
        return;
      }

      geolocation.getCurrentPosition(
        ({ coords }) =>
          resolve({
            kind: 'ready',
            coordinates: { latitude: coords.latitude, longitude: coords.longitude },
          }),
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

function createGpsLocationContent() {
  const content = document.createElement('span');
  content.className = 'lock-create-gps-location';
  content.setAttribute('aria-hidden', 'true');
  content.style.pointerEvents = 'none';
  const dot = document.createElement('span');
  content.append(dot);
  return content;
}

/** 자물쇠 생성에 필요한 위치·사진·음악 입력과 API 제출 흐름을 소유한다. */
export function RecordCreateForm({ onCoordinatesChange, onCreated, weather }: Props) {
  const { fetchAuthenticatedJson } = useSession();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const adjustButtonRef = useRef<HTMLButtonElement>(null);
  const closeEditorButtonRef = useRef<HTMLButtonElement>(null);
  const hasOpenedLocationEditorRef = useRef(false);
  const mapRef = useRef<KakaoMap | null>(null);
  const kakaoRef = useRef<KakaoMaps | null>(null);
  const currentGpsLocationRef = useRef<Coordinates | null>(null);
  const gpsLocationOverlayRef = useRef<KakaoCustomOverlay | null>(null);
  const resolveLegalDongRef = useRef<((coordinates: Coordinates) => void) | null>(null);
  const isLocationEditorOpenRef = useRef(false);
  const locationRequestIdRef = useRef(0);
  const gpsRequestIdRef = useRef(0);
  const mapLayoutFrameRef = useRef<number | null>(null);
  const lastRequestedCoordinatesRef = useRef<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoSelectionIdRef = useRef(0);
  const recommendationRequestIdRef = useRef(0);
  const [location, setLocation] = useState<RecordLocation | null>(null);
  const [draftLocation, setDraftLocation] = useState<RecordLocation | null>(null);
  const [isLocationEditorOpen, setIsLocationEditorOpen] = useState(false);
  const [isRefreshingCurrentLocation, setIsRefreshingCurrentLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationAccessState, setLocationAccessState] = useState<LocationAccessState>('loading');
  const [locationRetryKey, setLocationRetryKey] = useState(0);
  const [isMapReady, setIsMapReady] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<PhotoPreview | null>(null);
  const [uploadId, setUploadId] = useState<number | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [recommendations, setRecommendations] = useState<PhotoMusicRecommendation[]>([]);
  const [recommendationLoadState, setRecommendationLoadState] = useState<
    'loading' | 'ready' | 'error'
  >('ready');
  const [isRecommendationOpen, setIsRecommendationOpen] = useState(false);
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [selectedMusic, setSelectedMusic] = useState<SelectedMusic | null>(null);
  const [moodScore, setMoodScore] = useState(0);
  const [comment, setComment] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasCurrentGpsLocation, setHasCurrentGpsLocation] = useState(false);
  const missingRequiredItems: string[] = [];
  if (!location) missingRequiredItems.push('위치 선택');
  if (!uploadId) missingRequiredItems.push('사진 업로드');
  if (!selectedMusic) missingRequiredItems.push('음악 선택');

  useEffect(() => {
    let isActive = true;
    let gpsLocationOverlay: KakaoCustomOverlay | undefined;
    const resolveLegalDong = (kakao: KakaoMaps, coordinates: Coordinates) => {
      const { latitude, longitude } = coordinates;
      const coordinateKey = `${latitude}:${longitude}`;
      if (lastRequestedCoordinatesRef.current === coordinateKey) return;
      lastRequestedCoordinatesRef.current = coordinateKey;
      const isDraft = isLocationEditorOpenRef.current;
      const requestId = locationRequestIdRef.current + 1;
      locationRequestIdRef.current = requestId;
      if (isDraft) setDraftLocation(null);
      else setLocation(null);
      setLocationError(null);
      if (!isDraft) onCoordinatesChange(coordinates);
      if (!kakao.maps.services) {
        if (isDraft) setDraftLocation(null);
        else setLocation(null);
        setLocationError('법정동 기능을 초기화하지 못했습니다. 페이지를 새로고침해 주세요.');
        return;
      }
      try {
        new kakao.maps.services.Geocoder().coord2RegionCode(
          longitude,
          latitude,
          (regions, status) => {
            if (!isActive || requestId !== locationRequestIdRef.current) return;
            if (status !== kakao.maps.services.Status.OK) {
              if (isDraft) setDraftLocation(null);
              else setLocation(null);
              setLocationError('법정동 정보를 확인하지 못했습니다. 지도에서 다시 선택해 주세요.');
              return;
            }
            const legalRegion = regions.find((region) => region.region_type === 'B');
            if (!legalRegion) {
              if (isDraft) setDraftLocation(null);
              else setLocation(null);
              setLocationError('법정동 정보를 확인하지 못했습니다. 지도에서 다시 선택해 주세요.');
              return;
            }
            const nextLocation = {
              latitude,
              longitude,
              legalDongCode: legalRegion.code,
              legalDongName: legalRegion.region_3depth_name,
            };
            if (isDraft) setDraftLocation(nextLocation);
            else setLocation(nextLocation);
          },
        );
      } catch {
        if (isActive && requestId === locationRequestIdRef.current) {
          if (isDraft) setDraftLocation(null);
          else setLocation(null);
          setLocationError('법정동 정보를 확인하지 못했습니다. 지도에서 다시 선택해 주세요.');
        }
      }
    };
    currentGpsLocationRef.current = null;

    void getCurrentCoordinates().then(async (locationResult) => {
      if (!isActive) return;
      if (locationResult.kind !== 'ready') {
        setHasCurrentGpsLocation(false);
        setLocationAccessState(locationResult.kind);
        return;
      }

      const { coordinates } = locationResult;
      try {
        const kakao = await loadKakaoMapSdk(env.kakaoMapAppKey);
        if (!isActive || !mapContainerRef.current) return;
        currentGpsLocationRef.current = coordinates;
        setHasCurrentGpsLocation(true);
        kakaoRef.current = kakao;
        resolveLegalDongRef.current = (nextCoordinates) => resolveLegalDong(kakao, nextCoordinates);
        const map = new kakao.maps.Map(mapContainerRef.current, {
          center: new kakao.maps.LatLng(coordinates.latitude, coordinates.longitude),
          level: 4,
        });
        mapRef.current = map;
        const gpsLocationContent = createGpsLocationContent();
        gpsLocationOverlay = new kakao.maps.CustomOverlay({
          map,
          position: new kakao.maps.LatLng(coordinates.latitude, coordinates.longitude),
          content: gpsLocationContent,
          xAnchor: 0.5,
          yAnchor: 0.5,
          clickable: false,
          zIndex: 1,
        });
        gpsLocationOverlayRef.current = gpsLocationOverlay;
        gpsLocationContent.parentElement?.style.setProperty('pointer-events', 'none');
        setIsMapReady(true);
        setLocationAccessState('ready');
        resolveLegalDong(kakao, coordinates);
        kakao.maps.event.addListener(map, 'idle', () => {
          if (!isLocationEditorOpenRef.current) return;
          const center = map.getCenter();
          resolveLegalDong(kakao, { latitude: center.getLat(), longitude: center.getLng() });
        });
      } catch {
        if (isActive) {
          setLocationAccessState('map-error');
          setLocationError('지도를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        }
      }
    });
    return () => {
      isActive = false;
      mapRef.current = null;
      kakaoRef.current = null;
      currentGpsLocationRef.current = null;
      resolveLegalDongRef.current = null;
      lastRequestedCoordinatesRef.current = null;
      gpsRequestIdRef.current += 1;
      gpsLocationOverlayRef.current = null;
      isLocationEditorOpenRef.current = false;
      gpsLocationOverlay?.setMap(null);
    };
  }, [locationRetryKey, onCoordinatesChange]);

  useLayoutEffect(() => {
    if (isMapReady) {
      // CSS 크기 변경이 반영된 프레임에서 지도를 재배치하고 현재 선택 위치를 중심에 둔다.
      if (mapLayoutFrameRef.current !== null) {
        cancelAnimationFrame(mapLayoutFrameRef.current);
      }
      mapLayoutFrameRef.current = requestAnimationFrame(() => {
        const map = mapRef.current;
        const kakao = kakaoRef.current;
        if (!map || !kakao) return;
        map.relayout();
        const center = isLocationEditorOpenRef.current
          ? map.getCenter()
          : location
            ? new kakao.maps.LatLng(location.latitude, location.longitude)
            : currentGpsLocationRef.current
              ? new kakao.maps.LatLng(
                  currentGpsLocationRef.current.latitude,
                  currentGpsLocationRef.current.longitude,
                )
              : map.getCenter();
        map.setCenter(center);
        mapLayoutFrameRef.current = null;
      });
    }
    if (isLocationEditorOpen) closeEditorButtonRef.current?.focus();
    else if (hasOpenedLocationEditorRef.current) adjustButtonRef.current?.focus();
    return () => {
      if (mapLayoutFrameRef.current !== null) {
        cancelAnimationFrame(mapLayoutFrameRef.current);
        mapLayoutFrameRef.current = null;
      }
    };
  }, [isLocationEditorOpen, isMapReady, location]);

  useEffect(() => {
    if (photoPreview?.kind !== 'local') return;
    return () => URL.revokeObjectURL(photoPreview.url);
  }, [photoPreview]);

  function selectPhoto(file: File | undefined) {
    setPhotoError(null);
    if (!file || isSubmitting) return;
    if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
      setPhotoError('JPG, PNG, HEIC, WebP 사진만 선택할 수 있습니다.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setPhotoError('사진은 최대 10MB까지 업로드할 수 있습니다.');
      return;
    }
    photoSelectionIdRef.current += 1;
    recommendationRequestIdRef.current += 1;
    const selectionId = photoSelectionIdRef.current;
    setRecommendations([]);
    setIsRecommendationOpen(false);
    setIsRecommending(false);
    setRecommendationLoadState('ready');
    setRecommendationError(null);
    setUploadId(null);
    setPhoto(file);
    setPhotoPreview(
      file.type === HEIC_IMAGE_TYPE ? null : { kind: 'local', url: URL.createObjectURL(file) },
    );
    void uploadSelectedPhoto(file, selectionId);
  }

  /** GPS 좌표를 지도 중심과 현재 위치 오버레이에 함께 적용한다. */
  function centerMapAtCoordinates(coordinates: Coordinates) {
    const kakao = kakaoRef.current;
    const map = mapRef.current;
    if (!kakao || !map) return;
    const position = new kakao.maps.LatLng(coordinates.latitude, coordinates.longitude);
    map.setCenter(position);
    gpsLocationOverlayRef.current?.setPosition(position);
  }

  /** 브라우저에서 현재 좌표를 새로 받아 지도와 법정동 선택값을 갱신한다. */
  async function refreshCurrentLocation() {
    const requestId = gpsRequestIdRef.current + 1;
    gpsRequestIdRef.current = requestId;
    setIsRefreshingCurrentLocation(true);
    const result = await getCurrentCoordinates();
    if (requestId !== gpsRequestIdRef.current || !mapRef.current) return;
    setIsRefreshingCurrentLocation(false);

    if (result.kind !== 'ready') {
      setLocationError('현재 위치를 다시 확인하지 못했습니다. 기존 위치를 사용합니다.');
      return;
    }

    currentGpsLocationRef.current = result.coordinates;
    setLocationError(null);
    lastRequestedCoordinatesRef.current = null;
    centerMapAtCoordinates(result.coordinates);
    resolveLegalDongRef.current?.(result.coordinates);
  }

  /** 현재 GPS 위치로 지도를 이동하고 열린 화면에 맞는 위치 상태를 갱신한다. */
  function moveToCurrentLocation() {
    const currentGpsLocation = currentGpsLocationRef.current;
    if (!currentGpsLocation || !mapRef.current) return;
    centerMapAtCoordinates(currentGpsLocation);
    // 미리보기에서는 기존처럼 위치를 즉시 반영하고 확대 화면에서는 임시 위치만 갱신한다.
    resolveLegalDongRef.current?.(currentGpsLocation);
  }

  /** 확대 지도를 열고 최신 GPS 조회와 임시 장소 선택을 시작한다. */
  function openLocationEditor() {
    if (!isMapReady) return;
    locationRequestIdRef.current += 1;
    lastRequestedCoordinatesRef.current = null;
    isLocationEditorOpenRef.current = true;
    hasOpenedLocationEditorRef.current = true;
    setDraftLocation(location);
    setLocationError(null);
    setIsLocationEditorOpen(true);
    // 편집을 열 때 캐시 좌표 대신 새 GPS 좌표를 기준으로 지도와 임시 장소를 맞춘다.
    void refreshCurrentLocation();
  }

  /** 확대 지도에서 선택한 위치를 자물쇠 저장값과 날씨 조회 좌표에 반영한다. */
  function confirmLocationEditor() {
    if (!draftLocation) return;
    gpsRequestIdRef.current += 1;
    setIsRefreshingCurrentLocation(false);
    locationRequestIdRef.current += 1;
    isLocationEditorOpenRef.current = false;
    setLocation(draftLocation);
    onCoordinatesChange({ latitude: draftLocation.latitude, longitude: draftLocation.longitude });
    setIsLocationEditorOpen(false);
  }

  /** 임시 이동을 버리고 새 GPS 좌표로 지도와 확정 장소를 되돌린다. */
  function closeLocationEditor() {
    gpsRequestIdRef.current += 1;
    locationRequestIdRef.current += 1;
    isLocationEditorOpenRef.current = false;
    setDraftLocation(null);
    setLocationError(null);
    const currentGpsLocation = currentGpsLocationRef.current;
    if (currentGpsLocation) centerMapAtCoordinates(currentGpsLocation);
    setIsLocationEditorOpen(false);
    // 닫기는 임시 이동을 확정하지 않고 최신 GPS 위치로 최종 선택을 복구한다.
    void refreshCurrentLocation();
  }

  /** 확대 지도 안에 키보드 초점을 유지하고 Escape로 임시 선택을 취소한다. */
  function handleLocationEditorKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!isLocationEditorOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeLocationEditor();
      return;
    }
    if (event.key !== 'Tab') return;
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'),
    );
    const first = buttons[0];
    const last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  function retryLocationAcquisition() {
    setLocationAccessState('loading');
    setLocationError(null);
    setLocation(null);
    setIsMapReady(false);
    setHasCurrentGpsLocation(false);
    currentGpsLocationRef.current = null;
    setLocationRetryKey((key) => key + 1);
  }

  /** 검증을 통과한 최신 사진을 즉시 업로드하고 해당 선택의 uploadId만 반영한다. */
  async function uploadSelectedPhoto(selectedPhoto: File, selectionId: number) {
    setIsUploading(true);
    setPhotoError(null);
    try {
      const nextUploadId = await uploadPhoto(selectedPhoto, fetchAuthenticatedJson);
      if (selectionId !== photoSelectionIdRef.current) return;
      setUploadId(nextUploadId);

      if (selectedPhoto.type === HEIC_IMAGE_TYPE) {
        const signedUrl = await getUploadSignedUrl(nextUploadId, fetchAuthenticatedJson);
        if (selectionId === photoSelectionIdRef.current) {
          setPhotoPreview({ kind: 'signed', url: signedUrl });
        }
      }
    } catch (error) {
      if (selectionId === photoSelectionIdRef.current) {
        setPhotoError(messageForError(error, '사진을 업로드하지 못했습니다.'));
      }
    } finally {
      if (selectionId === photoSelectionIdRef.current) {
        setIsUploading(false);
      }
    }
  }

  async function handleSubmit() {
    if (isSubmitting) return;
    if (!location || !uploadId || !selectedMusic) {
      setSubmitError('위치, 사진 업로드, 음악 선택을 모두 완료해 주세요.');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const recordId = await createRecord(
        { location, music: selectedMusic, moodScore, comment: comment.trim() || null, uploadId },
        fetchAuthenticatedJson,
      );
      onCreated(recordId);
    } catch (error) {
      setSubmitError(
        messageForError(error, '자물쇠를 저장하지 못했습니다. 입력 내용을 확인해 주세요.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  /** 최신 업로드 사진에 대해서만 사용자 요청 시 AI 음악 추천을 조회한다. */
  async function requestPhotoMusicRecommendations() {
    if (!uploadId || isRecommending || isUploading || isSubmitting) return;

    const requestId = recommendationRequestIdRef.current + 1;
    const photoSelectionId = photoSelectionIdRef.current;
    recommendationRequestIdRef.current = requestId;
    setIsRecommendationOpen(true);
    setIsRecommending(true);
    setRecommendationLoadState('loading');
    setRecommendationError(null);
    setRecommendations([]);

    try {
      const nextRecommendations = await getPhotoMusicRecommendations(
        uploadId,
        fetchAuthenticatedJson,
      );
      if (
        requestId !== recommendationRequestIdRef.current ||
        photoSelectionId !== photoSelectionIdRef.current
      ) {
        return;
      }
      setRecommendations(nextRecommendations);
      setRecommendationLoadState('ready');
    } catch (error) {
      if (
        requestId !== recommendationRequestIdRef.current ||
        photoSelectionId !== photoSelectionIdRef.current
      ) {
        return;
      }
      setRecommendationError(messageForError(error, '음악 추천에 실패했어요. 다시 시도해주세요.'));
      setRecommendationLoadState('error');
    } finally {
      if (requestId === recommendationRequestIdRef.current) {
        setIsRecommending(false);
      }
    }
  }

  /** 추천곡을 기존 직접 검색과 같은 선택 음악 상태로 반영한다. */
  function selectRecommendedMusic(recommendation: PhotoMusicRecommendation) {
    setSelectedMusic(recommendation);
    setIsRecommendationOpen(false);
  }

  return (
    <>
      <div className="lock-create-context">
        <article className="surface-card lock-create-card">
          <small>📍 장소</small>
          <strong>
            {location?.legalDongName ??
              (locationAccessState === 'permission-denied'
                ? '위치 권한이 필요해요'
                : locationAccessState === 'loading'
                  ? '현재 위치 확인 중'
                  : '현재 위치 확인 필요')}
          </strong>
          <span>위치 조정 버튼을 눌러 최종 위치를 선택하세요</span>
        </article>
        <article className="surface-card lock-create-card">
          <small>☁️ 날씨</small>
          <strong>{weather}</strong>
          <span>최종 위치 기준 · 저장에는 자동 반영</span>
        </article>
      </div>
      <section className="surface-card lock-create-card" aria-label="최종 위치 선택">
        <small>📍 최종 위치 *</small>
        <div
          className={`lock-create-map-frame${isLocationEditorOpen ? ' is-expanded' : ''}`}
          role={isLocationEditorOpen ? 'dialog' : undefined}
          aria-modal={isLocationEditorOpen ? true : undefined}
          aria-label={isLocationEditorOpen ? '위치 조정' : undefined}
          onKeyDown={handleLocationEditorKeyDown}
        >
          {isLocationEditorOpen ? (
            <header className="lock-create-map-editor-header">
              <button
                ref={closeEditorButtonRef}
                aria-label="닫기"
                type="button"
                onClick={closeLocationEditor}
              >
                ×
              </button>
              <strong>위치 조정</strong>
              <span aria-hidden="true" />
            </header>
          ) : null}
          <div className="lock-create-map-stage">
            <div
              className={`lock-create-map${isLocationEditorOpen && !isRefreshingCurrentLocation ? ' is-editing' : ''}`}
              ref={mapContainerRef}
            />
            {isMapReady ? (
              <>
                <span className="lock-create-map-center-pin" aria-hidden="true">
                  <span />
                </span>
                {isLocationEditorOpen ? (
                  <p className="lock-create-map-instruction" aria-live="polite">
                    {isRefreshingCurrentLocation
                      ? '현재 위치를 확인하고 있어요'
                      : '지도를 움직여 핀을 원하는 장소에 맞추세요'}
                  </p>
                ) : (
                  <button
                    ref={adjustButtonRef}
                    className="lock-create-adjust-location"
                    type="button"
                    onClick={openLocationEditor}
                  >
                    위치 조정
                  </button>
                )}
                {hasCurrentGpsLocation ? (
                  <button
                    aria-label="현재 위치로 이동"
                    className="lock-create-current-location"
                    type="button"
                    disabled={isLocationEditorOpen && isRefreshingCurrentLocation}
                    onClick={moveToCurrentLocation}
                  >
                    <span aria-hidden="true">◎</span>
                  </button>
                ) : null}
              </>
            ) : (
              <div
                className="lock-create-location-notice"
                role={locationAccessState === 'loading' ? 'status' : 'alert'}
              >
                <strong>
                  {locationAccessState === 'loading'
                    ? '현재 위치를 확인하는 중이에요'
                    : locationAccessState === 'permission-denied'
                      ? '위치 권한이 필요해요'
                      : locationAccessState === 'unsupported'
                        ? '위치 기능을 사용할 수 없어요'
                        : '현재 위치를 확인할 수 없어요'}
                </strong>
                <p>
                  {locationAccessState === 'loading'
                    ? '잠시만 기다려주세요.'
                    : locationAccessState === 'permission-denied'
                      ? '서비스를 이용하려면 현재 위치 접근 권한이 필요합니다. 브라우저 설정에서 이 사이트의 위치 권한을 허용한 뒤 다시 확인해주세요.'
                      : locationAccessState === 'unsupported'
                        ? '현재 브라우저에서는 위치 기반 기능을 이용할 수 없습니다.'
                        : locationAccessState === 'map-error'
                          ? locationError
                          : '위치를 다시 요청합니다. 권한 요청 창이 나타나면 브라우저에서 허용해주세요.'}
                </p>
                {locationAccessState !== 'loading' && locationAccessState !== 'unsupported' ? (
                  <button type="button" onClick={retryLocationAcquisition}>
                    {locationAccessState === 'permission-denied'
                      ? '브라우저 설정 후 다시 확인'
                      : locationAccessState === 'map-error'
                        ? '다시 시도'
                        : '위치 권한 허용하기'}
                  </button>
                ) : null}
              </div>
            )}
          </div>
          {isLocationEditorOpen ? (
            <footer className="lock-create-map-editor-footer">
              <small>선택한 장소</small>
              <strong>
                {draftLocation?.legalDongName ??
                  (locationError ? '위치를 선택할 수 없어요' : '위치를 확인하는 중이에요')}
              </strong>
              {locationError && <p className="lock-create-error">{locationError}</p>}
              <button type="button" disabled={!draftLocation} onClick={confirmLocationEditor}>
                이 위치로 설정
              </button>
            </footer>
          ) : null}
        </div>
        {isMapReady && !isLocationEditorOpen && locationError && (
          <p className="lock-create-error">{locationError}</p>
        )}
      </section>
      <section className="surface-card lock-create-card">
        <small>🖼️ 사진 *</small>
        <label className="lock-create-photo">
          {photoPreview ? (
            <img alt="선택한 사진 미리보기" src={photoPreview.url} />
          ) : (
            <>
              <span aria-hidden="true">▧</span>사진 추가하기
            </>
          )}
          <input
            aria-label="사진 업로드"
            accept="image/jpeg,image/png,image/heic,image/webp"
            disabled={isSubmitting}
            ref={photoInputRef}
            type="file"
            onChange={(event) => {
              const selectedPhoto = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              selectPhoto(selectedPhoto);
            }}
          />
        </label>
        {photo && (
          <button
            className="lock-create-upload"
            type="button"
            disabled={isUploading || isSubmitting}
            onClick={() => photoInputRef.current?.click()}
          >
            {isUploading ? '사진 업로드 중…' : '사진 바꾸기'}
          </button>
        )}
        <button
          className="lock-create-ai"
          type="button"
          disabled={!uploadId || isUploading || isSubmitting || isRecommending}
          onClick={() => void requestPhotoMusicRecommendations()}
        >
          {isRecommending ? '음악 추천 중…' : '✨ AI 음악 추천받기'}
        </button>
        {photoError && <p className="lock-create-error">{photoError}</p>}
      </section>
      <section className="surface-card lock-create-card">
        <small>🎧 지금 듣고 있는 음악 *</small>
        {selectedMusic ? (
          <div className="lock-create-selected-music" aria-label="현재 선택한 음악">
            <span className="lock-create-selected-cover">
              <img
                alt={`${selectedMusic.title} - ${selectedMusic.artistName} 앨범 커버`}
                key={selectedMusic.externalTrackId}
                src={selectedMusic.albumImageUrl}
                onError={(event) => {
                  event.currentTarget.hidden = true;
                }}
              />
            </span>
            <span>
              <small>현재 선택한 음악</small>
              <strong>{selectedMusic.title}</strong>
              <span>{selectedMusic.artistName}</span>
            </span>
          </div>
        ) : null}
        <MusicSearchField onSelect={setSelectedMusic} request={fetchAuthenticatedJson} />
      </section>
      <section className="surface-card lock-create-card">
        <small>😌 오늘 기분</small>
        <div className="lock-create-mood">
          <span aria-live="polite">{getMoodEmoji(moodScore)}</span>
          <input
            aria-label="오늘 기분"
            max="50"
            min="-50"
            type="range"
            value={moodScore}
            onChange={(event) => setMoodScore(Number(event.target.value))}
          />
        </div>
      </section>
      <section className="surface-card lock-create-card">
        <small>✏️ 하고 싶은 말</small>
        <textarea
          aria-label="하고 싶은 말"
          aria-describedby="lock-create-comment-count"
          maxLength={80}
          placeholder="이 순간을 1~2문장으로 남겨보세요"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
        <span className="lock-create-count" id="lock-create-comment-count">
          {comment.length} / 80자
        </span>
      </section>
      <div
        className="lock-create-required-hint-slot"
        aria-hidden={missingRequiredItems.length === 0}
      >
        {missingRequiredItems.length > 0 ? (
          <p className="lock-create-required-hint" aria-live="polite">
            저장 전 필수 작성 항목 : {missingRequiredItems.join(', ')}
          </p>
        ) : null}
      </div>
      <button
        className="lock-create-save"
        type="button"
        disabled={isSubmitting || !location || !uploadId || !selectedMusic}
        onClick={() => void handleSubmit()}
      >
        {isSubmitting ? '자물쇠 저장 중…' : '🔒 자물쇠 저장하기'}
      </button>
      {submitError && <p className="lock-create-error">{submitError}</p>}
      <PhotoMusicRecommendationModal
        errorMessage={recommendationError}
        isOpen={isRecommendationOpen}
        loadState={recommendationLoadState}
        onClose={() => setIsRecommendationOpen(false)}
        onDirectSearch={() => setIsRecommendationOpen(false)}
        onRetry={() => void requestPhotoMusicRecommendations()}
        onSelect={selectRecommendedMusic}
        recommendations={recommendations}
      />
    </>
  );
}

function messageForError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
