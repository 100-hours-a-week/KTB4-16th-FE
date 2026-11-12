import { describe, expect, it } from 'vitest';

import { CHAT_STICKERS, parseChatStickerContent } from './chatSticker';

describe('chatSticker', () => {
  it('registers 25 sticker ids and uses their PNG paths and content tokens', () => {
    expect(CHAT_STICKERS).toHaveLength(25);
    expect(CHAT_STICKERS[0]).toEqual({
      id: 'sticker-01',
      src: '/stickers/sticker-01.png',
      token: '[mulo-sticker:sticker-01]',
    });
    expect(CHAT_STICKERS[24]).toEqual({
      id: 'sticker-25',
      src: '/stickers/sticker-25.png',
      token: '[mulo-sticker:sticker-25]',
    });
  });

  it('parses only registered sticker tokens', () => {
    expect(parseChatStickerContent('[mulo-sticker:sticker-09]')).toEqual(CHAT_STICKERS[8]);
    expect(parseChatStickerContent('[mulo-sticker:sticker-25]')).toEqual(CHAT_STICKERS[24]);
    expect(parseChatStickerContent('[mulo-sticker:sticker-26]')).toBeNull();
    expect(parseChatStickerContent('[mulo-sticker:sticker-27]')).toBeNull();
    expect(parseChatStickerContent('[mulo-sticker:hello]')).toBeNull();
    expect(parseChatStickerContent('메시지 [mulo-sticker:sticker-09]')).toBeNull();
  });
});
