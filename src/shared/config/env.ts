const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const env = Object.freeze({
  apiBaseUrl: configuredApiBaseUrl || '/api',
});
