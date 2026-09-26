import { describe, expect, it, vi } from 'vitest';

import { searchMusic } from './searchMusic';

describe('searchMusic', () => {
  it('encodes q and returns a selectable record-create music object', async () => {
    const fetchAuthenticatedJson = vi.fn().mockResolvedValue({
      message: 'ok',
      data: [
        {
          externalTrackId: 'id',
          title: '밤편지',
          artistName: '아이유',
          albumImageUrl: 'https://image',
          externalUrl: 'https://track',
        },
      ],
    });
    await expect(searchMusic('밤 편지', fetchAuthenticatedJson)).resolves.toEqual([
      {
        externalTrackId: 'id',
        title: '밤편지',
        artistName: '아이유',
        albumImageUrl: 'https://image',
        externalUrl: 'https://track',
      },
    ]);
    expect(fetchAuthenticatedJson).toHaveBeenCalledWith(
      '/music/search?q=%EB%B0%A4+%ED%8E%B8%EC%A7%80',
    );
  });
});
