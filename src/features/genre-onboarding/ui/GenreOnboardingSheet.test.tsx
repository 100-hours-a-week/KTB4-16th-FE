import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { updatePreferredGenres } from '../api/genreOnboardingApi';
import { GenreOnboardingSheet } from './GenreOnboardingSheet';

vi.mock('../api/genreOnboardingApi', () => ({ updatePreferredGenres: vi.fn() }));

const genresRequest = vi.fn() as AuthenticatedApiClient['fetchJson'];

function renderSheet(onSaved = vi.fn()) {
  return {
    onSaved,
    ...render(<GenreOnboardingSheet request={genresRequest} onSaved={onSaved} />),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(updatePreferredGenres).mockResolvedValue(undefined);
});

describe('GenreOnboardingSheet', () => {
  it('shows all allowed genres as a three-column accessible chip grid', () => {
    renderSheet();

    expect(screen.getByRole('dialog', { name: '🎧 어떤 음악을 좋아하세요?' })).toBeInTheDocument();
    expect(screen.getByText('0 / 3 선택')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '완료' })).toBeDisabled();
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(13);
    expect(screen.getByLabelText('선호 장르 선택')).toHaveClass('genre-onboarding-grid');
  });

  it('keeps keyboard focus inside the modal sheet', () => {
    renderSheet();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'J-POP' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('button', { name: '발라드' })).toHaveFocus();
  });

  it('toggles chips, caps selection at three, and allows selected chips to be removed', async () => {
    const user = userEvent.setup();
    renderSheet();

    const ballad = screen.getByRole('button', { name: '발라드' });
    const dance = screen.getByRole('button', { name: '댄스' });
    const hipHop = screen.getByRole('button', { name: '랩/힙합' });
    const jazz = screen.getByRole('button', { name: '재즈' });

    await user.click(ballad);
    await user.click(dance);
    await user.click(hipHop);

    expect(screen.getByText('3 / 3 선택')).toBeInTheDocument();
    expect(jazz).toBeDisabled();
    expect(ballad).toHaveAttribute('aria-pressed', 'true');

    await user.click(dance);

    expect(screen.getByText('2 / 3 선택')).toBeInTheDocument();
    expect(jazz).toBeEnabled();
    expect(dance).toHaveAttribute('aria-pressed', 'false');
  });

  it('sends the selected genres and notifies the parent only after success', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    renderSheet(onSaved);

    await user.click(screen.getByRole('button', { name: '인디음악' }));
    await user.click(screen.getByRole('button', { name: '재즈' }));
    await user.click(screen.getByRole('button', { name: '완료' }));

    await waitFor(() =>
      expect(updatePreferredGenres).toHaveBeenCalledWith(genresRequest, ['인디음악', '재즈']),
    );
    expect(onSaved).toHaveBeenCalledWith(['인디음악', '재즈']);
  });

  it('requires at least one genre and has no skip or close action', () => {
    renderSheet();

    expect(screen.getByText('최소 1개, 최대 3개까지 선택할 수 있어요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '완료' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '선택하지 않음' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /닫기|닫기/ })).not.toBeInTheDocument();
  });

  it('keeps the dialog open and shows an error when saving fails', async () => {
    const user = userEvent.setup();
    vi.mocked(updatePreferredGenres).mockRejectedValue(new Error('request failed'));
    const onSaved = vi.fn();
    renderSheet(onSaved);

    await user.click(screen.getByRole('button', { name: '재즈' }));
    await user.click(screen.getByRole('button', { name: '완료' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '선호 장르를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('does not submit twice while a save request is pending', async () => {
    const user = userEvent.setup();
    let resolveSave: (() => void) | undefined;
    vi.mocked(updatePreferredGenres).mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSave = resolve;
      }),
    );
    renderSheet();

    await user.click(screen.getByRole('button', { name: '재즈' }));
    await user.dblClick(screen.getByRole('button', { name: '완료' }));

    expect(updatePreferredGenres).toHaveBeenCalledTimes(1);
    resolveSave?.();
  });
});
