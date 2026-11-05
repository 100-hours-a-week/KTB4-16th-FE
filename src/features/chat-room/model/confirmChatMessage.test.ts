import { afterEach, expect, it, vi } from 'vitest';
import { confirmChatMessage } from './confirmChatMessage';
afterEach(() => vi.useRealTimers());
it('DB confirmation cancels the late ACK timeout and resolves once', async () => {
  vi.useFakeTimers();
  let failed = false;
  let resolved = 0;
  const timeoutId = setTimeout(() => {
    failed = true;
  }, 20000);
  const pending = new Map([
    [
      'request',
      {
        content: 'hello',
        timeoutId,
        resolve: () => {
          resolved++;
        },
      },
    ],
  ]);
  const retries = new Map([['hello', 'request']]);
  confirmChatMessage(17, 17, 'request', pending, retries);
  confirmChatMessage(17, 17, 'request', pending, retries);
  await vi.advanceTimersByTimeAsync(21000);
  expect(failed).toBe(false);
  expect(resolved).toBe(1);
  expect(pending.size).toBe(0);
  expect(retries.size).toBe(0);
});
it('confirmation also clears a retry key whose ACK already timed out', () => {
  const pending = new Map();
  const retries = new Map([['hello', 'request']]);
  confirmChatMessage(17, 17, 'request', pending, retries);
  expect(retries.size).toBe(0);
});
it('another user with the same request UUID cannot confirm my message', () => {
  const pending = new Map([
    [
      'request',
      {
        content: 'hello',
        timeoutId: 0 as unknown as ReturnType<typeof setTimeout>,
        resolve: () => {
          throw new Error('wrong sender');
        },
      },
    ],
  ]);
  const retries = new Map([['hello', 'request']]);
  confirmChatMessage(17, 18, 'request', pending, retries);
  expect(pending.size).toBe(1);
  expect(retries.size).toBe(1);
});
