import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { expect, it } from 'vitest';

import { useMemorySearchScroll } from './useMemorySearchScroll';

/** 상세 복귀처럼 이미 완료된 대화가 있는 화면의 최초 마운트를 재현한다. */
function RestoredConversation() {
  const { scrollRef, handleConversationScroll } = useMemorySearchScroll({
    conversationId: 'restored-conversation',
    turnCount: 3,
    pendingQuery: null,
  });
  return (
    <section
      aria-label="복원된 대화"
      onScroll={handleConversationScroll}
      ref={(element) => {
        if (element) {
          // JSDOM의 레이아웃 부재만 보완하고 실제 스크롤 제어는 Hook이 수행한다.
          Object.defineProperties(element, {
            clientHeight: { configurable: true, value: 300 },
            scrollHeight: { configurable: true, value: 1_000 },
          });
        }
        scrollRef.current = element;
      }}
    >
      복원된 검색 결과
    </section>
  );
}

it('실제 앱의 StrictMode에서도 복원된 대화를 최신 결과 위치에 표시한다', async () => {
  render(
    <StrictMode>
      <RestoredConversation />
    </StrictMode>,
  );
  await waitFor(() =>
    expect(screen.getByRole('region', { name: '복원된 대화' }).scrollTop).toBe(700),
  );
});
