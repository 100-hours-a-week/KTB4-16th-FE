import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { KakaoMaps, KakaoRegion } from '../../home-map/lib/kakaoMap';
import { RecordCreateForm } from './RecordCreateForm';
import '../../../pages/lock-create/ui/lockCreatePage.css';

const mocks = vi.hoisted(() => ({
  createRecord: vi.fn(),
  loadKakaoMapSdk: vi.fn(),
  searchMusic: vi.fn(),
  uploadPhoto: vi.fn(),
}));

vi.mock('../../../entities/session/model/useSession', () => ({
  useSession: () => ({ fetchAuthenticatedJson: vi.fn() }),
}));
vi.mock('../../home-map/lib/kakaoMap', () => ({ loadKakaoMapSdk: mocks.loadKakaoMapSdk }));
vi.mock('../api/createRecord', () => ({ createRecord: mocks.createRecord }));
vi.mock('../api/searchMusic', () => ({ searchMusic: mocks.searchMusic }));
vi.mock('../api/uploadPhoto', () => ({ uploadPhoto: mocks.uploadPhoto }));

const selectedMusic = {
  externalTrackId: 'spotify-track',
  title: 'REALLY REALLY',
  artistName: 'WINNER',
  albumImageUrl: 'https://image.test/really-really.jpg',
  externalUrl: 'https://music.test/really-really',
};
const anotherMusic = {
  externalTrackId: 'another-track',
  title: 'LOVE SCENARIO',
  artistName: 'iKON',
  albumImageUrl: 'https://image.test/love-scenario.jpg',
  externalUrl: 'https://music.test/love-scenario',
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:photo-preview'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  });
  mocks.loadKakaoMapSdk.mockResolvedValue(createKakaoMaps());
  mocks.uploadPhoto.mockResolvedValue(77);
  mocks.searchMusic.mockResolvedValue([selectedMusic]);
});

