# Login and Signup Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 백엔드 계약에 맞는 로그인·회원가입 화면, 메모리 세션, 인증 라우팅을 테스트와 함께 구현한다.

**Architecture:** `app → pages → features → entities → shared` 의존 방향을 유지한다. 공통 HTTP/CSRF 처리는 `shared`, 인증 계약·검증·공통 필드는 `features/auth`, access token 메모리 상태는 `entities/session`, URL별 제출 흐름은 `pages`, Provider와 라우팅 조합은 `app`이 담당한다.

**Tech Stack:** React 19, TypeScript strict, Vite 8, React Router, Fetch API, Vitest, jsdom, React Testing Library, user-event, CSS

**Spec:** `docs/superpowers/specs/2026-09-23-auth-pages-design.md`

## Global Constraints

- Node.js 24와 npm을 사용한다.
- `react-router`만 런타임 의존성으로 추가하고 HTTP 통신은 브라우저 `fetch`를 사용한다.
- 테스트 개발 의존성은 `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/jest-dom`으로 제한한다.
- access token은 React 메모리 상태에만 저장하고 `localStorage`, `sessionStorage`, 일반 Cookie에 저장하지 않는다.
- refresh token은 HttpOnly Cookie에 맡기며 JavaScript에서 읽거나 저장하지 않는다.
- 외부 응답은 `unknown`으로 받고 타입 가드로 좁히며 `any`를 사용하지 않는다.
- 함수, Hook, 서비스 메서드에는 책임을 설명하는 짧은 한국어 주석을 남긴다.
- 로그인 이메일만 `trim().toLowerCase()`로 정규화하고 비밀번호는 변경하지 않는다.
- 회원가입 비밀번호 확인 값은 API 본문에 포함하지 않는다.
- 목업은 색상·중앙 카드·필드 구성만 참고하고 인라인 이벤트와 영구 저장 구현은 복사하지 않는다.
- 로컬 개발 서버는 포트 `3000`, `/api` 프록시 대상은 `http://localhost:8080`으로 설정한다.

## Review Focus

- CSRF 응답은 성공했지만 `XSRF-TOKEN` Cookie가 없을 때 로그인 POST를 보내지 않고 보안 오류를 표시한다.
- 서버가 JSON이 아닌 오류 본문 또는 빈 본문을 반환해도 UI가 중단되지 않고 일반 오류로 정규화한다.
- 비밀번호 앞뒤 공백은 인증값 일부로 보존하지만 이메일 공백과 대소문자는 정규화한다.
- 제출 버튼을 빠르게 두 번 눌러도 API 요청은 한 번만 발생한다.
- 브라우저 새로고침에 해당하는 Provider 재생성 후 access token이 남지 않는다.

---

### Task 1: 라우팅·테스트 실행 기반

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/test/smoke.test.tsx`

**Interfaces:**

- Consumes: 기존 Vite/React 진입점과 `env.apiBaseUrl`
- Produces: `npm test`, jsdom 테스트 환경, `@testing-library/jest-dom` matcher, Vite 포트·프록시 설정

- [ ] **Step 1: 승인된 의존성을 설치한다**

```bash
npm install react-router
npm install --save-dev vitest jsdom @testing-library/react @testing-library/dom @testing-library/user-event @testing-library/jest-dom
```

Expected: `package.json`과 `package-lock.json`에 의존성이 함께 기록된다.

- [ ] **Step 2: 테스트 스크립트와 환경을 설정한다**

`package.json` scripts에 다음을 추가한다.

```json
"test": "vitest"
```

`vite.config.ts`를 다음 책임으로 수정한다.

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
});
```

`src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: 테스트 환경 smoke test를 작성한다**

`src/test/smoke.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

/** jsdom과 Testing Library가 React 요소를 렌더링하는지 검증한다. */
function Fixture() {
  return <h1>MULO 테스트 환경</h1>;
}

