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

  it('normalizes the backend FieldError array by field name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'DUPLICATE_RESOURCE',
            message: '이미 사용 중인 정보가 있습니다.',
            errors: [
              { field: 'email', code: 'EMAIL_DUPLICATED', message: '이미 사용 중인 이메일입니다.' },
              {
                field: 'nickname',
                code: 'NICKNAME_DUPLICATED',
                message: '이미 사용 중인 닉네임입니다.',
              },
            ],
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    await expect(fetchJson('/users/signup')).rejects.toMatchObject({
      status: 409,
      fieldErrors: {
        email: '이미 사용 중인 이메일입니다.',
        nickname: '이미 사용 중인 닉네임입니다.',
      },
    });
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