describe('RecordCreateForm', () => {
  it('shows a preview and uploads immediately after photo selection', async () => {
    const { container } = renderForm();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    const photo = new File(['photo'], 'memory.jpg', { type: 'image/jpeg' });

    expect(input).not.toBeNull();
    fireEvent.change(input as HTMLInputElement, { target: { files: [photo] } });

    const preview = screen.getByRole('img', { name: '선택한 사진 미리보기' });
    const previewContainer = preview.closest('.lock-create-photo');
    expect(preview).toHaveAttribute('src', 'blob:photo-preview');
    expect(previewContainer).toBeInTheDocument();
    expect(previewContainer).toContainElement(preview);
    expect(mocks.uploadPhoto).toHaveBeenCalledWith(photo, expect.any(Function));
    expect(screen.queryByRole('button', { name: '사진 업로드하기' })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '사진 바꾸기' })).toBeEnabled();
  });

  it('keeps the form and does not report success when record creation fails', async () => {
    const onCreated = vi.fn();
    mocks.createRecord.mockRejectedValue(new Error('생성 실패'));
    const { container } = renderForm(onCreated);

    await completeRequiredInputs(container);
    fireEvent.click(screen.getByRole('button', { name: '🔒 자물쇠 저장하기' }));

    expect(await screen.findByText('생성 실패')).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('이 순간을 1~2문장으로 남겨보세요')).toBeInTheDocument();
  });

  it('passes the returned record ID to the page without exposing it in the form', async () => {
    const onCreated = vi.fn();
    mocks.createRecord.mockResolvedValue(1356);
    const { container } = renderForm(onCreated);

    await completeRequiredInputs(container);
    fireEvent.click(screen.getByRole('button', { name: '🔒 자물쇠 저장하기' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(1356));
    expect(screen.queryByText(/#1356/)).not.toBeInTheDocument();
  });

  it('uploads a replacement photo and submits only its latest upload ID', async () => {
    const onCreated = vi.fn();
    mocks.uploadPhoto.mockResolvedValueOnce(77).mockResolvedValueOnce(88);
    mocks.createRecord.mockResolvedValue(1356);
    const { container } = renderForm(onCreated);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');

    await selectAndUploadPhoto(input, new File(['first'], 'first.jpg', { type: 'image/jpeg' }));
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(['second'], 'second.jpg', { type: 'image/jpeg' })] },
    });

    await screen.findByRole('button', { name: '사진 바꾸기' });
    await selectMusic();
    fireEvent.click(screen.getByRole('button', { name: '🔒 자물쇠 저장하기' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(1356));
    expect(mocks.uploadPhoto).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: 'first.jpg' }),
      expect.any(Function),
    );
    expect(mocks.uploadPhoto).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: 'second.jpg' }),
      expect.any(Function),
    );
    expect(mocks.createRecord).toHaveBeenCalledWith(
      expect.objectContaining({ uploadId: 88 }),
      expect.any(Function),
    );
  });

  it('keeps a valid photo state when an invalid replacement is selected', async () => {
    const { container } = renderForm();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');

    await selectAndUploadPhoto(input, new File(['first'], 'first.jpg', { type: 'image/jpeg' }));
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(['invalid'], 'invalid.txt', { type: 'text/plain' })] },
    });

    expect(screen.getByText('JPG, PNG, HEIC, WebP 사진만 선택할 수 있습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '사진 바꾸기' })).toBeEnabled();
    expect(screen.getByRole('img', { name: '선택한 사진 미리보기' })).toBeInTheDocument();
  });

  it('opens the existing file input from the change-photo button', async () => {
    const { container } = renderForm();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');

    await selectAndUploadPhoto(input, new File(['first'], 'first.jpg', { type: 'image/jpeg' }));
    const inputClick = vi.spyOn(input as HTMLInputElement, 'click');

    fireEvent.click(screen.getByRole('button', { name: '사진 바꾸기' }));

    expect(inputClick).toHaveBeenCalledOnce();
  });

  it('does not reuse an earlier upload ID when a replacement upload fails', async () => {
    mocks.uploadPhoto
      .mockResolvedValueOnce(77)
      .mockRejectedValueOnce(new Error('교체 업로드 실패'));
    const { container } = renderForm();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');

    await selectAndUploadPhoto(input, new File(['first'], 'first.jpg', { type: 'image/jpeg' }));
    await selectMusic();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '🔒 자물쇠 저장하기' })).toBeEnabled(),
    );
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(['second'], 'second.jpg', { type: 'image/jpeg' })] },
    });

    expect(await screen.findByText('교체 업로드 실패')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '사진 바꾸기' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '🔒 자물쇠 저장하기' })).toBeDisabled();
  });

  it('blocks another selection while a photo upload is pending', async () => {
    let resolveUpload: ((uploadId: number) => void) | undefined;
    mocks.uploadPhoto.mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          resolveUpload = resolve;
        }),
    );
    const { container } = renderForm();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');

    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(['first'], 'first.jpg', { type: 'image/jpeg' })] },
    });

    expect(screen.getByRole('button', { name: '사진 업로드 중…' })).toBeDisabled();
    expect(input).toBeDisabled();
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(['second'], 'second.jpg', { type: 'image/jpeg' })] },
    });
    expect(mocks.uploadPhoto).toHaveBeenCalledTimes(1);

    resolveUpload?.(77);
    expect(await screen.findByRole('button', { name: '사진 바꾸기' })).toBeEnabled();
  });

  it('searches exactly once when the search form is submitted with Enter', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(
      screen.getByPlaceholderText('곡 제목이나 아티스트 검색'),
      'REALLY REALLY{Enter}',
    );

    await waitFor(() => expect(mocks.searchMusic).toHaveBeenCalledOnce());
    expect(mocks.searchMusic).toHaveBeenCalledWith('REALLY REALLY', expect.any(Function));
  });

  it('searches exactly once from the search button', async () => {
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('곡 제목이나 아티스트 검색'), {
      target: { value: 'REALLY REALLY' },
    });

    fireEvent.click(screen.getByRole('button', { name: '음악 검색' }));

    await waitFor(() => expect(mocks.searchMusic).toHaveBeenCalledOnce());
  });

  it('ignores duplicate submits while a music search is pending', async () => {
    let resolveSearch: ((music: Array<typeof selectedMusic>) => void) | undefined;
    mocks.searchMusic.mockImplementationOnce(
      () =>
        new Promise<(typeof selectedMusic)[]>((resolve) => {
          resolveSearch = resolve;
        }),
    );
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('곡 제목이나 아티스트 검색'), {
      target: { value: 'REALLY REALLY' },
    });
    const searchForm = screen.getByRole('search', { name: '음악 검색' });

    fireEvent.submit(searchForm);
    fireEvent.submit(searchForm);

    expect(mocks.searchMusic).toHaveBeenCalledOnce();
    resolveSearch?.([selectedMusic]);
    expect(await screen.findByRole('button', { name: /REALLY REALLY/ })).toBeInTheDocument();
  });

  it('shows the selected track and switches it without another search request', async () => {
    mocks.searchMusic.mockResolvedValueOnce([selectedMusic, anotherMusic]);
    renderForm();

    fireEvent.change(screen.getByPlaceholderText('곡 제목이나 아티스트 검색'), {
      target: { value: 'music' },
    });
    fireEvent.click(screen.getByRole('button', { name: '음악 검색' }));
    fireEvent.click(await screen.findByRole('button', { name: /REALLY REALLY/ }));

    let summary = screen.getByLabelText('현재 선택한 음악');
    expect(within(summary).getByText('REALLY REALLY')).toBeInTheDocument();
    expect(within(summary).getByText('WINNER')).toBeInTheDocument();
    const firstCover = within(summary).getByRole('img');
    expect(firstCover).toHaveAttribute('src', selectedMusic.albumImageUrl);
    fireEvent.error(firstCover);
    expect(firstCover).toHaveAttribute('hidden');

    fireEvent.click(screen.getByRole('button', { name: /LOVE SCENARIO/ }));

    summary = screen.getByLabelText('현재 선택한 음악');
    expect(within(summary).getByText('LOVE SCENARIO')).toBeInTheDocument();
    expect(within(summary).getByText('iKON')).toBeInTheDocument();
    expect(within(summary).getByRole('img')).toHaveAttribute('src', anotherMusic.albumImageUrl);
    expect(within(summary).getByRole('img')).not.toHaveAttribute('hidden');
    expect(mocks.searchMusic).toHaveBeenCalledTimes(1);
  });
});

