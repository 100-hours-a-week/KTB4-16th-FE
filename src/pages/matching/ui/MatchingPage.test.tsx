import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSession } from '../../../entities/session/model/useSession';
import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import {
  getTodayPreferenceVote,
  submitPreferenceVote,
} from '../../../features/preference-vote/api/preferenceVoteApi';
import { MatchingPage } from './MatchingPage';
import { ApiError } from '../../../shared/api/apiError';

vi.mock('../../../shared/api/csrf', () => ({
  getCsrfToken: vi.fn().mockResolvedValue('test-csrf-token'),
}));
vi.mock('../../../entities/session/model/useSession', () => ({ useSession: vi.fn() }));
vi.mock('../../../features/preference-vote/api/preferenceVoteApi', () => ({
  getTodayPreferenceVote: vi.fn(),
  submitPreferenceVote: vi.fn(),
}));

const requestMock = vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>();
const fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'] = <T,>(
  path: string,
  init?: RequestInit,
) => requestMock(path, init).then((value) => value as T);

function CurrentPath() {
  return <p data-testid="current-path">{useLocation().pathname}</p>;
}

function renderPage() {
  return render(
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
    </MemoryRouter>,
  );
}

async function flushEffects() {
  await act(async () => {
    for (let index = 0; index < 6; index += 1) await Promise.resolve();
  });
}

const answeredVote = {
  voteQuestionId: 12,
  question: '오늘은 어떤 분위기가 좋아요?',
  optionA: '산책',
  optionB: '카페',
  myAnswer: '산책',
  voteAnswerId: 43,
  result: { optionAPercent: 67, optionBPercent: 33 },
};

beforeEach(() => {
  window.sessionStorage.clear();
  vi.clearAllMocks();
  requestMock.mockResolvedValue({
    message: '그룹 채팅방 입장 성공',
    data: {
      chatRoomId: 21,
      roomSequence: 1,
      newlyAssigned: true,
      admittedParticipantCount: 1,
      activeParticipantCount: 0,
      expiresAt: '2026-10-22T00:00:00+09:00',
    },
  });
  vi.mocked(useSession).mockReturnValue({
    accessToken: null,
    sessionVersion: 0,
    isAuthenticated: true,
    isSessionRestoring: false,
    setAccessToken: vi.fn(),
    clearSession: vi.fn(),
    fetchAuthenticatedJson,
    getAccessToken: () => null,
    refreshAccessToken: vi.fn(),
  });
  vi.mocked(getTodayPreferenceVote).mockResolvedValue(answeredVote);
});

afterEach(() => vi.clearAllMocks());

describe('MatchingPage', () => {
  it('loads the saved vote and results without calling any legacy matching endpoint', async () => {
    renderPage();
    await flushEffects();

    expect(getTodayPreferenceVote).toHaveBeenCalledOnce();
    expect(screen.getByRole('img', { name: '투표 결과: A 67%, B 33%' })).toBeVisible();
    expect(screen.getByRole('button', { name: '투표 완료' })).toBeDisabled();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('submits the selected answer and retains its returned voteAnswerId and result', async () => {
    vi.mocked(getTodayPreferenceVote).mockResolvedValue({
      ...answeredVote,
      myAnswer: null,
      voteAnswerId: null,
      result: undefined,
    });
    vi.mocked(submitPreferenceVote).mockResolvedValue({
      voteAnswerId: 44,
      myAnswer: '카페',
      optionAPercent: 40,
      optionBPercent: 60,
    });
    renderPage();
    await flushEffects();

    fireEvent.click(screen.getByRole('button', { name: 'B 카페' }));
    fireEvent.click(screen.getByRole('button', { name: '투표하기' }));
    await flushEffects();

    expect(submitPreferenceVote).toHaveBeenCalledWith(fetchAuthenticatedJson, 12, 'B');
    expect(screen.getByRole('img', { name: '투표 결과: A 40%, B 60%' })).toBeVisible();
    expect(screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' })).toBeEnabled();
  });

  it('joins the GROUP room only after the user clicks and navigates to its server room id', async () => {
    renderPage();
    await flushEffects();

    expect(requestMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' }));
    await flushEffects();

    expect(requestMock).toHaveBeenCalledOnce();
    expect(requestMock).toHaveBeenCalledWith(
      '/group-chat-rooms/join',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ voteAnswerId: 43 }) }),
    );
    expect(requestMock.mock.calls.map(([path]) => path)).not.toContain('/match-requests');
    expect(screen.getByTestId('current-path')).toHaveTextContent('/chat/21');
  });

  it('does not request group entry before a vote answer exists', async () => {
    vi.mocked(getTodayPreferenceVote).mockResolvedValue({
      ...answeredVote,
      myAnswer: null,
      voteAnswerId: null,
      result: undefined,
    });
    renderPage();
    await flushEffects();

    expect(screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' })).toBeDisabled();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('prevents duplicate GROUP join requests while the first request is pending', async () => {
    let resolveJoin!: (value: unknown) => void;
    requestMock.mockReturnValue(new Promise((resolve) => (resolveJoin = resolve)));
    renderPage();
    await flushEffects();

    const joinButton = screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' });
    fireEvent.click(joinButton);
    fireEvent.click(joinButton);
    await flushEffects();

    expect(requestMock).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: '그룹 채팅 입장 중...' })).toBeDisabled();
    await act(async () => {
      resolveJoin({
        message: '그룹 채팅방 입장 성공',
        data: {
          chatRoomId: 21,
          roomSequence: 1,
          newlyAssigned: false,
          admittedParticipantCount: 2,
          activeParticipantCount: 1,
          expiresAt: '2026-10-22T00:00:00+09:00',
        },
      });
    });
    expect(screen.getByTestId('current-path')).toHaveTextContent('/chat/21');
  });

  it('shows GROUP join errors and retries the group endpoint without a legacy fallback', async () => {
    requestMock.mockRejectedValueOnce(new ApiError(401, 'unauthorized', 'UNAUTHORIZED'));
    renderPage();
    await flushEffects();

    fireEvent.click(screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' }));
    await flushEffects();
    expect(screen.getByRole('alert')).toHaveTextContent('로그인이 만료되었어요');

    requestMock.mockResolvedValueOnce({
      message: '그룹 채팅방 입장 성공',
      data: {
        chatRoomId: 22,
        roomSequence: 2,
        newlyAssigned: false,
        admittedParticipantCount: 4,
        activeParticipantCount: 2,
        expiresAt: '2026-10-22T00:00:00+09:00',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await flushEffects();

    expect(requestMock).toHaveBeenCalledTimes(2);
    expect(requestMock.mock.calls.every(([path]) => path === '/group-chat-rooms/join')).toBe(true);
    expect(screen.getByTestId('current-path')).toHaveTextContent('/chat/22');
  });

  it('keeps the server-side GROUP re-entry restriction', async () => {
    requestMock.mockRejectedValueOnce(
      new ApiError(403, '오늘은 다시 입장할 수 없습니다.', 'GROUP_CHAT_REENTRY_FORBIDDEN'),
    );
    renderPage();
    await flushEffects();

    fireEvent.click(screen.getByRole('button', { name: '의견 다른 사람과 채팅하기' }));
    await flushEffects();

    expect(screen.getByRole('alert')).toHaveTextContent(
      '이미 퇴장한 그룹 채팅방에는 다시 입장할 수 없어요.',
    );
    expect(screen.getByTestId('current-path')).toHaveTextContent('/matching');
  });
});
