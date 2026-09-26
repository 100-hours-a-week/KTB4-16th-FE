import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../../shared/api/apiError';
import { searchMusic } from '../api/musicSearchApi';
import { MusicSearchField } from './MusicSearchField';

vi.mock('../api/musicSearchApi', () => ({ searchMusic: vi.fn() }));

describe('MusicSearchField', () => {
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
      .mockRejectedValueOnce(new ApiError(429, 'too many', 'MUSIC_SEARCH_RATE_LIMITED'));
    render(<MusicSearchField onSelect={vi.fn()} request={vi.fn()} />);

    await user.type(screen.getByLabelText('음악 검색어'), '밤편지');
    await user.click(screen.getByRole('button', { name: '음악 검색' }));
    expect(await screen.findByText('검색 결과가 없어요.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('음악 검색어'));
    await user.type(screen.getByLabelText('음악 검색어'), '아이유');
    await user.click(screen.getByRole('button', { name: '음악 검색' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('잠시 후 다시 검색해 주세요.');
  });
});
