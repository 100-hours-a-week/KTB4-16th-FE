import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TodayPreferenceVote } from '../api/preferenceVoteApi';
import { PreferenceVote } from './PreferenceVote';

const vote: TodayPreferenceVote = {
  voteQuestionId: 12,
  question: '오늘은 어떤 분위기가 좋아요?',
  optionA: '산책하면서 듣기',
  optionB: '카페에서 듣기',
  myAnswer: null,
  voteAnswerId: null,
};
function renderVote(overrides: Partial<React.ComponentProps<typeof PreferenceVote>> = {}) {
  return render(
    <PreferenceVote
      errorMessage={null}
      isLoading={false}
      isSubmitting={false}
      result={null}
      vote={vote}
      onRetry={vi.fn()}
      onSubmit={vi.fn()}
      {...overrides}
    />,
  );
}
describe('PreferenceVote', () => {
  it('shows unavailable controls while today vote is loading', () => {
    renderVote({ isLoading: true, vote: null });
    expect(
      screen.getByRole('heading', { name: '오늘의 취향 투표를 불러오고 있어요.' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: /그렇다/ })).toBeDisabled();
  });
  it('submits only the selected A/B option', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderVote({ onSubmit });
    await user.click(screen.getByRole('button', { name: /산책하면서 듣기/ }));
    await user.click(screen.getByRole('button', { name: '투표하기' }));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('A');
  });
  it('restores an existing answer and prevents a second submit', () => {
    renderVote({ vote: { ...vote, myAnswer: '카페에서 듣기', voteAnswerId: 43 } });
    expect(screen.getByRole('button', { name: /카페에서 듣기/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '투표 완료' })).toBeDisabled();
  });
  it('shows result percentages and keeps matching unavailable', () => {
    renderVote({
      result: {
        voteAnswerId: 43,
        myAnswer: '산책하면서 듣기',
        optionAPercent: 60,
        optionBPercent: 40,
      },
    });
    expect(screen.getByText('산책하면서 듣기 60% · 카페에서 듣기 40%')).toBeVisible();
    expect(screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' })).toBeDisabled();
  });
});
