import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../../shared/api/apiError';
import { searchMusic } from './musicSearchApi';

describe('searchMusic', () => {
  it('공백을 정리하고 q 하나를 URLSearchParams 형식으로 인코딩한다', async () => {
    const request = vi.fn().mockResolvedValue({ message: 'ok', data: [] });

    await searchMusic(request, ' 아이유 & 밤편지 ');

    expect(request).toHaveBeenCalledWith(
      '/music/search?q=%EC%95%84%EC%9D%B4%EC%9C%A0+%26+%EB%B0%A4%ED%8E%B8%EC%A7%80',
    );
  });

  it('필수 음악 필드가 없는 응답을 화면에 전달하지 않는다', async () => {
    await expect(
      searchMusic(
        vi.fn().mockResolvedValue({ message: 'ok', data: [{ title: '밤편지' }] }),
        '밤편지',
      ),
    ).rejects.toMatchObject({ status: 502, code: 'INVALID_RESPONSE' } satisfies Partial<ApiError>);
  });

  it('두 글자 미만 검색어는 요청 전에 거절한다', async () => {
    const request = vi.fn();

    await expect(searchMusic(request, '밤')).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_SEARCH_QUERY',
    } satisfies Partial<ApiError>);
    expect(request).not.toHaveBeenCalled();
  });
});
