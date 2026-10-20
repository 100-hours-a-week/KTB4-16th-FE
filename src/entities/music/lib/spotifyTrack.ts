/** 저장된 Spotify 곡 ID 또는 공식 트랙 링크만 임베드 식별자로 허용한다. */
export function getSpotifyTrackId(
  externalUrl?: string | null,
  externalTrackId?: string | null,
): string | null {
  if (externalTrackId && /^[A-Za-z0-9]{22}$/.test(externalTrackId)) return externalTrackId;
  if (!externalUrl) return null;
  try {
    const url = new URL(externalUrl);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'open.spotify.com' ||
      url.port ||
      url.username ||
      url.password
    )
      return null;
    return /^\/(?:intl-[a-z]+\/)?track\/([A-Za-z0-9]{22})\/?$/.exec(url.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}
