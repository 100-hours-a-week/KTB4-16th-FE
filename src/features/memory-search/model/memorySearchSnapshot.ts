import { parseMemorySearchResult } from '../api/memorySearchQueryApi';
import type { MemorySearchTurn } from './memorySearch.types';

const SNAPSHOT_KEY = 'mulo-memory-search-v1';
const SNAPSHOT_VERSION = 1;

export interface MemorySearchSnapshot {
  conversationId: string;
  turns: MemorySearchTurn[];
  allResultsTurnIndex: number | null;
  suggestionsOpen: boolean[];
  pendingQuery: string | null;
}

/** 완료된 화면 상태만 동일 탭의 저장소에 기록하고 저장 실패를 반환한다. */
export function saveMemorySearchSnapshot(userId: string, snapshot: MemorySearchSnapshot): boolean {
  try {
    window.sessionStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({
        version: SNAPSHOT_VERSION,
        userId,
        ...snapshot,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

/** 인증된 같은 사용자에게만 구조가 유효한 스냅샷을 복원한다. */
export function loadMemorySearchSnapshot(userId: string): MemorySearchSnapshot | null {
  try {
    const raw = window.sessionStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      !isObject(value) ||
      value.version !== SNAPSHOT_VERSION ||
      value.userId !== userId ||
      typeof value.conversationId !== 'string' ||
      value.conversationId.length === 0 ||
      !Array.isArray(value.turns) ||
      !Array.isArray(value.suggestionsOpen) ||
      !(value.pendingQuery === null || typeof value.pendingQuery === 'string')
    ) {
      clearMemorySearchSnapshot();
      return null;
    }
    const turns = value.turns.map(parseTurn);
    const suggestionsOpen = value.suggestionsOpen;
    if (
      suggestionsOpen.length !== turns.length ||
      !suggestionsOpen.every((open) => typeof open === 'boolean') ||
      !(
        value.allResultsTurnIndex === null ||
        (typeof value.allResultsTurnIndex === 'number' &&
          Number.isInteger(value.allResultsTurnIndex) &&
          value.allResultsTurnIndex >= 0 &&
          value.allResultsTurnIndex < turns.length)
      )
    ) {
      clearMemorySearchSnapshot();
      return null;
    }
    return {
      conversationId: value.conversationId,
      turns,
      allResultsTurnIndex: value.allResultsTurnIndex,
      suggestionsOpen,
      pendingQuery: value.pendingQuery,
    };
  } catch {
    clearMemorySearchSnapshot();
    return null;
  }
}

/** 대화 종료·계정 변경·만료 시 브라우저 스냅샷을 지운다. */
export function clearMemorySearchSnapshot(): void {
  try {
    window.sessionStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    // 저장소가 차단돼도 메모리 대화 종료는 계속한다.
  }
}

/** 저장된 턴의 질문과 공개 결과를 다시 검증한다. */
function parseTurn(value: unknown): MemorySearchTurn {
  if (!isObject(value) || typeof value.query !== 'string') throw new Error('손상된 대화 턴');
  return { query: value.query, ...parseMemorySearchResult(value) };
}

/** 외부 값이 필드 접근 가능한 객체인지 판별한다. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
