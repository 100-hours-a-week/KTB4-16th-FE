# MULO Frontend Initial Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 화면 구현 없이 Vite, React, TypeScript 기반의 실행 가능한 프론트엔드 초기 구조와 사람·AI 협업 문서를 구축한다.

**Architecture:** `app -> pages -> features -> entities -> shared` 단방향 의존 규칙을 사용하는 기능 중심 절충형 구조를 문서로 정의한다. 초기 코드에는 앱 진입점, 전역 스타일, 환경 설정만 두고 화면·라우팅·API 기능은 추가하지 않는다.

**Tech Stack:** Node.js 24, npm, Vite, React, TypeScript strict, ESLint, Prettier

**Spec:** `docs/superpowers/specs/2026-09-22-frontend-initial-setup-design.md`

## Global Constraints

- 작업 브랜치는 `chore/frontend-initial-setup-112`, PR 대상은 `develop`이다.
- Node.js 버전은 CI와 동일한 24를 사용하고 패키지 관리자는 npm으로 고정한다.
- TypeScript `strict` 모드를 비활성화하지 않는다.
- Router, Axios, 상태 관리, UI 프레임워크, 테스트 도구를 추가하지 않는다.
- `main` 브랜치의 배포 워크플로는 수정하지 않는다.
- `develop` CI의 검증 범위는 `prettier`, `lint`, `typecheck`로 유지한다.
- 함수, Hook, 서비스 메서드를 추가할 때 책임과 역할을 설명하는 짧은 주석을 남긴다.
- 화면과 실제 API 요청을 구현하지 않는다.

## Review Focus

- `VITE_API_BASE_URL`이 비어 있거나 공백이면 `'/api'`를 사용해야 한다 — Task 1의 production build와 `env.ts` 정적 검토로 확인한다.
- CI가 호출하는 `prettier`, `lint`, `typecheck` 스크립트 이름이 `package.json`과 정확히 일치해야 한다 — Task 1에서 각 명령을 직접 실행한다.
- `VITE_` 환경변수에 Secret 예제가 들어가면 안 된다 — Task 2의 `.env.example`, `AGENTS.md`, API 문서를 함께 검토한다.
- 문서의 의존 방향이 서로 다르게 설명되면 안 된다 — Task 2에서 `AGENTS.md`, `RULE.md`, `docs/architecture.md`를 검색해 비교한다.
- 초기 구조에 화면·Router·HTTP 클라이언트가 섞이면 안 된다 — Task 3에서 의존성과 파일 목록을 검사한다.

---

### Task 1: 실행 가능한 React TypeScript 기반 구성

**Files:**

- Create: `.env.example`
- Create: `.gitignore`
- Create: `.prettierignore`
- Create: `.prettierrc.json`
- Create: `eslint.config.js`
- Create: `index.html`
- Create: `package.json`
- Create: `package-lock.json`
- Create: `src/App.tsx`
- Create: `src/app/styles/global.css`
- Create: `src/main.tsx`
- Create: `src/shared/config/env.ts`
- Create: `src/vite-env.d.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`

**Interfaces:**

- Consumes: Node.js 24, npm registry packages, Vite의 `import.meta.env`
- Produces: `env.apiBaseUrl: string`, `App(): JSX.Element`, CI가 호출할 npm scripts

- [ ] **Step 1: 패키지 manifest를 생성한다**

`package.json`을 다음 책임으로 작성한다.

```json
{
  "name": "mulo-fe",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "prettier": "prettier --check .",
    "format": "prettier --write .",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: 승인된 최소 의존성을 설치한다**

Run:

```bash
npm install react react-dom
npm install --save-dev typescript vite @vitejs/plugin-react eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh globals prettier @types/node @types/react @types/react-dom
```

Expected: `package.json`에 dependencies/devDependencies가 기록되고 `package-lock.json`이 생성된다.

- [ ] **Step 3: TypeScript와 Vite 설정을 작성한다**

`tsconfig.app.json`에는 최소한 다음 안전 설정을 포함한다.

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

`vite.config.ts`는 `@vitejs/plugin-react`만 등록한다.

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

- [ ] **Step 4: 환경 설정 경계를 작성한다**

`src/shared/config/env.ts`:

```ts
const DEFAULT_API_BASE_URL = '/api';