describe('test setup', () => {
  it('renders a React element in jsdom', () => {
    render(<Fixture />);
    expect(screen.getByRole('heading', { name: 'MULO 테스트 환경' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: 테스트와 설정 검증을 실행한다**

Run: `npm test -- --run src/test/smoke.test.tsx`

Expected: 1 test PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: 기반 설정을 커밋한다**

```bash
git add package.json package-lock.json vite.config.ts src/test/setup.ts src/test/smoke.test.tsx
git commit -m "test: 인증 화면 테스트 기반 구성 #112"
```

### Task 2: 안전한 HTTP·CSRF 공통 계층

**Files:**

- Create: `src/shared/api/apiError.ts`
- Create: `src/shared/api/fetchJson.ts`
- Create: `src/shared/api/csrf.ts`
- Create: `src/shared/api/fetchJson.test.ts`
- Create: `src/shared/api/csrf.test.ts`

**Interfaces:**

- Consumes: `env.apiBaseUrl: string`, 전역 `fetch`, `document.cookie`
- Produces: `ApiError`, `fetchJson<T>(path: string, init?: RequestInit): Promise<T>`, `getCsrfToken(): Promise<string>`

- [ ] **Step 1: HTTP 실패 정규화 테스트를 작성한다**

`src/shared/api/fetchJson.test.ts`에서 다음 사례를 고정한다.

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './apiError';
import { fetchJson } from './fetchJson';

afterEach(() => vi.unstubAllGlobals());

describe('fetchJson', () => {
  it('returns parsed JSON for a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"message":"ok"}', { status: 200 })),
    );
    await expect(fetchJson<{ message: string }>('/health')).resolves.toEqual({ message: 'ok' });
  });

  it('normalizes field errors from a failed response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          '{"code":"VALIDATION_ERROR","message":"입력값을 확인해주세요.","errors":{"email":"이메일 형식이 아닙니다."}}',
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    );
    await expect(fetchJson('/users/signup')).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      fieldErrors: { email: '이메일 형식이 아닙니다.' },
    } satisfies Partial<ApiError>);
  });

  it.each([[''], ['Gateway failure']])('normalizes non-JSON failure body %s', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 502 })));
    await expect(fetchJson('/health')).rejects.toMatchObject({ status: 502 });
  });

  it('normalizes a network rejection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(fetchJson('/health')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });
});
```

- [ ] **Step 2: HTTP 테스트 실패를 확인한다**

Run: `npm test -- --run src/shared/api/fetchJson.test.ts`

Expected: FAIL because `ApiError` and `fetchJson` do not exist.

- [ ] **Step 3: 오류 타입과 JSON 요청 함수를 구현한다**

`ApiError`는 아래 공개 필드를 가진다.

```ts
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly fieldErrors: Readonly<Record<string, string>>;

  constructor(
    status: number,
    message: string,
    code?: string,
    fieldErrors: Readonly<Record<string, string>> = {},
  );
}
```

`fetchJson<T>`는 `env.apiBaseUrl + path`로 요청하며 성공한 빈 응답은 `undefined as T`, JSON 응답은 파싱 결과를 반환한다. 실패 본문은 `unknown` 타입 가드로 `code`, `message`, `errors` 또는 `fieldErrors`를 좁힌다. `fetch`가 던진 오류는 `status: 0`, `code: 'NETWORK_ERROR'`인 `ApiError`로 변환한다. 기존 `ApiError`는 다시 감싸지 않는다.

- [ ] **Step 4: CSRF 추출 테스트를 작성한다**

`src/shared/api/csrf.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCsrfToken } from './csrf';

afterEach(() => {
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/';
  vi.unstubAllGlobals();
});

