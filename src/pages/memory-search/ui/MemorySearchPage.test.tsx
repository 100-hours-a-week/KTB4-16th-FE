import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SessionContext,
  type SessionContextValue,
} from '../../../entities/session/model/sessionContext';
import { getMemoryRecordCount } from '../../../features/memory-search/api/getMemoryRecordCount';
import {
  createMemorySearchConversation,
  deleteMemorySearchConversation,
} from '../../../features/memory-search/api/memorySearchConversationApi';
import { searchMemory } from '../../../features/memory-search/api/memorySearchQueryApi';
import { MemorySearchConversationProvider } from '../../../features/memory-search/model/MemorySearchConversationProvider';
import { ApiError } from '../../../shared/api/apiError';
import { MemorySearchPage } from './MemorySearchPage';

vi.mock('../../../features/memory-search/api/getMemoryRecordCount', () => ({
  getMemoryRecordCount: vi.fn(),
}));
vi.mock('../../../features/memory-search/api/memorySearchConversationApi', () => ({
  createMemorySearchConversation: vi.fn(),
  deleteMemorySearchConversation: vi.fn(),
}));
vi.mock('../../../features/memory-search/api/memorySearchQueryApi', () => ({
  searchMemory: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  vi.mocked(createMemorySearchConversation).mockResolvedValue('conversation-1');
  vi.mocked(deleteMemorySearchConversation).mockResolvedValue(undefined);
  vi.mocked(getMemoryRecordCount).mockResolvedValue(8);
});

/** UI 시나리오에서 상세 왕복을 실제 라우터 상태로 검증한다. */
function DetailProbe() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      상세 닫기
    </button>
  );
}

/** 인증된 화면과 상위 대화 Provider를 실제 구조처럼 렌더링한다. */
function renderPage(initialPath = '/memory-search') {
  const session: SessionContextValue = {
    accessToken: 'token',
    sessionVersion: 0,
    getAccessToken: () => 'token',
    refreshAccessToken: vi.fn(),
    isAuthenticated: true,
    isSessionRestoring: false,
    setAccessToken: vi.fn(),
    clearSession: vi.fn(),
    fetchAuthenticatedJson: vi.fn(),
  };
  /** 계정이 전환돼도 동일 Provider와 화면 인스턴스를 유지한다. */
  const renderTree = (currentSession: SessionContextValue) => (
    <MemoryRouter initialEntries={[initialPath]}>
      <SessionContext value={currentSession}>
        <MemorySearchConversationProvider>
          <Routes>
            <Route path="/memory-search" element={<MemorySearchPage />} />
            <Route path="/records/:recordId" element={<DetailProbe />} />
            <Route path="/locks/create" element={<div>자물쇠 작성 화면</div>} />
            <Route path="/" element={<div>홈</div>} />
          </Routes>
        </MemorySearchConversationProvider>
      </SessionContext>
    </MemoryRouter>
  );
  const view = render(renderTree(session));
  return {
    ...view,
    updateToken(accessToken: string) {
      view.rerender(renderTree({ ...session, accessToken }));
    },
  };
}

/** 관련도 순서를 확인할 수 있는 공개 카드 fixture를 만든다. */
function card(id: number) {
  return {
    recordId: id,
    musicTrackId: id,
    title: `노래${id}`,
    artistName: '가수',
    placeId: id,
    placeName: null,
    date: '2026.10.15',
    weatherCondition: null,
    albumImageUrl: '',
  };
}

