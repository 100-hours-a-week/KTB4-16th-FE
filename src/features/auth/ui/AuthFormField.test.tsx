import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuthFormField } from './AuthFormField';

describe('AuthFormField', () => {
  it('connects the label and error description to its input', () => {
    render(
      <AuthFormField
        id="email"
        label="이메일"
        type="email"
        value="bad"
        onChange={() => undefined}
        error="이메일 형식이 올바르지 않습니다."
        autoComplete="email"
      />,
    );

    const input = screen.getByRole('textbox', { name: '이메일' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('이메일 형식이 올바르지 않습니다.');
  });

  it('does not announce an error when the field is valid', () => {
    render(
      <AuthFormField
        id="nickname"
        label="닉네임"
        type="text"
        value="뮬로"
        onChange={() => undefined}
        autoComplete="nickname"
      />,
    );

    expect(screen.getByRole('textbox', { name: '닉네임' })).toHaveAttribute(
      'aria-invalid',
      'false',
    );
  });

  it('connects persistent helper text to its input', () => {
    render(
      <AuthFormField
        id="password"
        label="비밀번호"
        type="password"
        value=""
        onChange={() => undefined}
        helperText="영문 대소문자, 숫자, 특수문자를 포함해 8~16자로 입력해주세요."
        autoComplete="new-password"
      />,
    );

    expect(screen.getByLabelText('비밀번호')).toHaveAccessibleDescription(
      '영문 대소문자, 숫자, 특수문자를 포함해 8~16자로 입력해주세요.',
    );
  });

  it('shows an error instead of helper and success feedback', () => {
    render(
      <AuthFormField
        id="nickname"
        label="닉네임"
        type="text"
        value="!"
        onChange={() => undefined}
        helperText="2~10자로 입력해주세요."
        successText="사용할 수 있는 닉네임입니다."
        error="2~10자로 입력해주세요."
        autoComplete="nickname"
      />,
    );

    const input = screen.getByLabelText('닉네임');
    expect(input).toHaveAccessibleDescription('2~10자로 입력해주세요.');
    expect(screen.queryByText('사용할 수 있는 닉네임입니다.')).not.toBeInTheDocument();
  });
});
