import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MusicPreviewButton } from './MusicPreviewButton';

const externalUrl = 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=test';

beforeEach(() => {
  // jsdom에는 native modal이 없어 열림·닫힘 상태와 최초 초점 이동을 재현한다.
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
      this.querySelector<HTMLButtonElement>('button')?.focus();
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    },
  });
});

describe('MusicPreviewButton', () => {
  it('opens the selected Spotify track only after a click and removes it on close', async () => {
    const user = userEvent.setup();
    render(<MusicPreviewButton title="테스트 곡" artistName="가수" externalUrl={externalUrl} />);
    expect(screen.queryByTitle('테스트 곡 Spotify 플레이어')).not.toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: '테스트 곡 미리듣기' });
    await user.click(trigger);
    expect(screen.getByTitle('테스트 곡 Spotify 플레이어')).toHaveAttribute(
      'src',
      'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC',
    );
    await user.click(screen.getByRole('button', { name: '미리듣기 닫기' }));
    expect(screen.queryByTitle('테스트 곡 Spotify 플레이어')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('consumes Escape so the underlying recommendation window stays open', async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    document.addEventListener('keydown', onKeyDown);
    try {
      render(<MusicPreviewButton title="곡" artistName="가수" externalUrl={externalUrl} />);
      await user.click(screen.getByRole('button', { name: '곡 미리듣기' }));
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(onKeyDown).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', onKeyDown);
    }
  });

  it('disables preview when no valid Spotify identifier exists', () => {
    render(
      <MusicPreviewButton
        title="곡"
        artistName="가수"
        externalUrl="https://evil.test/track/4uLU6hMCjMI75M1A2tKUQC"
      />,
    );
    expect(screen.getByRole('button', { name: '곡 미리듣기 제공 불가' })).toBeDisabled();
  });

  it('removes playback when the source screen is unmounted', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <MusicPreviewButton title="곡" artistName="가수" externalUrl={externalUrl} />,
    );
    await user.click(screen.getByRole('button', { name: '곡 미리듣기' }));
    unmount();
    expect(document.querySelector('iframe')).toBeNull();
  });
  it('keeps the recommendation scroll lock intact after closing the player', async () => {
    const user = userEvent.setup();
    document.body.style.overflow = 'hidden';
    try {
      render(<MusicPreviewButton title="곡" artistName="가수" externalUrl={externalUrl} />);
      await user.click(screen.getByRole('button', { name: '곡 미리듣기' }));
      await user.click(screen.getByRole('button', { name: '미리듣기 닫기' }));
      expect(document.body.style.overflow).toBe('hidden');
    } finally {
      document.body.style.overflow = '';
    }
  });
  it('closes the native modal before restoring focus to the background button', async () => {
    const user = userEvent.setup();
    render(<MusicPreviewButton title="곡" artistName="가수" externalUrl={externalUrl} />);
    const trigger = screen.getByRole('button', { name: '곡 미리듣기' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog');
    const onRestoreFocus = vi.fn(() => dialog.hasAttribute('open'));
    trigger.addEventListener('focus', onRestoreFocus);
    await user.click(screen.getByRole('button', { name: '미리듣기 닫기' }));
    expect(onRestoreFocus).toHaveReturnedWith(false);
  });
});
