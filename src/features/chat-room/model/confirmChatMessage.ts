interface PendingConfirmation {
  content: string;
  timeoutId: ReturnType<typeof setTimeout>;
  resolve: () => void;
}
/** 내 메시지의 DB/live 확인을 같은 ACK 처리로 합치며 만료된 재시도 키도 정리한다. */
export function confirmChatMessage(
  currentUserId: number | undefined,
  messageUserId: number,
  clientMessageId: string,
  pendingMessages: Map<string, PendingConfirmation>,
  retries: Map<string, string>,
): void {
  if (currentUserId !== messageUserId) return;
  for (const [content, id] of retries) if (id === clientMessageId) retries.delete(content);
  const pending = pendingMessages.get(clientMessageId);
  if (!pending) return;
  clearTimeout(pending.timeoutId);
  pendingMessages.delete(clientMessageId);
  pending.resolve();
}
