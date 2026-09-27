import { afterEach, describe, expect, it, vi } from 'vitest';

import { getCsrfToken } from '../../../shared/api/csrf';
import { updateRecordComment } from './updateRecordComment';

vi.mock('../../../shared/api/csrf', () => ({ getCsrfToken: vi.fn() }));

afterEach(() => vi.clearAllMocks());

describe('updateRecordComment', () => {
  it('patches the exact record with authentication-compatible CSRF options', async () => {
    vi.mocked(getCsrfToken).mockResolvedValue('csrf-token');
    const fetchAuthenticatedJson = vi.fn().mockResolvedValue({
      message: '코멘트 수정 성공',
      data: { recordId: 1456, comment: '수정된 코멘트' },
    });

    await expect(updateRecordComment(1456, '수정된 코멘트', fetchAuthenticatedJson)).resolves.toBe(
      '수정된 코멘트',
    );
    expect(fetchAuthenticatedJson).toHaveBeenCalledWith('/records/1456/comment', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': 'csrf-token' },
      body: JSON.stringify({ comment: '수정된 코멘트' }),
    });
  });

  it('sends explicit null when removing a comment', async () => {
    vi.mocked(getCsrfToken).mockResolvedValue('csrf-token');
    const fetchAuthenticatedJson = vi.fn().mockResolvedValue({
      message: '코멘트 수정 성공',
      data: { recordId: 1456, comment: null },
    });

    await expect(updateRecordComment(1456, null, fetchAuthenticatedJson)).resolves.toBeNull();
    expect(fetchAuthenticatedJson).toHaveBeenCalledWith(
      '/records/1456/comment',
      expect.objectContaining({ body: JSON.stringify({ comment: null }) }),
    );
  });
});
