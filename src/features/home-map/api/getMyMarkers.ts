import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';

import type { MapBounds } from './getPopularMarkers';

export type MyMarker = {
  placeId: number;
  legalDongName: string | null;
  myRecordsCount: number;
  latitude: number;
  longitude: number;
};

type MyMarkersResponse = {
  message: string;
  data: MyMarker[];
};

/** 현재 사용자가 viewport 안에 남긴 자물쇠 Place 마커를 인증 요청으로 조회한다. */
export async function getMyMarkers(
  bounds: MapBounds,
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
  signal: AbortSignal,
): Promise<MyMarker[]> {
  const response = await fetchAuthenticatedJson<unknown>(createMyMarkersPath(bounds), { signal });

  return parseMyMarkersResponse(response).data;
}

/** 지도 bounds를 공통 인증 클라이언트가 사용할 내 자물쇠 마커 경로로 변환한다. */
function createMyMarkersPath(bounds: MapBounds): string {
  const query = new URLSearchParams({
    swLat: String(bounds.swLat),
    swLng: String(bounds.swLng),
    neLat: String(bounds.neLat),
    neLng: String(bounds.neLng),
  });

  return `/users/me/places?${query.toString()}`;
}

/** 신뢰할 수 없는 HTTP 응답을 내 자물쇠 마커 목록 계약으로 검증한다. */
function parseMyMarkersResponse(value: unknown): MyMarkersResponse {
  if (!isRecord(value) || typeof value.message !== 'string' || !Array.isArray(value.data)) {
    throw new Error('내 자물쇠 마커 응답 형식이 올바르지 않습니다.');
  }

  return {
    message: value.message,
    data: value.data.map((marker) => parseMyMarker(marker)),
  };
}

/** Place 단위 내 자물쇠 마커의 필수 좌표와 집계 필드를 검증한다. */
function parseMyMarker(value: unknown): MyMarker {
  if (
    !isRecord(value) ||
    !isFiniteNumber(value.placeId) ||
    !isNullableString(value.legalDongName) ||
    !isFiniteNumber(value.myRecordsCount) ||
    !isFiniteNumber(value.latitude) ||
    !isFiniteNumber(value.longitude)
  ) {
    throw new Error('내 자물쇠 마커 항목 형식이 올바르지 않습니다.');
  }

  return {
    placeId: value.placeId,
    legalDongName: value.legalDongName,
    myRecordsCount: value.myRecordsCount,
    latitude: value.latitude,
    longitude: value.longitude,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null;
}
