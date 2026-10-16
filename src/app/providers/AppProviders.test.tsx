import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSession } from '../../entities/session/model/useSession';
import {
  createMemorySearchConversation,
  deleteMemorySearchConversation,
} from '../../features/memory-search/api/memorySearchConversationApi';
import { useMemorySearchConversation } from '../../features/memory-search/model/useMemorySearchConversation';
import { AppProviders } from './AppProviders';

vi.mock('../../features/memory-search/api/memorySearchConversationApi', () => ({
  createMemorySearchConversation: vi.fn(),
  deleteMemorySearchConversation: vi.fn(),
}));

beforeEach(() => {
  window.history.replaceState({}, '', '/memory-search');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
  vi.mocked(createMemorySearchConversation).mockResolvedValue('app-conversation');
  vi.mocked(deleteMemorySearchConversation).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

/** 실제 앱 Provider 경계 안에서 인증과 대화 상태를 조작한다. */
function SearchProbe() {
  const navigate = useNavigate();
  const { setAccessToken, clearSession } = useSession();
  const conversation = useMemorySearchConversation();

  return (
    <>
      <output>{`${conversation.status}:${conversation.conversationId ?? 'none'}:${String(conversation.isAllResultsOpen)}`}</output>
      <button type="button" onClick={() => setAccessToken('token')}>
        로그인
      </button>
      <button type="button" onClick={() => void conversation.startConversation()}>
        대화 시작
      </button>
      <button type="button" onClick={() => conversation.setAllResultsOpen(true)}>
        전체보기
      </button>
      <button type="button" onClick={() => navigate('/records/1')}>
        상세로
      </button>
      <button type="button" onClick={clearSession}>
        로그아웃
      </button>
    </>
  );
}

/** 상세 화면의 기존 뒤로가기 동작을 실제 BrowserRouter로 검사한다. */
function DetailProbe() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      상세 닫기
    </button>
  );
}

describe('AppProviders', () => {
  it('상세 왕복에는 대화가 남고 로그아웃에는 대화가 지워진다', async () => {
    const user = userEvent.setup();
    render(
      <AppProviders>
        <Routes>
          <Route path="/memory-search" element={<SearchProbe />} />
          <Route path="/records/:recordId" element={<DetailProbe />} />
        </Routes>
      </AppProviders>,
    );

    await user.click(screen.getByRole('button', { name: '로그인' }));
    await user.click(screen.getByRole('button', { name: '대화 시작' }));
    expect(await screen.findByText('active:app-conversation:false')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '전체보기' }));
    await user.click(screen.getByRole('button', { name: '상세로' }));
    await user.click(screen.getByRole('button', { name: '상세 닫기' }));
    expect(await screen.findByText('active:app-conversation:true')).toBeInTheDocument();
    expect(deleteMemorySearchConversation).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '로그아웃' }));
    await waitFor(() => expect(screen.getByText('idle:none:false')).toBeInTheDocument());
  });
});
