import { env } from '../config/env';
import { ApiError } from './apiError';

interface ErrorPayload {
  code?: string;
  message?: string;
  fieldErrors: Readonly<Record<string, string>>;
}

/** 알 수 없는 값이 키-값 객체인지 확인한다. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 서버의 필드 오류 객체에서 화면에 표시할 문자열만 추출한다. */
function parseFieldErrors(value: unknown): Readonly<Record<string, string>> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([field, error]) => {
      if (typeof error === 'string') {
        return [[field, error]];
      }

      if (Array.isArray(error) && typeof error[0] === 'string') {
        return [[field, error[0]]];
      }

      return [];
    }),
  );
}

/** 서버 오류 본문을 안전한 공통 오류 정보로 좁힌다. */
function parseErrorPayload(value: unknown): ErrorPayload {
  if (!isRecord(value)) {
    return { fieldErrors: {} };
  }

  return {
    code: typeof value.code === 'string' ? value.code : undefined,
    message: typeof value.message === 'string' ? value.message : undefined,
    fieldErrors: parseFieldErrors(value.errors ?? value.fieldErrors),
  };
}

/** 응답 본문을 비어 있거나 잘못된 JSON이어도 예외 없이 해석한다. */
async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** API JSON 요청과 네트워크·서버 오류 정규화를 한 경계에서 처리한다. */
export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${env.apiBaseUrl}${path}`, init);
    const payload = await readJson(response);

    if (!response.ok) {
      const error = parseErrorPayload(payload);
      throw new ApiError(
        response.status,
        error.message ?? '요청을 처리하지 못했습니다.',
        error.code,
        error.fieldErrors,
      );
    }

    return payload as T;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(0, '서버에 연결할 수 없습니다.', 'NETWORK_ERROR');
  }
}
