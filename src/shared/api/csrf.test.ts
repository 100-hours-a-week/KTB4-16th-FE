import { afterEach, describe, expect, it, vi } from 'vitest';

import { env } from '../config/env';
import { getCsrfToken } from './csrf';

const createApiUrl = (path: string) => `${env.apiBaseUrl}${path}`;

afterEach(() => {
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/';
  vi.unstubAllGlobals();
});

describe('getCsrfToken', () => {
  it('requests CSRF state with credentials and decodes the cookie', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => {
      document.cookie = 'XSRF-TOKEN=token%2Bvalue; path=/';
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getCsrfToken()).resolves.toBe('token+value');
    expect(fetchMock).toHaveBeenCalledWith(createApiUrl('/csrf'), { credentials: 'include' });
  });

  it('fails before login when the cookie is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(getCsrfToken()).rejects.toMatchObject({
      status: 403,
      code: 'CSRF_TOKEN_MISSING',
    });
  });
});
