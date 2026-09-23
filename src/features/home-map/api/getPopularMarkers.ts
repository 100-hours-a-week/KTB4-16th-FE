import { env } from '../../../shared/config/env';

export type MapBounds = {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
};

export type PopularMarker = {
  placeId: number;
  recordsCount: number;
  legalDongCode: string | null;
  legalDongName: string | null;
  latitude: number;
  longitude: number;
};

type PopularMarkersResponse = {
  message: string;
  data: PopularMarker[];
};

/** 현재 지도 범위 안의 최근 7일 인기 자물쇠 Place 마커를 조회한다. */
export async function getPopularMarkers(
  bounds: MapBounds,
  signal: AbortSignal,
): Promise<PopularMarker[]> {
  const requestUrl = createPopularMarkersUrl(bounds);
  const response = await fetch(requestUrl, { signal });

  if (!response.ok) {
    throw new Error('인기 자물쇠 마커를 조회하지 못했습니다.');
  }

  return parsePopularMarkersResponse(await response.json()).data;
}

/** API base URL과 지도 bounds를 인기 마커 조회 URL로 변환한다. */
function createPopularMarkersUrl(bounds: MapBounds): URL {
  const apiBaseUrl = env.apiBaseUrl.endsWith('/') ? env.apiBaseUrl.slice(0, -1) : env.apiBaseUrl;
  const requestUrl = new URL(`${apiBaseUrl}/places/popular`, window.location.origin);

  requestUrl.search = new URLSearchParams({
    swLat: String(bounds.swLat),
    swLng: String(bounds.swLng),
    neLat: String(bounds.neLat),
    neLng: String(bounds.neLng),
  }).toString();

  return requestUrl;
}

/** 신뢰할 수 없는 HTTP 응답을 인기 마커 목록 계약으로 검증한다. */
function parsePopularMarkersResponse(value: unknown): PopularMarkersResponse {
  if (!isRecord(value) || typeof value.message !== 'string' || !Array.isArray(value.data)) {
    throw new Error('인기 자물쇠 마커 응답 형식이 올바르지 않습니다.');
  }

  return {
    message: value.message,
    data: value.data.map((marker) => parsePopularMarker(marker)),
  };
}

/** Place 단위 인기 마커의 필수 좌표와 집계 필드를 검증한다. */
function parsePopularMarker(value: unknown): PopularMarker {
  if (
    !isRecord(value) ||
    !isFiniteNumber(value.placeId) ||
    !isFiniteNumber(value.recordsCount) ||
    !isNullableString(value.legalDongCode) ||
    !isNullableString(value.legalDongName) ||
    !isFiniteNumber(value.latitude) ||
    !isFiniteNumber(value.longitude)
  ) {
    throw new Error('인기 자물쇠 마커 항목 형식이 올바르지 않습니다.');
  }

  return {
    placeId: value.placeId,
    recordsCount: value.recordsCount,
    legalDongCode: value.legalDongCode,
    legalDongName: value.legalDongName,
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
