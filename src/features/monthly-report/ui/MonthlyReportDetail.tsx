import type { MonthlyReportDetail as MonthlyReportDetailData } from '../model/monthlyReport.types';

type MonthlyReportDetailProps = {
  report: MonthlyReportDetailData;
};

/** 완료된 AI 회고만 노출하고 나머지 상태는 준비 안내로 전환한다. */
function getAiRecapText(report: MonthlyReportDetailData): string {
  if (report.aiRecap.status === 'COMPLETED' && report.aiRecap.text) {
    return report.aiRecap.text;
  }

  return 'AI 회고를 준비하고 있어요.';
}

/** 서버에서 검증된 월별 리포트 스냅샷을 통계·사진·회고 섹션으로 표시한다. */
export function MonthlyReportDetail({ report }: MonthlyReportDetailProps) {
  const topPlace = report.stats.topPlace?.legalDongName ?? '기록 없음';
  const topArtist = report.stats.topArtistName ?? '기록 없음';
  const averageMood =
    report.stats.averageMoodScore === null ? '기록 없음' : `${report.stats.averageMoodScore}점`;

  return (
    <article className="report-detail-content">
      <section className="report-recap" aria-label="AI 회고">
        <span>AI 회고</span>
        <h2>{getAiRecapText(report)}</h2>
      </section>
      <section className="report-stat-grid" aria-label="월별 기록 통계">
        <article>
          <small>남긴 기록</small>
          <strong>{report.stats.recordCount}개</strong>
        </article>
        <article>
          <small>가장 많이 간 곳</small>
          <strong>{topPlace}</strong>
        </article>
        <article>
          <small>가장 많이 들은 아티스트</small>
          <strong>{topArtist}</strong>
        </article>
        <article>
          <small>평균 기분 점수</small>
          <strong>{averageMood}</strong>
        </article>
      </section>
      <section className="report-photo" aria-label="사진 장면 분석">
        <h2>사진 장면 분석</h2>
        {report.photoScenes.length === 0 ? (
          <p>사진 장면 분석 결과가 없어요.</p>
        ) : (
          report.photoScenes.map((scene) => (
            <span key={`${scene.sceneTag}-${scene.count}`}>
              {scene.sceneTag} {scene.count}개 · {scene.ratio}%
            </span>
          ))
        )}
      </section>
    </article>
  );
}
