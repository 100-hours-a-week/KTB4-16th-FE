import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from './apiError';
import { fetchJson } from './fetchJson';

afterEach(() => vi.unstubAllGlobals());

describe('fetchJson', () => {
  it('returns parsed JSON for a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"message":"ok"}', { status: 200 })),
    );

    await expect(fetchJson<{ message: string }>('/health')).resolves.toEqual({ message: 'ok' });
  });

  it('normalizes field errors from a failed response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          '{"code":"VALIDATION_ERROR","message":"입력값을 확인해주세요.","errors":{"email":"이메일 형식이 아닙니다."}}',
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    );

    await expect(fetchJson('/users/signup')).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      fieldErrors: { email: '이메일 형식이 아닙니다.' },
    } satisfies Partial<ApiError>);
  });

  it.each([[''], ['Gateway failure']])('normalizes non-JSON failure body %s', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 502 })));

    await expect(fetchJson('/health')).rejects.toMatchObject({ status: 502 });
  });

  it('normalizes a network rejection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(fetchJson('/health')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });
});
