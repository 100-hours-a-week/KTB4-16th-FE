/** JWT sub를 화면 상태 초기화에만 사용하며 인증·인가 판단은 서버에 맡긴다. */
export function readUiUserId(accessToken: string): string | null {
  const parts = accessToken.split('.');
  if (parts.length !== 3 || !parts[1]) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));

    if (typeof claims !== 'object' || claims === null || Array.isArray(claims)) return null;
    const sub = (claims as Record<string, unknown>).sub;
    return typeof sub === 'string' && /^[1-9]\d*$/.test(sub) ? sub : null;
  } catch {
    return null;
  }
}

/** 같은 토큰 또는 파싱 가능한 같은 사용자 sub만 동일 화면 세션으로 취급한다. */
export function isSameUiSession(previousToken: string | null, nextToken: string | null): boolean {
  if (!previousToken || !nextToken) return false;
  if (previousToken === nextToken) return true;

  const previousUserId = readUiUserId(previousToken);
  return previousUserId !== null && previousUserId === readUiUserId(nextToken);
}
