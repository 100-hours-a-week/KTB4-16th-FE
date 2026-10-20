import { useCallback, useLayoutEffect, useRef, useState, type UIEvent } from 'react';

/** 하단 48px 이내의 작은 위치 차이는 최신 대화를 보고 있는 것으로 취급한다. */
const NEAR_BOTTOM_DISTANCE_PX = 48;

interface ConversationPosition {
  conversationId: string | null;
  turnCount: number;
  pendingQuery: string | null;
}

/** 새 질문은 하단에 표시하고, 과거 대화를 읽는 동안 도착한 답변은 버튼으로 안내한다. */
export function useMemorySearchScroll(position: ConversationPosition) {
  const scrollRef = useRef<HTMLElement>(null);
  const previousPositionRef = useRef<ConversationPosition | null>(null);
  const followingLatestRef = useRef(true);
  const [hasNewAnswer, setHasNewAnswer] = useState(false);
  const { conversationId, turnCount, pendingQuery } = position;

  /** 대화 영역만 하단으로 이동하고 확인하지 않은 답변 표식을 해제한다. */
  const scrollToLatest = useCallback(() => {
    const viewport = scrollRef.current;
    if (viewport) viewport.scrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    followingLatestRef.current = true;
    setHasNewAnswer(false);
  }, []);

  /** 사용자의 실제 스크롤 위치를 기록하며 하단까지 읽으면 새 답변 안내를 숨긴다. */
  function handleConversationScroll(event: UIEvent<HTMLElement>) {
    const viewport = event.currentTarget;
    const distance = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop;
    followingLatestRef.current = distance <= NEAR_BOTTOM_DISTANCE_PX;
    if (followingLatestRef.current) setHasNewAnswer(false);
  }

  // DOM에 새 말풍선이 반영된 뒤, 반영 전의 읽기 의도를 기준으로 이동 여부를 결정한다.
  useLayoutEffect(() => {
    const previous = previousPositionRef.current;
    const changedConversation = previous?.conversationId !== conversationId;
    const startedQuestion = pendingQuery !== null && pendingQuery !== previous?.pendingQuery;
    const receivedAnswer =
      !changedConversation && previous !== null && turnCount > previous.turnCount;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      // StrictMode에서 취소된 effect가 최초 복원 스크롤을 처리한 것으로 남지 않게 한다.
      previousPositionRef.current = { conversationId, turnCount, pendingQuery };
      if (!changedConversation && !startedQuestion && !receivedAnswer) return;
      if (changedConversation || startedQuestion) followingLatestRef.current = true;
      if (followingLatestRef.current && (turnCount > 0 || pendingQuery !== null)) scrollToLatest();
      else setHasNewAnswer(receivedAnswer);
    });
    return () => {
      active = false;
    };
  }, [conversationId, turnCount, pendingQuery, scrollToLatest]);

  return { scrollRef, handleConversationScroll, hasNewAnswer, scrollToLatest };
}
