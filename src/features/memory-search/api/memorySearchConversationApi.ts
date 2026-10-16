import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { ApiError } from '../../../shared/api/apiError';
import { getCsrfToken } from '../../../shared/api/csrf';

type Request = AuthenticatedApiClient['fetchJson'];

const CONVERSATIONS_PATH = '/memories/search/conversations';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 인증 사용자에게 새 대화 ID를 발급받고 응답 경계에서 ID를 검증한다. */
export async function createMemorySearchConversation(request: Request): Promise<string> {
  const csrfToken = await getCsrfToken();
  const response = await request<unknown>(CONVERSATIONS_PATH, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-XSRF-TOKEN': csrfToken },
  });

  if (
    !isRecord(response) ||
    typeof response.message !== 'string' ||
    !isRecord(response.data) ||
    typeof response.data.conversationId !== 'string' ||
    !UUID_PATTERN.test(response.data.conversationId)
  ) {
    throw new ApiError(502, '서버 응답 형식을 확인할 수 없습니다.', 'INVALID_RESPONSE');
  }

  return response.data.conversationId;
}

/** 명시적 채팅 나가기에서 백엔드 대화 상태를 삭제하고 204 빈 응답을 허용한다. */
export async function deleteMemorySearchConversation(
  conversationId: string,
  request: Request,
): Promise<void> {
  if (conversationId.trim().length === 0) {
    throw new Error('종료할 대화 ID가 필요합니다.');
  }

  const csrfToken = await getCsrfToken();
  await request<unknown>(`${CONVERSATIONS_PATH}/${encodeURIComponent(conversationId)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'X-XSRF-TOKEN': csrfToken },
  });
}

/** 외부 JSON이 안전하게 필드를 읽을 수 있는 객체인지 판별한다. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