function renderForm(onCreated = vi.fn()) {
  const onCoordinatesChange = vi.fn();
  return render(
    <RecordCreateForm
      onCoordinatesChange={onCoordinatesChange}
      onCreated={onCreated}
      weather="맑음 · 22°C"
    />,
  );
}

async function completeRequiredInputs(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  const photo = new File(['photo'], 'memory.jpg', { type: 'image/jpeg' });

  await selectAndUploadPhoto(input, photo);
  await selectMusic();

  await waitFor(() =>
    expect(screen.getByRole('button', { name: '🔒 자물쇠 저장하기' })).toBeEnabled(),
  );
}

async function selectAndUploadPhoto(input: HTMLInputElement | null, photo: File) {
  fireEvent.change(input as HTMLInputElement, { target: { files: [photo] } });
  expect(input).toHaveValue('');
  await screen.findByRole('button', { name: '사진 바꾸기' });
}

async function selectMusic() {
  fireEvent.change(screen.getByPlaceholderText('곡 제목이나 아티스트 검색'), {
    target: { value: 'REALLY REALLY' },
  });
  fireEvent.click(screen.getByRole('button', { name: '음악 검색' }));
  fireEvent.click(await screen.findByRole('button', { name: /REALLY REALLY/ }));
}

function createKakaoMaps(): KakaoMaps {
  class Geocoder {
    coord2RegionCode(
      _longitude: number,
      _latitude: number,
      callback: (regions: KakaoRegion[], status: string) => void,
    ) {
      callback([{ region_type: 'B', code: '4111710100', region_3depth_name: '수원역' }], 'OK');
    }
  }

  return {
    maps: {
      Map: class {},
      LatLng: class {},
      services: { Geocoder, Status: { OK: 'OK' } },
      event: { addListener: vi.fn() },
    },
  } as unknown as KakaoMaps;
}
