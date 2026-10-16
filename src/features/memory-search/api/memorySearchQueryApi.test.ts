import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCsrfToken } from '../../../shared/api/csrf';
import { searchMemory } from './memorySearchQueryApi';

vi.mock('../../../shared/api/csrf', () => ({ getCsrfToken: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCsrfToken).mockResolvedValue('csrf-token');
});

describe('searchMemory', () => {
  it('질문과 대화 ID만 보내고 nullable 카드 필드를 보존한다', async () => {
    const data = {
      answer: '기억을 살펴봤어요.',
      records: [
        {
          recordId: 1,
          musicTrackId: 2,
          title: '노래',
          artistName: '가수',
          placeId: 3,
          placeName: null,
          date: '2026.10.15',
          weatherCondition: null,
          albumImageUrl: '',
        },
      ],
      suggestedRecords: [
        {
          recordId: 4,
          musicTrackId: 5,
          title: '제안',
          artistName: '가수',
          placeId: 6,
          placeName: '서교동',
          date: '2026.10.14',
          weatherCondition: 'RAIN',
          albumImageUrl: '',
          matchedConditions: ['가을'],
        },
      ],
    };
    const request = vi.fn().mockResolvedValue({ message: '성공', data });

    await expect(searchMemory('conversation-id', '가을', request)).resolves.toEqual(data);
    expect(request).toHaveBeenCalledWith('/memories/search', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': 'csrf-token' },
      body: JSON.stringify({ conversationId: 'conversation-id', query: '가을' }),
    });
  });

  it.each([
    { message: '성공', data: { answer: '', records: [], suggestedRecords: null } },
    { message: '성공', data: { answer: '', records: [{ recordId: 1 }], suggestedRecords: [] } },
    {
      message: '성공',
      data: { answer: '', records: [], suggestedRecords: [{ matchedConditions: '가을' }] },
    },
  ])('계약에 맞지 않는 응답을 거부한다', async (response) => {
    await expect(
      searchMemory('id', '질문', vi.fn().mockResolvedValue(response)),
    ).rejects.toMatchObject({
      status: 502,
      code: 'INVALID_RESPONSE',
    });
  });
});
