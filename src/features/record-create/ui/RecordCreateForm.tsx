import { useEffect, useRef, useState, type ReactNode } from 'react';

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

const DEFAULT_LOCATION = { latitude: 37.2002, longitude: 127.098 };
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
  const mapRef = useRef<KakaoMap | null>(null);
  const kakaoRef = useRef<KakaoMaps | null>(null);
  const currentGpsLocationRef = useRef<Coordinates | null>(null);
  const locationRequestIdRef = useRef(0);
  const lastRequestedCoordinatesRef = useRef<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoSelectionIdRef = useRef(0);
  const recommendationRequestIdRef = useRef(0);
  const [location, setLocation] = useState<RecordLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
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
    const resolveInitialCoordinates = () =>
      new Promise<{ coordinates: Coordinates; isGps: boolean }>((resolve) => {
        if (!navigator.geolocation) {
          resolve({ coordinates: DEFAULT_LOCATION, isGps: false });
          return;
        }
        navigator.geolocation.getCurrentPosition(
          ({ coords }) =>
            resolve({
              coordinates: { latitude: coords.latitude, longitude: coords.longitude },
              isGps: true,
            }),
          () => resolve({ coordinates: DEFAULT_LOCATION, isGps: false }),
          { timeout: 10_000 },
        );
      });
    const resolveLegalDong = (kakao: KakaoMaps, coordinates: Coordinates) => {
      const { latitude, longitude } = coordinates;
      const coordinateKey = `${latitude}:${longitude}`;
      if (lastRequestedCoordinatesRef.current === coordinateKey) return;
      lastRequestedCoordinatesRef.current = coordinateKey;
      const requestId = locationRequestIdRef.current + 1;
      locationRequestIdRef.current = requestId;
      setLocation(null);
      setLocationError(null);
      onCoordinatesChange(coordinates);
      if (!kakao.maps.services) {
        setLocation(null);
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
              setLocation(null);
              setLocationError('법정동 정보를 확인하지 못했습니다. 지도에서 다시 선택해 주세요.');
              return;
            }
            const legalRegion = regions.find((region) => region.region_type === 'B');
            if (!legalRegion) {
              setLocation(null);
              setLocationError('법정동 정보를 확인하지 못했습니다. 지도에서 다시 선택해 주세요.');
              return;
            }
            const nextLocation = {
              latitude,
              longitude,
              legalDongCode: legalRegion.code,
              legalDongName: legalRegion.region_3depth_name,
            };
            setLocation(nextLocation);
          },
        );
      } catch {
        if (isActive && requestId === locationRequestIdRef.current) {
          setLocation(null);
          setLocationError('법정동 정보를 확인하지 못했습니다. 지도에서 다시 선택해 주세요.');
        }
      }
    };
    void resolveInitialCoordinates().then(async ({ coordinates, isGps }) => {
      try {
        const kakao = await loadKakaoMapSdk(env.kakaoMapAppKey);
        if (!isActive || !mapContainerRef.current) return;
        currentGpsLocationRef.current = isGps ? coordinates : null;
        setHasCurrentGpsLocation(isGps);
        kakaoRef.current = kakao;
        const map = new kakao.maps.Map(mapContainerRef.current, {
          center: new kakao.maps.LatLng(coordinates.latitude, coordinates.longitude),
          level: 4,
        });
        mapRef.current = map;
        if (isGps) {
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
          gpsLocationContent.parentElement?.style.setProperty('pointer-events', 'none');
        }
        resolveLegalDong(kakao, coordinates);
        kakao.maps.event.addListener(map, 'idle', () => {
          const center = map.getCenter();
          resolveLegalDong(kakao, { latitude: center.getLat(), longitude: center.getLng() });
        });
      } catch {
        if (isActive) setLocationError('지도를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
    });
    return () => {
      isActive = false;
      mapRef.current = null;
      kakaoRef.current = null;
      currentGpsLocationRef.current = null;
      lastRequestedCoordinatesRef.current = null;
      gpsLocationOverlay?.setMap(null);
    };
  }, [onCoordinatesChange]);

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

  function moveToCurrentLocation() {
    const currentGpsLocation = currentGpsLocationRef.current;
    const kakao = kakaoRef.current;
    if (!currentGpsLocation || !mapRef.current || !kakao) return;
    mapRef.current.setCenter(
      new kakao.maps.LatLng(currentGpsLocation.latitude, currentGpsLocation.longitude),
    );
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
          <strong>{location?.legalDongName ?? '현재 위치 확인 중'}</strong>
          <span>지도를 움직여 최종 위치를 조정하세요</span>
        </article>
        <article className="surface-card lock-create-card">
          <small>☁️ 날씨</small>
          <strong>{weather}</strong>
          <span>최종 위치 기준 · 저장에는 자동 반영</span>
        </article>
      </div>
      <section className="surface-card lock-create-card" aria-label="최종 위치 선택">
        <small>📍 최종 위치 *</small>
        <div className="lock-create-map-frame">
          <div className="lock-create-map" ref={mapContainerRef} />
          <span className="lock-create-map-center-pin" aria-hidden="true">
            <span />
          </span>
          {hasCurrentGpsLocation && (
            <button
              aria-label="현재 위치로 이동"
              className="lock-create-current-location"
              type="button"
              onClick={moveToCurrentLocation}
            >
              ◎
            </button>
          )}
        </div>
        {locationError && <p className="lock-create-error">{locationError}</p>}
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
