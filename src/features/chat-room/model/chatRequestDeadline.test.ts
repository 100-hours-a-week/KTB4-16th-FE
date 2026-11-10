import { afterEach, it, expect, vi } from 'vitest';
import { withChatRequestDeadline } from './chatRequestDeadline';
afterEach(() => vi.useRealTimers());
it('bounds a shared token refresh wait even if the operation ignores abort', async () => {
  vi.useFakeTimers();
  const parent = new AbortController();
  let release: () => void = () => {};
  const hung = new Promise<void>((resolve) => {
    release = resolve;
  });
  const result = withChatRequestDeadline(() => hung, parent.signal, 10000);
  const rejection = expect(result).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(10000);
  await rejection;
  release();
  await hung;
  expect(parent.signal.aborted).toBe(false);
});
it('cancels the waiter on room change without waiting for a shared refresh', async () => {
  const parent = new AbortController();
  const result = withChatRequestDeadline(() => new Promise<void>(() => {}), parent.signal, 10000);
  const rejection = expect(result).rejects.toThrow();
  parent.abort();
  await rejection;
});
