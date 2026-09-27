import { describe, expect, it, vi } from 'vitest';

import { getRecordDetail } from './getRecordDetail';

const response = {
  message: '자물쇠 상세 조회 성공',
  data: {
    recordId: 585,
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
      title: 'REALLY REALLY',
      artistName: 'WINNER',
      albumImageUrl: 'https://image.test/album.jpg',
      externalUrl: 'https://open.spotify.test/track',
    },
    weatherCondition: 'CLEAR',
    temperature: 22.5,
    moodScore: 10,
    comment: '수원역에서 남긴 자물쇠',
    photoUrl: 'https://signed.example/photo.jpg',
    createdAt: '2026-09-26T18:30:00',
  },
};

describe('getRecordDetail', () => {
  it('requests the encoded record path and parses the detail contract', async () => {
    const fetchAuthenticatedJson = vi.fn().mockResolvedValue(response);
    const controller = new AbortController();

    await expect(getRecordDetail(585, fetchAuthenticatedJson, controller.signal)).resolves.toEqual(
      response.data,
    );
    expect(fetchAuthenticatedJson).toHaveBeenCalledWith('/records/585', {
      signal: controller.signal,
    });
  });

  it('accepts nullable place, weather, temperature, and comment fields', async () => {
    const fetchAuthenticatedJson = vi.fn().mockResolvedValue({
      ...response,
      data: {
        ...response.data,
        place: { ...response.data.place, legalDongName: null, legalDongCode: null },
        weatherCondition: null,
        temperature: null,
        comment: null,
      },
    });

    await expect(
      getRecordDetail(585, fetchAuthenticatedJson, new AbortController().signal),
    ).resolves.toMatchObject({
      place: { legalDongName: null, legalDongCode: null },
      weatherCondition: null,
      temperature: null,
      comment: null,
    });
  });

  it('rejects an invalid response instead of hiding it with a type assertion', async () => {
    const fetchAuthenticatedJson = vi.fn().mockResolvedValue({
      ...response,
      data: { ...response.data, photoUrl: null },
    });

    await expect(
      getRecordDetail(585, fetchAuthenticatedJson, new AbortController().signal),
    ).rejects.toThrow('자물쇠 상세 데이터 형식이 올바르지 않습니다.');
  });
});
