/** fetch가 공유 인증 갱신을 기다리더라도 호출자 자신의 대기 기한과 취소를 보장한다. */
export async function withChatRequestDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  parent: AbortSignal,
  timeoutMs = 10000,
): Promise<T> {
  parent.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort(parent.reason);
  parent.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new DOMException('Chat request deadline exceeded', 'TimeoutError')),
    timeoutMs,
  );
  let onAbort: () => void = () => {};
  const cancelled = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return operation(controller.signal);
      }),
      cancelled,
    ]);
  } finally {
    clearTimeout(timeout);
    parent.removeEventListener('abort', abort);
    controller.signal.removeEventListener('abort', onAbort);
  }
}
