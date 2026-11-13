import { describe, expect, it } from 'vitest';

import { CHAT_STICKERS, parseChatStickerContent } from './chatSticker';

describe('chatSticker', () => {
  it('registers 30 sticker ids and uses their PNG paths and content tokens', () => {
    expect(CHAT_STICKERS).toHaveLength(30);
    expect(CHAT_STICKERS[0]).toEqual({
      id: 'sticker-01',
      src: '/stickers/sticker-01.png',
      token: '[mulo-sticker:sticker-01]',
    });
    expect(CHAT_STICKERS[29]).toEqual({
      id: 'sticker-30',
      src: '/stickers/sticker-30.png',
      token: '[mulo-sticker:sticker-30]',
    });
  });

  it('parses only registered sticker tokens', () => {
    expect(parseChatStickerContent('[mulo-sticker:sticker-09]')).toEqual(CHAT_STICKERS[8]);
    expect(parseChatStickerContent('[mulo-sticker:sticker-26]')).toEqual(CHAT_STICKERS[25]);
    expect(parseChatStickerContent('[mulo-sticker:sticker-30]')).toEqual(CHAT_STICKERS[29]);
    expect(parseChatStickerContent('[mulo-sticker:sticker-31]')).toBeNull();
    expect(parseChatStickerContent('[mulo-sticker:hello]')).toBeNull();
    expect(parseChatStickerContent('메시지 [mulo-sticker:sticker-09]')).toBeNull();
  });
});
