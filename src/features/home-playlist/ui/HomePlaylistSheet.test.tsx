import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createRecommendationPlaylist,
  getRecommendationPlaylist,
} from '../api/recommendationPlaylistApi';
import { HomePlaylistSheet } from './HomePlaylistSheet';

const mocks = vi.hoisted(() => ({ isAuthenticated: false, fetchAuthenticatedJson: vi.fn() }));
vi.mock('../../../entities/session/model/useSession', () => ({ useSession: () => ({ ...mocks }) }));
vi.mock('../api/recommendationPlaylistApi', () => ({
  getRecommendationPlaylist: vi.fn(),
  createRecommendationPlaylist: vi.fn(),
}));

/** 각 회차마다 서로 다른 외부 곡 ID를 가진 다섯 곡을 준비한다. */
function playlist(round: number) {
  return {
    recommendationPlaylistId: round,
    tracks: Array.from({ length: 5 }, (_, index) => ({
      musicTrackId: round * 10 + index,
      externalTrackId: `track-${round}-${index}`,
      title: `${round}회차 추천곡 ${index + 1}`,
      artistName: '추천 아티스트',
      albumImageUrl: 'https://i.scdn.co/image/example',
      externalUrl: `https://open.spotify.com/track/${round}-${index}`,
    })),
  };
}

