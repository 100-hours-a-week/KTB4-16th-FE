const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const configuredKakaoMapAppKey = import.meta.env.VITE_KAKAO_MAP_APP_KEY?.trim();

export const env = Object.freeze({
  apiBaseUrl: configuredApiBaseUrl || '/api',
  kakaoMapAppKey: configuredKakaoMapAppKey || '',
});
