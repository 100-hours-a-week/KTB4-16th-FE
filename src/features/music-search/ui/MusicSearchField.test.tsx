import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../../shared/api/apiError';
import { searchMusic } from '../api/musicSearchApi';
import { MusicSearchField } from './MusicSearchField';

vi.mock('../api/musicSearchApi', () => ({ searchMusic: vi.fn() }));

describe('MusicSearchField', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pending 중 버튼 submit과 Enter submit이 연속 진입해도 요청은 한 번만 실행한다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const pendingResolvers: Array<(results: Awaited<ReturnType<typeof searchMusic>>) => void> = [];
    vi.mocked(searchMusic).mockImplementation(
      () => new Promise((resolve) => pendingResolvers.push(resolve)),
    );
    render(<MusicSearchField onSelect={vi.fn()} request={vi.fn()} />);
    const input = screen.getByLabelText('음악 검색어');
    fireEvent.change(input, { target: { value: '밤편지' } });
    const form = input.closest('form');
    if (!form) throw new Error('검색 form을 찾을 수 없습니다.');
    const button = screen.getByRole('button', { name: '음악 검색' });

    act(() => {
      fireEvent.click(button);
      fireEvent.submit(form);
    });

    expect(searchMusic).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '검색 중…' })).toBeDisabled();
    await act(async () => {
      pendingResolvers[0]([]);
    });
    fireEvent.click(screen.getByRole('button', { name: '음악 검색' }));
    expect(searchMusic).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(400);
    fireEvent.click(screen.getByRole('button', { name: '음악 검색' }));
    expect(searchMusic).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(500);
    fireEvent.click(screen.getByRole('button', { name: '음악 검색' }));
    expect(searchMusic).toHaveBeenCalledTimes(2);
    await act(async () => {
      pendingResolvers[1]([]);
    });
  });

  it('첫 Enter 검색이 pending인 동안 연속 Enter는 무시한다', async () => {
    let resolveSearch: ((results: Awaited<ReturnType<typeof searchMusic>>) => void) | undefined;
    vi.mocked(searchMusic).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<MusicSearchField onSelect={vi.fn()} request={vi.fn()} />);
    const input = screen.getByLabelText('음악 검색어');
    await user.type(input, '밤편지');
    input.focus();

    await user.keyboard('{Enter}{Enter}');

    expect(searchMusic).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: '검색 중…' })).toBeDisabled();
    await act(async () => {
      resolveSearch?.([]);
    });
  });

  it('버튼 연타가 500ms를 넘어 이어져도 조용한 구간 전까지 막고 이후 재검색을 허용한다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.mocked(searchMusic).mockResolvedValue([]);
    render(<MusicSearchField onSelect={vi.fn()} request={vi.fn()} />);
    const input = screen.getByLabelText('음악 검색어');
    fireEvent.change(input, { target: { value: '블랙핑크' } });
    const form = input.closest('form');
    if (!form) throw new Error('검색 form을 찾을 수 없습니다.');
    const button = screen.getByRole('button', { name: '음악 검색' });

    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });
    expect(searchMusic).toHaveBeenCalledOnce();

    for (let repeat = 0; repeat < 3; repeat += 1) {
      await act(async () => {
        vi.advanceTimersByTime(400);
        fireEvent.click(button);
        await Promise.resolve();
      });
      expect(searchMusic).toHaveBeenCalledOnce();
    }

    await act(async () => {
      vi.advanceTimersByTime(500);
      fireEvent.click(button);
      await Promise.resolve();
    });
    expect(searchMusic).toHaveBeenCalledTimes(2);
  });

  it('Enter submit 연타는 요청 완료 사이에도 막고 query 변경은 즉시 검색한다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.mocked(searchMusic).mockResolvedValue([]);
    render(<MusicSearchField onSelect={vi.fn()} request={vi.fn()} />);
    const input = screen.getByLabelText('음악 검색어');
    fireEvent.change(input, { target: { value: '블랙핑크' } });
    const form = input.closest('form');
    if (!form) throw new Error('검색 form을 찾을 수 없습니다.');

    await act(async () => {
      fireEvent.submit(form);
      await Promise.resolve();
    });
    for (let repeat = 0; repeat < 3; repeat += 1) {
      await act(async () => {
        vi.advanceTimersByTime(400);
        fireEvent.submit(form);
        await Promise.resolve();
      });
      expect(searchMusic).toHaveBeenCalledOnce();
    }

    fireEvent.change(input, { target: { value: '아이유' } });
    await act(async () => {
      fireEvent.submit(form);
      await Promise.resolve();
    });
    expect(searchMusic).toHaveBeenCalledTimes(2);
  });

  it('키보드 Enter repeat 이벤트의 기본 submit을 막는다', async () => {
    vi.mocked(searchMusic).mockResolvedValue([]);
    render(<MusicSearchField onSelect={vi.fn()} request={vi.fn()} />);
    const input = screen.getByLabelText('음악 검색어');
    fireEvent.change(input, { target: { value: '블랙핑크' } });
    const repeatedEnter = new KeyboardEvent('keydown', {
      key: 'Enter',
      repeat: true,
      bubbles: true,
      cancelable: true,
    });

    input.dispatchEvent(repeatedEnter);

    expect(repeatedEnter.defaultPrevented).toBe(true);
    expect(searchMusic).not.toHaveBeenCalled();
  });

  it('실패 요청도 짧은 반복을 막고 guard가 지난 뒤 재시도할 수 있다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.mocked(searchMusic)
      .mockRejectedValueOnce(new Error('network failure'))
      .mockResolvedValueOnce([]);
    render(<MusicSearchField onSelect={vi.fn()} request={vi.fn()} />);
    const input = screen.getByLabelText('음악 검색어');
    fireEvent.change(input, { target: { value: '블랙핑크' } });
    const form = input.closest('form');
    if (!form) throw new Error('검색 form을 찾을 수 없습니다.');

    await act(async () => {
      fireEvent.submit(form);
      await Promise.resolve();
    });
    expect(searchMusic).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toHaveTextContent('음악을 불러오지 못했습니다');

    await act(async () => {
      fireEvent.submit(form);
      await Promise.resolve();
    });
    expect(searchMusic).toHaveBeenCalledOnce();

    await act(async () => {
      vi.advanceTimersByTime(500);
      fireEvent.submit(form);
      await Promise.resolve();
    });
    expect(searchMusic).toHaveBeenCalledTimes(2);
  });

  it('검색 실패 후에도 다음 검색을 실행할 수 있다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.mocked(searchMusic)
      .mockRejectedValueOnce(new Error('network failure'))
      .mockResolvedValueOnce([]);
    render(<MusicSearchField onSelect={vi.fn()} request={vi.fn()} />);
    const input = screen.getByLabelText('음악 검색어');
    fireEvent.change(input, { target: { value: '밤편지' } });
    const form = input.closest('form');
    if (!form) throw new Error('검색 form을 찾을 수 없습니다.');

    await act(async () => {
      fireEvent.submit(form);
      await Promise.resolve();
    });
    expect(screen.getByRole('alert')).toHaveTextContent('음악을 불러오지 못했습니다');

    fireEvent.submit(form);
    expect(searchMusic).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(500);
    await act(async () => {
      fireEvent.submit(form);
      await Promise.resolve();
    });
    expect(searchMusic).toHaveBeenCalledTimes(2);
    expect(screen.getByText('검색 결과가 없어요.')).toBeInTheDocument();
  });

  it('한 글자 검색어는 API를 요청하지 않고 입력 오류를 표시한다', async () => {
    const user = userEvent.setup();
    const request = vi.fn();
    render(<MusicSearchField onSelect={vi.fn()} request={request} />);

    await user.type(screen.getByLabelText('음악 검색어'), '밤');
    await user.click(screen.getByRole('button', { name: '음악 검색' }));

    expect(request).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('2자 이상');
  });

  it('빈 결과와 검색 제한 오류를 구분해 표시한다', async () => {
    const user = userEvent.setup();
    vi.mocked(searchMusic)
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new ApiError(429, 'too many', 'MUSIC_SEARCH_RATE_LIMITED'))
      .mockResolvedValueOnce([]);
    render(<MusicSearchField onSelect={vi.fn()} request={vi.fn()} />);

    await user.type(screen.getByLabelText('음악 검색어'), '밤편지');
    await user.click(screen.getByRole('button', { name: '음악 검색' }));
    expect(await screen.findByText('검색 결과가 없어요.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('음악 검색어'));
    await user.type(screen.getByLabelText('음악 검색어'), '아이유');
    await user.click(screen.getByRole('button', { name: '음악 검색' }));
    const rateLimitAlert = await screen.findByRole('alert');
    expect(rateLimitAlert).toHaveTextContent(
      '검색 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    );
    expect(rateLimitAlert).toHaveAttribute('aria-live', 'assertive');

    await user.clear(screen.getByLabelText('음악 검색어'));
    await user.type(screen.getByLabelText('음악 검색어'), '뉴진스');
    await user.click(screen.getByRole('button', { name: '음악 검색' }));
    expect(await screen.findByText('검색 결과가 없어요.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