describe('MemorySearchPage', () => {
  it('넓은 화면 메뉴의 홈 링크로 기억 검색을 나갈 수 있다', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: '기억 검색 질문' })).toBeEnabled(),
    );

    const menu = screen.getByRole('navigation', { name: '주요 메뉴' });
    await user.click(within(menu).getByRole('link', { name: '홈' }));

    expect(screen.getByText('홈')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '기억 검색 질문' })).not.toBeInTheDocument();
  });

  it.each([
    { readingHistory: false, expectedTop: 900 },
    { readingHistory: true, expectedTop: 0 },
  ])(
    '새 질문은 하단으로 이동하고 답변 도착 시 과거 읽기=$readingHistory 위치를 존중한다',
    async ({ readingHistory, expectedTop }) => {
      let resolveSearch!: (result: Awaited<ReturnType<typeof searchMemory>>) => void;
      vi.mocked(searchMemory).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSearch = resolve;
          }),
      );
      const user = userEvent.setup();
      renderPage();
      const input = screen.getByRole('textbox', { name: '기억 검색 질문' });
      await waitFor(() => expect(input).toBeEnabled());
      const viewport = screen.getByRole('region', { name: '기억 검색 대화' });
      let contentHeight = 1_000;
      // JSDOM에는 레이아웃이 없으므로 실제 스크롤 영역의 높이만 고정한다.
      Object.defineProperties(viewport, {
        clientHeight: { configurable: true, value: 300 },
        scrollHeight: { configurable: true, get: () => contentHeight },
      });
      viewport.scrollTop = 0;
      fireEvent.scroll(viewport);
      await user.type(input, '가을에 공원에서 들었던 노래');
      await user.click(screen.getByRole('button', { name: '질문 보내기' }));
      await waitFor(() => expect(viewport.scrollTop).toBe(700));

      viewport.scrollTop = readingHistory ? 0 : 700;
      fireEvent.scroll(viewport);
      contentHeight = 1_200;
      await act(async () => {
        resolveSearch({
          answer: '가을 기억을 찾아봤어요.',
          records: [card(1)],
          suggestedRecords: [],
        });
      });
      await waitFor(() => expect(viewport.scrollTop).toBe(expectedTop));

      if (readingHistory) {
        await user.click(await screen.findByRole('button', { name: '새 답변 보기' }));
        expect(viewport.scrollTop).toBe(900);
        expect(screen.getByRole('group', { name: '최근 검색 결과' })).toHaveFocus();
      }
      expect(screen.queryByRole('button', { name: '새 답변 보기' })).not.toBeInTheDocument();
    },
  );

  it('입장 확인 중에는 입력을 막고 보유 여부를 확인한 뒤 첫 인사로 전환한다', async () => {
    let resolveCount!: (count: number) => void;
    vi.mocked(getMemoryRecordCount).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCount = resolve;
        }),
    );
    renderPage();

    expect(screen.getByRole('status', { name: '자물쇠 확인 중' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '기억 검색 질문' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '채팅 나가기' })).toBeInTheDocument();
    expect(createMemorySearchConversation).not.toHaveBeenCalled();

    await act(async () => {
      resolveCount(8);
    });
    expect(
      await screen.findByRole('heading', { name: /어떤 기억을 찾고 싶으세요/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: '자물쇠 확인 중' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '기억 검색 질문' })).toBeEnabled();
  });

  it('요청 중인 질문과 응답 대기 상태를 표시하고 완료 후에는 결과로 교체한다', async () => {
    let resolveSearch!: (result: Awaited<ReturnType<typeof searchMemory>>) => void;
    vi.mocked(searchMemory).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve;
        }),
    );
    const user = userEvent.setup();
    renderPage();
    const input = screen.getByRole('textbox', { name: '기억 검색 질문' });
    await waitFor(() => expect(input).toBeEnabled());
    await user.type(input, '비 오는 날 공원에서 들었던 노래');
    await user.click(screen.getByRole('button', { name: '질문 보내기' }));

    expect(screen.getByText('비 오는 날 공원에서 들었던 노래')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'AI 응답 대기 중' })).toBeInTheDocument();
    expect(input).toBeDisabled();
    expect(screen.getByRole('button', { name: '질문 보내기' })).toBeDisabled();

    await act(async () => {
      resolveSearch({ answer: '기억을 살펴봤어요.', records: [card(1)], suggestedRecords: [] });
    });
    expect(await screen.findByText('기억을 살펴봤어요.')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'AI 응답 대기 중' })).not.toBeInTheDocument();
    expect(screen.getAllByText('비 오는 날 공원에서 들었던 노래')).toHaveLength(1);
    expect(input).toBeEnabled();
  });

  it('계정 전환 전의 성공 응답이 새 계정의 작성 중 질문을 지우지 않는다', async () => {
    let resolveOldRequest!: (result: Awaited<ReturnType<typeof searchMemory>>) => void;
    vi.mocked(searchMemory).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveOldRequest = resolve;
        }),
    );
    const user = userEvent.setup();
    const { updateToken } = renderPage();
    const input = screen.getByRole('textbox', { name: '기억 검색 질문' });
    await waitFor(() => expect(input).toBeEnabled());
    await user.type(input, '이전 계정 질문');
    await user.click(screen.getByRole('button', { name: '질문 보내기' }));
    vi.mocked(createMemorySearchConversation).mockResolvedValue('new-conversation');
    updateToken('another-account-token');
    await waitFor(() => expect(input).toBeEnabled());
    await user.clear(input);
    await user.type(input, '새 계정 질문');

    await act(async () => {
      resolveOldRequest({ answer: '이전 응답', records: [], suggestedRecords: [] });
    });
    expect(input).toHaveValue('새 계정 질문');
    expect(screen.queryByText('이전 응답')).not.toBeInTheDocument();
  });

  it('계정 전환 후 이전 요청의 409는 새 인증으로 재시도하지 않는다', async () => {
    let rejectOldRequest!: (error: Error) => void;
    vi.mocked(searchMemory).mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectOldRequest = reject;
        }),
    );
    vi.mocked(createMemorySearchConversation)
      .mockResolvedValueOnce('old-conversation')
      .mockResolvedValueOnce('new-conversation');
    const user = userEvent.setup();
    const { updateToken } = renderPage();
    const input = screen.getByRole('textbox', { name: '기억 검색 질문' });
    await waitFor(() => expect(input).toBeEnabled());
    await user.type(input, '가을');
    await user.click(screen.getByRole('button', { name: '질문 보내기' }));
    updateToken('another-account-token');
    await waitFor(() => expect(input).toBeEnabled());

    await act(async () => {
      rejectOldRequest(new ApiError(409, '처리 중', 'MEMORY_SEARCH_IN_PROGRESS'));
      await new Promise((resolve) => setTimeout(resolve, 1_100));
    });
    expect(searchMemory).toHaveBeenCalledTimes(1);
    expect(input).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /어떤 기억을 찾고 싶으세요/ })).toBeInTheDocument();
  });

  it('첫 인사의 예시는 입력만 채우고 전송 후에는 첫 안내를 숨긴다', async () => {
    vi.mocked(searchMemory).mockResolvedValue({
      answer: '가을 기억을 살펴봤어요.',
      records: [card(1)],
      suggestedRecords: [],
    });
    const user = userEvent.setup();
    renderPage();

    const example = await screen.findByRole('button', {
      name: '가을에 공원에서 들었던 노래',
    });
    const input = screen.getByRole('textbox', { name: '기억 검색 질문' });
    await user.click(example);
    expect(input).toHaveValue('가을에 공원에서 들었던 노래');
    expect(input).toHaveFocus();
    expect(searchMemory).not.toHaveBeenCalled();

    await user.type(input, ' 찾아줘');
    await user.click(screen.getByRole('button', { name: '질문 보내기' }));
    expect(await screen.findByText('가을 기억을 살펴봤어요.')).toBeInTheDocument();
    expect(screen.getByText('가을에 공원에서 들었던 노래 찾아줘')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '가을에 공원에서 들었던 노래' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /어떤 기억을 찾고 싶으세요/ }),
    ).not.toBeInTheDocument();
  });

  it('0개 보유자는 입력을 차단하고 첫 자물쇠 작성 화면으로 안내한다', async () => {
    vi.mocked(getMemoryRecordCount).mockResolvedValue(0);
    const user = userEvent.setup();
    renderPage();
    expect(
      await screen.findByRole('heading', { name: '아직 남겨 둔 자물쇠가 없어요' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '기억 검색 질문' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '질문 보내기' })).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: '가을에 공원에서 들었던 노래' }),
    ).not.toBeInTheDocument();
    expect(createMemorySearchConversation).not.toHaveBeenCalled();
    await user.click(screen.getByRole('link', { name: '첫 자물쇠 만들기' }));
    expect(screen.getByText('자물쇠 작성 화면')).toBeInTheDocument();
  });

  it('앞 5건과 전체보기 6건을 순서대로 표시하고 상세에서 시트로 돌아온다', async () => {
    vi.mocked(searchMemory).mockResolvedValue({
      answer: '가을 기억을 살펴봤어요.',
      records: Array.from({ length: 6 }, (_, index) => card(index + 1)),
      suggestedRecords: [],
    });
    const user = userEvent.setup();
    renderPage();
    const input = await screen.findByRole('textbox', { name: '기억 검색 질문' });
    await waitFor(() => expect(input).toBeEnabled());
    await user.type(input, '가을 기억');
    await user.click(screen.getByRole('button', { name: '질문 보내기' }));

    expect(await screen.findByText('가을 기억을 살펴봤어요.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '노래6 상세보기' })).not.toBeInTheDocument();
    const opener = screen.getByRole('button', { name: '전체보기 (6건)' });
    await user.click(opener);
    const sheet = screen.getByRole('dialog', { name: '전체보기' });
    expect(screen.getByRole('navigation', { name: '주요 메뉴' }).parentElement).toHaveAttribute(
      'inert',
    );
    expect(within(sheet).getAllByRole('button', { name: /상세보기/ })).toHaveLength(6);
    const close = within(sheet).getByRole('button', { name: '전체보기 닫기' });
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(sheet).getByRole('button', { name: '노래6 상세보기' })).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab();
    expect(within(sheet).getByRole('button', { name: '노래1 상세보기' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: '전체보기' })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();

    await user.click(opener);
    const reopenedSheet = screen.getByRole('dialog', { name: '전체보기' });
    await user.click(within(reopenedSheet).getByRole('button', { name: '노래6 상세보기' }));
    await user.click(screen.getByRole('button', { name: '상세 닫기' }));
    expect(screen.getByRole('dialog', { name: '전체보기' })).toBeInTheDocument();
    expect(deleteMemorySearchConversation).not.toHaveBeenCalled();
  });

  it('정확 일치가 0건이고 제안만 있으면 토글 뒤에만 제안을 표시한다', async () => {
    vi.mocked(searchMemory).mockResolvedValue({
      answer: '일부 조건에 맞는 기억이 있어요.',
      records: [],
      suggestedRecords: [{ ...card(7), matchedConditions: ['가을'] }],
    });
    const user = userEvent.setup();
    renderPage();
    const input = await screen.findByRole('textbox', { name: '기억 검색 질문' });
    await waitFor(() => expect(input).toBeEnabled());
    await user.type(input, '가을');
    await user.click(screen.getByRole('button', { name: '질문 보내기' }));
    expect(await screen.findByText('일부 조건에 맞는 기억이 있어요.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '노래7 상세보기' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '제안 보기 (1건)' }));
    expect(screen.getByRole('button', { name: '노래7 상세보기' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /전체보기/ })).not.toBeInTheDocument();
    await waitFor(() => expect(searchMemory).toHaveBeenCalledOnce());
  });

  it('만료된 대화는 새 대화 안내를 표시하고 버튼을 눌렀을 때만 새 ID를 발급한다', async () => {
    vi.mocked(searchMemory).mockRejectedValue(
      new ApiError(410, '대화 만료', 'MEMORY_SEARCH_CONVERSATION_GONE'),
    );
    const user = userEvent.setup();
    renderPage();
    const input = screen.getByRole('textbox', { name: '기억 검색 질문' });
    await waitFor(() => expect(input).toBeEnabled());
    await user.type(input, '가을');
    await user.click(screen.getByRole('button', { name: '질문 보내기' }));
    expect(
      await screen.findByRole('heading', { name: '새 대화를 시작해 주세요' }),
    ).toBeInTheDocument();
    expect(input).toBeDisabled();
    expect(createMemorySearchConversation).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: '새 대화 시작' }));
    await waitFor(() => expect(createMemorySearchConversation).toHaveBeenCalledTimes(2));
    expect(input).toBeEnabled();
  });

  it('정확히 5건이면 전체보기 버튼을 표시하지 않는다', async () => {
    vi.mocked(searchMemory).mockResolvedValue({
      answer: '찾았어요.',
      records: Array.from({ length: 5 }, (_, index) => card(index + 1)),
      suggestedRecords: [],
    });
    const user = userEvent.setup();
    renderPage();
    const input = screen.getByRole('textbox', { name: '기억 검색 질문' });
    await waitFor(() => expect(input).toBeEnabled());
    await user.type(input, '가을');
    await user.click(screen.getByRole('button', { name: '질문 보내기' }));
    expect(await screen.findByText('찾았어요.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /상세보기/ })).toHaveLength(5);
    expect(screen.queryByRole('button', { name: /전체보기/ })).not.toBeInTheDocument();
  });

  it('응답 확인이 불명확한 502는 기존 ID를 닫고 새 대화에서 수동 재질문하게 한다', async () => {
    vi.mocked(createMemorySearchConversation)
      .mockResolvedValueOnce('conversation-old')
      .mockResolvedValueOnce('conversation-new');
    vi.mocked(searchMemory).mockRejectedValue(new ApiError(502, 'AI 실패', 'AI_SERVICE_ERROR'));
    const user = userEvent.setup();
    renderPage();
    const input = screen.getByRole('textbox', { name: '기억 검색 질문' });
    await waitFor(() => expect(input).toBeEnabled());
    await user.type(input, '가을');
    await user.click(screen.getByRole('button', { name: '질문 보내기' }));
    expect(
      await screen.findByText(/응답을 확인하지 못해 새 대화를 시작합니다/),
    ).toBeInTheDocument();
    await waitFor(() => expect(createMemorySearchConversation).toHaveBeenCalledTimes(2));
    expect(deleteMemorySearchConversation).toHaveBeenCalledWith(
      'conversation-old',
      expect.any(Function),
    );
    expect(input).toHaveValue('가을');
    expect(searchMemory).toHaveBeenCalledOnce();
  });
});
