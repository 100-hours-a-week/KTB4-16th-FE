/** 월별 리포트 목록에서 한 달을 식별하고 표시하는 서버 요약 정보다. */
export type MonthlyReportSummary = {
  monthlyReportId: number;
  year: number;
  month: number;
  recordCount: number;
  aiRecapStatus: string;
};

/** 월별 리포트의 대표 장소 통계를 표현한다. */
export type MonthlyReportTopPlace = {
  placeId: number;
  legalDongName: string | null;
};

/** 월별 리포트에 저장된 기록·장소·음악·기분 통계를 표현한다. */
export type MonthlyReportStats = {
  recordCount: number;
  topPlace: MonthlyReportTopPlace | null;
  topArtistName: string | null;
  averageMoodScore: number | null;
};

/** 월별 리포트의 사진 장면 집계 한 항목을 표현한다. */
export type MonthlyPhotoScene = {
  sceneTag: string;
  count: number;
  ratio: number;
};

/** AI 회고의 처리 상태와 완료된 경우의 텍스트를 표현한다. */
export type MonthlyReportAiRecap = {
  status: string;
  text: string | null;
};

/** 월별 리포트 상세 화면이 서버에서 받아 표시하는 스냅샷이다. */
export type MonthlyReportDetail = {
  monthlyReportId: number;
  year: number;
  month: number;
  stats: MonthlyReportStats;
  photoScenes: MonthlyPhotoScene[];
  aiRecap: MonthlyReportAiRecap;
};
