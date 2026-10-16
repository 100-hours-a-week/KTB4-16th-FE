import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { useSession } from '../../../entities/session/model/useSession';
import { ApiError } from '../../../shared/api/apiError';
import {
  createMemorySearchConversation,
  deleteMemorySearchConversation,
} from '../api/memorySearchConversationApi';
import {
  MemorySearchConversationContext,
  type MemorySearchConversationStatus,
} from './memorySearchConversationContext';
import type { MemorySearchResult, MemorySearchTurn } from './memorySearch.types';
import {
  clearMemorySearchSnapshot,
  loadMemorySearchSnapshot,
  saveMemorySearchSnapshot,
} from './memorySearchSnapshot';
import { isSameUiSession, readUiUserId } from './memorySearchSessionIdentity';

interface ConversationState {
  status: MemorySearchConversationStatus;
  conversationId: string | null;
  turns: MemorySearchTurn[];
  isAllResultsOpen: boolean;
  allResultsTurnIndex: number | null;
  suggestionsOpen: boolean[];
  pendingQuery: string | null;
  recoveryQuery: string;
}

const INITIAL_STATE: ConversationState = {
  status: 'idle',
  conversationId: null,
  turns: [],
  isAllResultsOpen: false,
  allResultsTurnIndex: null,
  suggestionsOpen: [],
  pendingQuery: null,
  recoveryQuery: '',
};

