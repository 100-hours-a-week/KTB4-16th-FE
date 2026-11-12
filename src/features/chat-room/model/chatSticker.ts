export type ChatSticker = {
  id: string;
  src: string;
  token: string;
};

export const CHAT_STICKERS: readonly ChatSticker[] = Array.from({ length: 25 }, (_, index) => {
  const id = `sticker-${String(index + 1).padStart(2, '0')}`;
  return {
    id,
    src: `/stickers/${id}.png`,
    token: `[mulo-sticker:${id}]`,
  };
});

const stickersByToken = new Map(CHAT_STICKERS.map((sticker) => [sticker.token, sticker]));

export function parseChatStickerContent(content: string): ChatSticker | null {
  if (!/^\[mulo-sticker:sticker-(?:0[1-9]|1[0-9]|2[0-5])\]$/.test(content)) return null;
  return stickersByToken.get(content) ?? null;
}
