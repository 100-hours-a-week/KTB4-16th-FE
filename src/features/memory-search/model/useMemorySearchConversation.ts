import { use } from 'react';

import {
  MemorySearchConversationContext,
  type MemorySearchConversationContextValue,
} from './memorySearchConversationContext';

/** 상세 왕복 동안 유지되는 현재 기억 검색 대화 상태와 동작을 반환한다. */
export function useMemorySearchConversation(): MemorySearchConversationContextValue {
  const conversation = use(MemorySearchConversationContext);

  if (!conversation) {
    throw new Error(
      'useMemorySearchConversation은 MemorySearchConversationProvider 안에서 사용해야 합니다.',
    );
  }

  return conversation;
}
