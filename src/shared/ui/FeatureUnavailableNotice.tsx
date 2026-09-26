import { Link } from 'react-router';

import './featureUnavailableNotice.css';

interface FeatureUnavailableNoticeProps {
  title: string;
  description: string;
  homeLabel?: string;
}

/** API가 아직 제공되지 않은 기능과 홈 복귀 경로를 명확히 안내한다. */
export function FeatureUnavailableNotice({
  title,
  description,
  homeLabel = '홈으로 돌아가기',
}: FeatureUnavailableNoticeProps) {
  return (
    <section className="feature-unavailable-notice">
      <h2>{title}</h2>
      <p role="status">미구현 기능입니다. {description}</p>
      <Link to="/">{homeLabel}</Link>
    </section>
  );
}
