import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SessionContext,
  type SessionContextValue,
} from '../../../entities/session/model/sessionContext';
import {
  createMemorySearchConversation,
  deleteMemorySearchConversation,
} from '../api/memorySearchConversationApi';
import { MemorySearchConversationProvider } from './MemorySearchConversationProvider';
import { saveMemorySearchSnapshot } from './memorySearchSnapshot';
import { useMemorySearchConversation } from './useMemorySearchConversation';

vi.mock('../api/memorySearchConversationApi', () => ({
  createMemorySearchConversation: vi.fn(),
  deleteMemorySearchConversation: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  vi.mocked(deleteMemorySearchConversation).mockResolvedValue(undefined);
});

/** 비동기 시작 요청의 완료 순서를 테스트가 통제할 수 있게 한다. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

/** 인증 모의값에 넣을 사용자별 JWT를 서명 검증 없이 만든다. */
function tokenForUser(sub: string, nonce: string): string {
  return `${btoa(JSON.stringify({ alg: 'none' }))}.${btoa(JSON.stringify({ sub, nonce }))}.signature`;
}

/** 대화 수명과 전체보기 상태를 사용자 동작으로 관찰한다. */
function ConversationProbe() {
  const navigate = useNavigate();
  const conversation = useMemorySearchConversation();

  return (
    <>
      <output data-testid="conversation-state">
        {conversation.status}:{conversation.conversationId ?? 'none'}:
        {String(conversation.isAllResultsOpen)}
      </output>
      <output data-testid="turn-count">{conversation.turns.length}</output>
      <output data-testid="recovery-query">{conversation.recoveryQuery}</output>
      <button
        type="button"
        onClick={() => void conversation.startConversation().catch(() => undefined)}
      >
        대화 시작
      </button>
      <button type="button" onClick={conversation.exitConversation}>
        대화 나가기
      </button>
      <button
        type="button"
        onClick={() => conversation.markConversationGone(conversation.conversationId ?? '')}
      >
        만료 알림
      </button>
      <button
        type="button"
        onClick={() => conversation.markConversationGone('expired-conversation')}
      >
        이전 대화의 만료 알림
      </button>
      <button type="button" onClick={() => conversation.setAllResultsOpen(true)}>
        전체보기
      </button>
      <button type="button" onClick={() => conversation.beginQuestion('가을 기억')}>
        질문 시작
      </button>
      <button type="button" onClick={() => conversation.pauseQuestion('old-conversation')}>
        이전 질문 대기 종료
      </button>
      <button type="button" onClick={() => conversation.abandonQuestion('old-conversation')}>
        이전 질문 실패
      </button>
      <button
        type="button"
        onClick={() =>
          conversation.completeQuestion(conversation.conversationId ?? '', '가을 기억', {
            answer: '찾았어요.',
            records: [],
            suggestedRecords: [],
          })
        }
      >
        질문 완료
      </button>
      <button type="button" onClick={() => navigate('/records/1')}>
        상세로
      </button>
    </>
  );
}

/** 실제 라우트 교체 시에도 같은 Provider가 유지되는지 관찰한다. */
function DetailProbe() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      상세 닫기
    </button>
  );
}

/** 인증 상태와 라우트 수명을 주입해 대화 Provider를 렌더링한다. */
function renderConversation(initialToken: string | null = 'token', strictMode = false) {
  const request = vi.fn() as SessionContextValue['fetchAuthenticatedJson'];
  const session: SessionContextValue = {
    accessToken: initialToken,
    sessionVersion: 0,
    getAccessToken: () => initialToken,
    refreshAccessToken: vi.fn(),
    isAuthenticated: initialToken !== null,
    isSessionRestoring: false,
    setAccessToken: vi.fn(),
    clearSession: vi.fn(),
    fetchAuthenticatedJson: request,
  };

  /** 인증 값만 바꾸어 같은 Provider 인스턴스의 로그아웃 동작을 검증한다. */
  const renderTree = (currentSession: SessionContextValue) => (
    <MemoryRouter initialEntries={['/memory-search']}>
      <SessionContext value={currentSession}>
        <MemorySearchConversationProvider>
          <Routes>
            <Route path="/memory-search" element={<ConversationProbe />} />
            <Route path="/records/:recordId" element={<DetailProbe />} />
          </Routes>
        </MemorySearchConversationProvider>
      </SessionContext>
    </MemoryRouter>
  );
  const view = render(
    strictMode ? <StrictMode>{renderTree(session)}</StrictMode> : renderTree(session),
  );

  return {
    ...view,
    request,
    updateToken(nextToken: string | null) {
      const nextTree = renderTree({
        ...session,
        accessToken: nextToken,
        isAuthenticated: nextToken !== null,
      });
      view.rerender(strictMode ? <StrictMode>{nextTree}</StrictMode> : nextTree);
    },
  };
}

