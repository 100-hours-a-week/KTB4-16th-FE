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

export type KakaoMouseEvent = {
  getLatLng: () => KakaoLatLng;
};

export type KakaoRegion = {
  region_type: string;
  code: string;
  region_3depth_name: string;
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
    services: {
      Geocoder: new () => {
        coord2RegionCode: (
          longitude: number,
          latitude: number,
          callback: (regions: KakaoRegion[], status: string) => void,
        ) => void;
      };
      Status: { OK: string };
    };
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
        (target: KakaoMap, eventName: 'click', handler: (event: KakaoMouseEvent) => void): void;
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
        (target: KakaoMap, eventName: 'click', handler: (event: KakaoMouseEvent) => void): void;
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

const KAKAO_SDK_SCRIPT_ID = 'kakao-map-sdk';

/** 지도 생성과 홈·자물쇠 생성 화면에서 공통으로 쓰는 부가 라이브러리의 준비 상태를 확인한다. */
function hasRequiredLibraries(kakao: KakaoMaps): boolean {
  return (
    typeof kakao.maps.MarkerClusterer === 'function' &&
    typeof kakao.maps.services?.Geocoder === 'function'
  );
}

/** kakao.maps.load 완료 뒤 지도와 공통 부가 라이브러리가 모두 준비된 SDK만 반환한다. */
function waitForKakaoMapsLoad(): Promise<KakaoMaps> {
  return new Promise((resolve, reject) => {
    const kakao = window.kakao;

    if (!kakao) {
      reject(new Error('카카오 지도 SDK를 초기화하지 못했습니다.'));
      return;
    }

    if (hasRequiredLibraries(kakao)) {
      resolve(kakao);
      return;
    }

    try {
      kakao.maps.load(() => {
        const loadedKakao = window.kakao;

        if (!loadedKakao || !hasRequiredLibraries(loadedKakao)) {
          reject(new Error('카카오 지도 필수 라이브러리를 초기화하지 못했습니다.'));
          return;
        }

        resolve(loadedKakao);
      });
    } catch {
      reject(new Error('카카오 지도 SDK를 초기화하지 못했습니다.'));
    }
  });
}

/** 이미 DOM에 삽입된 SDK script의 완료 이벤트를 재사용하고 중복 script를 만들지 않는다. */
function waitForKakaoSdkScript(script: HTMLScriptElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.kakao) {
      resolve();
      return;
    }

    const readyState = (script as HTMLScriptElement & { readyState?: string }).readyState;
    if (readyState === 'complete') {
      reject(new Error('카카오 지도 SDK를 초기화하지 못했습니다.'));
      return;
    }

    const cleanup = () => {
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };
    const handleLoad = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error('카카오 지도 SDK를 불러오지 못했습니다.'));
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
  });
}

/** 카카오 지도 SDK를 한 번만 불러오고, 지도 생성 가능한 객체를 반환한다. */
export function loadKakaoMapSdk(appKey: string): Promise<KakaoMaps> {
  if (!appKey) {
    return Promise.reject(new Error('카카오 지도 JavaScript 앱 키가 설정되지 않았습니다.'));
  }

  if (sdkPromise) {
    return sdkPromise;
  }

  if (window.kakao) {
    sdkPromise = waitForKakaoMapsLoad().catch((error: unknown) => {
      sdkPromise = undefined;
      throw error;
    });
    return sdkPromise;
  }

  sdkPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(KAKAO_SDK_SCRIPT_ID);
    const script = existingScript instanceof HTMLScriptElement ? existingScript : null;

    if (script) {
      waitForKakaoSdkScript(script).then(
        () => {
          if (!window.kakao) {
            sdkPromise = undefined;
            reject(new Error('카카오 지도 SDK를 초기화하지 못했습니다.'));
            return;
          }
          waitForKakaoMapsLoad().then(resolve, (error: unknown) => {
            sdkPromise = undefined;
            reject(error);
          });
        },
        (error: unknown) => {
          sdkPromise = undefined;
          reject(error);
        },
      );
      return;
    }

    const newScript = document.createElement('script');
    const sdkUrl = new URL('https://dapi.kakao.com/v2/maps/sdk.js');

    sdkUrl.searchParams.set('appkey', appKey);
    sdkUrl.searchParams.set('autoload', 'false');

    // Kakao SDK는 libraries 값을 URL decode하지 않고 comma로 분리한다.
    const sdkSrc = `${sdkUrl.toString()}&libraries=clusterer,services`;

    newScript.id = KAKAO_SDK_SCRIPT_ID;
    newScript.async = true;
    newScript.src = sdkSrc;
    newScript.onload = () => {
      if (!window.kakao) {
        sdkPromise = undefined;
        reject(new Error('카카오 지도 SDK를 초기화하지 못했습니다.'));
        return;
      }

      waitForKakaoMapsLoad().then(resolve, (error: unknown) => {
        sdkPromise = undefined;
        reject(error);
      });
    };
    newScript.onerror = () => {
      sdkPromise = undefined;
      reject(new Error('카카오 지도 SDK를 불러오지 못했습니다.'));
    };

    document.head.append(newScript);
  });

  return sdkPromise;
}
