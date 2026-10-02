import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

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

  it('선택적인 onBlur handler를 input에 전달하고 빈 메시지 영역을 접근성 트리에서 숨긴다', async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();

    render(
      <FormField
        autoComplete="email"
        id="email"
        label="이메일"
        onBlur={onBlur}
        onChange={() => undefined}
        type="email"
        value=""
      />,
    );

    const input = screen.getByLabelText('이메일');
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(document.getElementById('email-message')).toHaveAttribute('aria-hidden', 'true');
    expect(document.getElementById('email-message')).toHaveClass('form-field-message');

    await user.click(input);
    await user.tab();
    expect(onBlur).toHaveBeenCalledTimes(1);
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

  it('비밀번호는 기본적으로 숨기고 버튼으로 값을 유지한 채 표시 여부를 전환한다', async () => {
    const user = userEvent.setup();

    render(
      <FormField
        autoComplete="current-password"
        id="password"
        label="비밀번호"
        onChange={() => undefined}
        type="password"
        value="secret-value"
      />,
    );

    const input = screen.getByLabelText('비밀번호');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveValue('secret-value');

    const showButton = screen.getByRole('button', { name: '비밀번호 보기' });
    expect(showButton).toHaveAttribute('type', 'button');
    await user.click(showButton);

    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue('secret-value');
    expect(screen.getByRole('button', { name: '비밀번호 숨기기' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: '비밀번호 숨기기' }));
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveValue('secret-value');
  });

  it('비밀번호 토글은 키보드로 동작하고 폼 제출을 유발하지 않는다', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());

    render(
      <form onSubmit={onSubmit}>
        <FormField
          autoComplete="new-password"
          id="password"
          label="비밀번호"
          onChange={() => undefined}
          type="password"
          value="secret-value"
        />
      </form>,
    );

    await user.tab();
    expect(screen.getByLabelText('비밀번호')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: '비밀번호 보기' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByLabelText('비밀번호')).toHaveAttribute('type', 'text');
    expect(onSubmit).not.toHaveBeenCalled();

    await user.keyboard(' ');
    expect(screen.getByLabelText('비밀번호')).toHaveAttribute('type', 'password');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('일반 입력 필드에는 비밀번호 토글을 표시하지 않는다', () => {
    render(
      <FormField
        autoComplete="email"
        id="email"
        label="이메일"
        onChange={() => undefined}
        type="email"
        value="person@mulo.com"
      />,
    );

    expect(screen.getByLabelText('이메일')).toHaveAttribute('type', 'email');
    expect(screen.queryByRole('button', { name: /비밀번호/ })).not.toBeInTheDocument();
  });
});
