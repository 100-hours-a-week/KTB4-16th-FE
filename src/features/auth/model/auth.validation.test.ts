import { describe, expect, it } from 'vitest';

import { validateLogin, validateSignup } from './auth.validation';

describe('validateLogin', () => {
  it.each([
    [{ email: '', password: 'Password1!' }, 'email'],
    [{ email: 'not-an-email', password: 'Password1!' }, 'email'],
    [{ email: 'user@example.com', password: '' }, 'password'],
  ] as const)('rejects invalid login values %o', (values, field) => {
    expect(validateLogin(values)[field]).toBeDefined();
  });

  it('accepts valid login values', () => {
    expect(validateLogin({ email: ' user@example.com ', password: ' Password1! ' })).toEqual({});
  });
});

describe('validateSignup', () => {
  it.each(['a', '가나다라마바사아자차카', '닉네임!'])('rejects invalid nickname %s', (nickname) => {
    expect(
      validateSignup({
        nickname,
        email: 'user@example.com',
        password: 'Password1!',
        passwordConfirm: 'Password1!',
      }).nickname,
    ).toBeDefined();
  });

  it.each(['password1!', 'PASSWORD1!', 'Password!!', 'Password1', 'Pass1!'])(
    'rejects invalid password %s',
    (password) => {
      expect(
        validateSignup({
          nickname: '뮬로',
          email: 'user@example.com',
          password,
          passwordConfirm: password,
        }).password,
      ).toBeDefined();
    },
  );

  it('rejects mismatched confirmation', () => {
    expect(
      validateSignup({
        nickname: '뮬로',
        email: 'user@example.com',
        password: 'Password1!',
        passwordConfirm: 'Password2!',
      }).passwordConfirm,
    ).toBeDefined();
  });

  it('accepts values at nickname and password boundaries', () => {
    expect(
      validateSignup({
        nickname: '가1',
        email: 'user@example.com',
        password: 'Password1!',
        passwordConfirm: 'Password1!',
      }),
    ).toEqual({});
  });
});
