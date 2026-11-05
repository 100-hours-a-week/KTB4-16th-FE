import type { ChatRoomMessageRecord, ChatMessageSyncPage } from '../api/chatRoomApi';
/** DB가 확인한 고정 범위를 끝까지 읽고 전체 완료 기준점만 반환한다. */
export async function recoverChatMessages(options: {
  afterMessageId: number;
  fetchPage: (
    after: number,
    through: number | undefined,
    signal: AbortSignal,
  ) => Promise<ChatMessageSyncPage>;
  applyPage: (messages: ChatRoomMessageRecord[]) => void;
  signal: AbortSignal;
}): Promise<number> {
  let after = options.afterMessageId;
  let through: number | undefined;
  do {
    options.signal.throwIfAborted();
    const page = await options.fetchPage(after, through, options.signal);
    options.signal.throwIfAborted();
    if (
      !Number.isSafeInteger(page.throughMessageId) ||
      page.throughMessageId < after ||
      (through !== undefined && through !== page.throughMessageId) ||
      page.nextAfterMessageId > page.throughMessageId ||
      page.nextAfterMessageId < after ||
      (page.hasNext && (page.nextAfterMessageId <= after || page.messages.length === 0)) ||
      (!page.hasNext && page.nextAfterMessageId !== page.throughMessageId) ||
      page.messages.some(
        (m, i) =>
          m.chatMessageId <= after ||
          m.chatMessageId > page.throughMessageId ||
          (i > 0 && m.chatMessageId <= page.messages[i - 1].chatMessageId),
      )
    ) {
      throw new Error('Invalid message recovery boundary');
    }
    through = page.throughMessageId;
    options.applyPage(page.messages);
    if (!page.hasNext) return through;
    if (page.messages.at(-1)?.chatMessageId !== page.nextAfterMessageId)
      throw new Error('Invalid recovery cursor');
    after = page.nextAfterMessageId;
  } while (!options.signal.aborted);
  options.signal.throwIfAborted();
  throw new Error('Recovery aborted');
}
