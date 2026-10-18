import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCsrfToken } from '../../../shared/api/csrf';
import { getTodayPreferenceVote, submitPreferenceVote } from './preferenceVoteApi';
vi.mock('../../../shared/api/csrf', () => ({ getCsrfToken: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
describe('preferenceVoteApi', () => {
  it('reads today vote data from the authenticated endpoint', async () => {
    const request = vi.fn().mockResolvedValue({
      data: {
        voteQuestionId: 12,
        question: '오늘은 어떤 분위기가 좋아요?',
        optionA: '산책하면서 듣기',
        optionB: '카페에서 듣기',
        myAnswer: null,
        voteAnswerId: null,
      },
    });
    await expect(getTodayPreferenceVote(request)).resolves.toMatchObject({
      voteQuestionId: 12,
      optionA: '산책하면서 듣기',
    });
    expect(request).toHaveBeenCalledWith('/vote-questions/today');
  });
  it('uses CSRF and sends the selected A/B option once', async () => {
    vi.mocked(getCsrfToken).mockResolvedValue('csrf-token');
    const request = vi.fn().mockResolvedValue({
      data: {
        voteAnswerId: 43,
        myAnswer: '산책하면서 듣기',
        result: { optionAPercent: 60, optionBPercent: 40 },
      },
    });
    await expect(submitPreferenceVote(request, 12, 'A')).resolves.toMatchObject({
      optionAPercent: 60,
    });
    expect(request).toHaveBeenCalledWith('/vote-questions/12/answers', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': 'csrf-token' },
      body: JSON.stringify({ selectedOption: 'A' }),
    });
  });
  it('rejects a malformed successful response', async () => {
    await expect(
      getTodayPreferenceVote(vi.fn().mockResolvedValue({ data: { voteQuestionId: 0 } })),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 502 });
  });
});