/** 빌드 환경변수를 애플리케이션에서 사용할 읽기 전용 설정으로 변환한다. */
function resolveApiBaseUrl(value: string | undefined): string {
  const normalizedValue = value?.trim();
  return normalizedValue || DEFAULT_API_BASE_URL;
}

export const env = Object.freeze({
  apiBaseUrl: resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
});
```

`.env.example`:

```dotenv
VITE_API_BASE_URL=/api
```

- [ ] **Step 5: 최소 앱 진입점을 작성한다**

`src/App.tsx`는 화면 디자인 없이 구조 준비 상태만 표시한다.

```tsx
/** MULO 프론트엔드의 최상위 애플리케이션 컴포넌트다. */
function App() {
  return (
    <main>
      <h1>MULO</h1>
      <p>프론트엔드 초기 설정이 완료되었습니다.</p>
    </main>
  );
}

export default App;
```

`src/main.tsx`는 `createRoot`로 `App`을 마운트하고 `src/app/styles/global.css`만 import한다.

- [ ] **Step 6: ESLint와 Prettier 설정을 작성한다**

`eslint.config.js`는 Vite React TypeScript 기본 규칙을 사용하고 `dist`를 무시한다. `.prettierrc.json`은 다음 팀 기본값을 사용한다.

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 7: CI와 동일한 정적 검사를 실행한다**

Run:

```bash
npm run prettier
npm run lint
npm run typecheck
npm run build
```

Expected: 네 명령 모두 exit code 0. `dist/`가 생성되지만 Git에는 포함되지 않는다.

- [ ] **Step 8: 기반 구성을 커밋한다**

```bash
git add .env.example .gitignore .prettierignore .prettierrc.json eslint.config.js index.html package.json package-lock.json src tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts
git commit -m "chore: React TypeScript 초기 환경 구성 #112"
```

### Task 2: 사람·AI 협업 문서 작성

**Files:**

- Create: `AGENTS.md`
- Create: `RULE.md`
- Create: `README.md`
- Create: `docs/architecture.md`
- Create: `docs/api-integration.md`

**Interfaces:**

- Consumes: Task 1의 npm scripts와 `env.apiBaseUrl`, 설계 문서의 계층 규칙
- Produces: AI 작업 규칙, 사람·AI 공통 협업 규칙, 신규 참여자 실행 가이드, 기능 배치 기준, API 통합 계약

- [ ] **Step 1: `AGENTS.md`를 작성한다**

다음 항목을 명시한다.

```text
1. 작업 전 RULE.md, README.md, 관련 docs 읽기
2. app -> pages -> features -> entities -> shared 의존 방향 준수
3. 새 의존성, 인증 구조, 공용 경계 변경 전 승인 요청
4. strict 유지, any 지양, 외부 값은 unknown에서 검증
5. 함수·Hook·서비스 메서드 책임 주석 작성
6. API 계약은 최신 OpenAPI와 docs/api-integration.md 기준
7. prettier, lint, typecheck 및 관련 build 검증
8. 실제 실행하지 않은 검증을 통과했다고 보고하지 않기
```

- [ ] **Step 2: `RULE.md`를 작성한다**

백엔드와 동일한 Git 흐름을 프론트 명령에 맞게 기록한다.

```text
main/develop 직접 작업 및 push 금지
<type>/<function>-<issueNumber> 작업 브랜치
<type>: <작업 내용> #<issueNumber> 커밋 및 PR 제목
작업 브랜치 -> develop PR
최소 1명 승인, 수동 merge, force push 금지
npm run prettier, npm run lint, npm run typecheck 통과
Secret과 실제 .env 커밋 금지
의존성 변경은 PR에 이유와 영향 기록
```

- [ ] **Step 3: 실행 가이드와 아키텍처 문서를 작성한다**

`README.md`에는 Node.js 24, `npm ci`, `npm run dev`, 네 검증 명령, `.env.example` 복사 방법과 문서 링크를 기록한다.

`docs/architecture.md`에는 각 계층별 허용·금지 책임과 다음 배치 예시를 기록한다.

```text
features/auth -> 로그인 같은 사용자 행동
entities/user -> User 타입과 사용자 도메인 표현
shared/api -> 도메인 비종속 HTTP 기반
pages -> 여러 기능을 한 URL 화면으로 조립
app -> 전역 Provider와 앱 초기화
```

- [ ] **Step 4: API 연동 문서를 작성한다**

`docs/api-integration.md`에 다음 계약을 구체적으로 기록한다.

```text
OpenAPI가 경로·method·필드·상태 코드의 기준
VITE_API_BASE_URL에는 공개 가능한 base URL만 설정
Refresh Token은 HttpOnly Cookie로만 보관
Access Token은 메모리에만 보관
상태 변경 요청은 XSRF-TOKEN을 X-XSRF-TOKEN으로 전달
401은 refresh 한 번, 성공 시 원 요청 한 번 재시도
동시 401은 하나의 refresh Promise를 공유
query는 URLSearchParams로 인코딩
```

- [ ] **Step 5: 문서 간 규칙 일관성을 검사한다**

Run:

```bash
rg -n "app.*pages.*features.*entities.*shared|npm run (prettier|lint|typecheck)|VITE_API_BASE_URL|Refresh Token" AGENTS.md RULE.md README.md docs
rg -n "TBD|TODO|FIXME|npm run Prettier" AGENTS.md RULE.md README.md docs || true
```

Expected: 첫 명령은 관련 규칙 위치를 출력하고, 두 번째 명령은 미완성 표기나 대문자 스크립트 호출을 출력하지 않는다.

- [ ] **Step 6: 문서를 커밋한다**

```bash
git add AGENTS.md RULE.md README.md docs/architecture.md docs/api-integration.md
git commit -m "docs: 프론트엔드 협업 및 구조 규칙 작성 #112"
```

### Task 3: develop CI 정합화 및 최종 검증

**Files:**

- Modify: `.github/workflows/CI.yaml:31`
- Verify: `package.json`
- Verify: repository tracked files

**Interfaces:**

- Consumes: Task 1의 `prettier`, `lint`, `typecheck` scripts
- Produces: `develop` PR에서 실행 가능한 최소 CI 계약

- [ ] **Step 1: CI 실행 명령을 확인한다**

`.github/workflows/CI.yaml`의 Prettier 단계가 다음과 정확히 일치해야 한다.

```yaml
- name: Run prettier
  run: npm run prettier
