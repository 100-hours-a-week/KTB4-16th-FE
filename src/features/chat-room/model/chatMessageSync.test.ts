import { describe, it, expect } from 'vitest';
import { recoverChatMessages } from './chatMessageSync';
describe('fixed DB sync window', () => {
  it('recovers 45 records across 3 pages without moving the upper bound for live frames', async () => {
    const calls: [number, number | undefined][] = [];
    const ids: number[] = [];
    const upper = await recoverChatMessages({
      afterMessageId: 10,
      signal: new AbortController().signal,
      fetchPage: async (after, through) => {
        calls.push([after, through]);
        const end = Math.min(after + 20, 55);
        return {
          messages: Array.from({ length: end - after }, (_, i) => ({
            chatMessageId: after + i + 1,
            clientMessageId: 'uuid',
            userId: 1,
            nickname: 'one',
            content: 'message',
            createdAt: '2026-11-05T00:00:00+09:00',
          })),
          throughMessageId: 55,
          nextAfterMessageId: end,
          hasNext: end < 55,
        };
      },
      applyPage: (page) => ids.push(...page.map((m) => m.chatMessageId)),
    });
    expect(calls).toEqual([
      [10, undefined],
      [30, 55],
      [50, 55],
    ]);
    expect(ids).toHaveLength(45);
    expect(new Set(ids).size).toBe(45);
    expect(upper).toBe(55);
  });
  it('rejects a stuck cursor instead of claiming recovery', async () => {
    await expect(
      recoverChatMessages({
        afterMessageId: 10,
        signal: new AbortController().signal,
        applyPage: () => {},
        fetchPage: async () => ({
          messages: [],
          throughMessageId: 55,
          nextAfterMessageId: 10,
          hasNext: true,
        }),
      }),
    ).rejects.toThrow();
  });
  it('does not apply an aborted room response', async () => {
    const controller = new AbortController();
    let applied = false;
    await expect(
      recoverChatMessages({
        afterMessageId: 0,
        signal: controller.signal,
        applyPage: () => {
          applied = true;
        },
        fetchPage: async () => {
          controller.abort();
          return { messages: [], throughMessageId: 0, nextAfterMessageId: 0, hasNext: false };
        },
      }),
    ).rejects.toThrow();
    expect(applied).toBe(false);
  });
});