/** 상세 왕복·같은 탭 새로고침 사이에 백엔드 대화 ID와 완료된 화면 턴을 보관한다. */
export function MemorySearchConversationProvider({ children }: PropsWithChildren) {
  const { accessToken, fetchAuthenticatedJson, isAuthenticated, isSessionRestoring } = useSession();
  const [state, setState] = useState<ConversationState>(INITIAL_STATE);
  const [storageWarning, setStorageWarning] = useState(false);
  const stateRef = useRef(state);
  const activeIdRef = useRef<string | null>(null);
  const pendingStartRef = useRef<Promise<string | null> | null>(null);
  const generationRef = useRef(0);
  const hydratedRef = useRef(false);
  const currentSessionRef = useRef({ accessToken, isAuthenticated });

  /** 현재 상태를 화면에 반영하고 인증된 동일 사용자의 스냅샷을 즉시 기록한다. */
  const commitState = useCallback(
    (next: ConversationState) => {
      stateRef.current = next;
      setState(next);
      if (!hydratedRef.current || !accessToken || !next.conversationId) return;
      const userId = readUiUserId(accessToken);
      if (!userId) return;
      const saved = saveMemorySearchSnapshot(userId, {
        conversationId: next.conversationId,
        turns: next.turns,
        allResultsTurnIndex: next.allResultsTurnIndex,
        suggestionsOpen: next.suggestionsOpen,
        pendingQuery: next.pendingQuery,
      });
      if (!saved) {
        // 오래된 스냅샷이 남으면 새로고침 뒤 서버 문맥과 화면이 어긋날 수 있다.
        clearMemorySearchSnapshot();
        setStorageWarning(true);
      }
    },
    [accessToken],
  );

  /** 종료 요청 실패가 화면 초기화를 막지 않도록 서버 종료를 최선 노력으로 수행한다. */
  const closeInBackground = useCallback(
    (conversationId: string) => {
      void deleteMemorySearchConversation(conversationId, fetchAuthenticatedJson).catch(() => {
        // 서버는 명시적 종료 요청 유실 시 30분 유휴 만료로 대화를 정리한다.
      });
    },
    [fetchAuthenticatedJson],
  );

  /** 대화 상태와 저장된 화면 정보를 지우고 선택적으로 기존 ID를 종료한다. */
  const resetConversation = useCallback(
    (closeOnServer: boolean, recoveryQuery = '') => {
      generationRef.current += 1;
      pendingStartRef.current = null;
      const oldId = activeIdRef.current;
      activeIdRef.current = null;
      clearMemorySearchSnapshot();
      setStorageWarning(false);
      commitState({ ...INITIAL_STATE, recoveryQuery });
      if (closeOnServer && oldId) closeInBackground(oldId);
    },
    [closeInBackground, commitState],
  );

  /** 중복 진입 요청을 공유하고 늦게 도착한 이전 대화 ID를 폐기한다. */
  const startConversation = useCallback((): Promise<string | null> => {
    if (!isAuthenticated) {
      return Promise.reject(new ApiError(401, '로그인이 필요합니다.', 'UNAUTHORIZED'));
    }
    if (activeIdRef.current) return Promise.resolve(activeIdRef.current);
    if (pendingStartRef.current) return pendingStartRef.current;

    const generation = generationRef.current;
    const requestToken = accessToken;
    commitState({ ...stateRef.current, status: 'starting', conversationId: null });
    const pending = createMemorySearchConversation(fetchAuthenticatedJson)
      .then((conversationId): string | null => {
        if (generation !== generationRef.current) {
          if (
            currentSessionRef.current.isAuthenticated &&
            isSameUiSession(requestToken, currentSessionRef.current.accessToken)
          ) {
            closeInBackground(conversationId);
          }
          return null;
        }
        activeIdRef.current = conversationId;
        commitState({ ...stateRef.current, status: 'active', conversationId });
        return conversationId;
      })
      .catch((error: unknown) => {
        if (generation === generationRef.current) {
          commitState({ ...stateRef.current, status: 'error', conversationId: null });
        }
        throw error;
      })
      .finally(() => {
        if (pendingStartRef.current === pending) pendingStartRef.current = null;
      });
    pendingStartRef.current = pending;
    return pending;
  }, [accessToken, closeInBackground, commitState, fetchAuthenticatedJson, isAuthenticated]);

  /** 명시적 나가기에서 화면 상태를 즉시 지우고 서버 대화를 종료한다. */
  const exitConversation = useCallback(() => resetConversation(true), [resetConversation]);

  /** 현재 대화의 410만 반영하고 이전 요청에서 늦게 온 410은 무시한다. */
  const markConversationGone = useCallback(
    (conversationId: string) => {
      if (activeIdRef.current !== conversationId) return;
      generationRef.current += 1;
      pendingStartRef.current = null;
      activeIdRef.current = null;
      clearMemorySearchSnapshot();
      commitState({ ...INITIAL_STATE, status: 'gone' });
    },
    [commitState],
  );

  /** 선택한 턴의 전체보기 시트를 상세 화면 왕복에도 유지한다. */
  const setAllResultsOpen = useCallback(
    (open: boolean, turnIndex?: number) => {
      const current = stateRef.current;
      if (current.status !== 'active') return;
      const index = turnIndex ?? current.turns.length - 1;
      commitState({
        ...current,
        isAllResultsOpen: open,
        allResultsTurnIndex: open && index >= 0 ? index : null,
      });
    },
    [commitState],
  );

  /** 턴별 제안 토글 열림 상태를 변경한다. */
  const setSuggestionsOpen = useCallback(
    (turnIndex: number, open: boolean) => {
      const current = stateRef.current;
      if (turnIndex < 0 || turnIndex >= current.turns.length) return;
      const suggestionsOpen = [...current.suggestionsOpen];
      suggestionsOpen[turnIndex] = open;
      commitState({ ...current, suggestionsOpen });
    },
    [commitState],
  );

  /** 질문을 보내기 전에 진행 중 표식을 동기적으로 저장해 새로고침 유실을 구별한다. */
  const beginQuestion = useCallback(
    (query: string): boolean => {
      const current = stateRef.current;
      if (current.status !== 'active' || current.pendingQuery !== null || !current.conversationId) {
        return false;
      }
      commitState({ ...current, pendingQuery: query, recoveryQuery: '' });
      return true;
    },
    [commitState],
  );

  /** 상세 왕복은 허용하되 계정·대화가 바뀐 요청의 재시도와 오류 반영을 차단한다. */
  const isQuestionActive = useCallback((conversationId: string, query: string): boolean => {
    return activeIdRef.current === conversationId && stateRef.current.pendingQuery === query;
  }, []);

  /** 현재 대화의 성공 응답만 완료 턴으로 기록하고 진행 중 표식을 지운다. */
  const completeQuestion = useCallback(
    (conversationId: string, query: string, result: MemorySearchResult) => {
      const current = stateRef.current;
      if (activeIdRef.current !== conversationId || current.pendingQuery !== query) return;
      commitState({
        ...current,
        turns: [...current.turns, { query, ...result }],
        suggestionsOpen: [...current.suggestionsOpen, false],
        pendingQuery: null,
        recoveryQuery: '',
        isAllResultsOpen: false,
        allResultsTurnIndex: null,
      });
    },
    [commitState],
  );

  /** 현재 대화의 409 대기가 끝나면 질문을 입력창에 남기고 진행 중 표식을 지운다. */
  const pauseQuestion = useCallback(
    (conversationId: string) => {
      if (activeIdRef.current !== conversationId) return;
      const current = stateRef.current;
      if (!current.pendingQuery) return;
      commitState({ ...current, recoveryQuery: current.pendingQuery, pendingQuery: null });
    },
    [commitState],
  );

  /** 현재 대화의 결과가 유실됐을 가능성이 있으면 질문 문구만 보존하고 초기화한다. */
  const abandonQuestion = useCallback(
    (conversationId: string) => {
      if (activeIdRef.current !== conversationId) return;
      const query = stateRef.current.pendingQuery ?? stateRef.current.recoveryQuery;
      resetConversation(true, query);
    },
    [resetConversation],
  );

  /** 사용자가 보존된 질문을 다시 제출한 뒤 입력창 복구값을 비운다. */
  const clearRecoveryQuery = useCallback(() => {
    const current = stateRef.current;
    if (current.recoveryQuery) commitState({ ...current, recoveryQuery: '' });
  }, [commitState]);

  // 계정 변경은 이전 사용자의 화면 정보를 새 사용자에게 보여주기 전에 지운다.
  useLayoutEffect(() => {
    const previous = currentSessionRef.current;
    currentSessionRef.current = { accessToken, isAuthenticated };
    if (
      previous.isAuthenticated &&
      (!isAuthenticated || !isSameUiSession(previous.accessToken, accessToken))
    ) {
      resetConversation(false);
      hydratedRef.current = false;
    }
  }, [accessToken, isAuthenticated, resetConversation]);

  // 인증 복원 뒤 같은 사용자의 완료 턴만 복원하고 진행 중 스냅샷은 안전하게 폐기한다.
  useLayoutEffect(() => {
    if (isSessionRestoring || !isAuthenticated || !accessToken || hydratedRef.current) return;
    const userId = readUiUserId(accessToken);
    const snapshot = userId ? loadMemorySearchSnapshot(userId) : null;
    if (!snapshot) {
      hydratedRef.current = true;
      return;
    }
    let active = true;
    queueMicrotask(() => {
      if (!active || currentSessionRef.current.accessToken !== accessToken) return;
      hydratedRef.current = true;
      if (snapshot.pendingQuery !== null) {
        clearMemorySearchSnapshot();
        closeInBackground(snapshot.conversationId);
        commitState({ ...INITIAL_STATE, recoveryQuery: snapshot.pendingQuery });
        return;
      }
      activeIdRef.current = snapshot.conversationId;
      commitState({
        ...INITIAL_STATE,
        status: 'active',
        conversationId: snapshot.conversationId,
        turns: snapshot.turns,
        isAllResultsOpen: snapshot.allResultsTurnIndex !== null,
        allResultsTurnIndex: snapshot.allResultsTurnIndex,
        suggestionsOpen: snapshot.suggestionsOpen,
      });
    });
    return () => {
      active = false;
    };
  }, [accessToken, closeInBackground, commitState, isAuthenticated, isSessionRestoring]);

  useLayoutEffect(
    () => () => {
      // 새로고침 뒤 이전 Provider의 늦은 시작 응답은 새 화면에 반영하지 않는다.
      generationRef.current += 1;
    },
    [],
  );

  const value = useMemo(
    () => ({
      ...state,
      storageWarning,
      startConversation,
      exitConversation,
      markConversationGone,
      setAllResultsOpen,
      setSuggestionsOpen,
      beginQuestion,
      isQuestionActive,
      completeQuestion,
      pauseQuestion,
      abandonQuestion,
      clearRecoveryQuery,
    }),
    [
      state,
      storageWarning,
      startConversation,
      exitConversation,
      markConversationGone,
      setAllResultsOpen,
      setSuggestionsOpen,
      beginQuestion,
      isQuestionActive,
      completeQuestion,
      pauseQuestion,
      abandonQuestion,
      clearRecoveryQuery,
    ],
  );

  return (
    <MemorySearchConversationContext value={value}>{children}</MemorySearchConversationContext>
  );
}
