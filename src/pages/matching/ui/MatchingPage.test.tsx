import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSession } from '../../../entities/session/model/useSession';
import {
  createMatchRequest,
  getMatchRequestState,
} from '../../../features/matching/api/matchRequestApi';
import { getTodayPreferenceVote } from '../../../features/preference-vote/api/preferenceVoteApi';
import { MatchingPage } from './MatchingPage';

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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/matching']}>
      <Routes>
        <Route path="/matching" element={<MatchingPage />} />
        <Route path="/chat/:chatRoomId" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>,
  );
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
    isAuthenticated: true,
    isSessionRestoring: false,
    setAccessToken: vi.fn(),
    clearSession: vi.fn(),
    fetchAuthenticatedJson: vi.fn(),
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
