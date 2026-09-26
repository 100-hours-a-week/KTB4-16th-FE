import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { LockCreatePage } from './LockCreatePage';
import { SessionProvider } from '../../../entities/session/model/SessionProvider';

/** 실제 라우터 문맥에서 자물쇠 작성 화면의 사용자 입력을 검증한다. */
function renderLockCreatePage() {
  return render(
    <MemoryRouter>
      <SessionProvider>
        <LockCreatePage />
      </SessionProvider>
    </MemoryRouter>,
  );
}

describe('LockCreatePage', () => {
  it('updates the comment count and preserves the 80-character limit', async () => {
    const user = userEvent.setup();
    renderLockCreatePage();
    const comment = screen.getByPlaceholderText('이 순간을 1~2문장으로 남겨보세요');

    await user.type(comment, '안녕');
    expect(screen.getByText('2 / 80')).toBeInTheDocument();

    await user.clear(comment);
    await user.type(comment, 'a'.repeat(81));
    expect(comment).toHaveValue('a'.repeat(80));
    expect(screen.getByText('80 / 80')).toBeInTheDocument();
  });

  it('changes the mood emoji at the mockup score boundaries', async () => {
    renderLockCreatePage();
    const moodSlider = screen.getByLabelText('오늘 기분');

    fireEvent.change(moodSlider, { target: { value: '-1' } });
    expect(screen.getByText('🙁')).toBeInTheDocument();

    fireEvent.change(moodSlider, { target: { value: '41' } });
    expect(screen.getByText('🤩')).toBeInTheDocument();
  });
});
