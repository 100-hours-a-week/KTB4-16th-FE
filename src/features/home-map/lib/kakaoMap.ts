type KakaoMapOptions = {
  center: KakaoLatLng;
  level: number;
};

type KakaoMarkerOptions = {
  position: KakaoLatLng;
  map?: KakaoMap;
  image?: KakaoMarkerImage;
  clickable?: boolean;
};

type KakaoMarkerClustererOptions = {
  map: KakaoMap;
  averageCenter?: boolean;
  minLevel?: number;
  disableClickZoom?: boolean;
  styles?: KakaoMarkerClustererStyle[];
};

type KakaoMarkerImageOptions = {
  offset?: KakaoPoint;
};

type KakaoMarkerClustererStyle = {
  width: string;
  height: string;
  background: string;
  borderRadius: string;
  border: string;
  boxShadow: string;
  color: string;
  textAlign: string;
  lineHeight: string;
  fontSize: string;
  fontWeight: string;
};

export type KakaoLatLng = {
  getLat: () => number;
  getLng: () => number;
};

type KakaoPoint = object;
type KakaoSize = object;
type KakaoMarkerImage = object;

export type KakaoLatLngBounds = {
  getSouthWest: () => KakaoLatLng;
  getNorthEast: () => KakaoLatLng;
};

export type KakaoMap = {
  getBounds: () => KakaoLatLngBounds;
};

export type KakaoMarker = {
  setMap: (map: KakaoMap | null) => void;
  setImage: (image: KakaoMarkerImage) => void;
};

export type KakaoCluster = {
  getMarkers: () => KakaoMarker[];
  getCenter: () => KakaoLatLng;
  getClusterMarker: () => KakaoCustomOverlay;
};

export type KakaoCustomOverlay = {
  setMap: (map: KakaoMap | null) => void;
  setZIndex: (zIndex: number) => void;
};

export type KakaoMarkerClusterer = {
  addMarkers: (markers: KakaoMarker[], nodraw?: boolean) => void;
  clear: () => void;
};

export type KakaoMaps = {
  maps: {
    load: (callback: () => void) => void;
    LatLng: new (latitude: number, longitude: number) => KakaoLatLng;
    Point: new (x: number, y: number) => KakaoPoint;
    Size: new (width: number, height: number) => KakaoSize;
    MarkerImage: new (
      source: string,
      size: KakaoSize,
      options?: KakaoMarkerImageOptions,
    ) => KakaoMarkerImage;
    Map: new (container: HTMLElement, options: KakaoMapOptions) => KakaoMap;
    Marker: new (options: KakaoMarkerOptions) => KakaoMarker;
    CustomOverlay: new (options: {
      map?: KakaoMap;
      position: KakaoLatLng;
      content: string;
      xAnchor?: number;
      yAnchor?: number;
      zIndex?: number;
    }) => KakaoCustomOverlay;
    MarkerClusterer: new (options: KakaoMarkerClustererOptions) => KakaoMarkerClusterer;
    event: {
      addListener: {
        (target: KakaoMap, eventName: 'idle', handler: () => void): void;
        (target: KakaoMap, eventName: 'click', handler: () => void): void;
        (target: KakaoMarker, eventName: 'click', handler: () => void): void;
        (
          target: KakaoMarkerClusterer,
          eventName: 'clusterclick',
          handler: (cluster: KakaoCluster) => void,
        ): void;
      };
      removeListener: {
        (target: KakaoMap, eventName: 'idle', handler: () => void): void;
        (target: KakaoMap, eventName: 'click', handler: () => void): void;
        (target: KakaoMarker, eventName: 'click', handler: () => void): void;
        (
          target: KakaoMarkerClusterer,
          eventName: 'clusterclick',
          handler: (cluster: KakaoCluster) => void,
        ): void;
      };
    };
  };
};

declare global {
  interface Window {
    kakao?: KakaoMaps;
  }
}

let sdkPromise: Promise<KakaoMaps> | undefined;

/** 카카오 지도 SDK를 한 번만 불러오고, 지도 생성 가능한 객체를 반환한다. */
export function loadKakaoMapSdk(appKey: string): Promise<KakaoMaps> {
  if (!appKey) {
    return Promise.reject(new Error('카카오 지도 JavaScript 앱 키가 설정되지 않았습니다.'));
  }

  if (window.kakao) {
    return Promise.resolve(window.kakao);
  }

  if (sdkPromise) {
    return sdkPromise;
  }

  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const sdkUrl = new URL('https://dapi.kakao.com/v2/maps/sdk.js');

    sdkUrl.searchParams.set('appkey', appKey);
    sdkUrl.searchParams.set('autoload', 'false');
    sdkUrl.searchParams.set('libraries', 'clusterer');

    script.id = 'kakao-map-sdk';
    script.async = true;
    script.src = sdkUrl.toString();
    script.onload = () => {
      if (!window.kakao) {
        sdkPromise = undefined;
        reject(new Error('카카오 지도 SDK를 초기화하지 못했습니다.'));
        return;
      }

      window.kakao.maps.load(() => resolve(window.kakao as KakaoMaps));
    };
    script.onerror = () => {
      sdkPromise = undefined;
      reject(new Error('카카오 지도 SDK를 불러오지 못했습니다.'));
    };

    document.head.append(script);
  });

  return sdkPromise;
}