describe('getCsrfToken', () => {
  it('requests CSRF state with credentials and decodes the cookie', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => {
      document.cookie = 'XSRF-TOKEN=token%2Bvalue; path=/';
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getCsrfToken()).resolves.toBe('token+value');
    expect(fetchMock).toHaveBeenCalledWith('/api/csrf', { credentials: 'include' });
  });

  it('fails before login when the cookie is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(getCsrfToken()).rejects.toMatchObject({ status: 403, code: 'CSRF_TOKEN_MISSING' });
  });
});
```

- [ ] **Step 5: CSRF 테스트 실패를 확인한다**

Run: `npm test -- --run src/shared/api/csrf.test.ts`

Expected: FAIL because `getCsrfToken` does not exist.

- [ ] **Step 6: CSRF 요청과 Cookie 파서를 구현한다**

`getCsrfToken()`은 `fetchJson<void>('/csrf', { credentials: 'include' })`를 호출한 뒤 `document.cookie`를 세미콜론 단위로 파싱하고 `XSRF-TOKEN` 값을 `decodeURIComponent`로 복원한다. 값이 없으면 `ApiError(403, ..., 'CSRF_TOKEN_MISSING')`를 던져 로그인 POST가 실행되지 않게 한다.

- [ ] **Step 7: 공통 API 테스트를 통과시킨다**

Run: `npm test -- --run src/shared/api/fetchJson.test.ts src/shared/api/csrf.test.ts`

Expected: all tests PASS.

- [ ] **Step 8: 공통 API 계층을 커밋한다**

```bash
git add src/shared/api
git commit -m "feat: 공통 API와 CSRF 처리 추가 #112"
```

### Task 3: 인증 계약과 입력 검증

**Files:**

- Create: `src/features/auth/model/auth.types.ts`
- Create: `src/features/auth/model/auth.validation.ts`
- Create: `src/features/auth/model/auth.validation.test.ts`
- Create: `src/features/auth/api/authApi.ts`
- Create: `src/features/auth/api/authApi.test.ts`

**Interfaces:**

- Consumes: `fetchJson`, `getCsrfToken`
- Produces: `LoginValues`, `SignupValues`, `AuthFieldErrors`, `validateLogin`, `validateSignup`, `login`, `signup`

- [ ] **Step 1: 인증 타입과 검증 실패 테스트를 작성한다**

`auth.types.ts`가 제공할 타입:

```ts
export interface LoginValues {
  email: string;
  password: string;
}
export interface SignupValues extends LoginValues {
  nickname: string;
  passwordConfirm: string;
}
export type AuthField = keyof SignupValues;
export type AuthFieldErrors = Partial<Record<AuthField, string>>;
export interface LoginResponse {
  message: string;
  accessToken: string;
}
export interface SignupResponse {
  message: string;
}
```

`auth.validation.test.ts`에서 경계값을 고정한다.

```ts
describe('validateSignup', () => {
  it.each(['a', '열한글자닉네임초과', '닉네임!'])('rejects invalid nickname %s', (nickname) => {
    expect(
      validateSignup({
        nickname,
        email: 'user@example.com',
        password: 'Password1!',
        passwordConfirm: 'Password1!',
      }).nickname,
    ).toBeDefined();
  });

  it.each(['password1!', 'PASSWORD1!', 'Password!!', 'Password1', 'Pass1!'])(
    'rejects invalid password %s',
    (password) => {
      expect(
        validateSignup({
          nickname: '뮬로',
          email: 'user@example.com',
          password,
          passwordConfirm: password,
        }).password,
      ).toBeDefined();
    },
  );

  it('rejects mismatched confirmation', () => {
    expect(
      validateSignup({
        nickname: '뮬로',
        email: 'user@example.com',
        password: 'Password1!',
        passwordConfirm: 'Password2!',
      }).passwordConfirm,
    ).toBeDefined();
  });
});
```

로그인 테스트에는 빈 이메일, 잘못된 이메일, 빈 비밀번호, 유효한 입력을 포함한다.

- [ ] **Step 2: 검증 테스트 실패를 확인한다**

Run: `npm test -- --run src/features/auth/model/auth.validation.test.ts`

Expected: FAIL because validation modules do not exist.

- [ ] **Step 3: 백엔드 제약과 같은 검증 함수를 구현한다**

```ts
export function validateLogin(values: LoginValues): AuthFieldErrors;
export function validateSignup(values: SignupValues): AuthFieldErrors;
```

닉네임 정규식은 `/^[A-Za-z0-9가-힣]{2,10}$/`, 비밀번호 정규식은 `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,16}$/`을 사용한다. 이메일은 공백을 제거한 값에 브라우저 수준의 단순 형식 검사를 적용한다.

- [ ] **Step 4: 인증 API 테스트를 작성한다**

`authApi.test.ts`에서 모듈 mock으로 요청 계약을 검증한다.

```ts
vi.mock('../../../shared/api/fetchJson', () => ({ fetchJson: vi.fn() }));
vi.mock('../../../shared/api/csrf', () => ({ getCsrfToken: vi.fn() }));

