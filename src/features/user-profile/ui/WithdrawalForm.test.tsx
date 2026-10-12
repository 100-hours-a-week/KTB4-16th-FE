import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../../shared/api/apiError';
import { getCsrfToken } from '../../../shared/api/csrf';
import { WithdrawalForm } from './WithdrawalForm';

vi.mock('../../../shared/api/csrf', () => ({ getCsrfToken: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCsrfToken).mockResolvedValue('csrf-token');
});

describe('WithdrawalForm', () => {
  it('비밀번호가 비어 있으면 탈퇴 요청을 보내지 않고 입력 오류를 표시한다', async () => {
    const user = userEvent.setup();
    const request = vi.fn();
    render(<WithdrawalForm onSuccess={vi.fn()} request={request} />);

    await user.click(screen.getByRole('button', { name: '회원 탈퇴하기' }));

    expect(screen.getByLabelText('현재 비밀번호')).toHaveAccessibleDescription(
      '비밀번호를 입력해 주세요.',
    );
    expect(request).not.toHaveBeenCalled();
  });

  it('서버가 현재 비밀번호 불일치를 반환하면 입력칸에 오류를 표시하고 화면에 남는다', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const request = vi
      .fn()
      .mockRejectedValue(
        new ApiError(400, '현재 비밀번호가 일치하지 않습니다.', 'CURRENT_PASSWORD_MISMATCH'),
      );
    render(<WithdrawalForm onSuccess={onSuccess} request={request} />);

    await user.type(screen.getByLabelText('현재 비밀번호'), 'Wrong123!');
    await user.click(screen.getByRole('button', { name: '회원 탈퇴하기' }));

    expect(await screen.findByLabelText('현재 비밀번호')).toHaveAccessibleDescription(
      '현재 비밀번호가 일치하지 않습니다.',
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('서버의 탈퇴 성공 응답을 확인한 뒤에만 완료 콜백을 호출한다', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const request = vi.fn().mockResolvedValue({ message: '회원 탈퇴가 완료되었습니다.' });
    render(<WithdrawalForm onSuccess={onSuccess} request={request} />);

    await user.type(screen.getByLabelText('현재 비밀번호'), 'Current123!');
    await user.click(screen.getByRole('button', { name: '회원 탈퇴하기' }));

    expect(await screen.findByRole('button', { name: '회원 탈퇴하기' })).toBeEnabled();
    expect(request).toHaveBeenCalledWith(
      '/users/me',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
