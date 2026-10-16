import { createContext } from 'react';
import type { MemorySearchResult, MemorySearchTurn } from './memorySearch.types';

export type MemorySearchConversationStatus = 'idle' | 'starting' | 'active' | 'gone' | 'error';

export interface MemorySearchConversationContextValue {
  status: MemorySearchConversationStatus;
  conversationId: string | null;
  isAllResultsOpen: boolean;
  allResultsTurnIndex: number | null;
  turns: MemorySearchTurn[];
  suggestionsOpen: boolean[];
  pendingQuery: string | null;
  recoveryQuery: string;
  storageWarning: boolean;
  startConversation: () => Promise<string | null>;
  exitConversation: () => void;
  markConversationGone: (conversationId: string) => void;
  setAllResultsOpen: (open: boolean, turnIndex?: number) => void;
  setSuggestionsOpen: (turnIndex: number, open: boolean) => void;
  beginQuestion: (query: string) => boolean;
  isQuestionActive: (conversationId: string, query: string) => boolean;
  completeQuestion: (conversationId: string, query: string, result: MemorySearchResult) => void;
  pauseQuestion: (conversationId: string) => void;
  abandonQuestion: (conversationId: string) => void;
  clearRecoveryQuery: () => void;
}

export const MemorySearchConversationContext =
  createContext<MemorySearchConversationContextValue | null>(null);
