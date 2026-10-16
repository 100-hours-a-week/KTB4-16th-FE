import { Link } from 'react-router';

/** 보유 자물쇠가 없는 사용자를 검색 대신 첫 기록 작성으로 안내한다. */
export function MemorySearchEmptyState() {
  return (
    <div className="memory-welcome">
      <div className="memory-welcome-sender">
        <span aria-hidden="true" className="memory-welcome-symbol">
          <svg viewBox="0 0 24 24">
            <rect x="5" y="10" width="14" height="11" rx="3" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
          </svg>
        </span>
        <span>MULO</span>
      </div>
      <div className="memory-answer memory-welcome-bubble">
        <h2>아직 남겨 둔 자물쇠가 없어요</h2>
        <p>
          노래와 장소를 자물쇠로 남겨보세요.
          <br />
          기억이 쌓이면 단서로 다시 찾아드릴게요.
        </p>
        <Link className="memory-empty-create" to="/locks/create">
          첫 자물쇠 만들기 <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
