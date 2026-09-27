import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

/** Provider 초기 세션 복구가 테스트 중 실제 네트워크 요청을 만들지 않게 기본 401 응답을 둔다. */
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response('{"message":"unauthorized"}', { status: 401 })),
  );
});
afterEach(() => cleanup());
afterEach(() => vi.unstubAllGlobals());
