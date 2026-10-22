import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSession } from '../../../entities/session/model/useSession';
import {
  createMatchRequest,
  getMatchRequestByVoteAnswer,
  getMatchRequestState,
} from '../../../features/matching/api/matchRequestApi';
import {
  getTodayPreferenceVote,
  submitPreferenceVote,
} from '../../../features/preference-vote/api/preferenceVoteApi';
import { joinGroupChat } from '../../../features/chat-room/api/groupChatApi';
import { MatchingPage } from './MatchingPage';
import { ApiError } from '../../../shared/api/apiError';

vi.mock('../../chat-room/ui/ChatRoomPage', () => ({
  ChatRoomPage: ({
    embeddedRoomId,
    expanded,
    onToggleExpanded,
    onLeaveSuccess,
  }: {
    embeddedRoomId: string;
    expanded: boolean;
    onToggleExpanded: (expanded: boolean) => void;
    onLeaveSuccess?: () => void;
  }) => (
    <section aria-label="매칭된 채팅방" data-testid="inline-chat" data-expanded={expanded}>
      <span>{embeddedRoomId}</span>
      <button type="button" onClick={() => onToggleExpanded(true)}>
        전체보기
      </button>
      <button type="button" onClick={() => onToggleExpanded(false)}>
        축소
      </button>
      <button type="button" onClick={() => onLeaveSuccess?.()}>
        나가기 성공
      </button>
    </section>
  ),
}));

vi.mock('../../../entities/session/model/useSession', () => ({ useSession: vi.fn() }));
vi.mock('../../../features/matching/api/matchRequestApi', () => ({
  createMatchRequest: vi.fn(),
  getMatchRequestByVoteAnswer: vi.fn(),
  getMatchRequestState: vi.fn(),
}));
vi.mock('../../../features/preference-vote/api/preferenceVoteApi', () => ({
  getTodayPreferenceVote: vi.fn(),
  submitPreferenceVote: vi.fn(),
}));
vi.mock('../../../features/chat-room/api/groupChatApi', () => ({
  joinGroupChat: vi.fn(),
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
        <Route
          path="/matching"
          element={
            <>
              <CurrentPath />
              <MatchingPage />
            </>
          }
        />
        <Route path="/chat/:chatRoomId" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{page}</StrictMode> : page);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function flushEffects() {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
  vi.clearAllMocks();
  vi.mocked(getMatchRequestByVoteAnswer).mockRejectedValue(
    new ApiError(404, '요청 없음', 'MATCH_REQUEST_NOT_FOUND'),
  );
  vi.mocked(joinGroupChat).mockResolvedValue({
    chatRoomId: 21,
    roomSequence: 1,
    newlyAssigned: true,
    admittedParticipantCount: 1,
    activeParticipantCount: 0,
    expiresAt: '2026-10-22T00:00:00+09:00',
  });
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
    result: null,
  });
});

afterEach(() => vi.useRealTimers());

