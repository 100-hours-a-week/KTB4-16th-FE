/** 화면 읽기 프로그램에는 상태를 한 번 알리고, 장식용 점 세 개만 움직인다. */
function MemorySearchTypingDots() {
  return (
    <span aria-hidden="true" className="memory-typing-dots">
      <span />
      <span />
      <span />
    </span>
  );
}

/** 기억 검색의 확인·재시작 상태에 맞는 장식용 아이콘을 표시한다. */
function MemorySearchStateSymbol({ restart = false }: { restart?: boolean }) {
  return (
    <span aria-hidden="true" className="memory-state-symbol">
      <svg viewBox="0 0 24 24">
        {restart ? (
          <>
            <path d="M20 11.5a8 8 0 0 1-8 8 9 9 0 0 1-3.5-.7L4 20l1.2-4.5A8 8 0 1 1 20 11.5Z" />
            <path d="M12 8v7M8.5 11.5h7" />
          </>
        ) : (
          <>
            <rect x="5" y="10" width="14" height="11" rx="3" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
          </>
        )}
      </svg>
    </span>
  );
}

/** 전송된 질문과 AI 대기 말풍선을 보여 주되 완료된 대화 기록에는 추가하지 않는다. */
export function MemorySearchPending({ query }: { query: string }) {
  return (
    <div className="memory-turn">
      <p className="memory-query">{query}</p>
      <div className="memory-pending-reply">
        <div className="memory-welcome-sender">
          <MemorySearchStateSymbol />
          <span>MULO</span>
        </div>
        <div
          aria-label="AI 응답 대기 중"
          className="memory-answer memory-typing-bubble"
          role="status"
        >
          <span className="memory-status-text">AI가 답변을 준비하고 있어요.</span>
          <MemorySearchTypingDots />
        </div>
      </div>
    </div>
  );
}

/** 입장 시 보유 자물쇠 확인과 이어지는 대화 준비 상태를 중앙에서 안내한다. */
export function MemorySearchEntryLoading({ preparing = false }: { preparing?: boolean }) {
  return (
    <div
      aria-label={preparing ? '대화 준비 중' : '자물쇠 확인 중'}
      className="memory-state"
      role="status"
    >
      <MemorySearchStateSymbol />
      <h2>{preparing ? '대화를 준비하고 있어요' : '자물쇠를 확인하고 있어요'}</h2>
      <p>
        남겨 둔 기억을 검색할 수 있도록
        <br />
        잠시 준비하고 있어요.
      </p>
      <MemorySearchTypingDots />
    </div>
  );
}

/** 만료된 대화에서는 사용자가 중앙 버튼을 눌러야 새 대화를 시작하도록 안내한다. */
export function MemorySearchConversationExpired({ onStart }: { onStart: () => void }) {
  return (
    <div className="memory-state" role="alert">
      <MemorySearchStateSymbol restart />
      <h2>새 대화를 시작해 주세요</h2>
      <p>
        이전 대화가 종료되었어요.
        <br />
        기억나는 단서로 다시 찾아볼까요?
      </p>
      <button className="memory-state-action" onClick={onStart} type="button">
        <span aria-hidden="true">＋</span>새 대화 시작
      </button>
    </div>
  );
}
