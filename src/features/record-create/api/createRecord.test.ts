import { afterEach, describe, expect, it, vi } from 'vitest';

import { getCsrfToken } from '../../../shared/api/csrf';
import { createRecord } from './createRecord';

vi.mock('../../../shared/api/csrf', () => ({ getCsrfToken: vi.fn() }));
afterEach(() => vi.clearAllMocks());

describe('createRecord', () => {
  it('posts the exact JSON payload with CSRF and returns recordId', async () => {
    vi.mocked(getCsrfToken).mockResolvedValue('csrf');
    const fetchAuthenticatedJson = vi
      .fn()
      .mockResolvedValue({ message: 'ok', data: { recordId: 9 } });
    const payload = {
      location: { latitude: 37.2, longitude: 127.1, legalDongCode: null, legalDongName: null },
      music: {
        externalTrackId: 'id',
        title: 'title',
        artistName: 'artist',
        albumImageUrl: 'image',
        externalUrl: 'url',
      },
      moodScore: 0,
      comment: null,
      uploadId: 2,
    };
    await expect(createRecord(payload, fetchAuthenticatedJson)).resolves.toBe(9);
    expect(fetchAuthenticatedJson).toHaveBeenCalledWith('/records', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': 'csrf' },
      body: JSON.stringify(payload),
    });
  });
});
