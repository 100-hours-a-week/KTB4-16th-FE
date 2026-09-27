import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FormField } from './FormField';

describe('FormField', () => {
  it('연결된 label과 오류 설명을 입력에 제공한다', () => {
    render(
      <FormField
        autoComplete="nickname"
        error="2~10자로 입력해주세요."
        id="nickname"
        label="닉네임"
        onChange={() => undefined}
        type="text"
        value="!"
      />,
    );

    expect(screen.getByRole('textbox', { name: '닉네임' })).toHaveAccessibleDescription(
      '2~10자로 입력해주세요.',
    );
  });

  it('오류가 있으면 성공과 도움말보다 오류를 우선 표시한다', () => {
    render(
      <FormField
        autoComplete="new-password"
        error="형식을 확인해주세요."
        helperText="8~16자"
        id="password"
        label="비밀번호"
        onChange={() => undefined}
        successText="사용할 수 있습니다."
        type="password"
        value="bad"
      />,
    );

    expect(screen.getByLabelText('비밀번호')).toHaveAccessibleDescription('형식을 확인해주세요.');
    expect(screen.queryByText('사용할 수 있습니다.')).not.toBeInTheDocument();
    expect(screen.queryByText('8~16자')).not.toBeInTheDocument();
  });
});
