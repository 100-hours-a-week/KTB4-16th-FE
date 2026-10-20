import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FriendToast } from './FriendToast';

afterEach(() => vi.useRealTimers());

describe('FriendToast', () => {
  it('4초 뒤 자동 닫힘을 요청한다', () => {
    vi.useFakeTimers();
    const dismiss = vi.fn();
    render(
      <FriendToast
        notice={{ id: 1, message: '친구 요청을 보냈어요.' }}
        onDismiss={dismiss}
        onViewFriends={vi.fn()}
      />,
    );
    act(() => vi.advanceTimersByTime(3_999));
    expect(dismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(dismiss).toHaveBeenCalledOnce();
  });

  it('안내에 포커스가 있는 동안 자동 닫힘을 멈춘다', () => {
    vi.useFakeTimers();
    const dismiss = vi.fn();
    render(
      <FriendToast
        notice={{ id: 1, message: '친구가 되었어요.', showFriends: true }}
        onDismiss={dismiss}
        onViewFriends={vi.fn()}
      />,
    );
    fireEvent.focus(screen.getByRole('button', { name: '친구 보기' }));
    act(() => vi.advanceTimersByTime(8_000));
    expect(dismiss).not.toHaveBeenCalled();
    fireEvent.blur(screen.getByRole('button', { name: '친구 보기' }));
    act(() => vi.advanceTimersByTime(4_000));
    expect(dismiss).toHaveBeenCalledOnce();
  });
});