it('normalizes only login email and preserves password bytes', async () => {
  vi.mocked(getCsrfToken).mockResolvedValue('csrf-token');
  vi.mocked(fetchJson).mockResolvedValue({ message: 'ok', accessToken: 'access-token' });

  await login({ email: ' User@Example.COM ', password: ' Password1! ' });

  expect(fetchJson).toHaveBeenLastCalledWith('/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': 'csrf-token' },
    body: JSON.stringify({ email: 'user@example.com', password: ' Password1! ' }),
  });
});

it('omits passwordConfirm from signup body', async () => {
  vi.mocked(fetchJson).mockResolvedValue({ message: '가입 완료' });
  await signup({
    nickname: '뮬로',
    email: ' User@Example.COM ',
    password: 'Password1!',
    passwordConfirm: 'Password1!',
  });
  expect(fetchJson).toHaveBeenCalledWith(
    '/users/signup',
    expect.objectContaining({
      credentials: 'include',
      body: JSON.stringify({ nickname: '뮬로', email: 'user@example.com', password: 'Password1!' }),
    }),
  );
});
```

- [ ] **Step 5: 인증 API 테스트 실패를 확인한다**

Run: `npm test -- --run src/features/auth/api/authApi.test.ts`

Expected: FAIL because `login` and `signup` do not exist.

- [ ] **Step 6: 인증 API 함수를 구현한다**

```ts
export async function login(values: LoginValues): Promise<LoginResponse>;
export async function signup(values: SignupValues): Promise<SignupResponse>;
```

`login`은 CSRF 토큰을 먼저 얻은 뒤 POST하고, `signup`은 CSRF 선행 요청 없이 POST한다.

- [ ] **Step 7: 인증 모델과 API 테스트를 통과시킨다**

Run: `npm test -- --run src/features/auth/model/auth.validation.test.ts src/features/auth/api/authApi.test.ts`

Expected: all tests PASS.

- [ ] **Step 8: 인증 계약과 검증을 커밋한다**

```bash
git add src/features/auth/model src/features/auth/api
git commit -m "feat: 인증 계약과 입력 검증 추가 #112"
```

### Task 4: 메모리 세션과 인증 라우팅

**Files:**

- Create: `src/entities/session/model/SessionContext.tsx`
- Create: `src/entities/session/model/SessionContext.test.tsx`
- Create: `src/app/providers/AppProviders.tsx`
- Create: `src/app/router/AppRouter.tsx`
- Create: `src/app/router/AppRouter.test.tsx`
- Create: `src/pages/home/HomePlaceholderPage.tsx`
- Create: `src/pages/login/LoginPage.tsx`
- Create: `src/pages/signup/SignupPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

**Interfaces:**

- Consumes: React Context, React Router `BrowserRouter`, `Routes`, `Route`, `Navigate`
- Produces: `SessionProvider`, `useSession(): SessionContextValue`, `AppProviders`, `AppRouter`

- [ ] **Step 1: 메모리 세션 테스트를 작성한다**

```tsx
function SessionProbe() {
  const { accessToken, isAuthenticated, setAccessToken, clearSession } = useSession();
  return (
    <>
      <output>
        {accessToken ?? 'empty'}:{String(isAuthenticated)}
      </output>
      <button onClick={() => setAccessToken('token')}>login</button>
      <button onClick={clearSession}>logout</button>
    </>
  );
}
```

테스트는 최초 `empty:false`, 로그인 후 `token:true`, 로그아웃 후 `empty:false`를 확인하고 Provider를 unmount 후 다시 render했을 때도 `empty:false`임을 확인한다. `Storage.prototype.setItem` spy가 호출되지 않은 것도 검증한다.

- [ ] **Step 2: 세션 테스트 실패를 확인한다**

Run: `npm test -- --run src/entities/session/model/SessionContext.test.tsx`

Expected: FAIL because session context does not exist.

- [ ] **Step 3: 세션 Context를 구현한다**

```ts
export interface SessionContextValue {
  accessToken: string | null;
  isAuthenticated: boolean;
  setAccessToken: (token: string) => void;
  clearSession: () => void;
}
```

`SessionProvider` 내부 `useState<string | null>(null)`만 상태 저장에 사용한다. `useSession`은 Provider 밖 호출 시 명시적인 오류를 던진다.

