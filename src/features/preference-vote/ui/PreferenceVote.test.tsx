import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PreferenceVote } from './PreferenceVote';

describe('PreferenceVote', () => {
  it('shows an unavailable question state when no question data is provided', () => {
    render(<PreferenceVote question={null} />);

    expect(screen.getByText('PREFERENCE VOTE')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '취향 투표 질문을 준비하고 있어요.' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: /그렇다/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /아니다/ })).toBeDisabled();
    expect(screen.getByText('투표 결과가 제공되면 여기에 표시돼요.')).toBeVisible();
  });

  it('shows a supplied question and updates the O/X selection state', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<PreferenceVote question="테스트 질문" />);

    const yesButton = screen.getByRole('button', { name: /그렇다/ });
    const noButton = screen.getByRole('button', { name: /아니다/ });

    expect(screen.getByRole('heading', { name: '테스트 질문' })).toBeVisible();
    await user.click(yesButton);
    expect(yesButton).toHaveAttribute('aria-pressed', 'true');
    expect(noButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(noButton);
    expect(yesButton).toHaveAttribute('aria-pressed', 'false');
    expect(noButton).toHaveAttribute('aria-pressed', 'true');

    rerender(<PreferenceVote question="새 질문" />);
    expect(screen.getByRole('button', { name: /그렇다/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /아니다/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('does not simulate voting or matching while action handlers are unavailable', async () => {
    const user = userEvent.setup();
    render(<PreferenceVote question="테스트 질문" />);

    const voteButton = screen.getByRole('button', { name: '투표만 하기' });
    const matchingButton = screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' });

    await user.click(screen.getByRole('button', { name: /그렇다/ }));
    expect(voteButton).toBeDisabled();
    expect(matchingButton).toBeDisabled();
    await user.click(voteButton);
    await user.click(matchingButton);
    expect(screen.queryByText('투표 완료!')).not.toBeInTheDocument();
    expect(screen.queryByText('생각이 다른 분들을 찾고 있어요')).not.toBeInTheDocument();
  });
});
