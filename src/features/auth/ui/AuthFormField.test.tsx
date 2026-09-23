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
});