- [ ] **Step 4: 인증 라우팅 테스트를 작성한다**

라우터가 실제 페이지 구현 전에도 테스트 가능하도록 `AppRouter`에 `loginElement?`, `signupElement?` 테스트용 선택 props를 제공하지 않는다. 대신 Task 4에서 최소 페이지 파일을 생성해 로그인·회원가입 제목과 링크만 렌더링하고 Task 5·6에서 폼으로 확장한다.

`AppRouter.test.tsx`는 `window.history.pushState`로 경로를 설정한 뒤 다음을 확인한다.

- 비로그인 `/` → 로그인 화면
- 비로그인 알 수 없는 경로 → 로그인 화면
- 로그인 상태에서 `/login` → 홈 화면
- 로그인 상태에서 `/signup` → 홈 화면
- 홈 화면의 로그아웃 버튼 → 로그인 화면

- [ ] **Step 5: 라우팅 테스트 실패를 확인한다**

Run: `npm test -- --run src/app/router/AppRouter.test.tsx`

Expected: FAIL because router and pages do not exist.

- [ ] **Step 6: Provider·라우터·최소 페이지를 구현한다**

`AppProviders`는 `BrowserRouter > SessionProvider` 순서로 감싼다. `AppRouter`는 인증 여부에 따라 `/`, `/login`, `/signup`, `*`를 설계 표대로 분기한다. `HomePlaceholderPage`는 MULO 시작 화면, 로그인 완료 안내, 로그아웃 버튼을 제공한다. `App.tsx`는 `<AppRouter />`만 반환하고 `main.tsx`는 `<AppProviders><App /></AppProviders>`를 렌더링한다.

- [ ] **Step 7: 세션과 라우팅 테스트를 통과시킨다**

Run: `npm test -- --run src/entities/session/model/SessionContext.test.tsx src/app/router/AppRouter.test.tsx`

Expected: all tests PASS.

- [ ] **Step 8: 메모리 세션과 라우팅을 커밋한다**

```bash
git add src/entities/session src/app/providers src/app/router src/pages/home src/pages/login src/pages/signup src/App.tsx src/main.tsx
git commit -m "feat: 메모리 세션과 인증 라우팅 구성 #112"
```

### Task 5: 회원가입 화면과 오류 연결

**Files:**

- Create: `src/features/auth/ui/AuthFormField.tsx`
- Create: `src/features/auth/ui/AuthFormField.test.tsx`
- Modify: `src/pages/signup/SignupPage.tsx`
- Create: `src/pages/signup/SignupPage.test.tsx`

**Interfaces:**

- Consumes: `SignupValues`, `AuthFieldErrors`, `validateSignup`, `signup`, `ApiError`, React Router `useNavigate`
- Produces: 접근 가능한 `AuthFormField`, 완성된 `SignupPage`

- [ ] **Step 1: 공통 필드 접근성 테스트를 작성한다**

```tsx
render(
  <AuthFormField
    id="email"
    label="이메일"
    type="email"
    value="bad"
    onChange={() => undefined}
    error="이메일 형식이 올바르지 않습니다."
    autoComplete="email"
  />,
);
const input = screen.getByRole('textbox', { name: '이메일' });
expect(input).toHaveAttribute('aria-invalid', 'true');
expect(input).toHaveAccessibleDescription('이메일 형식이 올바르지 않습니다.');
```

- [ ] **Step 2: 공통 필드 테스트 실패를 확인한다**

Run: `npm test -- --run src/features/auth/ui/AuthFormField.test.tsx`

Expected: FAIL because `AuthFormField` does not exist.

- [ ] **Step 3: 공통 필드 컴포넌트를 구현한다**

`AuthFormField` props는 `id`, `label`, `type`, `value`, `onChange`, `error?`, `autoComplete`를 받는다. 오류가 있으면 `${id}-error`를 `aria-describedby`에 연결하고 `aria-invalid`를 설정한다.

- [ ] **Step 4: 회원가입 사용자 흐름 테스트를 작성한다**

`signup`을 mock하고 `MemoryRouter`에서 다음을 검증한다.

