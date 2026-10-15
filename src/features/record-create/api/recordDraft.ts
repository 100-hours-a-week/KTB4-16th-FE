import type { AuthenticatedApiClient } from '../../../shared/api/authenticatedFetchJson';
import { getCsrfToken } from '../../../shared/api/csrf';
import type { RecordLocation, SelectedMusic } from '../model/recordCreate.types';

export type RecordDraftSnapshot = {
  location: RecordLocation | null;
  music: SelectedMusic | null;
  moodScore: number;
  comment: string | null;
  uploadId: number | null;
};

export type RecordDraft = RecordDraftSnapshot & {
  photoUrl: string | null;
  expiresAt: string;
};

/** 현재 사용자의 자물쇠 작성 임시저장을 조회한다. 없거나 만료된 경우 null을 반환한다. */
export async function getRecordDraft(
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
): Promise<RecordDraft | null> {
  const response = await fetchAuthenticatedJson<unknown>('/users/me/record-draft');
  if (response === undefined) return null;
  return parseRecordDraft(response);
}

/** 현재 폼의 전체 스냅샷으로 사용자당 하나의 자물쇠 임시저장을 upsert한다. */
export async function saveRecordDraft(
  snapshot: RecordDraftSnapshot,
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
): Promise<void> {
  const csrfToken = await getCsrfToken();
  await fetchAuthenticatedJson<unknown>('/users/me/record-draft', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrfToken },
    body: JSON.stringify(snapshot),
  });
}

/** 현재 사용자의 자물쇠 임시저장을 삭제한다. 없는 draft도 성공으로 처리하는 API다. */
export async function deleteRecordDraft(
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
): Promise<void> {
  const csrfToken = await getCsrfToken();
  await fetchAuthenticatedJson<unknown>('/users/me/record-draft', {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'X-XSRF-TOKEN': csrfToken },
  });
}

function parseRecordDraft(value: unknown): RecordDraft {
  if (!isRecord(value) || !isRecord(value.data)) {
    throw new Error('임시저장 응답 형식이 올바르지 않습니다.');
  }
  const { data } = value;
  const location = parseLocation(data.location);
  const music = parseMusic(data.music);
  const moodScore = parseMoodScore(data.moodScore);
  if (
    !isNullableString(data.comment) ||
    !isNullablePositiveInteger(data.uploadId) ||
    !isNullableNonEmptyString(data.photoUrl) ||
    typeof data.expiresAt !== 'string'
  ) {
    throw new Error('임시저장 응답 형식이 올바르지 않습니다.');
  }
  return {
    location,
    music,
    moodScore,
    comment: data.comment,
    uploadId: data.uploadId,
    photoUrl: data.photoUrl,
    expiresAt: data.expiresAt,
  };
}

function parseLocation(value: unknown): RecordLocation | null {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    !isFiniteNumber(value.latitude) ||
    !isFiniteNumber(value.longitude) ||
    !isNullableString(value.legalDongCode) ||
    !isNullableString(value.legalDongName)
  ) {
    throw new Error('임시저장 위치 정보 형식이 올바르지 않습니다.');
  }
  return {
    latitude: value.latitude,
    longitude: value.longitude,
    legalDongCode: value.legalDongCode,
    legalDongName: value.legalDongName,
  };
}

function parseMusic(value: unknown): SelectedMusic | null {
  if (value === null) return null;
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.externalTrackId) ||
    !isNonEmptyString(value.title) ||
    !isNonEmptyString(value.artistName) ||
    !isNonEmptyString(value.albumImageUrl) ||
    !isNonEmptyString(value.externalUrl)
  ) {
    throw new Error('임시저장 음악 정보 형식이 올바르지 않습니다.');
  }
  return {
    externalTrackId: value.externalTrackId,
    title: value.title,
    artistName: value.artistName,
    albumImageUrl: value.albumImageUrl,
    externalUrl: value.externalUrl,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
function parseMoodScore(value: unknown): number {
  if (value === null) return 0;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < -50 || value > 50) {
    throw new Error('임시저장 응답 형식이 올바르지 않습니다.');
  }
  return value;
}
function isNullablePositiveInteger(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isSafeInteger(value) && value > 0);
}
function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}
function isNullableNonEmptyString(value: unknown): value is string | null {
  return value === null || isNonEmptyString(value);
}
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
