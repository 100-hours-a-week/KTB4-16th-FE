import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { KakaoMaps, KakaoRegion } from '../../home-map/lib/kakaoMap';
import { searchMusic } from '../../music-search/api/musicSearchApi';
import type { MusicSearchResult } from '../../music-search/model/musicSearch.types';
import { getPhotoMusicRecommendations } from '../api/getPhotoMusicRecommendations';
import { RecordCreateForm } from './RecordCreateForm';
import '../../../pages/lock-create/ui/lockCreatePage.css';

const mocks = vi.hoisted(() => ({
  createRecord: vi.fn(),
  loadKakaoMapSdk: vi.fn(),
  uploadPhoto: vi.fn(),
  getUploadSignedUrl: vi.fn(),
  getPhotoMusicRecommendations: vi.fn(),
}));

vi.mock('../../../entities/session/model/useSession', () => ({
  useSession: () => ({ fetchAuthenticatedJson: vi.fn() }),
}));
vi.mock('../../home-map/lib/kakaoMap', () => ({ loadKakaoMapSdk: mocks.loadKakaoMapSdk }));
vi.mock('../../music-search/api/musicSearchApi', () => ({ searchMusic: vi.fn() }));
vi.mock('../api/createRecord', () => ({ createRecord: mocks.createRecord }));
vi.mock('../api/uploadPhoto', () => ({ uploadPhoto: mocks.uploadPhoto }));
vi.mock('../api/getUploadSignedUrl', () => ({ getUploadSignedUrl: mocks.getUploadSignedUrl }));
vi.mock('../api/getPhotoMusicRecommendations', () => ({
  getPhotoMusicRecommendations: mocks.getPhotoMusicRecommendations,
}));

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

let latestMapControl: {
  center: { getLat: () => number; getLng: () => number };
  setCenter: ReturnType<typeof vi.fn>;
  getCurrentCenter: () => { getLat: () => number; getLng: () => number };
  setCurrentCenter: (center: { getLat: () => number; getLng: () => number }) => void;
  triggerIdle: () => void;
} | null = null;
let customOverlayOptions: Array<Record<string, unknown>> = [];
let customOverlayControls: Array<{ setPosition: ReturnType<typeof vi.fn> }> = [];
let deferInitialRegionLookup = false;

beforeEach(() => {
  vi.clearAllMocks();
  latestMapControl = null;
  customOverlayOptions = [];
  customOverlayControls = [];
  deferInitialRegionLookup = false;
  useSuccessfulGeolocation(37.5, 127.03);
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
  mocks.getUploadSignedUrl.mockResolvedValue('https://storage.example/photo.jpg?signature=temp');
  mocks.getPhotoMusicRecommendations.mockResolvedValue([selectedMusic]);
  vi.mocked(searchMusic).mockResolvedValue([{ provider: 'SPOTIFY', ...selectedMusic }]);
});

