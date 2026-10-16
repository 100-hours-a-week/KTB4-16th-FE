import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCsrfToken } from '../../../shared/api/csrf';
import {
  createMemorySearchConversation,
  deleteMemorySearchConversation,
} from './memorySearchConversationApi';

vi.mock('../../../shared/api/csrf', () => ({ getCsrfToken: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCsrfToken).mockResolvedValue('csrf-token');
});

describe('memorySearchConversationApi', () => {
  it('CSRF와 인증 요청으로 대화를 시작하고 백엔드 발급 ID만 반환한다', async () => {
    const request = vi.fn().mockResolvedValue({
      message: '기억 검색 대화 시작',
      data: { conversationId: 'de316f47-4e96-492d-b7c4-a74789376299' },
    });

    await expect(createMemorySearchConversation(request)).resolves.toBe(
      'de316f47-4e96-492d-b7c4-a74789376299',
    );
    expect(request).toHaveBeenCalledWith('/memories/search/conversations', {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-XSRF-TOKEN': 'csrf-token' },
    });
  });

  it.each([
    undefined,
    { message: 'ok' },
    { message: 'ok', data: { conversationId: '' } },
    { message: 'ok', data: { conversationId: 2 } },
    { message: 'ok', data: { conversationId: 'not-a-uuid' } },
  ])('시작 응답이 계약과 다르면 화면 상태에 ID를 저장하지 않는다', async (response) => {
    const request = vi.fn().mockResolvedValue(response);

    await expect(createMemorySearchConversation(request)).rejects.toMatchObject({
      status: 502,
      code: 'INVALID_RESPONSE',
    });
  });

  it('명시적 나가기에서 ID를 경로 인코딩하고 204 빈 응답을 허용한다', async () => {
    const request = vi.fn().mockResolvedValue(undefined);

    await expect(
      deleteMemorySearchConversation('id/with?unsafe', request),
    ).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledWith('/memories/search/conversations/id%2Fwith%3Funsafe', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'X-XSRF-TOKEN': 'csrf-token' },
    });
  });

  it('빈 대화 ID로 종료 요청을 보내지 않는다', async () => {
    const request = vi.fn();

    await expect(deleteMemorySearchConversation(' ', request)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
    expect(getCsrfToken).not.toHaveBeenCalled();
  });
});
