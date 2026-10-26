interface MemorySearchWelcomeProps {
  onSelectExample: (query: string) => void;
}

const EXAMPLE_QUESTIONS = ['가을에 공원에서 들었던 노래', '비 오는 날 역에서 들었던 노래'] as const;

/** 첫 질문 전에 검색 단서를 안내하고, 예시는 전송 대신 편집할 입력값으로 전달한다. */
export function MemorySearchWelcome({ onSelectExample }: MemorySearchWelcomeProps) {
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
        <h2>
          안녕하세요!
          <br />
          어떤 기억을 찾고 싶으세요?
        </h2>
        <p>어렴풋이 떠오르는 장소나 음악을 이야기해 주세요.</p>
      </div>
      <div className="memory-welcome-examples">
        <p className="memory-welcome-label">이렇게 물어보세요</p>
        {EXAMPLE_QUESTIONS.map((query) => (
          <button
            className="memory-welcome-example"
            key={query}
            onClick={() => onSelectExample(query)}
            type="button"
          >
            <span>{query}</span>
            <span aria-hidden="true">↵</span>
          </button>
        ))}
        <p className="memory-welcome-hint">예시를 누르면 입력창에 채워져요.</p>
      </div>
    </div>
  );
}
