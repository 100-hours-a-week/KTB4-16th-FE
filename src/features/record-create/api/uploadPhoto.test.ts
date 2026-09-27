import { afterEach, describe, expect, it, vi } from 'vitest';

import { getCsrfToken } from '../../../shared/api/csrf';
import { uploadPhoto } from './uploadPhoto';

vi.mock('../../../shared/api/csrf', () => ({ getCsrfToken: vi.fn() }));
afterEach(() => vi.clearAllMocks());

describe('uploadPhoto', () => {
  it('sends the photo multipart field with CSRF and does not set Content-Type', async () => {
    vi.mocked(getCsrfToken).mockResolvedValue('csrf');
    const fetchAuthenticatedJson = vi
      .fn()
      .mockResolvedValue({ message: 'ok', data: { uploadId: 4 } });
    const photo = new File(['image'], 'photo.png', { type: 'image/png' });

    await expect(uploadPhoto(photo, fetchAuthenticatedJson)).resolves.toBe(4);
    const [, init] = fetchAuthenticatedJson.mock.calls[0] as [string, RequestInit];
    expect(fetchAuthenticatedJson).toHaveBeenCalledWith(
      '/uploads',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(init.headers).toEqual({ 'X-XSRF-TOKEN': 'csrf' });
    expect((init.body as FormData).get('photo')).toBe(photo);
  });
});
