import { afterEach, describe, expect, it, vi } from 'vitest';

import type { KakaoMaps } from './kakaoMap';

function createKakaoMaps(overrides: Partial<KakaoMaps['maps']> = {}): KakaoMaps {
  return {
    maps: {
      load: vi.fn((callback: () => void) => callback()),
      MarkerClusterer: vi.fn(),
      services: { Geocoder: vi.fn(), Status: { OK: 'OK' } },
      ...overrides,
    },
  } as KakaoMaps;
}

afterEach(() => {
  document.getElementById('kakao-map-sdk')?.remove();
  delete window.kakao;
  vi.resetModules();
});

describe('loadKakaoMapSdk', () => {
  it('reuses the global SDK when its required libraries are already ready', async () => {
    const kakao = createKakaoMaps();
    window.kakao = kakao;
    const { loadKakaoMapSdk } = await import('./kakaoMap');

    await expect(loadKakaoMapSdk('public-app-key')).resolves.toBe(kakao);

    expect(kakao.maps.load).not.toHaveBeenCalled();
  });

  it('waits for maps.load when the global SDK still needs its libraries', async () => {
    const kakao = createKakaoMaps({
      services: undefined as unknown as KakaoMaps['maps']['services'],
    });
    kakao.maps.load = vi.fn((callback: () => void) => {
      kakao.maps.services = { Geocoder: vi.fn(), Status: { OK: 'OK' } };
      callback();
    });
    window.kakao = kakao;
    const { loadKakaoMapSdk } = await import('./kakaoMap');

    await expect(loadKakaoMapSdk('public-app-key')).resolves.toBe(kakao);

    expect(kakao.maps.load).toHaveBeenCalledOnce();
  });

  it('does not resolve an SDK that is missing a required shared library', async () => {
    const kakao = createKakaoMaps({
      services: undefined as unknown as KakaoMaps['maps']['services'],
    });
    window.kakao = kakao;
    const { loadKakaoMapSdk } = await import('./kakaoMap');

    await expect(loadKakaoMapSdk('public-app-key')).rejects.toThrow(
      '카카오 지도 필수 라이브러리를 초기화하지 못했습니다.',
    );
  });

  it('requests both clusterer and services libraries for a newly inserted SDK script', async () => {
    const { loadKakaoMapSdk } = await import('./kakaoMap');
    const promise = loadKakaoMapSdk('public-app-key');
    const script = document.getElementById('kakao-map-sdk') as HTMLScriptElement;
    const scriptUrl = new URL(script.src);

    expect(scriptUrl.searchParams.get('libraries')).toBe('clusterer,services');
    expect(script.src).toContain('libraries=clusterer,services');
    expect(script.src).not.toContain('libraries=clusterer%2Cservices');
    window.kakao = createKakaoMaps();
    script.dispatchEvent(new Event('load'));

    await expect(promise).resolves.toBe(window.kakao);
  });

  it('waits for an existing loading SDK script instead of creating a duplicate', async () => {
    const script = document.createElement('script');
    script.id = 'kakao-map-sdk';
    document.head.append(script);

    const { loadKakaoMapSdk } = await import('./kakaoMap');
    const promise = loadKakaoMapSdk('public-app-key');

    expect(document.querySelectorAll('#kakao-map-sdk')).toHaveLength(1);

    window.kakao = createKakaoMaps();
    script.dispatchEvent(new Event('load'));

    await expect(promise).resolves.toBe(window.kakao);
  });

  it('resolves only after an asynchronously loaded SDK runs maps.load', async () => {
    const { loadKakaoMapSdk } = await import('./kakaoMap');
    const promise = loadKakaoMapSdk('public-app-key');
    const script = document.getElementById('kakao-map-sdk') as HTMLScriptElement;
    const kakao = createKakaoMaps({
      services: undefined as unknown as KakaoMaps['maps']['services'],
      load: vi.fn((callback: () => void) => {
        window.setTimeout(() => {
          kakao.maps.services = { Geocoder: vi.fn(), Status: { OK: 'OK' } };
          callback();
        }, 0);
      }),
    });

    window.kakao = kakao;
    script.dispatchEvent(new Event('load'));

    await expect(promise).resolves.toBe(kakao);
    expect(kakao.maps.load).toHaveBeenCalledOnce();
  });
});