/** 라우터를 포함한 실제 추천 화면을 렌더링한다. */
function renderSheet(props?: Partial<Parameters<typeof HomePlaylistSheet>[0]>) {
  return render(
    <MemoryRouter>
      <HomePlaylistSheet
        currentLocation={{ latitude: 37.5, longitude: 127.03 }}
        isOpen
        onClose={vi.fn()}
        onExited={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.isAuthenticated = true;
});

describe('HomePlaylistSheet session', () => {
  it('진입 시 이전 추천 조회와 자동 생성 없이 3회 안내를 표시한다', () => {
    renderSheet();
    expect(screen.getByText(/이 창에서 최대 3번/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '추천 받기' })).toBeEnabled();
    expect(getRecommendationPlaylist).not.toHaveBeenCalled();
    expect(createRecommendationPlaylist).not.toHaveBeenCalled();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('세 번 성공할 때까지 제외 ID를 누적하고 네 번째 요청을 막는다', async () => {
    const user = userEvent.setup();
    vi.mocked(createRecommendationPlaylist)
      .mockResolvedValueOnce(playlist(1))
      .mockResolvedValueOnce(playlist(2))
      .mockResolvedValueOnce(playlist(3));
    renderSheet();
    await user.click(screen.getByRole('button', { name: '추천 받기' }));
    expect(await screen.findByText('1회차 추천곡 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다시 추천받기 · 2회 남음' }));
    expect(await screen.findByText('2회차 추천곡 1')).toBeInTheDocument();
    expect(screen.queryByText('1회차 추천곡 1')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다시 추천받기 · 1회 남음' }));
    expect(await screen.findByText('3회차 추천곡 1')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: '추천 3회를 모두 받았어요' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(createRecommendationPlaylist).toHaveBeenCalledTimes(3);
    expect(vi.mocked(createRecommendationPlaylist).mock.calls.map(([request]) => request)).toEqual([
      { latitude: 37.5, longitude: 127.03, excludeTrackIds: [] },
      {
        latitude: 37.5,
        longitude: 127.03,
        excludeTrackIds: ['track-1-0', 'track-1-1', 'track-1-2', 'track-1-3', 'track-1-4'],
      },
      {
        latitude: 37.5,
        longitude: 127.03,
        excludeTrackIds: [
          'track-1-0',
          'track-1-1',
          'track-1-2',
          'track-1-3',
          'track-1-4',
          'track-2-0',
          'track-2-1',
          'track-2-2',
          'track-2-3',
          'track-2-4',
        ],
      },
    ]);
  });

  it('실패 후 이전 목록과 남은 횟수를 유지하고 같은 제외 목록으로 재시도한다', async () => {
    const user = userEvent.setup();
    vi.mocked(createRecommendationPlaylist)
      .mockResolvedValueOnce(playlist(1))
      .mockRejectedValueOnce(new Error('AI failure'))
      .mockResolvedValueOnce(playlist(2));
    renderSheet();
    await user.click(screen.getByRole('button', { name: '추천 받기' }));
    await user.click(await screen.findByRole('button', { name: '다시 추천받기 · 2회 남음' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('1회차 추천곡 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다시 시도 · 2회 남음' }));
    expect(await screen.findByRole('button', { name: '다시 추천받기 · 1회 남음' })).toBeEnabled();
    expect(vi.mocked(createRecommendationPlaylist).mock.calls[1][0]).toEqual(
      vi.mocked(createRecommendationPlaylist).mock.calls[2][0],
    );
  });

  it('요청 중 연타로 추가 요청을 보내지 않는다', () => {
    vi.mocked(createRecommendationPlaylist).mockReturnValue(new Promise(() => {}));
    renderSheet();
    const button = screen.getByRole('button', { name: '추천 받기' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(createRecommendationPlaylist).toHaveBeenCalledOnce();
  });

  it.each(['close', 'escape', 'backdrop'])(
    '요청 중 %s 닫기를 취소하면 요청을 유지하고 확인하면 취소한다',
    (method) => {
      vi.mocked(createRecommendationPlaylist).mockReturnValue(new Promise(() => {}));
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const onClose = vi.fn();
      renderSheet({ onClose });
      fireEvent.click(screen.getByRole('button', { name: '추천 받기' }));
      const signal = vi.mocked(createRecommendationPlaylist).mock.calls[0][2];
      /** 모든 닫기 경로가 같은 요청 확인을 거치는지 검증한다. */
      function close() {
        if (method === 'escape') fireEvent.keyDown(document, { key: 'Escape' });
        else
          fireEvent.click(
            screen.getByRole('button', {
              name: method === 'close' ? '플레이리스트 안내 닫기' : '플레이리스트 배경 닫기',
            }),
          );
      }
      close();
      expect(confirm).toHaveBeenCalledOnce();
      expect(onClose).not.toHaveBeenCalled();
      expect(signal?.aborted).toBe(false);
      confirm.mockReturnValue(true);
      close();
      expect(onClose).toHaveBeenCalledOnce();
      expect(signal?.aborted).toBe(true);
    },
  );

  it.each([
    { method: 'close', hasPlaylist: false },
    { method: 'backdrop', hasPlaylist: false },
    { method: 'escape', hasPlaylist: false },
    { method: 'close', hasPlaylist: true },
    { method: 'backdrop', hasPlaylist: true },
    { method: 'escape', hasPlaylist: true },
  ])(
    '요청이 없을 때도 $method 닫기를 확인한다 (추천 표시: $hasPlaylist)',
    async ({ method, hasPlaylist }) => {
      const user = userEvent.setup();
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
      const onClose = vi.fn();
      vi.mocked(createRecommendationPlaylist).mockResolvedValue(playlist(1));
      renderSheet({ onClose });
      if (hasPlaylist) {
        await user.click(screen.getByRole('button', { name: '추천 받기' }));
        await screen.findByText('1회차 추천곡 1');
      }
      /** 초기 안내·추천 완료 상태에서도 모든 종료 경로에 같은 의사 확인을 적용한다. */
      function close() {
        if (method === 'escape') fireEvent.keyDown(document, { key: 'Escape' });
        else
          fireEvent.click(
            screen.getByRole('button', {
              name: method === 'close' ? '플레이리스트 안내 닫기' : '플레이리스트 배경 닫기',
            }),
          );
      }
      close();
      expect(confirm).toHaveBeenCalledOnce();
      expect(onClose).not.toHaveBeenCalled();
      expect(
        screen.getByRole('button', {
          name: hasPlaylist ? '다시 추천받기 · 2회 남음' : '추천 받기',
        }),
      ).toBeEnabled();
      if (hasPlaylist) expect(screen.getByText('1회차 추천곡 1')).toBeInTheDocument();
      confirm.mockReturnValue(true);
      close();
      expect(onClose).toHaveBeenCalledOnce();
    },
  );

  it('닫은 뒤 도착한 이전 응답은 다시 열린 세션에 반영하지 않는다', async () => {
    let complete: (value: ReturnType<typeof playlist>) => void = () => {};
    vi.mocked(createRecommendationPlaylist).mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const first = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: '추천 받기' }));
    fireEvent.click(screen.getByRole('button', { name: '플레이리스트 안내 닫기' }));
    first.unmount();
    renderSheet();
    await act(async () => complete(playlist(1)));
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    vi.mocked(createRecommendationPlaylist).mockResolvedValueOnce(playlist(2));
    fireEvent.click(screen.getByRole('button', { name: '추천 받기' }));
    await screen.findByText('2회차 추천곡 1');
    expect(vi.mocked(createRecommendationPlaylist).mock.calls[1][0]).toMatchObject({
      excludeTrackIds: [],
    });
  });

  it('위치가 없으면 생성 버튼을 잠그고 위치 안내를 표시한다', () => {
    renderSheet({ currentLocation: null });
    expect(screen.getByRole('button', { name: '추천 받기' })).toBeDisabled();
    expect(screen.getByText(/현재 위치를 확인한 뒤/)).toBeInTheDocument();
  });

  it('비로그인 사용자는 로그인 링크만 제공한다', () => {
    mocks.isAuthenticated = false;
    renderSheet();
    expect(screen.getByRole('link', { name: '로그인하기' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: '추천 받기' })).not.toBeInTheDocument();
  });

  it('앨범 이미지 실패 시 대체 커버를 표시한다', async () => {
    vi.mocked(createRecommendationPlaylist).mockResolvedValue(playlist(1));
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: '추천 받기' }));
    fireEvent.error(await screen.findByRole('img', { name: '1회차 추천곡 1 앨범 커버' }));
    expect(screen.queryByRole('img', { name: '1회차 추천곡 1 앨범 커버' })).not.toBeInTheDocument();
    expect(document.querySelector('.home-playlist-cover')).toHaveAttribute('aria-hidden', 'true');
  });

  it('모달의 첫 요소와 마지막 요소 사이에서 키보드 초점을 순환한다', async () => {
    const user = userEvent.setup();
    renderSheet();
    const close = screen.getByRole('button', { name: '플레이리스트 안내 닫기' });
    const create = screen.getByRole('button', { name: '추천 받기' });
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(create).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    expect(screen.getByRole('dialog', { name: 'AI 추천 플레이리스트' })).toHaveAttribute(
      'aria-modal',
      'true',
    );
  });

  it('닫힘 transition이 끝나면 종료 함수를 호출한다', () => {
    const onExited = vi.fn();
    renderSheet({ isOpen: false, onExited });
    fireEvent.transitionEnd(screen.getByLabelText('AI 추천 플레이리스트'), {
      propertyName: 'transform',
    });
    expect(onExited).toHaveBeenCalledOnce();
  });
});
