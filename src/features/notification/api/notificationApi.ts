import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { getCsrfToken } from '../../../shared/api/csrf';

export type NotificationType =
  'MONTHLY_REPORT_CREATED' | 'MATCH_COMPLETED' | 'FRIEND_REQUEST' | 'FRIEND_ACCEPTED';

export type NotificationItem = {
  notificationId: number;
  type: NotificationType;
  targetId: number | null;
  targetType: string;
  title: string;
  content: string;
  createdAt: string;
  readAt: string | null;
};

export type NotificationPage = {
  items: NotificationItem[];
  nextCursor: string | null;
};

type Request = AuthenticatedApiClient['fetchJson'];

/** OpenAPI v2.8의 최신순 알림 페이지를 읽고 외부 응답을 검증한다. */
export async function getNotifications(
  cursor: string | null,
  request: Request,
  signal: AbortSignal,
  size = 20,
): Promise<NotificationPage> {
  const query = new URLSearchParams({ size: String(size) });
  if (cursor !== null) query.set('cursor', cursor);
  const response = await request<unknown>(`/notifications?${query.toString()}`, { signal });
  if (!isRecord(response) || typeof response.message !== 'string' || !isRecord(response.data)) {
    throw new Error('알림 목록 응답 형식이 올바르지 않습니다.');
  }
  const { notifications, nextCursor } = response.data;
  if (!Array.isArray(notifications) || !(nextCursor === null || typeof nextCursor === 'string')) {
    throw new Error('알림 목록 응답 형식이 올바르지 않습니다.');
  }
  return { items: notifications.map(parseNotification), nextCursor };
}

/** 읽음 변경 없이 알림 페이지를 끝까지 확인해 미읽음 항목의 존재 여부만 반환한다. */
export async function hasUnreadNotifications(
  request: Request,
  signal: AbortSignal,
): Promise<boolean> {
  let cursor: string | null = null;
  do {
    signal.throwIfAborted();
    const page = await getNotifications(cursor, request, signal, 100);
    if (page.items.some((item) => item.readAt === null)) return true;
    cursor = page.nextCursor;
  } while (cursor !== null);
  return false;
}

/** 실제 조회한 미읽음 ID만 CSRF를 포함한 PATCH로 일괄 읽음 처리한다. */
export async function markNotificationsRead(
  notificationIds: number[],
  request: Request,
  signal: AbortSignal,
): Promise<void> {
  if (notificationIds.length === 0) return;
  if (!notificationIds.every(isPositiveId)) throw new Error('알림 ID가 올바르지 않습니다.');
  const csrfToken = await getCsrfToken();
  signal.throwIfAborted();
  const response = await request<unknown>('/notifications/read', {
    method: 'PATCH',
    credentials: 'include',
    signal,
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrfToken },
    body: JSON.stringify({ notificationIds: [...new Set(notificationIds)] }),
  });
  if (!isRecord(response) || typeof response.message !== 'string') {
    throw new Error('알림 읽음 응답 형식이 올바르지 않습니다.');
  }
}

/** 소유한 알림 한 건을 CSRF 보호 DELETE로 삭제하고 성공 응답을 확인한다. */
export async function deleteNotification(notificationId: number, request: Request): Promise<void> {
  if (!isPositiveId(notificationId)) throw new Error('알림 ID가 올바르지 않습니다.');
  const csrfToken = await getCsrfToken();
  const response = await request<unknown>(`/notifications/${notificationId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'X-XSRF-TOKEN': csrfToken },
  });
  if (!isRecord(response) || typeof response.message !== 'string') {
    throw new Error('알림 삭제 응답 형식이 올바르지 않습니다.');
  }
}

/** 대상이 삭제된 알림은 targetId=null로 보존하며 잘못된 항목은 화면 경계에서 거부한다. */
function parseNotification(value: unknown): NotificationItem {
  if (
    !isRecord(value) ||
    !isPositiveId(value.notificationId) ||
    !isNotificationType(value.type) ||
    !(value.targetId === null || isPositiveId(value.targetId)) ||
    typeof value.targetType !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.content !== 'string' ||
    !isTimestamp(value.createdAt) ||
    !(value.readAt === null || isTimestamp(value.readAt))
  )
    throw new Error('알림 항목 형식이 올바르지 않습니다.');
  return {
    notificationId: value.notificationId,
    type: value.type,
    targetId: value.targetId,
    targetType: value.targetType,
    title: value.title,
    content: value.content,
    createdAt: value.createdAt,
    readAt: value.readAt,
  };
}

/** 서버의 offset 없는 LocalDateTime은 KST로 해석하고 명시된 offset은 보존한다. */
export function notificationDate(value: string): Date {
  return new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}+09:00`);
}

/** 필수 일시가 ISO 형식이고 Date로 해석 가능한지 확인한다. */
function isTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    Number.isFinite(notificationDate(value).getTime())
  );
}

/** 현재 백엔드가 발행하는 네 가지 알림 유형을 식별한다. */
function isNotificationType(value: unknown): value is NotificationType {
  return (
    value === 'MONTHLY_REPORT_CREATED' ||
    value === 'MATCH_COMPLETED' ||
    value === 'FRIEND_REQUEST' ||
    value === 'FRIEND_ACCEPTED'
  );
}

/** 알림 및 대상 ID에 사용할 양의 안전 정수를 확인한다. */
function isPositiveId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/** JSON 객체를 런타임에서 좁혀 응답 필드에 안전하게 접근한다. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
