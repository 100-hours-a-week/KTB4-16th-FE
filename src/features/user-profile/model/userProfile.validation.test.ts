import { describe, expect, it } from 'vitest';

import { validateNicknameChange, validatePasswordChange } from './userProfile.validation';

describe('validateNicknameChange', () => {
  it.each(['a', '가나다라마바사아자차카', '닉네임!'])(
    '허용하지 않는 닉네임 %s을 거절한다',
    (nickname) => {
      expect(validateNicknameChange({ nickname }, '현재닉네임').nickname).toBeDefined();
    },
  );

  it('공백을 제외하고 현재 닉네임과 같은 값은 거절한다', () => {
    expect(validateNicknameChange({ nickname: ' 현재닉네임 ' }, '현재닉네임').nickname).toContain(
      '동일',
    );
  });

  it('유효하고 다른 닉네임을 허용한다', () => {
    expect(validateNicknameChange({ nickname: ' 새닉네임 ' }, '현재닉네임')).toEqual({});
  });
});

describe('validatePasswordChange', () => {
  it.each(['password1!', 'PASSWORD1!', 'Password!!', 'Password1', 'Pass1!'])(
    '규칙을 만족하지 않는 새 비밀번호 %s을 거절한다',
    (newPassword) => {
      expect(
        validatePasswordChange({
          currentPassword: 'Password1!',
          newPassword,
          newPasswordConfirm: newPassword,
        }).newPassword,
      ).toBeDefined();
    },
  );

  it('현재 비밀번호와 같은 새 비밀번호와 불일치 확인값을 함께 거절한다', () => {
    expect(
      validatePasswordChange({
        currentPassword: 'Password1!',
        newPassword: 'Password1!',
        newPasswordConfirm: 'OtherPassword1!',
      }),
    ).toMatchObject({
      newPassword: expect.any(String),
      newPasswordConfirm: expect.any(String),
    });
  });

  it('복잡도와 확인값을 만족하는 새 비밀번호를 허용한다', () => {
    expect(
      validatePasswordChange({
        currentPassword: 'Password1!',
        newPassword: 'NewPassword1!',
        newPasswordConfirm: 'NewPassword1!',
      }),
    ).toEqual({});
  });
});
