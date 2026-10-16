import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearMemorySearchSnapshot,
  loadMemorySearchSnapshot,
  saveMemorySearchSnapshot,
} from './memorySearchSnapshot';

beforeEach(() => window.sessionStorage.clear());

describe('memorySearchSnapshot', () => {
  const snapshot = {
    conversationId: 'conversation-1',
    turns: [],
    allResultsTurnIndex: null,
    suggestionsOpen: [],
    pendingQuery: null,
  };

  it('같은 사용자에게 완료된 대화 상태를 복원한다', () => {
    expect(saveMemorySearchSnapshot('35', snapshot)).toBe(true);
    expect(loadMemorySearchSnapshot('35')).toEqual(snapshot);
    expect(loadMemorySearchSnapshot('99')).toBeNull();
  });

  it('진행 중 질문을 복구 판단에 남긴다', () => {
    saveMemorySearchSnapshot('35', { ...snapshot, pendingQuery: '비 오는 날은?' });
    expect(loadMemorySearchSnapshot('35')?.pendingQuery).toBe('비 오는 날은?');
  });

  it('손상된 값과 명시적으로 지운 값을 복원하지 않는다', () => {
    window.sessionStorage.setItem('mulo-memory-search-v1', '{bad json');
    expect(loadMemorySearchSnapshot('35')).toBeNull();
    saveMemorySearchSnapshot('35', snapshot);
    clearMemorySearchSnapshot();
    expect(loadMemorySearchSnapshot('35')).toBeNull();
  });
});
