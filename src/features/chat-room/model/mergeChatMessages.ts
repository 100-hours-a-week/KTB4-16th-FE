import type { ChatMessage } from './chatMessage.types';
/** live·복구·과거 이력을 같은 DB ID와 사용자별 요청 ID로 병합한다. */
export function mergeChatMessages(
  current: readonly ChatMessage[],
  incoming: readonly ChatMessage[],
): ChatMessage[] {
  const result = [...current];
  for (const message of incoming) {
    const index = result.findIndex(
      (old) =>
        old.id === message.id ||
        Boolean(
          message.clientMessageId &&
          old.userId === message.userId &&
          old.clientMessageId === message.clientMessageId,
        ),
    );
    if (index < 0) result.push(message);
    else if (result[index].deliveryState !== 'success' || message.deliveryState === 'success')
      result[index] = message;
  }
  return result.sort((a, b) => {
    const ap = /^\d+$/.test(a.id);
    const bp = /^\d+$/.test(b.id);
    if (ap && bp) {
      const ai = BigInt(a.id),
        bi = BigInt(b.id);
      return ai < bi ? -1 : ai > bi ? 1 : 0;
    }
    return ap ? -1 : bp ? 1 : 0;
  });
}
