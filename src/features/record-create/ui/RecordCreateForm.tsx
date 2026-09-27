import { useEffect, useRef, useState, type ReactNode } from 'react';

import { useSession } from '../../../entities/session/model/useSession';
import { getMoodEmoji } from '../../../entities/record/model/mood';
import { env } from '../../../shared/config/env';
import { loadKakaoMapSdk, type KakaoMaps, type KakaoMouseEvent } from '../../home-map/lib/kakaoMap';
import { createRecord } from '../api/createRecord';
import { searchMusic } from '../api/searchMusic';
import { uploadPhoto } from '../api/uploadPhoto';
import type { RecordLocation, SelectedMusic } from '../model/recordCreate.types';

const DEFAULT_LOCATION = { latitude: 37.2002, longitude: 127.098 };
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/webp']);
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

type Props = {
  onCoordinatesChange: (coordinates: { latitude: number; longitude: number }) => void;
  onCreated: (recordId: number) => void;
  weather: ReactNode;
};

/** 자물쇠 생성에 필요한 위치·사진·음악 입력과 API 제출 흐름을 소유한다. */
export function RecordCreateForm({ onCoordinatesChange, onCreated, weather }: Props) {
  const { fetchAuthenticatedJson } = useSession();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoSelectionIdRef = useRef(0);
  const isSearchPendingRef = useRef(false);
  const [location, setLocation] = useState<RecordLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState<number | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [query, setQuery] = useState('');
  const [musicResults, setMusicResults] = useState<SelectedMusic[]>([]);
  const [selectedMusic, setSelectedMusic] = useState<SelectedMusic | null>(null);
  const [musicError, setMusicError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearchedMusic, setHasSearchedMusic] = useState(false);
  const [moodScore, setMoodScore] = useState(0);
  const [comment, setComment] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isActive = true;
    const resolveInitialCoordinates = () =>
      new Promise<{ latitude: number; longitude: number }>((resolve) => {
        if (!navigator.geolocation) {
          resolve(DEFAULT_LOCATION);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
          () => resolve(DEFAULT_LOCATION),
          { timeout: 10_000 },
        );
      });
    const resolveLegalDong = (kakao: KakaoMaps, latitude: number, longitude: number) => {
      setLocationError(null);
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
            if (!isActive) return;
            if (status !== kakao.maps.services.Status.OK) {
              setLocation(null);
              setLocationError('법정동 정보를 확인하지 못했습니다. 지도에서 다시 선택해 주세요.');
              return;
            }
            const legalRegion = regions.find((region) => region.region_type === 'B');
            const nextLocation = legalRegion
              ? {
                  latitude,
                  longitude,
                  legalDongCode: legalRegion.code,
                  legalDongName: legalRegion.region_3depth_name,
                }
              : { latitude, longitude, legalDongCode: null, legalDongName: null };
            setLocation(nextLocation);
            onCoordinatesChange({ latitude, longitude });
          },
        );
      } catch {
        setLocation(null);
        setLocationError('법정동 정보를 확인하지 못했습니다. 지도에서 다시 선택해 주세요.');
      }
    };
    void resolveInitialCoordinates().then(async ({ latitude, longitude }) => {
      try {
        const kakao = await loadKakaoMapSdk(env.kakaoMapAppKey);
        if (!isActive || !mapContainerRef.current) return;
        const map = new kakao.maps.Map(mapContainerRef.current, {
          center: new kakao.maps.LatLng(latitude, longitude),
          level: 4,
        });
        resolveLegalDong(kakao, latitude, longitude);
        kakao.maps.event.addListener(map, 'click', (event: KakaoMouseEvent) => {
          const point = event.getLatLng();
          resolveLegalDong(kakao, point.getLat(), point.getLng());
        });
      } catch {
        if (isActive) setLocationError('지도를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
    });
    return () => {
      isActive = false;
    };
  }, [onCoordinatesChange]);

  useEffect(
    () => () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    },
    [photoPreview],
  );

  function selectPhoto(file: File | undefined) {
    setPhotoError(null);
    if (!file || isUploading || isSubmitting) return;
    if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
      setPhotoError('JPG, PNG, HEIC, WebP 사진만 선택할 수 있습니다.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setPhotoError('사진은 최대 10MB까지 업로드할 수 있습니다.');
      return;
    }
    photoSelectionIdRef.current += 1;
    const selectionId = photoSelectionIdRef.current;
    setUploadId(null);
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    void uploadSelectedPhoto(file, selectionId);
  }

  /** 검증을 통과한 최신 사진을 즉시 업로드하고 해당 선택의 uploadId만 반영한다. */
  async function uploadSelectedPhoto(selectedPhoto: File, selectionId: number) {
    setIsUploading(true);
    setPhotoError(null);
    try {
      const nextUploadId = await uploadPhoto(selectedPhoto, fetchAuthenticatedJson);
      if (selectionId === photoSelectionIdRef.current) {
        setUploadId(nextUploadId);
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

  async function handleSearch() {
    if (isSearchPendingRef.current || query.trim().length < 2) return;
    isSearchPendingRef.current = true;
    setMusicError(null);
    setMusicResults([]);
    setSelectedMusic(null);
    setHasSearchedMusic(true);
    setIsSearching(true);
    try {
      setMusicResults(await searchMusic(query, fetchAuthenticatedJson));
    } catch (error) {
      setMusicError(messageForError(error, '음악을 검색하지 못했습니다.'));
    } finally {
      isSearchPendingRef.current = false;
      setIsSearching(false);
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

  return (
    <>
      <div className="lock-create-context">
        <article className="surface-card lock-create-card">
          <small>📍 장소</small>
          <strong>{location?.legalDongName ?? '현재 위치 확인 중'}</strong>
          <span>지도를 눌러 최종 위치를 선택하세요</span>
        </article>
        <article className="surface-card lock-create-card">
          <small>☁️ 날씨</small>
          <strong>{weather}</strong>
          <span>최종 위치 기준 · 저장에는 자동 반영</span>
        </article>
      </div>
      <section className="surface-card lock-create-card">
        <small>📍 최종 위치 *</small>
        <div className="lock-create-map" ref={mapContainerRef} />
        {locationError && <p className="lock-create-error">{locationError}</p>}
      </section>
      <section className="surface-card lock-create-card">
        <small>🖼️ 사진 *</small>
        <label className="lock-create-photo">
          {photoPreview ? (
            <img alt="선택한 사진 미리보기" src={photoPreview} />
          ) : (
            <>
              <span aria-hidden="true">▧</span>사진 추가하기
            </>
          )}
          <input
            accept="image/jpeg,image/png,image/heic,image/webp"
            disabled={isUploading || isSubmitting}
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
        <form
          aria-label="음악 검색"
          className="lock-create-music-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSearch();
          }}
        >
          <label className="lock-create-song">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              maxLength={255}
              placeholder="곡 제목이나 아티스트 검색"
              onChange={(event) => {
                setQuery(event.target.value);
                setHasSearchedMusic(false);
              }}
            />
          </label>
          <button
            className="lock-create-upload"
            type="submit"
            disabled={isSearching || query.trim().length < 2}
          >
            {isSearching ? '검색 중…' : '음악 검색'}
          </button>
        </form>
        {musicError && <p className="lock-create-error">{musicError}</p>}
        {musicResults.length > 0 && (
          <ul className="lock-create-music-results">
            {musicResults.map((music) => (
              <li key={music.externalTrackId}>
                <button
                  type="button"
                  className={
                    selectedMusic?.externalTrackId === music.externalTrackId ? 'selected' : ''
                  }
                  onClick={() => setSelectedMusic(music)}
                >
                  <strong>{music.title}</strong>
                  <span>{music.artistName}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {hasSearchedMusic && !isSearching && !musicError && musicResults.length === 0 ? (
          <span>검색 결과가 없습니다.</span>
        ) : null}
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
          maxLength={80}
          placeholder="이 순간을 1~2문장으로 남겨보세요"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
        <span className="lock-create-count">{comment.length} / 80</span>
      </section>
      <button
        className="lock-create-save"
        type="button"
        disabled={isSubmitting || !location || !uploadId || !selectedMusic}
        onClick={() => void handleSubmit()}
      >
        {isSubmitting ? '자물쇠 저장 중…' : '🔒 자물쇠 저장하기'}
      </button>
      {submitError && <p className="lock-create-error">{submitError}</p>}
    </>
  );
}

function messageForError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
