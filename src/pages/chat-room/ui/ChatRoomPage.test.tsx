import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ChatRoomPage } from './ChatRoomPage';

/** 채팅방 페이지를 지정된 route id와 서버 데이터 유무로 렌더링한다. */
function renderPage(path: string, pageProps: ComponentProps<typeof ChatRoomPage> = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/chat/:chatRoomId" element={<ChatRoomPage {...pageProps} />} />
        <Route path="/matching" element={<h1>취향 투표</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ChatRoomPage', () => {
  it.each(['0', '-3', '12.5', 'abc', '9223372036854775808'])(
    'shows an invalid-id explanation for %s',
    (chatRoomId) => {
      renderPage(`/chat/${chatRoomId}`);

      expect(screen.getByRole('alert')).toHaveTextContent('채팅방 주소를 확인');
    },
  );

  it.each(['1', '9223372036854775807'])('accepts positive signed 64-bit id %s', (chatRoomId) => {
    renderPage(`/chat/${chatRoomId}`);

    expect(screen.getByRole('heading', { name: '채팅방' })).toBeInTheDocument();
  });

  it('renders an invalid id explanation and a route back to matching', async () => {
    const user = userEvent.setup();
    renderPage('/chat/not-an-id');

    expect(screen.getByRole('alert')).toHaveTextContent('채팅방 주소를 확인');
    await user.click(screen.getByRole('link', { name: '취향 투표로 돌아가기' }));
    expect(await screen.findByRole('heading', { name: '취향 투표' })).toBeInTheDocument();
  });

  it('shows placeholders rather than inventing participant or expiration data', () => {
    renderPage('/chat/42');

    expect(screen.getByRole('heading', { name: '채팅방' })).toBeInTheDocument();
    expect(screen.getByText('상대방 정보는 연동 후 표시됩니다.')).toBeInTheDocument();
    expect(screen.getByText(/참여자 정보 대기 중/)).toBeInTheDocument();
    expect(screen.getByText(/종료 시간 대기 중/)).toBeInTheDocument();
    expect(screen.getByText('실시간 채팅 연동 준비 중')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '메시지' })).toBeDisabled();
  });

  it('renders only the header details supplied by the page data props', () => {
    renderPage('/chat/42', {
      roomInfo: {
        partnerNickname: '긴 닉네임 테스트',
        participantCount: 2,
        expiresAt: '2026-10-16T15:00:00Z',
      },
    });

    expect(screen.getByText('긴 닉네임 테스트')).toBeInTheDocument();
    expect(screen.getByText(/참여자 2명/)).toBeInTheDocument();
    expect(screen.getByText(/종료 2026년 10월 17일 오전 12:00/)).toBeInTheDocument();
  });

  it('keeps the leave action visibly unavailable and does not fake a room state change', async () => {
    const user = userEvent.setup();
    renderPage('/chat/42');

    await user.click(screen.getByRole('button', { name: '채팅방 메뉴' }));
    expect(screen.getByRole('menuitem', { name: '채팅방 나가기 (연동 준비 중)' })).toBeDisabled();
    expect(screen.queryByText('이미 퇴장한 채팅방입니다.')).not.toBeInTheDocument();
  });

  it('displays a supplied server state and delegates load retry without changing it locally', async () => {
    const onRetryLoad = vi.fn();
    const user = userEvent.setup();
    renderPage('/chat/42', { loadState: 'server-error', onRetryLoad });

    await user.click(screen.getByRole('button', { name: '다시 불러오기' }));
    expect(onRetryLoad).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toHaveTextContent('서버에 문제가 발생했어요.');
  });
});