- 잘못된 네 필드 제출 시 API가 호출되지 않고 필드 오류가 모두 표시됨
- 유효한 입력 성공 시 `/login`으로 이동하고 `가입이 완료되었습니다. 로그인해 주세요.` 상태 안내가 표시됨
- `400`의 서버 필드 오류가 해당 입력에 표시됨
- `409`의 email/nickname 중복 오류가 두 필드에 함께 표시됨
- 네트워크 오류는 `서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.` alert로 표시됨
- pending Promise 상태에서 버튼이 비활성화되고 연속 submit에도 `signup`이 한 번만 호출됨

성공 이동은 `navigate('/login', { replace: true, state: { signupMessage: '가입이 완료되었습니다. 로그인해 주세요.' } })`로 고정한다.

- [ ] **Step 5: 회원가입 화면 테스트 실패를 확인한다**

Run: `npm test -- --run src/pages/signup/SignupPage.test.tsx`

Expected: FAIL because the minimal page has no form behavior.

- [ ] **Step 6: 회원가입 화면을 구현한다**

controlled state로 네 필드를 관리한다. submit 시작 시 기존 오류를 비우고 `validateSignup` 결과가 있으면 종료한다. `isSubmitting` guard를 함수 첫 줄에서 확인하며 호출 동안 버튼을 `disabled` 처리한다. `ApiError.fieldErrors`는 알려진 필드만 타입 안전하게 병합하고, 상태별 일반 메시지는 별도 `role="alert"`에 표시한다.

- [ ] **Step 7: 회원가입 테스트를 통과시킨다**

Run: `npm test -- --run src/features/auth/ui/AuthFormField.test.tsx src/pages/signup/SignupPage.test.tsx`

Expected: all tests PASS.

- [ ] **Step 8: 회원가입 화면을 커밋한다**

```bash
git add src/features/auth/ui src/pages/signup
git commit -m "feat: 회원가입 화면과 오류 처리 구현 #112"
```

### Task 6: 로그인 화면과 CSRF 오류 연결

**Files:**

- Modify: `src/pages/login/LoginPage.tsx`
- Create: `src/pages/login/LoginPage.test.tsx`

**Interfaces:**

- Consumes: `LoginValues`, `validateLogin`, `login`, `ApiError`, `useSession`, React Router `useLocation`, `useNavigate`
- Produces: 완성된 `LoginPage`

- [ ] **Step 1: 로그인 사용자 흐름 테스트를 작성한다**

`login`을 mock하고 `SessionProvider`와 `MemoryRouter`에서 다음을 검증한다.

- 잘못된 이메일과 빈 비밀번호 제출 시 API가 호출되지 않고 두 필드 오류가 표시됨
- 회원가입에서 전달된 `signupMessage`가 `role="status"`로 표시됨
- 성공 응답의 `accessToken`이 세션에 저장되고 `/` 홈으로 이동함
- `401`은 `이메일 또는 비밀번호가 일치하지 않습니다.` 표시
- `403` 또는 `CSRF_TOKEN_MISSING`은 `보안 정보를 확인하지 못했습니다. 다시 시도해 주세요.` 표시
- 네트워크 오류는 서버 연결 안내 표시
- `500`은 `요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.` 표시
- pending Promise 상태에서 버튼이 비활성화되고 연속 submit에도 `login`이 한 번만 호출됨

- [ ] **Step 2: 로그인 화면 테스트 실패를 확인한다**

Run: `npm test -- --run src/pages/login/LoginPage.test.tsx`

Expected: FAIL because the minimal page has no form behavior.

- [ ] **Step 3: 로그인 화면을 구현한다**

controlled state로 이메일과 비밀번호를 관리한다. 클라이언트 검증 후 `login(values)`을 호출하고 반환된 토큰을 `setAccessToken`으로 저장한 다음 `/`로 replace 이동한다. 비밀번호 값은 submit handler에서도 가공하지 않는다. 회원가입 성공 상태는 location state가 올바른 문자열일 때만 출력한다.

- [ ] **Step 4: 로그인 테스트를 통과시킨다**

Run: `npm test -- --run src/pages/login/LoginPage.test.tsx`

Expected: all tests PASS.

- [ ] **Step 5: 인증 전체 테스트에서 회귀를 확인한다**

