import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearMatchedChatRoomSnapshot,
  loadMatchedChatRoomSnapshot,
  saveMatchedChatRoomSnapshot,
} from './matchedChatRoomSnapshot';

const key = 'mulo-matched-chat-room-v1';

beforeEach(() => window.sessionStorage.clear());

describe('matchedChatRoomSnapshot', () => {
  it('scopes the room hint to its owning user', () => {
    expect(saveMatchedChatRoomSnapshot('35', { chatRoomId: 41 })).toBe(true);
    expect(loadMatchedChatRoomSnapshot('35')).toEqual({ chatRoomId: 41 });
    expect(loadMatchedChatRoomSnapshot('36')).toBeNull();
    expect(window.sessionStorage.getItem(key)).toBeNull();
  });

  it('does not let a stale room invalidation remove a newer snapshot', () => {
    saveMatchedChatRoomSnapshot('35', { chatRoomId: 42 });

    clearMatchedChatRoomSnapshot({ userId: '35', chatRoomId: 41 });

    expect(loadMatchedChatRoomSnapshot('35')).toEqual({ chatRoomId: 42 });
  });
});
