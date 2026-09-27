import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LockDetailData } from '../model/lockDetail.types';
import { LockDetail } from './LockDetail';

const comment = '퇴근길에 우연히 튼 노래인데, 오늘따라 이 골목이랑 참 잘 어울렸다.';
const detail: LockDetailData = {
  recordId: 1356,
  userId: 108,
  place: {
    placeId: 225,
    legalDongName: '매산로1가',
    latitude: 37.266348,
    longitude: 126.99956,
    legalDongCode: '4111513400',
  },
  music: {
    musicTrackId: 122,
    title: '밤편지',
    artistName: '아이유',
    albumImageUrl: 'https://image.test/album.jpg',
    externalUrl: 'https://open.spotify.test/track',
  },
  weatherCondition: 'CLOUDY',
  temperature: 21,
  moodScore: 10,
  comment,
  photoUrl: 'https://signed.example/photo.jpg',
  createdAt: '2026-08-24T20:14:00',
};

const onSaveComment = vi.fn<(comment: string | null) => Promise<string | null>>();

beforeEach(() => {
  vi.restoreAllMocks();
  onSaveComment.mockReset();
  onSaveComment.mockImplementation(async (nextComment) => nextComment);
});

describe('LockDetail', () => {
  it('renders the detailed photo, album cover, and shared mood emoji', () => {
    renderDetail();

    expect(screen.getByRole('img', { name: '매산로1가에 남긴 자물쇠 사진' })).toHaveAttribute(
      'src',
      detail.photoUrl,
    );
    expect(screen.getByRole('img', { name: '밤편지 - 아이유 앨범 커버' })).toHaveAttribute(
      'src',
      detail.music.albumImageUrl,
    );
    expect(screen.getByRole('img', { name: '현재 기분' })).toHaveTextContent('😐');
    expect(screen.queryByText('10점')).not.toBeInTheDocument();
  });

  it('edits a comment locally only after its save callback succeeds', async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole('button', { name: '수정' }));
    const textarea = screen.getByRole('textbox', { name: '코멘트 입력' });
    expect(textarea).toHaveValue(comment);
    await user.clear(textarea);
    await user.type(textarea, '새 코멘트');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(onSaveComment).toHaveBeenCalledWith('새 코멘트');
    expect(await screen.findByText('“새 코멘트”')).toBeInTheDocument();
  });

  it('keeps an editable draft and allows retrying after a failed save', async () => {
    const user = userEvent.setup();
    onSaveComment.mockRejectedValueOnce(new Error('failed'));
    renderDetail();

    await user.click(screen.getByRole('button', { name: '수정' }));
    const textarea = screen.getByRole('textbox', { name: '코멘트 입력' });
    await user.clear(textarea);
    await user.type(textarea, '재시도할 코멘트');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '코멘트를 저장하지 못했어요. 다시 시도해주세요.',
    );
    expect(textarea).toHaveValue('재시도할 코멘트');

    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText('“재시도할 코멘트”')).toBeInTheDocument();
  });

  it('uses null for a blank draft and returns to the add-comment state', async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole('button', { name: '수정' }));
    const textarea = screen.getByRole('textbox', { name: '코멘트 입력' });
    await user.clear(textarea);
    await user.type(textarea, '   ');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(onSaveComment).toHaveBeenCalledWith(null);
    expect(await screen.findByRole('button', { name: '코멘트 추가' })).toBeInTheDocument();
  });

  it('prevents duplicate comment saves while a request is pending', async () => {
    let resolveSave: ((value: string | null) => void) | undefined;
    onSaveComment.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    const user = userEvent.setup();
    renderDetail();
    await user.click(screen.getByRole('button', { name: '수정' }));

    const saveButton = screen.getByRole('button', { name: '저장' });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    expect(onSaveComment).toHaveBeenCalledOnce();
    await act(async () => resolveSave?.(comment));
  });

  it('keeps deletion as a local confirmation dialog without a request', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderDetail();

    await user.click(screen.getByRole('button', { name: '자물쇠 삭제' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function renderDetail(value: LockDetailData = detail) {
  return render(
    <LockDetail detail={value} isOwner onClose={vi.fn()} onSaveComment={onSaveComment} />,
  );
}
