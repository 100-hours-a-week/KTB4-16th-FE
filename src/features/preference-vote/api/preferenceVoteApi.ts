import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { ApiError } from '../../../shared/api/apiError';
import { getCsrfToken } from '../../../shared/api/csrf';

type PreferenceVoteRequest = AuthenticatedApiClient['fetchJson'];

export interface TodayPreferenceVote {
  voteQuestionId: number;
  question: string;
  optionA: string;
  optionB: string;
  myAnswer: string | null;
  voteAnswerId: number | null;
}

export interface PreferenceVoteResult {
  voteAnswerId: number;
  myAnswer: string;
  optionAPercent: number;
  optionBPercent: number;
}

type VoteOption = 'A' | 'B';

/** 인증된 사용자의 오늘 취향 투표와 기존 답변을 조회한다. */
export async function getTodayPreferenceVote(
  request: PreferenceVoteRequest,
): Promise<TodayPreferenceVote> {
  const response = await request<unknown>('/vote-questions/today');
  return parseTodayPreferenceVote(response);
}

/** 선택한 A/B 항목을 한 번만 제출하고 서버가 계산한 결과 비율을 반환한다. */
export async function submitPreferenceVote(
  request: PreferenceVoteRequest,
  voteQuestionId: number,
  selectedOption: VoteOption,
): Promise<PreferenceVoteResult> {
  const csrfToken = await getCsrfToken();
  const response = await request<unknown>(`/vote-questions/${voteQuestionId}/answers`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrfToken },
    body: JSON.stringify({ selectedOption }),
  });
  return parsePreferenceVoteResult(response);
}

/** 오늘 투표 응답이 OpenAPI의 data 형식을 지키는지 런타임에서 검증한다. */
function parseTodayPreferenceVote(value: unknown): TodayPreferenceVote {
  const data = getData(value);
  if (
    !isPositiveInteger(data.voteQuestionId) ||
    !isNonEmptyString(data.question) ||
    !isNonEmptyString(data.optionA) ||
    !isNonEmptyString(data.optionB) ||
    !isNullableString(data.myAnswer) ||
    !isNullablePositiveInteger(data.voteAnswerId)
  )
    throw invalidResponseError();
  return {
    voteQuestionId: data.voteQuestionId,
    question: data.question,
    optionA: data.optionA,
    optionB: data.optionB,
    myAnswer: data.myAnswer,
    voteAnswerId: data.voteAnswerId,
  };
}

/** 제출 결과가 OpenAPI의 data.result 형식을 지키는지 런타임에서 검증한다. */
function parsePreferenceVoteResult(value: unknown): PreferenceVoteResult {
  const data = getData(value);
  const result = data.result;
  if (
    !isPositiveInteger(data.voteAnswerId) ||
    !isNonEmptyString(data.myAnswer) ||
    !isRecord(result) ||
    !isPercent(result.optionAPercent) ||
    !isPercent(result.optionBPercent) ||
    result.optionAPercent + result.optionBPercent !== 100
  )
    throw invalidResponseError();
  return {
    voteAnswerId: data.voteAnswerId,
    myAnswer: data.myAnswer,
    optionAPercent: result.optionAPercent,
    optionBPercent: result.optionBPercent,
  };
}

/** API 공통 응답의 data 객체만 안전하게 꺼낸다. */
function getData(value: unknown): Record<string, unknown> {
  if (!isRecord(value) || !isRecord(value.data)) throw invalidResponseError();
  return value.data;
}

/** 예상과 다른 성공 응답을 화면 오류로 일관되게 전달한다. */
function invalidResponseError(): ApiError {
  return new ApiError(502, '서버 응답 형식을 확인할 수 없습니다.', 'INVALID_RESPONSE');
}
/** 외부 JSON 값이 필드 접근 가능한 객체인지 확인한다. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/** API 식별자는 양의 안전한 정수여야 한다. */
function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
/** API 문자열은 빈 값이면 화면에 표시할 수 없다. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
/** 기존 답변은 아직 투표하지 않았을 때만 null일 수 있다. */
function isNullableString(value: unknown): value is string | null {
  return value === null || isNonEmptyString(value);
}
/** 기존 답변 ID는 아직 투표하지 않았을 때만 null일 수 있다. */
function isNullablePositiveInteger(value: unknown): value is number | null {
  return value === null || isPositiveInteger(value);
}
/** 서버가 반환하는 비율은 0부터 100까지의 정수다. */
function isPercent(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100;
}
