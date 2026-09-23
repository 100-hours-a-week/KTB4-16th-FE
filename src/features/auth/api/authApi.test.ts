import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCsrfToken } from '../../../shared/api/csrf';
import { fetchJson } from '../../../shared/api/fetchJson';
import { login, signup } from './authApi';

vi.mock('../../../shared/api/fetchJson', () => ({ fetchJson: vi.fn() }));
vi.mock('../../../shared/api/csrf', () => ({ getCsrfToken: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

describe('authApi', () => {
  it('normalizes only login email and preserves password bytes', async () => {
    vi.mocked(getCsrfToken).mockResolvedValue('csrf-token');
    vi.mocked(fetchJson).mockResolvedValue({ message: 'ok', accessToken: 'access-token' });

    await login({ email: ' User@Example.COM ', password: ' Password1! ' });

    expect(fetchJson).toHaveBeenLastCalledWith('/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': 'csrf-token' },
      body: JSON.stringify({ email: 'user@example.com', password: ' Password1! ' }),
    });
  });

  it('does not send login request when CSRF preparation fails', async () => {
    vi.mocked(getCsrfToken).mockRejectedValue(new Error('missing csrf'));

    await expect(login({ email: 'user@example.com', password: 'Password1!' })).rejects.toThrow(
      'missing csrf',
    );
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('omits passwordConfirm from signup body', async () => {
    vi.mocked(fetchJson).mockResolvedValue({ message: '가입 완료' });

    await signup({
      nickname: '뮬로',
      email: ' User@Example.COM ',
      password: 'Password1!',
      passwordConfirm: 'Password1!',
    });

    expect(getCsrfToken).not.toHaveBeenCalled();
    expect(fetchJson).toHaveBeenCalledWith(
      '/users/signup',
      expect.objectContaining({
        credentials: 'include',
        body: JSON.stringify({
          nickname: '뮬로',
          email: 'user@example.com',
          password: 'Password1!',
        }),
      }),
    );
  });
});
