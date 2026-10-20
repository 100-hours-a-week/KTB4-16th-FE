const SNAPSHOT_KEY = 'mulo-matched-chat-room-v1';
const SNAPSHOT_VERSION = 1;

export interface MatchedChatRoomSnapshot {
  chatRoomId: number;
}

/** Keeps only a same-tab hint; the server must confirm MATCHED before the room is rendered. */
export function saveMatchedChatRoomSnapshot(
  userId: string,
  snapshot: MatchedChatRoomSnapshot,
): boolean {
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

/** Reads a room hint only for its owning user and a valid positive room identifier. */
export function loadMatchedChatRoomSnapshot(userId: string): MatchedChatRoomSnapshot | null {
  try {
    const raw = window.sessionStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      !isRecord(value) ||
      value.version !== SNAPSHOT_VERSION ||
      value.userId !== userId ||
      !isPositiveInteger(value.chatRoomId)
    ) {
      clearMatchedChatRoomSnapshot();
      return null;
    }
    return { chatRoomId: value.chatRoomId };
  } catch {
    clearMatchedChatRoomSnapshot();
    return null;
  }
}

/** Clears the room hint, optionally only when it still points to the expected room. */
export function clearMatchedChatRoomSnapshot(expected?: {
  userId?: string;
  chatRoomId?: number;
}): void {
  try {
    if (expected) {
      const raw = window.sessionStorage.getItem(SNAPSHOT_KEY);
      if (!raw) return;
      const value: unknown = JSON.parse(raw);
      if (
        !isRecord(value) ||
        (expected.userId !== undefined && value.userId !== expected.userId) ||
        (expected.chatRoomId !== undefined && value.chatRoomId !== expected.chatRoomId)
      ) {
        return;
      }
    }
    window.sessionStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    // Storage errors do not affect server-confirmed matching state.
  }
}

/** Narrows untrusted session storage values before their fields are read. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validates identifiers that JavaScript can represent without precision loss. */
function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
