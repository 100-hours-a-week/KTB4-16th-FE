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
      isMatching={false}
      isSubmitting={false}
      matchStatus={null}
      result={null}
      vote={vote}
      onRetry={vi.fn()}
      onStartMatching={vi.fn()}
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
  it('allows a matching request after a saved vote answer', async () => {
    const user = userEvent.setup();
    const onStartMatching = vi.fn();
    renderVote({
      vote: { ...vote, myAnswer: '산책하면서 듣기', voteAnswerId: 43 },
      onStartMatching,
    });
    await user.click(screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' }));
    expect(onStartMatching).toHaveBeenCalledExactlyOnceWith();
  });
  it('shows the server matching status and prevents a second request', () => {
    renderVote({
      vote: { ...vote, myAnswer: '산책하면서 듣기', voteAnswerId: 43 },
      matchStatus: 'MATCHING',
    });
    expect(screen.getByText('상대를 찾았어요. 채팅방을 준비하고 있어요.')).toBeVisible();
    expect(screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' })).toBeDisabled();
  });
});