describe('MatchingPage', () => {
  it('joins the group room directly after the user chooses chat without using one-to-one matching', async () => {
    const { container } = renderPage();
    await flushEffects();

    await act(async () => {
      screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' }).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(joinGroupChat).toHaveBeenCalledWith(expect.any(Function), 43);
    expect(createMatchRequest).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="current-path"]')).toHaveTextContent('/chat/21');
  });

  it('does not fall back to one-to-one matching when group join fails and distinguishes auth and server errors', async () => {
    vi.mocked(joinGroupChat).mockRejectedValueOnce(
      new ApiError(401, 'unauthorized', 'UNAUTHORIZED'),
    );
    renderPage();
    await flushEffects();

    fireEvent.click(screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' }));
    await flushEffects();

    expect(createMatchRequest).not.toHaveBeenCalled();
    expect(joinGroupChat).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toHaveTextContent('로그인이 만료되었어요');

    vi.mocked(joinGroupChat).mockRejectedValueOnce(
      new ApiError(503, 'unavailable', 'SERVICE_UNAVAILABLE'),
    );
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await flushEffects();
    expect(joinGroupChat).toHaveBeenCalledTimes(2);
    expect(createMatchRequest).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('그룹 채팅 서버에 연결하지 못했어요');
  });

  it('does not call the group API without a vote answer', async () => {
    vi.mocked(getTodayPreferenceVote).mockResolvedValue({
      voteQuestionId: 12,
      question: '오늘은 어떤 분위기가 좋아요?',
      optionA: '산책',
      optionB: '카페',
      myAnswer: null,
      voteAnswerId: null,
    });
    renderPage();
    await flushEffects();

    expect(screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' })).toBeDisabled();
    expect(joinGroupChat).not.toHaveBeenCalled();
  });

  it('prevents duplicate group join requests while the first request is pending', async () => {
    let resolveJoin!: (value: Awaited<ReturnType<typeof joinGroupChat>>) => void;
    vi.mocked(joinGroupChat).mockReturnValue(
      new Promise((resolve) => {
        resolveJoin = resolve;
      }),
    );
    renderPage();
    await flushEffects();

    const groupEntryButton = screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' });
    fireEvent.click(groupEntryButton);
    fireEvent.click(groupEntryButton);

    expect(joinGroupChat).toHaveBeenCalledOnce();
    expect(createMatchRequest).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '그룹 채팅 입장 중...' })).toBeDisabled();

    await act(async () => {
      resolveJoin({
        chatRoomId: 21,
        roomSequence: 1,
        newlyAssigned: true,
        admittedParticipantCount: 1,
        activeParticipantCount: 0,
        expiresAt: '2026-10-23T00:00:00+09:00',
      });
      await Promise.resolve();
    });
    expect(screen.getByTestId('current-path')).toHaveTextContent('/chat/21');
  });

  it('keeps the server-side re-entry restriction after a previous GROUP leave', async () => {
    vi.mocked(joinGroupChat).mockRejectedValueOnce(
      new ApiError(403, '오늘은 다시 입장할 수 없습니다.', 'GROUP_CHAT_REENTRY_FORBIDDEN'),
    );
    renderPage();
    await flushEffects();

    fireEvent.click(screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' }));
    await flushEffects();

    expect(joinGroupChat).toHaveBeenCalledOnce();
    expect(createMatchRequest).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      '이미 퇴장한 그룹 채팅방에는 다시 입장할 수 없어요.',
    );
    expect(screen.getByTestId('current-path')).toHaveTextContent('/matching');
  });

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

  it('restores the server percentages from GET after a reload', async () => {
    vi.mocked(getTodayPreferenceVote).mockResolvedValue({
      voteQuestionId: 12,
      question: '오늘은 어떤 분위기가 좋아요?',
      optionA: '산책',
      optionB: '카페',
      myAnswer: '산책',
      voteAnswerId: 43,
      result: { optionAPercent: 67, optionBPercent: 33 },
    });

    renderPage();
    await flushEffects();

    expect(screen.getByRole('img', { name: '투표 결과: A 67%, B 33%' })).toBeVisible();
    expect(screen.getByTestId('preference-vote-result-a')).toHaveStyle({ width: '67%' });
    expect(screen.getByTestId('preference-vote-result-b')).toHaveStyle({ width: '33%' });
  });

  it('does not show percentages when GET has no result or the user has not voted', async () => {
    vi.mocked(getTodayPreferenceVote).mockResolvedValue({
      voteQuestionId: 12,
      question: '오늘은 어떤 분위기가 좋아요?',
      optionA: '산책',
      optionB: '카페',
      myAnswer: null,
      voteAnswerId: null,
      result: { optionAPercent: 67, optionBPercent: 33 },
    });

    renderPage();
    await flushEffects();

    expect(screen.queryByRole('img', { name: /투표 결과: A/ })).not.toBeInTheDocument();
    expect(screen.getByText('투표하면 현재 결과 비율을 확인할 수 있어요.')).toBeVisible();
  });

  it('deduplicates the initial question request when effects are replayed', async () => {
    renderPage({ strict: true });
    await flushEffects();

    expect(getTodayPreferenceVote).toHaveBeenCalledOnce();
  });

  it('keeps GROUP entry independent while restoring a legacy DIRECT request', async () => {
    vi.mocked(getMatchRequestByVoteAnswer).mockImplementation(() => new Promise(() => {}));
    renderPage();
    await flushEffects();

    expect(getMatchRequestByVoteAnswer).toHaveBeenCalledOnce();
    expect(getMatchRequestByVoteAnswer).toHaveBeenCalledWith(expect.any(Function), 43);
    const groupEntryButton = screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' });
    expect(groupEntryButton).toBeEnabled();
    expect(createMatchRequest).not.toHaveBeenCalled();

    fireEvent.click(groupEntryButton);
    await flushEffects();

    expect(joinGroupChat).toHaveBeenCalledWith(expect.any(Function), 43);
    expect(createMatchRequest).not.toHaveBeenCalled();
    expect(screen.getByTestId('current-path')).toHaveTextContent('/chat/21');
  });

  it('restores an existing WAITING request and resumes polling without creating another request', async () => {
    vi.mocked(getMatchRequestByVoteAnswer).mockResolvedValue({
      matchRequestId: 90,
      status: 'WAITING',
      chatRoomId: null,
    });
    vi.mocked(getMatchRequestState).mockResolvedValue({
      matchRequestId: 90,
      status: 'MATCHING',
      chatRoomId: null,
    });

    renderPage();
    await flushEffects();
    expect(screen.getByText('의견이 다른 상대를 찾고 있어요.')).toBeVisible();
    expect(screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' })).toBeEnabled();
    expect(window.sessionStorage.getItem('mulo-match-request-v1')).toContain('"matchRequestId":90');
    expect(createMatchRequest).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(3_000);
      await Promise.resolve();
    });
    expect(getMatchRequestState).toHaveBeenCalledWith(expect.any(Function), 90);
    expect(screen.getByText('상대를 찾았어요. 채팅방을 준비하고 있어요.')).toBeVisible();
  });

  it('does not allow a POST when existing-request lookup fails and retries lookup only', async () => {
    vi.mocked(getMatchRequestByVoteAnswer)
      .mockRejectedValueOnce(new ApiError(503, '잠시 후 다시 시도해 주세요.', 'SERVER_ERROR'))
      .mockRejectedValueOnce(new ApiError(404, '요청 없음', 'MATCH_REQUEST_NOT_FOUND'));
    renderPage();
    await flushEffects();

    expect(screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' })).toBeEnabled();
    expect(screen.getByRole('alert')).toHaveTextContent('잠시 후 다시 시도해 주세요.');
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await flushEffects();

    expect(getMatchRequestByVoteAnswer).toHaveBeenCalledTimes(2);
    expect(createMatchRequest).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' })).toBeEnabled();
  });

  it('restores a legacy MATCHING request without creating a new one-to-one request', async () => {
    vi.mocked(getMatchRequestByVoteAnswer).mockResolvedValue({
      matchRequestId: 90,
      status: 'MATCHING',
      chatRoomId: null,
    });
    renderPage();
    await flushEffects();

    expect(getMatchRequestByVoteAnswer).toHaveBeenCalledOnce();
    expect(createMatchRequest).not.toHaveBeenCalled();
    expect(screen.getByText('상대를 찾았어요. 채팅방을 준비하고 있어요.')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps FAILED terminal, offers GET-only refresh, and never retries POST', async () => {
    vi.mocked(getMatchRequestByVoteAnswer).mockResolvedValue({
      matchRequestId: 90,
      status: 'FAILED',
      chatRoomId: null,
    });
    vi.mocked(getMatchRequestState).mockResolvedValue({
      matchRequestId: 90,
      status: 'FAILED',
      chatRoomId: null,
    });
    renderPage();
    await flushEffects();

    expect(screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' })).toBeEnabled();
    expect(
      screen.getByText('채팅방을 만드는 중 문제가 발생했어요. 매칭 상태를 다시 확인해 주세요.'),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '상태 다시 확인' }));
    await flushEffects();

    expect(getMatchRequestState).toHaveBeenCalledWith(expect.any(Function), 90);
    expect(createMatchRequest).not.toHaveBeenCalled();
  });

  it('keeps the inline chat mounted while expanding and collapsing the matched room', async () => {
    vi.mocked(getMatchRequestByVoteAnswer).mockResolvedValue({
      matchRequestId: 90,
      status: 'MATCHED',
      chatRoomId: 41,
    });
    renderPage();
    await flushEffects();

    expect(screen.getByTestId('inline-chat')).toHaveAttribute('data-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: '전체보기' }));
    expect(screen.getByTestId('inline-chat')).toHaveAttribute('data-expanded', 'true');
    expect(screen.getByTestId('current-path')).toHaveTextContent('/matching');
    fireEvent.click(screen.getByRole('button', { name: '축소' }));
    expect(screen.getByTestId('inline-chat')).toHaveAttribute('data-expanded', 'false');
    expect(screen.getByTestId('current-path')).toHaveTextContent('/matching');
  });

  it('restores an existing WAITING request and polls its state', async () => {
    vi.mocked(getMatchRequestByVoteAnswer).mockResolvedValue({
      matchRequestId: 90,
      status: 'WAITING',
      chatRoomId: null,
    });
    vi.mocked(getMatchRequestState).mockResolvedValue({
      matchRequestId: 90,
      status: 'WAITING',
      chatRoomId: null,
    });
    renderPage();
    await flushEffects();

    expect(screen.getByText('의견이 다른 상대를 찾고 있어요.')).toBeVisible();
    expect(createMatchRequest).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTime(3_000));
    expect(getMatchRequestState).toHaveBeenCalledWith(expect.any(Function), 90);
    expect(window.sessionStorage.getItem('mulo-match-request-v1')).toContain('"userId":"35"');
  });

  it('keeps a restored DIRECT room and allows GROUP entry for the current vote', async () => {
    vi.mocked(getTodayPreferenceVote).mockResolvedValue({
      voteQuestionId: 12,
      question: '오늘은 어떤 분위기가 좋아요?',
      optionA: '산책',
      optionB: '카페',
      myAnswer: '산책',
      voteAnswerId: 43,
      result: { optionAPercent: 67, optionBPercent: 33 },
    });
    vi.mocked(getMatchRequestByVoteAnswer).mockResolvedValue({
      matchRequestId: 90,
      status: 'MATCHED',
      chatRoomId: 41,
    });
    renderPage();
    await flushEffects();

    expect(screen.getByTestId('current-path')).toHaveTextContent('/matching');
    expect(screen.getByTestId('inline-chat')).toHaveTextContent('41');
    expect(screen.getByRole('img', { name: '투표 결과: A 67%, B 33%' })).toBeVisible();
    const groupEntryButton = screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' });
    expect(groupEntryButton).toBeEnabled();
    expect(window.sessionStorage.getItem('mulo-match-request-v1')).toBeNull();
    expect(window.sessionStorage.getItem('mulo-matched-chat-room-v1')).toContain('"chatRoomId":41');

    fireEvent.click(groupEntryButton);
    await flushEffects();

    expect(joinGroupChat).toHaveBeenCalledWith(expect.any(Function), 43);
    expect(createMatchRequest).not.toHaveBeenCalled();
    expect(screen.getByTestId('current-path')).toHaveTextContent('/chat/21');
    expect(window.sessionStorage.getItem('mulo-matched-chat-room-v1')).toContain('"chatRoomId":41');
  });

  it('keeps the WAITING to MATCHING to MATCHED flow and shows the server room inline', async () => {
    vi.mocked(getMatchRequestByVoteAnswer).mockResolvedValue({
      matchRequestId: 90,
      status: 'WAITING',
      chatRoomId: null,
    });
    vi.mocked(getMatchRequestState)
      .mockResolvedValueOnce({ matchRequestId: 90, status: 'MATCHING', chatRoomId: null })
      .mockResolvedValueOnce({ matchRequestId: 90, status: 'MATCHED', chatRoomId: 41 });

    renderPage();
    await flushEffects();
    expect(screen.getByText('의견이 다른 상대를 찾고 있어요.')).toBeVisible();
    expect(createMatchRequest).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(3_000);
      await Promise.resolve();
    });
    expect(screen.getByText('상대를 찾았어요. 채팅방을 준비하고 있어요.')).toBeVisible();

    await act(async () => {
      vi.advanceTimersByTime(3_000);
      await Promise.resolve();
    });
    expect(screen.getByTestId('current-path')).toHaveTextContent('/matching');
    expect(screen.getByTestId('inline-chat')).toHaveTextContent('41');
    expect(window.sessionStorage.getItem('mulo-match-request-v1')).toBeNull();
  });

  it('keeps the submitted vote result visible while group room assignment is pending', async () => {
    vi.mocked(getTodayPreferenceVote).mockResolvedValue({
      voteQuestionId: 12,
      question: '오늘은 어떤 분위기가 좋아요?',
      optionA: '산책',
      optionB: '카페',
      myAnswer: null,
      voteAnswerId: null,
    });
    vi.mocked(submitPreferenceVote).mockResolvedValue({
      voteAnswerId: 43,
      myAnswer: '산책',
      optionAPercent: 60,
      optionBPercent: 40,
    });
    let resolveJoin!: (value: Awaited<ReturnType<typeof joinGroupChat>>) => void;
    vi.mocked(joinGroupChat).mockReturnValue(
      new Promise((resolve) => {
        resolveJoin = resolve;
      }),
    );
    renderPage();
    await flushEffects();

    fireEvent.click(screen.getByRole('button', { name: 'A 산책' }));
    fireEvent.click(screen.getByRole('button', { name: '투표하기' }));
    await flushEffects();
    expect(screen.getByRole('img', { name: '투표 결과: A 60%, B 40%' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' }));
    await flushEffects();
    expect(joinGroupChat).toHaveBeenCalledWith(expect.any(Function), 43);
    expect(createMatchRequest).not.toHaveBeenCalled();
    expect(screen.getByRole('img', { name: '투표 결과: A 60%, B 40%' })).toBeVisible();

    await act(async () => {
      resolveJoin({
        chatRoomId: 21,
        roomSequence: 1,
        newlyAssigned: true,
        admittedParticipantCount: 1,
        activeParticipantCount: 0,
        expiresAt: '2026-10-23T00:00:00+09:00',
      });
      await Promise.resolve();
    });
    expect(screen.getByTestId('current-path')).toHaveTextContent('/chat/21');
  });

  it('keeps EXPIRED terminal and clears its request snapshot without navigating', async () => {
    vi.mocked(getMatchRequestByVoteAnswer).mockResolvedValue({
      matchRequestId: 90,
      status: 'EXPIRED',
      chatRoomId: null,
    });

    renderPage();
    await flushEffects();

    expect(screen.getByText('오늘의 매칭 요청이 만료되었어요.')).toBeVisible();
    expect(screen.getByTestId('current-path')).toHaveTextContent('/matching');
    expect(window.sessionStorage.getItem('mulo-match-request-v1')).toBeNull();
  });

  it('shows FAILED, retains its snapshot for restoration, and stops interval and visibility polling', async () => {
    vi.mocked(getMatchRequestByVoteAnswer).mockResolvedValue({
      matchRequestId: 90,
      status: 'WAITING',
      chatRoomId: null,
    });
    vi.mocked(getMatchRequestState).mockResolvedValue({
      matchRequestId: 90,
      status: 'FAILED',
      chatRoomId: null,
    });

    renderPage();
    await flushEffects();
    expect(screen.getByText('의견이 다른 상대를 찾고 있어요.')).toBeVisible();

    await act(async () => {
      vi.advanceTimersByTime(3_000);
      await Promise.resolve();
    });

    const failedMessage = '채팅방을 만드는 중 문제가 발생했어요. 매칭 상태를 다시 확인해 주세요.';
    expect(screen.getByText(failedMessage)).toBeVisible();
    expect(screen.getByTestId('current-path')).toHaveTextContent('/matching');
    expect(window.sessionStorage.getItem('mulo-match-request-v1')).toContain('"matchRequestId":90');
    expect(getMatchRequestState).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(9_000);
      fireEvent(window, new Event('focus'));
      fireEvent(document, new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(getMatchRequestState).toHaveBeenCalledTimes(1);
    expect(screen.getByText(failedMessage)).toBeVisible();
    expect(screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' })).toBeEnabled();
  });

  it('does not let an older in-flight response replace FAILED', async () => {
    vi.mocked(getMatchRequestByVoteAnswer).mockResolvedValue({
      matchRequestId: 90,
      status: 'WAITING',
      chatRoomId: null,
    });
    const olderResponse = deferred<{
      matchRequestId: number;
      status: 'WAITING';
      chatRoomId: null;
    }>();
    const terminalResponse = deferred<{
      matchRequestId: number;
      status: 'FAILED';
      chatRoomId: null;
    }>();
    vi.mocked(getMatchRequestState)
      .mockReturnValueOnce(olderResponse.promise)
      .mockReturnValueOnce(terminalResponse.promise);

    renderPage();
    await flushEffects();
    fireEvent(window, new Event('focus'));
    fireEvent(window, new Event('focus'));
    await flushEffects();
    expect(getMatchRequestState).toHaveBeenCalledTimes(2);

    await act(async () => {
      terminalResponse.resolve({ matchRequestId: 90, status: 'FAILED', chatRoomId: null });
      await terminalResponse.promise;
    });
    await act(async () => {
      olderResponse.resolve({ matchRequestId: 90, status: 'WAITING', chatRoomId: null });
      await olderResponse.promise;
    });

    expect(
      screen.getByText('채팅방을 만드는 중 문제가 발생했어요. 매칭 상태를 다시 확인해 주세요.'),
    ).toBeVisible();
    expect(screen.queryByText('의견이 다른 상대를 찾고 있어요.')).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem('mulo-match-request-v1')).toContain('"matchRequestId":90');
  });

  it('restores FAILED from the server by vote answer after remount without retrying', async () => {
    vi.mocked(getMatchRequestByVoteAnswer).mockResolvedValue({
      matchRequestId: 90,
      status: 'FAILED',
      chatRoomId: null,
    });

    const firstPage = renderPage();
    await flushEffects();
    expect(
      screen.getByText('채팅방을 만드는 중 문제가 발생했어요. 매칭 상태를 다시 확인해 주세요.'),
    ).toBeVisible();
    firstPage.unmount();

    renderPage();
    await flushEffects();

    expect(getMatchRequestByVoteAnswer).toHaveBeenCalledTimes(2);
    expect(getMatchRequestState).not.toHaveBeenCalled();
    expect(createMatchRequest).not.toHaveBeenCalled();
    expect(
      screen.getByText('채팅방을 만드는 중 문제가 발생했어요. 매칭 상태를 다시 확인해 주세요.'),
    ).toBeVisible();
    expect(window.sessionStorage.getItem('mulo-match-request-v1')).toContain('"userId":"35"');
  });

  it('shows polling network errors separately from the server FAILED state', async () => {
    vi.mocked(getMatchRequestByVoteAnswer).mockResolvedValue({
      matchRequestId: 90,
      status: 'WAITING',
      chatRoomId: null,
    });
    vi.mocked(getMatchRequestState).mockRejectedValue(
      new ApiError(503, '서버에 연결할 수 없습니다.', 'NETWORK_ERROR'),
    );

    renderPage();
    await flushEffects();
    await flushEffects();
    await act(async () => {
      vi.advanceTimersByTime(3_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole('alert')).toHaveTextContent('서버에 연결할 수 없습니다.');
    expect(screen.getByText('의견이 다른 상대를 찾고 있어요.')).toBeVisible();
    expect(
      screen.queryByText('채팅방을 만드는 중 문제가 발생했어요. 매칭 상태를 다시 확인해 주세요.'),
    ).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem('mulo-match-request-v1')).not.toBeNull();
  });
});