describe('RecordCreateForm', () => {
  it('commits a moved map center only after the user confirms the enlarged map', async () => {
    const onCoordinatesChange = vi.fn();
    setGeolocation((success) =>
      success({
        coords: { latitude: 37.5, longitude: 127.03 } as GeolocationCoordinates,
        timestamp: 0,
      } as GeolocationPosition),
    );
    renderForm(vi.fn(), onCoordinatesChange);

    await screen.findByText('수원역');
    expect(document.querySelector('.lock-create-map-center-pin')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '위치 조정' }));
    expect(screen.getByRole('dialog', { name: '위치 조정' })).toBeInTheDocument();
    await waitFor(() => expect(customOverlayControls[0]?.setPosition).toHaveBeenCalled());
    const nextCenter = {
      getLat: () => 37.51,
      getLng: () => 127.04,
    };
    if (!latestMapControl) throw new Error('지도 테스트 제어 객체가 없습니다.');
    latestMapControl.setCurrentCenter(nextCenter);
    latestMapControl?.triggerIdle();

    expect(await screen.findByText('서울역')).toBeInTheDocument();
    expect(onCoordinatesChange).toHaveBeenLastCalledWith({ latitude: 37.5, longitude: 127.03 });
    fireEvent.click(screen.getByRole('button', { name: '이 위치로 설정' }));

    expect(screen.queryByRole('dialog', { name: '위치 조정' })).not.toBeInTheDocument();
    expect(screen.getByText('서울역')).toBeInTheDocument();
    expect(onCoordinatesChange).toHaveBeenLastCalledWith({ latitude: 37.51, longitude: 127.04 });
  });

  it('resolves the map center when adjustment opens before the initial place name arrives', async () => {
    deferInitialRegionLookup = true;
    renderForm();

    fireEvent.click(await screen.findByRole('button', { name: '위치 조정' }));

    expect(
      await within(screen.getByRole('dialog', { name: '위치 조정' })).findByText('수원역'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이 위치로 설정' })).toBeEnabled();
  });

  it('keeps the current GPS location centered when opening and closing the editor', async () => {
    renderForm();
    await screen.findByText('수원역');
    if (!latestMapControl) throw new Error('지도 테스트 제어 객체가 없습니다.');

    fireEvent.click(screen.getByRole('button', { name: '위치 조정' }));

    await waitFor(() => expect(latestMapControl?.getCurrentCenter().getLat()).toBe(37.5));
    expect(latestMapControl.getCurrentCenter().getLng()).toBe(127.03);

    fireEvent.click(screen.getByRole('button', { name: '닫기' }));

    await waitFor(() => expect(latestMapControl?.getCurrentCenter().getLat()).toBe(37.5));
    expect(latestMapControl.getCurrentCenter().getLng()).toBe(127.03);
  });

  it('waits for the fresh GPS result before enabling map movement', async () => {
    let resolveFreshPosition: PositionCallback | undefined;
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      if (getCurrentPosition.mock.calls.length === 1) {
        success({
          coords: { latitude: 37.5, longitude: 127.03 } as GeolocationCoordinates,
          timestamp: 0,
        } as GeolocationPosition);
      } else {
        resolveFreshPosition = success;
      }
    });
    setGeolocation(getCurrentPosition);
    renderForm();
    await screen.findByText('수원역');

    fireEvent.click(screen.getByRole('button', { name: '위치 조정' }));

    expect(document.querySelector('.lock-create-map')).not.toHaveClass('is-editing');
    expect(screen.getByText('현재 위치를 확인하고 있어요')).toBeInTheDocument();
    resolveFreshPosition?.({
      coords: { latitude: 37.51, longitude: 127.04 } as GeolocationCoordinates,
      timestamp: 0,
    } as GeolocationPosition);

    await within(screen.getByRole('dialog', { name: '위치 조정' })).findByText('서울역');
    expect(document.querySelector('.lock-create-map')).toHaveClass('is-editing');
  });

  it('discards a moved location on close and returns focus to the adjust button', async () => {
    const onCoordinatesChange = vi.fn();
    renderForm(vi.fn(), onCoordinatesChange);
    await screen.findByText('수원역');

    const adjustButton = screen.getByRole('button', { name: '위치 조정' });
    fireEvent.click(adjustButton);
    await waitFor(() => expect(customOverlayControls[0]?.setPosition).toHaveBeenCalled());
    if (!latestMapControl) throw new Error('지도 테스트 제어 객체가 없습니다.');
    latestMapControl.setCurrentCenter({ getLat: () => 37.51, getLng: () => 127.04 });
    latestMapControl.triggerIdle();
    expect(await screen.findByText('서울역')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '닫기' }));

    expect(screen.queryByRole('dialog', { name: '위치 조정' })).not.toBeInTheDocument();
    expect(screen.getByText('수원역')).toBeInTheDocument();
    await waitFor(() => expect(onCoordinatesChange).toHaveBeenCalledTimes(2));
    expect(onCoordinatesChange).toHaveBeenLastCalledWith({ latitude: 37.5, longitude: 127.03 });
    expect(screen.getByRole('button', { name: '위치 조정' })).toHaveFocus();
  });

  it('closes the enlarged map with Escape and keeps keyboard focus inside it', async () => {
    renderForm();
    await screen.findByText('수원역');
    fireEvent.click(screen.getByRole('button', { name: '위치 조정' }));

    const dialog = screen.getByRole('dialog', { name: '위치 조정' });
    const confirmButton = screen.getByRole('button', { name: '이 위치로 설정' });
    confirmButton.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(screen.getByRole('button', { name: '닫기' })).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '위치 조정' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '위치 조정' })).toHaveFocus();
  });

  it('keeps the previous location when the enlarged map cannot resolve a legal region', async () => {
    const onCoordinatesChange = vi.fn();
    renderForm(vi.fn(), onCoordinatesChange);
    await screen.findByText('수원역');
    fireEvent.click(screen.getByRole('button', { name: '위치 조정' }));
    await waitFor(() => expect(customOverlayControls[0]?.setPosition).toHaveBeenCalled());

    if (!latestMapControl) throw new Error('지도 테스트 제어 객체가 없습니다.');
    latestMapControl.setCurrentCenter({ getLat: () => 37.52, getLng: () => 127.05 });
    latestMapControl.triggerIdle();

    expect(await screen.findByText('위치를 선택할 수 없어요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이 위치로 설정' })).toBeDisabled();
    expect(onCoordinatesChange).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.getByText('수원역')).toBeInTheDocument();
  });

  it('recenters the compact map at the acquired GPS point without opening the editor or requesting geolocation again', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 37.5, longitude: 127.03 } as GeolocationCoordinates,
        timestamp: 0,
      } as GeolocationPosition);
    });
    setGeolocation(getCurrentPosition);
    renderForm();

    const button = await screen.findByRole('button', { name: '현재 위치로 이동' });
    fireEvent.click(button);

    expect(screen.queryByRole('dialog', { name: '위치 조정' })).not.toBeInTheDocument();
    expect(getCurrentPosition).toHaveBeenCalledOnce();
    expect(latestMapControl?.setCenter).toHaveBeenCalledOnce();
    expect(customOverlayOptions).toHaveLength(1);
    expect(customOverlayOptions[0]).toMatchObject({ clickable: false, zIndex: 1 });
  });

  it('resolves the GPS place inside the editor without waiting for another map idle event', async () => {
    const onCoordinatesChange = vi.fn();
    renderForm(vi.fn(), onCoordinatesChange);
    await screen.findByText('수원역');
    fireEvent.click(screen.getByRole('button', { name: '위치 조정' }));
    await waitFor(() => expect(customOverlayControls[0]?.setPosition).toHaveBeenCalled());
    if (!latestMapControl) throw new Error('지도 테스트 제어 객체가 없습니다.');
    latestMapControl.setCurrentCenter({ getLat: () => 37.51, getLng: () => 127.04 });
    latestMapControl.triggerIdle();
    expect(await screen.findByText('서울역')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '현재 위치로 이동' }));

    expect(
      await within(screen.getByRole('dialog', { name: '위치 조정' })).findByText('수원역'),
    ).toBeInTheDocument();
    expect(onCoordinatesChange).toHaveBeenCalledTimes(1);
  });

  it('refreshes GPS on open and close and aligns the map center pin with the GPS marker', async () => {
    const positions = [
      { latitude: 37.5, longitude: 127.03 },
      { latitude: 37.51, longitude: 127.04 },
      { latitude: 37.54, longitude: 127.07 },
    ];
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      const coordinates = positions[getCurrentPosition.mock.calls.length - 1];
      if (!coordinates) throw new Error('예상하지 못한 위치 조회입니다.');
      success({
        coords: coordinates as GeolocationCoordinates,
        timestamp: 0,
      } as GeolocationPosition);
    });
    setGeolocation(getCurrentPosition);
    const onCoordinatesChange = vi.fn();
    renderForm(vi.fn(), onCoordinatesChange);
    await screen.findByText('수원역');
    if (!latestMapControl) throw new Error('지도 테스트 제어 객체가 없습니다.');

    fireEvent.click(screen.getByRole('button', { name: '위치 조정' }));

    await within(screen.getByRole('dialog', { name: '위치 조정' })).findByText('서울역');
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(latestMapControl.getCurrentCenter().getLat()).toBe(37.51);
    expect(latestMapControl.getCurrentCenter().getLng()).toBe(127.04);
    const openGpsPosition = customOverlayControls[0]?.setPosition.mock.lastCall?.[0] as
      { getLat: () => number; getLng: () => number } | undefined;
    expect(openGpsPosition?.getLat()).toBe(37.51);
    expect(openGpsPosition?.getLng()).toBe(127.04);

    latestMapControl.setCurrentCenter({ getLat: () => 37.53, getLng: () => 127.06 });
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));

    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(latestMapControl?.getCurrentCenter().getLat()).toBe(37.54));
    expect(latestMapControl.getCurrentCenter().getLng()).toBe(127.07);
    const closeGpsPosition = customOverlayControls[0]?.setPosition.mock.lastCall?.[0] as
      { getLat: () => number; getLng: () => number } | undefined;
    expect(closeGpsPosition?.getLat()).toBe(37.54);
    expect(closeGpsPosition?.getLng()).toBe(127.07);
    expect(onCoordinatesChange).toHaveBeenLastCalledWith({ latitude: 37.54, longitude: 127.07 });
  });

  it.each([
    { name: 'permission is denied', code: 1, expectedMessage: '위치 권한이 필요해요' },
    { name: 'position is unavailable', code: 2, expectedMessage: '현재 위치를 확인할 수 없어요' },
    {
      name: 'location request times out',
      code: 3,
      expectedMessage: '현재 위치를 확인할 수 없어요',
    },
  ])('blocks map-based record location when $name', async ({ code, expectedMessage }) => {
    useFailedGeolocation(code);
    const onCoordinatesChange = vi.fn();
    renderForm(vi.fn(), onCoordinatesChange);

    expect(await screen.findByRole('alert')).toHaveTextContent(expectedMessage);
    expect(screen.getByRole('alert')).toHaveClass('lock-create-location-notice');
    if (code === 1) {
      expect(screen.getByRole('alert')).toHaveTextContent(
        '브라우저 설정에서 이 사이트의 위치 권한을 허용한 뒤 다시 확인해주세요.',
      );
      expect(
        screen.getByRole('button', { name: '브라우저 설정 후 다시 확인' }),
      ).toBeInTheDocument();
    } else {
      expect(screen.getByRole('button', { name: '위치 권한 허용하기' })).toBeInTheDocument();
    }

    const map = document.querySelector('.lock-create-map');
    expect(map).not.toBeNull();
    if (map) fireEvent.click(map);

    expect(screen.queryByRole('button', { name: '현재 위치로 이동' })).not.toBeInTheDocument();
    expect(customOverlayOptions).toHaveLength(0);
    expect(latestMapControl).toBeNull();
    expect(mocks.loadKakaoMapSdk).not.toHaveBeenCalled();
    expect(onCoordinatesChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '🔒 자물쇠 저장하기' })).toBeDisabled();
    expect(mocks.createRecord).not.toHaveBeenCalled();
  });

  it('does not initialize or geocode a fallback location when geolocation is unsupported', async () => {
    setGeolocation(null);
    renderForm();

    expect(await screen.findByRole('alert')).toHaveTextContent('위치 기능을 사용할 수 없어요');
    expect(screen.getByRole('alert')).toHaveClass('lock-create-location-notice');
    expect(mocks.loadKakaoMapSdk).not.toHaveBeenCalled();
    expect(latestMapControl).toBeNull();
    expect(screen.getByRole('button', { name: '🔒 자물쇠 저장하기' })).toBeDisabled();
  });

  it('retries location acquisition and only initializes the map after GPS succeeds', async () => {
    const user = userEvent.setup();
    const position: GeolocationPosition = {
      coords: { latitude: 37.5, longitude: 127.03 } as GeolocationCoordinates,
      timestamp: 0,
    } as GeolocationPosition;
    const getCurrentPosition: Geolocation['getCurrentPosition'] = vi
      .fn()
      .mockImplementationOnce((_success, failure) => {
        failure?.({
          code: 1,
          message: '위치 권한이 거부되었습니다.',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
      })
      .mockImplementationOnce((success) => success(position));
    setGeolocation(getCurrentPosition);
    renderForm();

    await screen.findByRole('alert');
    expect(mocks.loadKakaoMapSdk).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '브라우저 설정 후 다시 확인' }));

    expect(await screen.findByText('수원역')).toBeInTheDocument();
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(mocks.loadKakaoMapSdk).toHaveBeenCalledOnce();
    expect(latestMapControl).not.toBeNull();
  });

  it('keeps record location unavailable when geolocation throws', async () => {
    setGeolocation(() => {
      throw new Error('Geolocation failed');
    });
    const onCoordinatesChange = vi.fn();
    renderForm(vi.fn(), onCoordinatesChange);

    const notice = await screen.findByRole('alert');
    expect(notice).toHaveClass('lock-create-location-notice');
    expect(notice).toHaveTextContent('위치를 다시 요청합니다.');
    expect(mocks.loadKakaoMapSdk).not.toHaveBeenCalled();
    expect(onCoordinatesChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '🔒 자물쇠 저장하기' })).toBeDisabled();
  });

  it('provides named location and photo controls for keyboard users', async () => {
    setGeolocation((success) =>
      success({
        coords: { latitude: 37.5, longitude: 127.03 } as GeolocationCoordinates,
        timestamp: 0,
      } as GeolocationPosition),
    );
    renderForm();

    expect(await screen.findByRole('region', { name: '최종 위치 선택' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '현재 위치로 이동' })).toBeInTheDocument();
    expect(screen.getByLabelText('사진 업로드')).toHaveAttribute('type', 'file');
    expect(screen.getByRole('textbox', { name: '하고 싶은 말' })).toHaveAttribute(
      'aria-describedby',
      'lock-create-comment-count',
    );
  });

  it('shows the 80-character comment limit and prevents longer input', async () => {
    const user = userEvent.setup();
    renderForm();

    const comment = screen.getByPlaceholderText('이 순간을 1~2문장으로 남겨보세요');
    expect(comment).toHaveAttribute('maxLength', '80');
    expect(comment).toHaveAttribute('aria-describedby', 'lock-create-comment-count');
    expect(screen.getByText('0 / 80자')).toBeInTheDocument();

    await user.type(comment, '가'.repeat(81));

    expect(comment).toHaveValue('가'.repeat(80));
    expect(screen.getByText('80 / 80자')).toBeInTheDocument();
  });

  it('lists only missing required inputs and hides the hint when all are ready', async () => {
    const { container } = renderForm();

    expect(screen.getByText(/저장 전 필수 작성 항목/)).toHaveTextContent(
      '저장 전 필수 작성 항목 : 위치 선택, 사진 업로드, 음악 선택',
    );
    await screen.findByText('수원역');

    expect(screen.getByText(/저장 전 필수 작성 항목/)).toHaveTextContent(
      '저장 전 필수 작성 항목 : 사진 업로드, 음악 선택',
    );
    expect(screen.getByRole('button', { name: '🔒 자물쇠 저장하기' })).toBeDisabled();

    const photoInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    await selectAndUploadPhoto(
      photoInput,
      new File(['photo'], 'memory.jpg', { type: 'image/jpeg' }),
    );
    expect(screen.getByText(/저장 전 필수 작성 항목/)).toHaveTextContent(
      '저장 전 필수 작성 항목 : 음악 선택',
    );

    await completeRequiredInputs(container);

    expect(screen.queryByText(/저장 전 필수 작성 항목/)).not.toBeInTheDocument();
    expect(document.querySelector('.lock-create-required-hint-slot')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(screen.getByRole('button', { name: '🔒 자물쇠 저장하기' })).toBeEnabled();
  });

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

  it.each([
    ['JPEG', 'photo.jpg', 'image/jpeg'],
    ['JPG', 'photo.jpeg', 'image/jpeg'],
    ['PNG', 'photo.png', 'image/png'],
    ['WebP', 'photo.webp', 'image/webp'],
  ])('%s keeps the local Blob preview and does not request a Signed URL', async (_, name, type) => {
    const { container, unmount } = renderForm();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(['photo'], name, { type })] },
    });

    expect(await screen.findByRole('img', { name: '선택한 사진 미리보기' })).toHaveAttribute(
      'src',
      'blob:photo-preview',
    );
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(mocks.getUploadSignedUrl).not.toHaveBeenCalled();
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo-preview');
  });

  it('does not preview the raw HEIC Blob and displays the server JPEG Signed URL after upload', async () => {
    let resolveSignedUrl: ((url: string) => void) | undefined;
    mocks.getUploadSignedUrl.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveSignedUrl = resolve;
        }),
    );
    const { container, unmount } = renderForm();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(['heic'], 'photo.heic', { type: 'image/heic' })] },
    });

    expect(screen.queryByRole('img', { name: '선택한 사진 미리보기' })).not.toBeInTheDocument();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(mocks.uploadPhoto).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(mocks.getUploadSignedUrl).toHaveBeenCalledWith(77, expect.any(Function)),
    );
    expect(screen.queryByRole('img', { name: '선택한 사진 미리보기' })).not.toBeInTheDocument();

    resolveSignedUrl?.('https://storage.example/converted-photo.jpg?signature=temp');
    expect(await screen.findByRole('img', { name: '선택한 사진 미리보기' })).toHaveAttribute(
      'src',
      'https://storage.example/converted-photo.jpg?signature=temp',
    );
    expect(mocks.uploadPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'photo.heic' }),
      expect.any(Function),
    );
    unmount();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('keeps a successful HEIC upload usable when Signed URL preview lookup fails', async () => {
    mocks.getUploadSignedUrl.mockRejectedValueOnce(
      new Error('사진 미리보기 URL을 가져오지 못했습니다.'),
    );
    const { container } = renderForm();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(['heic'], 'photo.heic', { type: 'image/heic' })] },
    });

    expect(await screen.findByText('사진 미리보기 URL을 가져오지 못했습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: '선택한 사진 미리보기' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '✨ AI 음악 추천받기' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '✨ AI 음악 추천받기' }));
    await waitFor(() =>
      expect(mocks.getPhotoMusicRecommendations).toHaveBeenCalledWith(77, expect.any(Function)),
    );
  });

  it('requests photo music recommendations only after an uploaded photo and selects one through selectedMusic', async () => {
    const { container } = renderForm();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');

    expect(screen.getByRole('button', { name: '✨ AI 음악 추천받기' })).toBeDisabled();
    await selectAndUploadPhoto(input, new File(['photo'], 'memory.jpg', { type: 'image/jpeg' }));

    const recommendButton = screen.getByRole('button', { name: '✨ AI 음악 추천받기' });
    expect(recommendButton).toBeEnabled();
    fireEvent.click(recommendButton);
    fireEvent.click(recommendButton);

    expect(getPhotoMusicRecommendations).toHaveBeenCalledOnce();
    expect(getPhotoMusicRecommendations).toHaveBeenCalledWith(77, expect.any(Function));
    fireEvent.click(await screen.findByRole('button', { name: /REALLY REALLY/ }));

    expect(screen.queryByRole('dialog', { name: '사진 음악 추천' })).not.toBeInTheDocument();
    expect(
      within(screen.getByLabelText('현재 선택한 음악')).getByText('REALLY REALLY'),
    ).toBeInTheDocument();
  });

  it('clears photo recommendations when a replacement photo is selected', async () => {
    let resolveRecommendations: ((value: (typeof selectedMusic)[]) => void) | undefined;
    mocks.getPhotoMusicRecommendations.mockImplementationOnce(
      () =>
        new Promise<(typeof selectedMusic)[]>((resolve) => {
          resolveRecommendations = resolve;
        }),
    );
    const { container } = renderForm();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    await selectAndUploadPhoto(input, new File(['first'], 'first.jpg', { type: 'image/jpeg' }));

    fireEvent.click(screen.getByRole('button', { name: '✨ AI 음악 추천받기' }));
    expect(screen.getByRole('status')).toHaveTextContent('음악을 추천하는 중이에요.');
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(['second'], 'second.jpg', { type: 'image/jpeg' })] },
    });
    resolveRecommendations?.([selectedMusic]);

    await screen.findByRole('button', { name: '사진 바꾸기' });
    expect(screen.queryByRole('dialog', { name: '사진 음악 추천' })).not.toBeInTheDocument();
  });

  it('keeps the form inputs and allows a failed recommendation request to be retried', async () => {
    mocks.getPhotoMusicRecommendations
      .mockRejectedValueOnce(new Error('추천 실패'))
      .mockResolvedValueOnce([selectedMusic]);
    const { container } = renderForm();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    await selectAndUploadPhoto(input, new File(['photo'], 'memory.jpg', { type: 'image/jpeg' }));

    fireEvent.click(screen.getByRole('button', { name: '✨ AI 음악 추천받기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('추천 실패');
    expect(screen.getByRole('img', { name: '선택한 사진 미리보기' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('button', { name: /REALLY REALLY/ })).toBeInTheDocument();
    expect(getPhotoMusicRecommendations).toHaveBeenCalledTimes(2);
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

  it('keeps only the newest photo preview when an earlier HEIC Signed URL resolves late', async () => {
    let resolveFirstSignedUrl: ((url: string) => void) | undefined;
    let resolveSecondSignedUrl: ((url: string) => void) | undefined;
    mocks.uploadPhoto.mockResolvedValueOnce(77).mockResolvedValueOnce(88);
    mocks.getUploadSignedUrl
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveFirstSignedUrl = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveSecondSignedUrl = resolve;
          }),
      );
    const { container } = renderForm();
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');

    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(['first'], 'first.heic', { type: 'image/heic' })] },
    });
    await waitFor(() =>
      expect(mocks.getUploadSignedUrl).toHaveBeenCalledWith(77, expect.any(Function)),
    );
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(['second'], 'second.heic', { type: 'image/heic' })] },
    });
    await waitFor(() =>
      expect(mocks.getUploadSignedUrl).toHaveBeenCalledWith(88, expect.any(Function)),
    );

    resolveSecondSignedUrl?.('https://storage.example/second.jpg?signature=temp');
    expect(await screen.findByRole('img', { name: '선택한 사진 미리보기' })).toHaveAttribute(
      'src',
      'https://storage.example/second.jpg?signature=temp',
    );

    resolveFirstSignedUrl?.('https://storage.example/first.jpg?signature=temp');
    await waitFor(() =>
      expect(screen.getByRole('img', { name: '선택한 사진 미리보기' })).toHaveAttribute(
        'src',
        'https://storage.example/second.jpg?signature=temp',
      ),
    );
    expect(input).not.toBeDisabled();
  });

  it('searches exactly once when the search form is submitted with Enter', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(
      screen.getByPlaceholderText('곡 제목이나 아티스트 검색'),
      'REALLY REALLY{Enter}',
    );

    await waitFor(() => expect(searchMusic).toHaveBeenCalledOnce());
    expect(searchMusic).toHaveBeenCalledWith(expect.any(Function), 'REALLY REALLY');
  });

  it('searches exactly once from the search button', async () => {
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('곡 제목이나 아티스트 검색'), {
      target: { value: 'REALLY REALLY' },
    });

    fireEvent.click(screen.getByRole('button', { name: '음악 검색' }));

    await waitFor(() => expect(searchMusic).toHaveBeenCalledOnce());
  });

  it('ignores duplicate submits while a music search is pending', async () => {
    let resolveSearch: ((music: MusicSearchResult[]) => void) | undefined;
    vi.mocked(searchMusic).mockImplementationOnce(
      () =>
        new Promise<MusicSearchResult[]>((resolve) => {
          resolveSearch = resolve;
        }),
    );
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('곡 제목이나 아티스트 검색'), {
      target: { value: 'REALLY REALLY' },
    });
    const searchForm = screen.getByRole('button', { name: '음악 검색' }).closest('form');

    fireEvent.submit(searchForm as HTMLFormElement);
    fireEvent.submit(searchForm as HTMLFormElement);

    expect(searchMusic).toHaveBeenCalledOnce();
    resolveSearch?.([{ provider: 'SPOTIFY', ...selectedMusic }]);
    expect(await screen.findByRole('button', { name: /REALLY REALLY/ })).toBeInTheDocument();
  });

  it('shows the selected track and switches it without another search request', async () => {
    vi.mocked(searchMusic)
      .mockResolvedValueOnce([
        { provider: 'SPOTIFY', ...selectedMusic },
        { provider: 'SPOTIFY', ...anotherMusic },
      ])
      .mockResolvedValueOnce([{ provider: 'SPOTIFY', ...anotherMusic }]);
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

    fireEvent.change(screen.getByPlaceholderText('곡 제목이나 아티스트 검색'), {
      target: { value: 'LOVE SCENARIO' },
    });
    fireEvent.click(screen.getByRole('button', { name: '음악 검색' }));
    fireEvent.click(await screen.findByRole('button', { name: /LOVE SCENARIO/ }));

    summary = screen.getByLabelText('현재 선택한 음악');
    expect(within(summary).getByText('LOVE SCENARIO')).toBeInTheDocument();
    expect(within(summary).getByText('iKON')).toBeInTheDocument();
    expect(within(summary).getByRole('img')).toHaveAttribute('src', anotherMusic.albumImageUrl);
    expect(within(summary).getByRole('img')).not.toHaveAttribute('hidden');
    expect(searchMusic).toHaveBeenCalledTimes(2);
  });
});

