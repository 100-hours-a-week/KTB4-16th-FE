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
  it('does not show an answered state or results when no question was loaded', () => {
    renderVote({
      errorMessage: '오늘의 취향 투표를 준비하고 있어요.',
      vote: null,
    });

    expect(screen.queryByText(/이미 참여한 투표입니다/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '투표 결과' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '투표하기' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });
  it('treats a null answer id as not answered and a real answer id as answered', () => {
    const { rerender } = renderVote({ vote: { ...vote, voteAnswerId: null, myAnswer: null } });
    expect(screen.queryByText(/이미 참여한 투표입니다/)).not.toBeInTheDocument();

    rerender(
      <PreferenceVote
        errorMessage={null}
        isLoading={false}
        isMatching={false}
        isSubmitting={false}
        matchStatus={null}
        result={null}
        vote={{ ...vote, voteAnswerId: 43, myAnswer: '산책하면서 듣기' }}
        onRetry={vi.fn()}
        onStartMatching={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText('이미 참여한 투표입니다. 선택: 산책하면서 듣기')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '투표 완료' })).toBeDisabled();
  });
  it('submits only the selected A/B option', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderVote({ onSubmit });
    await user.click(screen.getByRole('button', { name: /산책하면서 듣기/ }));
    await user.click(screen.getByRole('button', { name: '투표하기' }));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith('A');
  });
  it('labels the two choices A and B without changing their submitted option values', () => {
    renderVote();

    expect(screen.getByRole('button', { name: 'A 산책하면서 듣기' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'B 카페에서 듣기' })).toBeEnabled();
  });
  it.each([
    [60, 40],
    [50, 50],
    [100, 0],
    [0, 100],
  ])('renders the server result as an A/B comparison bar (%i/%i)', (aPercent, bPercent) => {
    renderVote({
      vote: { ...vote, myAnswer: '산책하면서 듣기', voteAnswerId: 43 },
      result: {
        voteAnswerId: 43,
        myAnswer: '산책하면서 듣기',
        optionAPercent: aPercent,
        optionBPercent: bPercent,
      },
    });

    expect(
      screen.getByRole('img', { name: `투표 결과: A ${aPercent}%, B ${bPercent}%` }),
    ).toBeVisible();
    expect(screen.getByTestId('preference-vote-result-a')).toHaveStyle({ width: `${aPercent}%` });
    expect(screen.getByTestId('preference-vote-result-b')).toHaveStyle({ width: `${bPercent}%` });
    expect(screen.getByText('A.')).toBeVisible();
    expect(screen.getByText('B.')).toBeVisible();
    expect(screen.getAllByText('산책하면서 듣기')).toHaveLength(2);
    expect(screen.getAllByText('카페에서 듣기')).toHaveLength(2);
    expect(screen.getByText('내가 선택한 답: 산책하면서 듣기')).toBeVisible();
  });
  it('does not fabricate result percentages when the GET vote has no result data', () => {
    renderVote({ vote: { ...vote, myAnswer: '산책하면서 듣기', voteAnswerId: 43 } });

    expect(screen.getByText('이미 참여한 투표입니다. 선택: 산책하면서 듣기')).toBeVisible();
    expect(screen.queryByRole('img', { name: /투표 결과: A/ })).not.toBeInTheDocument();
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
    expect(
      screen.queryByRole('button', { name: '의견 다른 사람과 채팅하기' }),
    ).not.toBeInTheDocument();
  });

  it('shows a distinct failed state with GET-only status refresh and no matching POST action', async () => {
    const user = userEvent.setup();
    const onRefreshMatchStatus = vi.fn();
    renderVote({
      vote: { ...vote, myAnswer: '산책하면서 듣기', voteAnswerId: 43 },
      matchStatus: 'FAILED',
      onRefreshMatchStatus,
    });

    expect(
      screen.getByText('채팅방을 만드는 중 문제가 발생했어요. 매칭 상태를 다시 확인해 주세요.'),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: '의견 다른 사람과 채팅하기' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '상태 다시 확인' }));
    expect(onRefreshMatchStatus).toHaveBeenCalledOnce();
  });
});
