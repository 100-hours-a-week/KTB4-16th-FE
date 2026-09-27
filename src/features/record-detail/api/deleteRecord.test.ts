import { afterEach, describe, expect, it, vi } from 'vitest';

import { getCsrfToken } from '../../../shared/api/csrf';
import { deleteRecord } from './deleteRecord';

vi.mock('../../../shared/api/csrf', () => ({ getCsrfToken: vi.fn() }));

afterEach(() => vi.clearAllMocks());

describe('deleteRecord', () => {
  it('uses the authenticated API client with the CSRF token for DELETE', async () => {
    vi.mocked(getCsrfToken).mockResolvedValue('csrf-token');
    const fetchAuthenticatedJson = vi
      .fn()
      .mockResolvedValue({ message: '자물쇠가 삭제되었습니다.' });

    await expect(deleteRecord(1456, fetchAuthenticatedJson)).resolves.toBeUndefined();

    expect(fetchAuthenticatedJson).toHaveBeenCalledWith('/records/1456', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'X-XSRF-TOKEN': 'csrf-token' },
    });
  });

  it('rejects a malformed successful response', async () => {
    vi.mocked(getCsrfToken).mockResolvedValue('csrf-token');

    await expect(deleteRecord(1456, vi.fn().mockResolvedValue({}))).rejects.toThrow(
      '자물쇠 삭제 응답 형식이 올바르지 않습니다.',
    );
  });
});
