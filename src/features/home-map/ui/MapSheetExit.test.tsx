import { act, fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MyLocksSheet } from './MyLocksSheet';
import { PopularTracksSheet } from './PopularTracksSheet';

/** 실제 두 목록의 닫힘 계약을 같은 입력으로 검증한다. */
function sheet(kind: 'mine' | 'popular', isOpen: boolean, onExited: () => void) {
  const common = { isOpen, onExited, placeCount: 1, onClose: vi.fn(), loadState: 'empty' as const };
  return (
    <MemoryRouter>
      {kind === 'mine' ? (
        <MyLocksSheet
          {...common}
          records={[]}
          hasNextPage={false}
          isLoadingNextPage={false}
          onLoadNextPage={vi.fn()}
        />
      ) : (
        <PopularTracksSheet {...common} result={null} onRetry={vi.fn()} />
      )}
    </MemoryRouter>
  );
}

afterEach(() => vi.useRealTimers());

describe.each(['mine', 'popular'] as const)('%s map sheet exit', (kind) => {
  it('completes closing when transform transitionend never arrives', () => {
    vi.useFakeTimers();
    const onExited = vi.fn();
    const view = render(sheet(kind, true, onExited));
    view.rerender(sheet(kind, false, onExited));

    act(() => vi.advanceTimersByTime(400));

    expect(onExited).toHaveBeenCalledOnce();
  });

  it('cancels the previous close when reopened and uses the latest completion callback', () => {
    vi.useFakeTimers();
    const firstExited = vi.fn();
    const latestExited = vi.fn();
    const view = render(sheet(kind, true, firstExited));
    view.rerender(sheet(kind, false, firstExited));
    act(() => vi.advanceTimersByTime(100));
    view.rerender(sheet(kind, true, latestExited));
    act(() => vi.advanceTimersByTime(400));
    expect(firstExited).not.toHaveBeenCalled();
    expect(latestExited).not.toHaveBeenCalled();

    view.rerender(sheet(kind, false, firstExited));
    act(() => vi.advanceTimersByTime(100));
    view.rerender(sheet(kind, false, latestExited));
    act(() => vi.advanceTimersByTime(300));
    expect(firstExited).not.toHaveBeenCalled();
    expect(latestExited).toHaveBeenCalledOnce();
  });

  it('completes once when both transitionend and the fallback arrive', () => {
    vi.useFakeTimers();
    const onExited = vi.fn();
    const view = render(sheet(kind, true, onExited));
    view.rerender(sheet(kind, false, onExited));
    const event = new Event('transitionend', { bubbles: true });
    Object.defineProperty(event, 'propertyName', { value: 'transform' });
    fireEvent(view.container.querySelector('section')!, event);
    expect(onExited).toHaveBeenCalledOnce();

    act(() => vi.advanceTimersByTime(400));
    fireEvent(view.container.querySelector('section')!, event);
    expect(onExited).toHaveBeenCalledOnce();
  });
});
