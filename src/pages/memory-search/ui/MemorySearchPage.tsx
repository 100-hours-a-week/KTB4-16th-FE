import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';

import { useSession } from '../../../entities/session/model/useSession';
import { getMemoryRecordCount } from '../../../features/memory-search/api/getMemoryRecordCount';
import { searchMemory } from '../../../features/memory-search/api/memorySearchQueryApi';
import type { MemoryRecordCard } from '../../../features/memory-search/model/memorySearch.types';
import { searchWithConflictWait } from '../../../features/memory-search/model/searchWithConflictWait';
import { useMemorySearchConversation } from '../../../features/memory-search/model/useMemorySearchConversation';
import { MainNavigation } from '../../../features/main-navigation/ui/MainNavigation';
import { ApiError } from '../../../shared/api/apiError';
import '../../pageShell.css';
import './memorySearchPage.css';
import { MemorySearchEmptyState } from './MemorySearchEmptyState';
import { MemorySearchWelcome } from './MemorySearchWelcome';

type Availability = 'loading' | 'ready' | 'empty' | 'error';
const MAX_QUERY_LENGTH = 500;
const INITIAL_VISIBLE_RECORDS = 5;

/** 인증 사용자의 기억 검색 대화를 공개 카드와 제안 화면으로 조립한다. */
export function MemorySearchPage() {
  const navigate = useNavigate();
  const { fetchAuthenticatedJson } = useSession();
  const conversation = useMemorySearchConversation();
  const { startConversation, status } = conversation;
  const [availability, setAvailability] = useState<Availability>('loading');
  const [availabilityRetry, setAvailabilityRetry] = useState(0);
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const questionControllerRef = useRef<AbortController | null>(null);
  const exitingRef = useRef(false);

  // 화면 진입마다 전체 활성 자물쇠 수를 새로 확인해 0개 사용자 입력을 차단한다.
  useEffect(() => {
    const controller = new AbortController();
    void getMemoryRecordCount(fetchAuthenticatedJson, controller.signal)
      .then((count) => {
        if (!controller.signal.aborted) setAvailability(count === 0 ? 'empty' : 'ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setAvailability('error');
      });
    return () => controller.abort();
  }, [fetchAuthenticatedJson, availabilityRetry]);

  // 보유 자물쇠가 확인되면 복원된 ID를 재사용하거나 대화 ID를 한 번 발급받는다.
  useEffect(() => {
    if (availability !== 'ready' || status !== 'idle' || exitingRef.current) return;
    void startConversation().catch(() => undefined);
  }, [availability, startConversation, status]);

  const inputValue = conversation.recoveryQuery || draft;

  /** 예시 질문을 수정할 수 있도록 입력값만 채우고 입력창으로 초점을 옮긴다. */
  function selectExample(query: string) {
    conversation.clearRecoveryQuery();
    setDraft(query);
    inputRef.current?.focus();
  }

  /** 사용자가 명시적으로 채팅을 나갈 때만 서버 대화를 닫고 홈으로 이동한다. */
  function exitChat() {
    exitingRef.current = true;
    questionControllerRef.current?.abort();
    conversation.exitConversation();
    navigate('/');
  }

  /** 현재 대화에 질문을 보내고 409만 제한적으로 재시도한다. */
  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = inputValue.trim();
    if (
      !query ||
      query.length > MAX_QUERY_LENGTH ||
      availability !== 'ready' ||
      status !== 'active' ||
      !conversation.conversationId ||
      conversation.pendingQuery
    ) {
      return;
    }
    const conversationId = conversation.conversationId;
    if (!conversation.beginQuestion(query)) return;
    setFeedback('');
    const controller = new AbortController();
    questionControllerRef.current = controller;
    try {
      const result = await searchWithConflictWait(() => {
        if (!conversation.isQuestionActive(conversationId, query)) {
          throw new DOMException('종료된 대화의 요청입니다.', 'AbortError');
        }
        return searchMemory(conversationId, query, fetchAuthenticatedJson, controller.signal);
      }, controller.signal);
      if (!conversation.isQuestionActive(conversationId, query)) return;
      conversation.completeQuestion(conversationId, query, result);
      setDraft('');
    } catch (error: unknown) {
      if (controller.signal.aborted || !conversation.isQuestionActive(conversationId, query))
        return;
      if (error instanceof ApiError && error.code === 'MEMORY_SEARCH_CONVERSATION_GONE') {
        conversation.markConversationGone(conversationId);
        setFeedback('');
      } else if (error instanceof ApiError && error.code === 'MEMORY_SEARCH_NO_RECORDS') {
        conversation.pauseQuestion(conversationId);
        setAvailability('empty');
      } else if (error instanceof ApiError && error.code === 'MEMORY_SEARCH_IN_PROGRESS') {
        conversation.pauseQuestion(conversationId);
        setFeedback('이전 요청을 기다리는 시간이 길어졌어요. 잠시 후 다시 보내주세요.');
      } else if (error instanceof ApiError && error.code === 'INVALID_INPUT_VALUE') {
        conversation.pauseQuestion(conversationId);
        setFeedback('질문을 1자 이상 500자 이하로 입력해주세요.');
      } else {
        conversation.abandonQuestion(conversationId);
        setFeedback('응답을 확인하지 못해 새 대화를 시작합니다. 질문을 다시 보내주세요.');
      }
    } finally {
      if (questionControllerRef.current === controller) questionControllerRef.current = null;
    }
  }

  /** 카드의 공개 recordId만 상세 경로에 사용한다. */
  function openRecord(recordId: number) {
    navigate(`/records/${recordId}`);
  }

  const selectedTurn =
    conversation.allResultsTurnIndex === null
      ? null
      : conversation.turns[conversation.allResultsTurnIndex];

  return (
    <main className="static-page memory-search-page">
      <div className="static-page-content memory-search-content">
        <header className="memory-search-header">
          <button
            aria-label="채팅 나가기"
            className="memory-search-back-button"
            onClick={exitChat}
            type="button"
          >
            ‹
          </button>
          <h1 className="static-page-title">AI 기억 검색</h1>
          <span aria-hidden="true" className="memory-search-header-spacer" />
        </header>

        <section aria-label="기억 검색 대화" className="memory-search-results">
          {/* 인사말은 화면 안내이므로 AI 히스토리에 추가하지 않고 첫 질문 전에만 표시한다. */}
          {conversation.turns.length === 0 &&
          availability === 'ready' &&
          status === 'active' &&
          conversation.pendingQuery === null &&
          !conversation.recoveryQuery ? (
            <MemorySearchWelcome onSelectExample={selectExample} />
          ) : null}
          {conversation.turns.map((turn, turnIndex) => (
            <div className="memory-turn" key={turnIndex}>
              <p className="memory-query">{turn.query}</p>
              <div className="memory-answer">
                <p>{turn.answer}</p>
                {turn.records.length > 0 ? (
                  <p className="memory-result-count">조건에 맞는 자물쇠 {turn.records.length}건</p>
                ) : null}
                {turn.records.slice(0, INITIAL_VISIBLE_RECORDS).map((record) => (
                  <MemoryCard key={record.recordId} record={record} onOpen={openRecord} />
                ))}
                {turn.records.length > INITIAL_VISIBLE_RECORDS ? (
                  <button
                    className="memory-more-button"
                    onClick={() => conversation.setAllResultsOpen(true, turnIndex)}
                    type="button"
                  >
                    전체보기 ({turn.records.length}건)
                  </button>
                ) : null}
                {turn.suggestedRecords.length > 0 ? (
                  <>
                    <button
                      className="memory-suggestions-toggle"
                      onClick={() =>
                        conversation.setSuggestionsOpen(
                          turnIndex,
                          !conversation.suggestionsOpen[turnIndex],
                        )
                      }
                      type="button"
                    >
                      {conversation.suggestionsOpen[turnIndex]
                        ? '제안 닫기'
                        : `제안 보기 (${turn.suggestedRecords.length}건)`}
                    </button>
                    {conversation.suggestionsOpen[turnIndex]
                      ? turn.suggestedRecords.map((record) => (
                          <div className="memory-suggested-card" key={record.recordId}>
                            <MemoryCard record={record} onOpen={openRecord} />
                            <small>{record.matchedConditions.join(' · ')} 맞아요</small>
                          </div>
                        ))
                      : null}
                  </>
                ) : null}
              </div>
            </div>
          ))}
          {conversation.pendingQuery ? (
            <p aria-live="polite" role="status">
              기억을 찾고 있어요...
            </p>
          ) : null}
          {availability === 'loading' ? <p role="status">자물쇠를 확인하고 있어요.</p> : null}
          {availability === 'empty' ? <MemorySearchEmptyState /> : null}
          {availability === 'error' ? (
            <div role="alert">
              자물쇠 보유 여부를 확인하지 못했어요.
              <button
                onClick={() => {
                  setAvailability('loading');
                  setAvailabilityRetry((count) => count + 1);
                }}
                type="button"
              >
                다시 확인
              </button>
            </div>
          ) : null}
          {status === 'gone' ? (
            <div role="alert">
              새 대화창을 시작해주세요.
              <button onClick={() => void startConversation().catch(() => undefined)} type="button">
                새 대화 시작
              </button>
            </div>
          ) : null}
          {status === 'error' ? (
            <button onClick={() => void startConversation().catch(() => undefined)} type="button">
              대화 시작 다시 시도
            </button>
          ) : null}
          {feedback ? <p role="alert">{feedback}</p> : null}
          {conversation.storageWarning ? (
            <p role="status">새로고침하면 이 대화를 복원하지 못할 수 있어요.</p>
          ) : null}
        </section>

        <form className="memory-search-form" onSubmit={(event) => void submitQuestion(event)}>
          <input
            aria-label="기억 검색 질문"
            ref={inputRef}
            disabled={
              availability !== 'ready' || status !== 'active' || conversation.pendingQuery !== null
            }
            maxLength={MAX_QUERY_LENGTH}
            onChange={(event) => {
              conversation.clearRecoveryQuery();
              setDraft(event.target.value);
            }}
            placeholder={
              availability === 'empty'
                ? '자물쇠를 남긴 뒤 검색할 수 있어요'
                : '기억나는 단서로 물어보세요'
            }
            value={inputValue}
          />
          <button
            aria-label="질문 보내기"
            disabled={
              availability !== 'ready' ||
              status !== 'active' ||
              conversation.pendingQuery !== null ||
              !inputValue.trim()
            }
            type="submit"
          >
            ➤
          </button>
        </form>
      </div>
      <MainNavigation activeItem="home" />
      {conversation.isAllResultsOpen && selectedTurn ? (
        <div className="memory-sheet-backdrop">
          <section
            aria-label="전체보기"
            aria-modal="true"
            className="memory-results-sheet"
            role="dialog"
          >
            <header>
              <h2>조건에 맞는 자물쇠 {selectedTurn.records.length}건</h2>
              <button
                aria-label="전체보기 닫기"
                onClick={() => conversation.setAllResultsOpen(false)}
                type="button"
              >
                ×
              </button>
            </header>
            <div className="memory-sheet-list">
              {selectedTurn.records.map((record) => (
                <MemoryCard key={record.recordId} record={record} onOpen={openRecord} />
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

/** 검증된 자물쇠 DTO를 채팅과 전체보기에서 같은 방식으로 표시한다. */
function MemoryCard({
  record,
  onOpen,
}: {
  record: MemoryRecordCard;
  onOpen: (recordId: number) => void;
}) {
  return (
    <button
      aria-label={`${record.title} 상세보기`}
      className="memory-result-card"
      onClick={() => onOpen(record.recordId)}
      type="button"
    >
      {record.albumImageUrl ? (
        <img alt="" className="memory-result-cover" src={record.albumImageUrl} />
      ) : (
        <span aria-hidden="true" className="memory-result-cover" />
      )}
      <span>
        <strong>
          {record.title} — {record.artistName}
        </strong>
        <small>
          {record.placeName ?? '장소 미확인'} · {record.date}
          {record.weatherCondition ? ` · ${record.weatherCondition}` : ''}
        </small>
      </span>
    </button>
  );
}
