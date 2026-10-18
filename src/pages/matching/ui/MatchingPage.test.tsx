import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSession } from '../../../entities/session/model/useSession';
import {
  createMatchRequest,
  getMatchRequestState,
} from '../../../features/matching/api/matchRequestApi';
import {
  getTodayPreferenceVote,
  submitPreferenceVote,
} from '../../../features/preference-vote/api/preferenceVoteApi';
import { MatchingPage } from './MatchingPage';
import { ApiError } from '../../../shared/api/apiError';

vi.mock('../../../entities/session/model/useSession', () => ({ useSession: vi.fn() }));
vi.mock('../../../features/matching/api/matchRequestApi', () => ({
  createMatchRequest: vi.fn(),
  getMatchRequestState: vi.fn(),
}));
vi.mock('../../../features/preference-vote/api/preferenceVoteApi', () => ({
  getTodayPreferenceVote: vi.fn(),
  submitPreferenceVote: vi.fn(),
}));

const tokenForUser = (userId: string) =>
  `header.${btoa(JSON.stringify({ sub: userId })).replace(/=/g, '')}.signature`;

function CurrentPath() {
  return <p data-testid="current-path">{useLocation().pathname}</p>;
}

function renderPage({ strict = false }: { strict?: boolean } = {}) {
  const page = (
    <MemoryRouter initialEntries={['/matching']}>
      <Routes>
        <Route path="/matching" element={<MatchingPage />} />
        <Route path="/chat/:chatRoomId" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{page}</StrictMode> : page);
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
  vi.clearAllMocks();
  vi.mocked(useSession).mockReturnValue({
    accessToken: tokenForUser('35'),
    sessionVersion: 0,
    isAuthenticated: true,
    isSessionRestoring: false,
    setAccessToken: vi.fn(),
    clearSession: vi.fn(),
    fetchAuthenticatedJson: vi.fn(),
    getAccessToken: () => tokenForUser('35'),
    refreshAccessToken: vi.fn(),
  });
  vi.mocked(getTodayPreferenceVote).mockResolvedValue({
    voteQuestionId: 12,
    question: '오늘은 어떤 분위기가 좋아요?',
    optionA: '산책',
    optionB: '카페',
    myAnswer: '산책',
    voteAnswerId: 43,
  });
});

afterEach(() => vi.useRealTimers());

describe('MatchingPage', () => {
  it('shows the snapshot preparation error without implying the user already voted', async () => {
    vi.mocked(getTodayPreferenceVote).mockRejectedValue(
      new ApiError(503, '오늘의 취향 투표를 준비 중입니다.', 'VOTE_SNAPSHOT_NOT_READY'),
    );
    renderPage();
    await flushEffects();

    expect(
      screen.getByRole('heading', { name: '취향 투표 질문을 준비하고 있어요.' }),
    ).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('오늘의 취향 투표를 준비하고 있어요.');
    expect(screen.queryByText(/이미 참여한 투표입니다/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '투표 결과' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '투표하기' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' })).toBeDisabled();
  });

  it('clears stale vote data after a reload failure and restores it after retry succeeds', async () => {
    const unansweredVote = {
      voteQuestionId: 12,
      question: '오늘은 어떤 분위기가 좋아요?',
      optionA: '산책',
      optionB: '카페',
      myAnswer: null,
      voteAnswerId: null,
    };
    vi.mocked(getTodayPreferenceVote)
      .mockResolvedValueOnce(unansweredVote)
      .mockRejectedValueOnce(
        new ApiError(503, '오늘의 취향 투표를 준비 중입니다.', 'VOTE_SNAPSHOT_NOT_READY'),
      )
      .mockResolvedValueOnce({ ...unansweredVote, myAnswer: '산책', voteAnswerId: 44 });
    vi.mocked(submitPreferenceVote).mockRejectedValueOnce(
      new ApiError(409, '이미 투표한 질문입니다.', 'VOTE_ALREADY_ANSWERED'),
    );
    renderPage();
    await flushEffects();

    fireEvent.click(screen.getByRole('button', { name: /산책$/ }));
    fireEvent.click(screen.getByRole('button', { name: '투표하기' }));
    await flushEffects();

    expect(getTodayPreferenceVote).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('오늘은 어떤 분위기가 좋아요?')).not.toBeInTheDocument();
    expect(screen.queryByText(/이미 참여한 투표입니다/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '투표 결과' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '투표하기' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await flushEffects();

    expect(getTodayPreferenceVote).toHaveBeenCalledTimes(3);
    expect(screen.getByText('오늘은 어떤 분위기가 좋아요?')).toBeInTheDocument();
    expect(screen.getByText('이미 참여한 투표입니다. 선택: 산책')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '투표 완료' })).toBeDisabled();
  });

  it('deduplicates the initial question request when effects are replayed', async () => {
    renderPage({ strict: true });
    await flushEffects();

    expect(getTodayPreferenceVote).toHaveBeenCalledOnce();
  });

  it('creates one request and polls its WAITING state', async () => {
    vi.mocked(createMatchRequest).mockResolvedValue({ matchRequestId: 90, status: 'WAITING' });
    vi.mocked(getMatchRequestState).mockResolvedValue({
      matchRequestId: 90,
      status: 'WAITING',
      chatRoomId: null,
    });
    renderPage();
    await flushEffects();

    expect(screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' }));
    await flushEffects();
    expect(createMatchRequest).toHaveBeenCalledOnce();
    expect(screen.getByText('의견이 다른 상대를 찾고 있어요.')).toBeVisible();

    await act(async () => vi.advanceTimersByTime(3_000));
    expect(getMatchRequestState).toHaveBeenCalledWith(expect.any(Function), 90);
    expect(window.sessionStorage.getItem('mulo-match-request-v1')).toContain('"userId":"35"');
  });

  it('redirects only after MATCHED includes a valid chat room id', async () => {
    window.sessionStorage.setItem(
      'mulo-match-request-v1',
      JSON.stringify({ version: 1, userId: '35', matchRequestId: 90 }),
    );
    vi.mocked(getMatchRequestState).mockResolvedValue({
      matchRequestId: 90,
      status: 'MATCHED',
      chatRoomId: 41,
    });
    renderPage();
    await flushEffects();

    expect(screen.getByTestId('current-path')).toHaveTextContent('/chat/41');
    expect(window.sessionStorage.getItem('mulo-match-request-v1')).toBeNull();
  });
});
