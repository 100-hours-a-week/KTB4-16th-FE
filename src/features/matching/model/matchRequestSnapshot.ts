const SNAPSHOT_KEY = 'mulo-match-request-v1';
const SNAPSHOT_VERSION = 1;

export interface MatchRequestSnapshot {
  matchRequestId: number;
}

/** 동일 탭의 새로고침 뒤에도 현재 사용자 매칭 요청만 복원하도록 ID를 저장한다. */
export function saveMatchRequestSnapshot(userId: string, snapshot: MatchRequestSnapshot): boolean {
  try {
    window.sessionStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({ version: SNAPSHOT_VERSION, userId, ...snapshot }),
    );
    return true;
  } catch {
    return false;
  }
}

/** 같은 인증 사용자와 유효한 식별자일 때만 저장된 매칭 요청을 반환한다. */
export function loadMatchRequestSnapshot(userId: string): MatchRequestSnapshot | null {
  try {
    const raw = window.sessionStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      !isRecord(value) ||
      value.version !== SNAPSHOT_VERSION ||
      value.userId !== userId ||
      !isPositiveInteger(value.matchRequestId)
    ) {
      clearMatchRequestSnapshot();
      return null;
    }
    return { matchRequestId: value.matchRequestId };
  } catch {
    clearMatchRequestSnapshot();
    return null;
  }
}

/** 만료·완료·소유권 오류가 난 요청이 다음 세션에 재사용되지 않도록 제거한다. */
export function clearMatchRequestSnapshot(): void {
  try {
    window.sessionStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    // 브라우저 저장소가 차단돼도 현재 페이지의 매칭 흐름은 계속한다.
  }
}

/** JWT sub를 저장소의 사용자 범위 식별자로만 안전하게 읽는다. */
export function readMatchRequestUserId(accessToken: string): string | null {
  const parts = accessToken.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!isRecord(claims) || typeof claims.sub !== 'string' || !/^[1-9]\d*$/.test(claims.sub)) {
      return null;
    }
    return claims.sub;
  } catch {
    return null;
  }
}

/** 외부 저장소 값이 필드 접근 가능한 객체인지 판별한다. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 브라우저에서 정밀도를 보존할 수 있는 양의 API 식별자인지 확인한다. */
function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
