import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearMatchRequestSnapshot,
  loadMatchRequestSnapshot,
  saveMatchRequestSnapshot,
} from './matchRequestSnapshot';

beforeEach(() => window.sessionStorage.clear());

describe('matchRequestSnapshot', () => {
  it('restores only the same user request after a refresh', () => {
    expect(saveMatchRequestSnapshot('35', { matchRequestId: 90 })).toBe(true);
    expect(loadMatchRequestSnapshot('35')).toEqual({ matchRequestId: 90 });
    expect(loadMatchRequestSnapshot('36')).toBeNull();
    expect(window.sessionStorage.getItem('mulo-match-request-v1')).toBeNull();
  });

  it('removes a completed or expired request snapshot', () => {
    saveMatchRequestSnapshot('35', { matchRequestId: 90 });
    clearMatchRequestSnapshot();
    expect(loadMatchRequestSnapshot('35')).toBeNull();
  });
});
