const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const configuredKakaoMapAppKey = import.meta.env.VITE_KAKAO_MAP_APP_KEY?.trim();
const configuredSentryDsn = import.meta.env.VITE_SENTRY_DSN?.trim();

export const env = Object.freeze({
  apiBaseUrl: configuredApiBaseUrl || '/api',
  kakaoMapAppKey: configuredKakaoMapAppKey || '',
  sentryDsn: configuredSentryDsn || '',
});
