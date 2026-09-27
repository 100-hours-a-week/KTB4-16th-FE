import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../../shared/api/apiError';
import { getMonthlyReportDetail, getMonthlyReports } from './monthlyReportApi';

const detailResponse = {
  message: '월간 리포트 상세 조회 성공',
  data: {
    monthlyReportId: 50,
    year: 2026,
    month: 8,
    stats: {
      recordCount: 15,
      topPlace: { placeId: 10, legalDongName: '역삼동' },
      topArtistName: '아이유',
      averageMoodScore: 24.3,
    },
    photoScenes: [{ sceneTag: '야경', count: 3, ratio: 60 }],
    aiRecap: { status: 'COMPLETED', text: '이번 달의 기록입니다.' },
  },
};

describe('monthlyReportApi', () => {
  it('목록 응답을 월별 리포트 요약 목록으로 변환한다', async () => {
    const request = vi.fn().mockResolvedValue({
      message: '월간 리포트 목록 조회 성공',
      data: {
        reports: [
          {
            monthlyReportId: 50,
            year: 2026,
            month: 8,
            recordCount: 15,
            aiRecapStatus: 'COMPLETED',
          },
        ],
      },
    });

    await expect(getMonthlyReports(request)).resolves.toEqual([
      { monthlyReportId: 50, year: 2026, month: 8, recordCount: 15, aiRecapStatus: 'COMPLETED' },
    ]);
    expect(request).toHaveBeenCalledWith('/monthly-reports', { signal: undefined });
  });

  it('빈 reports 배열을 정상적인 빈 상태로 유지한다', async () => {
    const request = vi.fn().mockResolvedValue({
      message: '월간 리포트 목록 조회 성공',
      data: { reports: [] },
    });

    await expect(getMonthlyReports(request)).resolves.toEqual([]);
  });

  it('상세 응답의 선택 통계를 null로 유지한다', async () => {
    const request = vi.fn().mockResolvedValue({
      ...detailResponse,
      data: {
        ...detailResponse.data,
        stats: {
          ...detailResponse.data.stats,
          topPlace: null,
          topArtistName: null,
          averageMoodScore: null,
        },
      },
    });
    const controller = new AbortController();

    await expect(getMonthlyReportDetail(50, request, controller.signal)).resolves.toMatchObject({
      monthlyReportId: 50,
      stats: { topPlace: null, topArtistName: null, averageMoodScore: null },
    });
    expect(request).toHaveBeenCalledWith('/monthly-reports/50', { signal: controller.signal });
  });

  it('잘못된 응답은 INVALID_RESPONSE 오류로 거부한다', async () => {
    const request = vi.fn().mockResolvedValue({
      message: '월간 리포트 목록 조회 성공',
      data: { reports: [{ monthlyReportId: '50' }] },
    });

    await expect(getMonthlyReports(request)).rejects.toMatchObject({
      status: 502,
      code: 'INVALID_RESPONSE',
    } satisfies Partial<ApiError>);
  });

  it('유효하지 않은 상세 ID에는 요청을 보내지 않는다', async () => {
    const request = vi.fn();

    await expect(getMonthlyReportDetail(0, request)).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_MONTHLY_REPORT_ID',
    } satisfies Partial<ApiError>);
    expect(request).not.toHaveBeenCalled();
  });
});