function renderForm(onCreated = vi.fn(), onCoordinatesChange = vi.fn()) {
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
  let idleHandler: (() => void) | undefined;

  class LatLng {
    constructor(
      private readonly latitude: number,
      private readonly longitude: number,
    ) {}

    getLat() {
      return this.latitude;
    }

    getLng() {
      return this.longitude;
    }
  }

  class Map {
    private center: LatLng;
    relayout = vi.fn();
    setCenter = vi.fn((center: LatLng) => {
      this.center = center;
    });

    constructor(_container: HTMLElement, options: { center: LatLng }) {
      this.center = options.center;
      latestMapControl = {
        center: this.center,
        setCenter: this.setCenter,
        getCurrentCenter: () => this.center,
        setCurrentCenter: (center) => {
          this.center = new LatLng(center.getLat(), center.getLng());
        },
        triggerIdle: () => idleHandler?.(),
      };
    }

    getCenter() {
      return this.center;
    }
  }

  class Geocoder {
    coord2RegionCode(
      _longitude: number,
      _latitude: number,
      callback: (regions: KakaoRegion[], status: string) => void,
    ) {
      if (deferInitialRegionLookup) {
        deferInitialRegionLookup = false;
        return;
      }
      if (_latitude === 37.52) {
        callback([], 'ERROR');
        return;
      }
      callback(
        [
          {
            region_type: 'B',
            code: _latitude === 37.51 ? '1114010100' : '4111710100',
            region_3depth_name: _latitude === 37.51 ? '서울역' : '수원역',
          },
        ],
        'OK',
      );
    }
  }

  return {
    maps: {
      Map,
      LatLng,
      services: { Geocoder, Status: { OK: 'OK' } },
      event: {
        addListener: vi.fn((_target: unknown, eventName: string, handler: () => void) => {
          if (eventName === 'idle') idleHandler = handler;
        }),
      },
      CustomOverlay: class {
        setMap = vi.fn();
        setPosition = vi.fn();
        setZIndex = vi.fn();

        constructor(options: Record<string, unknown>) {
          customOverlayOptions.push(options);
          customOverlayControls.push({ setPosition: this.setPosition });
          if (options.content instanceof HTMLElement) {
            const wrapper = document.createElement('div');
            wrapper.append(options.content);
          }
        }
      },
    },
  } as unknown as KakaoMaps;
}

function setGeolocation(getCurrentPosition: Geolocation['getCurrentPosition'] | null) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: getCurrentPosition ? { getCurrentPosition } : undefined,
  });
}

function useSuccessfulGeolocation(latitude: number, longitude: number) {
  const position: GeolocationPosition = {
    coords: { latitude, longitude } as GeolocationCoordinates,
    timestamp: 0,
  } as GeolocationPosition;
  setGeolocation((success) => success(position));
}

function useFailedGeolocation(code: number) {
  const error: GeolocationPositionError = {
    code,
    message: '위치 정보를 가져올 수 없습니다.',
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  };
  setGeolocation((_success, failure) => failure?.(error));
}