Run: `npm test -- --run`

Expected: all tests PASS, including CSRF missing Cookie, non-JSON errors, storage non-use, double submit, routing cases.

- [ ] **Step 6: 로그인 화면을 커밋한다**

```bash
git add src/pages/login
git commit -m "feat: 로그인 화면과 세션 연결 구현 #112"
```

### Task 7: 반응형 시각 완성 및 전체 검수

**Files:**

- Modify: `src/app/styles/global.css`
- Modify: `README.md`
- Modify: `docs/api-integration.md`

**Interfaces:**

- Consumes: 로그인·회원가입·홈의 class 이름, Vite 실행 명령
- Produces: 목업 분위기를 반영한 반응형 화면, 팀원이 재현 가능한 실행·인증 문서

- [ ] **Step 1: 전역 스타일을 인증 화면 중심으로 교체한다**

기존 `.app-shell` 단일 중앙 텍스트 스타일을 다음 구조로 확장한다.

- `body`: 라일락·피치 계열의 부드러운 배경
- `.auth-page`: 최소 화면 높이와 중앙 정렬
- `.auth-card`: 최대 너비 약 440px, 흰색 반투명 카드, 둥근 모서리와 그림자
- `.auth-field`: label/input/error 수직 배치
- input: 최소 44px 높이, 명확한 `:focus-visible`
- primary button: 민트 또는 라일락 강조색, `:disabled` 상태
- `.home-page`: 로그인 완료와 로그아웃을 확인하는 최소 카드
- `@media (max-width: 480px)`: 카드 여백과 제목 크기 축소
- `@media (prefers-reduced-motion: reduce)`: 전환 효과 제거

- [ ] **Step 2: 실행법과 인증 제약 문서를 갱신한다**

`README.md`에 다음 명령과 URL을 추가한다.

```bash
npm install
npm run dev
npm test -- --run
```

- 프론트엔드: `http://localhost:3000`
- 백엔드 기본 프록시: `http://localhost:8080`

`docs/api-integration.md`에는 구현된 로그인 CSRF 순서, 회원가입 CSRF 예외, access token 메모리 저장과 새로고침 시 로그아웃되는 현재 범위를 기록한다.

- [ ] **Step 3: 자동 검증을 모두 실행한다**

Run: `npm test -- --run`

Expected: all tests PASS.

Run: `npm run prettier`

Expected: PASS. 실패하면 관련 파일만 `npm run format`으로 정리한 뒤 다시 검사한다.

Run: `npm run lint`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: PASS and `dist` generated.

- [ ] **Step 4: 브라우저에서 데스크톱·모바일 상태를 검수한다**

Run: `npm run dev -- --host 127.0.0.1`

브라우저에서 다음을 확인한다.

- `/login`, `/signup`이 1280px와 375px 너비에서 잘리지 않음
- label 클릭, Tab 이동, focus ring, 오류 메시지 연결이 동작함
- 백엔드가 없는 상태에서 제출하면 네트워크 오류가 안전하게 표시됨
- 비밀번호 문자가 마스킹되고 제출 중 버튼 상태가 구분됨
- 콘솔에 React 오류가 없음

- [ ] **Step 5: 보안·범위 누락을 정적 확인한다**

```bash
rg -n "localStorage|sessionStorage|document\.cookie\s*=|\bany\b" src
git diff --check origin/develop...HEAD
git status --short
```

Expected: `document.cookie`는 CSRF 테스트 정리 코드 외 제품 코드에서 쓰기 용도로 나타나지 않고, 영구 토큰 저장이나 `any` 사용이 없다. 작업 트리는 의도한 파일만 포함한다.

- [ ] **Step 6: 스타일과 문서를 커밋한다**

```bash
git add src/app/styles/global.css README.md docs/api-integration.md
git commit -m "style: 인증 화면 반응형 디자인 적용 #112"
```

- [ ] **Step 7: 브랜치 전체를 최종 검토한다**

```bash
git diff --stat origin/develop...HEAD
git log --oneline origin/develop..HEAD
```

설계 문서의 각 완료 조건과 테스트 결과를 대조하고, 변경 파일의 실제 줄 번호를 기록해 완료 보고와 PR 본문에 사용한다.