describe('MemorySearchConversationProvider', () => {
  it.each(['이전 질문 대기 종료', '이전 질문 실패'])(
    '%s가 늦게 도착해도 새 계정의 진행 중 대화를 변경하지 않는다',
    async (action) => {
      const user = userEvent.setup();
      vi.mocked(createMemorySearchConversation)
        .mockResolvedValueOnce('old-conversation')
        .mockResolvedValueOnce('new-conversation');
      const { updateToken } = renderConversation(tokenForUser('35', 'first'));
      await user.click(screen.getByRole('button', { name: '대화 시작' }));
      await user.click(screen.getByRole('button', { name: '질문 시작' }));
      updateToken(tokenForUser('99', 'second'));
      await user.click(screen.getByRole('button', { name: '대화 시작' }));
      await user.click(screen.getByRole('button', { name: '질문 시작' }));

      await user.click(screen.getByRole('button', { name: action }));
      await user.click(screen.getByRole('button', { name: '질문 완료' }));
      expect(screen.getByTestId('conversation-state')).toHaveTextContent('active:new-conversation');
      expect(screen.getByTestId('turn-count')).toHaveTextContent('1');
      expect(deleteMemorySearchConversation).not.toHaveBeenCalled();
      expect(window.sessionStorage.getItem('mulo-memory-search-v1')).toContain('new-conversation');
    },
  );

  it('연속 시작 동작은 하나의 발급 요청을 공유한다', async () => {
    const user = userEvent.setup();
    const pending = deferred<string>();
    vi.mocked(createMemorySearchConversation).mockReturnValue(pending.promise);
    renderConversation();

    await user.click(screen.getByRole('button', { name: '대화 시작' }));
    await user.click(screen.getByRole('button', { name: '대화 시작' }));
    expect(createMemorySearchConversation).toHaveBeenCalledOnce();

    pending.resolve('conversation-1');
    expect(await screen.findByTestId('conversation-state')).toHaveTextContent(
      'active:conversation-1:false',
    );
  });

  it('상세 화면 왕복은 대화 ID와 전체보기 상태를 유지하고 종료 요청을 보내지 않는다', async () => {
    const user = userEvent.setup();
    vi.mocked(createMemorySearchConversation).mockResolvedValue('conversation-2');
    renderConversation();

    await user.click(screen.getByRole('button', { name: '대화 시작' }));
    expect(await screen.findByTestId('conversation-state')).toHaveTextContent(
      'active:conversation-2:false',
    );
    await user.click(screen.getByRole('button', { name: '전체보기' }));
    await user.click(screen.getByRole('button', { name: '상세로' }));
    await user.click(screen.getByRole('button', { name: '상세 닫기' }));

    expect(screen.getByTestId('conversation-state')).toHaveTextContent(
      'active:conversation-2:true',
    );
    expect(deleteMemorySearchConversation).not.toHaveBeenCalled();
  });

  it('명시적 나가기는 화면 상태를 즉시 지우고 기존 대화 ID를 종료한다', async () => {
    const user = userEvent.setup();
    vi.mocked(createMemorySearchConversation).mockResolvedValue('conversation-3');
    const { request } = renderConversation();

    await user.click(screen.getByRole('button', { name: '대화 시작' }));
    expect(await screen.findByTestId('conversation-state')).toHaveTextContent(
      'active:conversation-3',
    );
    await user.click(screen.getByRole('button', { name: '전체보기' }));
    await user.click(screen.getByRole('button', { name: '대화 나가기' }));

    expect(screen.getByTestId('conversation-state')).toHaveTextContent('idle:none:false');
    expect(deleteMemorySearchConversation).toHaveBeenCalledWith('conversation-3', request);
  });

  it('시작 도중 나간 뒤 늦게 도착한 ID는 폐기하고 서버 종료를 요청한다', async () => {
    const user = userEvent.setup();
    const pending = deferred<string>();
    vi.mocked(createMemorySearchConversation).mockReturnValue(pending.promise);
    const { request } = renderConversation();

    await user.click(screen.getByRole('button', { name: '대화 시작' }));
    await user.click(screen.getByRole('button', { name: '대화 나가기' }));
    pending.resolve('stale-conversation');

    expect(screen.getByTestId('conversation-state')).toHaveTextContent('idle:none:false');
    await waitFor(() =>
      expect(deleteMemorySearchConversation).toHaveBeenCalledWith('stale-conversation', request),
    );
  });

  it('410을 받은 대화는 만료 상태로 바뀌며 버튼 동작으로 새 ID를 발급받을 수 있다', async () => {
    const user = userEvent.setup();
    vi.mocked(createMemorySearchConversation)
      .mockResolvedValueOnce('expired-conversation')
      .mockResolvedValueOnce('new-conversation');
    renderConversation();

    await user.click(screen.getByRole('button', { name: '대화 시작' }));
    expect(await screen.findByTestId('conversation-state')).toHaveTextContent(
      'active:expired-conversation',
    );
    await user.click(screen.getByRole('button', { name: '만료 알림' }));
    expect(screen.getByTestId('conversation-state')).toHaveTextContent('gone:none:false');
    await user.click(screen.getByRole('button', { name: '대화 시작' }));
    expect(await screen.findByTestId('conversation-state')).toHaveTextContent(
      'active:new-conversation',
    );

    await user.click(screen.getByRole('button', { name: '이전 대화의 만료 알림' }));
    expect(screen.getByTestId('conversation-state')).toHaveTextContent('active:new-conversation');
  });

  it('같은 사용자의 새로고침은 완료된 대화 ID와 턴을 복원한다', async () => {
    const user = userEvent.setup();
    vi.mocked(createMemorySearchConversation).mockResolvedValue('conversation-4');
    const view = renderConversation(tokenForUser('35', 'first'));

    await user.click(screen.getByRole('button', { name: '대화 시작' }));
    expect(await screen.findByTestId('conversation-state')).toHaveTextContent(
      'active:conversation-4',
    );
    await user.click(screen.getByRole('button', { name: '질문 시작' }));
    await user.click(screen.getByRole('button', { name: '질문 완료' }));
    expect(screen.getByTestId('turn-count')).toHaveTextContent('1');
    view.unmount();
    renderConversation(tokenForUser('35', 'refreshed'));

    await waitFor(() =>
      expect(screen.getByTestId('conversation-state')).toHaveTextContent(
        'active:conversation-4:false',
      ),
    );
    expect(screen.getByTestId('turn-count')).toHaveTextContent('1');
    expect(createMemorySearchConversation).toHaveBeenCalledOnce();
    expect(deleteMemorySearchConversation).not.toHaveBeenCalled();
  });

  it('질문 처리 중 새로고침하면 이전 ID를 닫고 질문 문구만 복구한다', async () => {
    const user = userEvent.setup();
    vi.mocked(createMemorySearchConversation).mockResolvedValue('conversation-pending');
    const view = renderConversation(tokenForUser('35', 'first'));
    await user.click(screen.getByRole('button', { name: '대화 시작' }));
    await user.click(screen.getByRole('button', { name: '질문 시작' }));
    view.unmount();

    renderConversation(tokenForUser('35', 'refreshed'));
    await waitFor(() =>
      expect(screen.getByTestId('recovery-query')).toHaveTextContent('가을 기억'),
    );
    expect(screen.getByTestId('conversation-state')).toHaveTextContent('idle:none:false');
    expect(deleteMemorySearchConversation).toHaveBeenCalledWith(
      'conversation-pending',
      expect.any(Function),
    );
  });

  it('스냅샷 저장 실패 시 오래된 값을 지워 문맥이 어긋난 복원을 막는다', async () => {
    const user = userEvent.setup();
    vi.mocked(createMemorySearchConversation).mockResolvedValue('conversation-storage');
    renderConversation(tokenForUser('35', 'first'));
    window.sessionStorage.setItem('mulo-memory-search-v1', 'stale');
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    try {
      await user.click(screen.getByRole('button', { name: '대화 시작' }));
      await waitFor(() =>
        expect(screen.getByTestId('conversation-state')).toHaveTextContent(
          'active:conversation-storage',
        ),
      );
      expect(window.sessionStorage.getItem('mulo-memory-search-v1')).toBeNull();
    } finally {
      write.mockRestore();
    }
  });

  it('StrictMode의 효과 재실행에서도 저장된 대화를 한 번 복원한다', async () => {
    saveMemorySearchSnapshot('35', {
      conversationId: 'conversation-strict',
      turns: [],
      allResultsTurnIndex: null,
      suggestionsOpen: [],
      pendingQuery: null,
    });
    renderConversation(tokenForUser('35', 'first'), true);
    await waitFor(() =>
      expect(screen.getByTestId('conversation-state')).toHaveTextContent(
        'active:conversation-strict:false',
      ),
    );
    expect(createMemorySearchConversation).not.toHaveBeenCalled();
  });

  it('로그아웃 시 화면 대화 정보를 지우고 이전 시작 응답을 다시 사용하지 않는다', async () => {
    const user = userEvent.setup();
    const pending = deferred<string>();
    vi.mocked(createMemorySearchConversation).mockReturnValue(pending.promise);
    const { updateToken } = renderConversation();

    await user.click(screen.getByRole('button', { name: '대화 시작' }));
    expect(screen.getByTestId('conversation-state')).toHaveTextContent('starting:none:false');
    updateToken(null);
    expect(screen.getByTestId('conversation-state')).toHaveTextContent('idle:none:false');

    await act(async () => {
      pending.resolve('old-user-conversation');
      await pending.promise;
    });
    expect(screen.getByTestId('conversation-state')).toHaveTextContent('idle:none:false');
    expect(deleteMemorySearchConversation).not.toHaveBeenCalled();
  });

  it('인증 상태가 계속 참이어도 JWT sub가 다른 사용자로 바뀌면 화면 상태를 지운다', async () => {
    const user = userEvent.setup();
    vi.mocked(createMemorySearchConversation).mockResolvedValue('user-35-conversation');
    const { updateToken } = renderConversation(tokenForUser('35', 'first'));

    await user.click(screen.getByRole('button', { name: '대화 시작' }));
    expect(await screen.findByTestId('conversation-state')).toHaveTextContent(
      'active:user-35-conversation',
    );
    await user.click(screen.getByRole('button', { name: '전체보기' }));
    updateToken(tokenForUser('99', 'second'));

    expect(screen.getByTestId('conversation-state')).toHaveTextContent('idle:none:false');
    expect(deleteMemorySearchConversation).not.toHaveBeenCalled();
  });

  it('같은 JWT sub의 토큰만 갱신되면 대화 ID와 전체보기 상태를 유지한다', async () => {
    const user = userEvent.setup();
    vi.mocked(createMemorySearchConversation).mockResolvedValue('same-user-conversation');
    const { updateToken } = renderConversation(tokenForUser('35', 'first'));

    await user.click(screen.getByRole('button', { name: '대화 시작' }));
    expect(await screen.findByTestId('conversation-state')).toHaveTextContent(
      'active:same-user-conversation',
    );
    await user.click(screen.getByRole('button', { name: '전체보기' }));
    updateToken(tokenForUser('35', 'refreshed'));

    expect(screen.getByTestId('conversation-state')).toHaveTextContent(
      'active:same-user-conversation:true',
    );
    expect(deleteMemorySearchConversation).not.toHaveBeenCalled();
  });

  it('사용자를 알 수 없는 토큰이 다른 토큰으로 바뀌면 안전하게 대화를 지운다', async () => {
    const user = userEvent.setup();
    vi.mocked(createMemorySearchConversation).mockResolvedValue('unknown-user-conversation');
    const { updateToken } = renderConversation('malformed-token');

    await user.click(screen.getByRole('button', { name: '대화 시작' }));
    expect(await screen.findByTestId('conversation-state')).toHaveTextContent(
      'active:unknown-user-conversation',
    );
    updateToken('another-malformed-token');

    expect(screen.getByTestId('conversation-state')).toHaveTextContent('idle:none:false');
  });

  it('계정 전환 전에 보낸 시작 요청의 늦은 ID를 새 계정에 반영하거나 새 토큰으로 종료하지 않는다', async () => {
    const user = userEvent.setup();
    const pending = deferred<string>();
    vi.mocked(createMemorySearchConversation).mockReturnValue(pending.promise);
    const { updateToken } = renderConversation(tokenForUser('35', 'first'));

    await user.click(screen.getByRole('button', { name: '대화 시작' }));
    updateToken(tokenForUser('99', 'second'));
    expect(screen.getByTestId('conversation-state')).toHaveTextContent('idle:none:false');

    await act(async () => {
      pending.resolve('old-user-conversation');
      await pending.promise;
    });
    expect(screen.getByTestId('conversation-state')).toHaveTextContent('idle:none:false');
    expect(deleteMemorySearchConversation).not.toHaveBeenCalled();
  });
});