```

- [ ] **Step 2: CI 명령과 package scripts의 대응을 검사한다**

Run:

```bash
rg -n '"(prettier|lint|typecheck)"' package.json
rg -n 'npm run (prettier|lint|typecheck)' .github/workflows/CI.yaml
```

Expected: 세 스크립트가 `package.json`과 CI 양쪽에서 각각 일치한다.

- [ ] **Step 3: 금지된 초기 의존성과 파일을 검사한다**

Run:

```bash
npm ls react-router-dom axios @reduxjs/toolkit zustand vitest --depth=0
find src -type f | sort
```

Expected: 첫 명령은 나열한 패키지를 찾지 못해 non-zero일 수 있으며, 두 번째 명령에는 앱 진입점·전역 스타일·환경 설정 외 화면 또는 API 구현 파일이 없다.

- [ ] **Step 4: 전체 검증을 다시 실행한다**

Run:

```bash
npm ci
npm run prettier
npm run lint
npm run typecheck
npm run build
git diff --check
git status --short
```

Expected: 설치와 네 검증 명령 및 `git diff --check`가 성공한다. `git status`에는 의도한 CI 변경만 남거나 커밋 후 깨끗한 상태가 표시된다.

- [ ] **Step 5: develop CI 변경을 커밋한다**

```bash
git add .github/workflows/CI.yaml
git commit -m "fix: develop CI prettier 명령 수정 #112"
```

- [ ] **Step 6: 커밋 범위와 브랜치를 확인한다**

Run:

```bash
git status --short --branch
git log --oneline origin/develop..HEAD
git diff --stat origin/develop...HEAD
```

Expected: 브랜치는 `chore/frontend-initial-setup-112`, 작업 트리는 clean, 변경은 설계·계획·초기 구조·협업 문서·develop CI에 한정된다.
