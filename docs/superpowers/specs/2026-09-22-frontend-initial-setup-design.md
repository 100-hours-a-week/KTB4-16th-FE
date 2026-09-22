# MULO 프론트엔드 초기 구조 설계

## 1. 목적

MULO 프론트엔드 팀원이 서로의 코드를 직접 확인하지 않고 병렬로 작업하더라도 기능 경계와 협업 규칙을 일관되게 이해할 수 있는 초기 기반을 만든다. 이번 작업은 화면과 실제 API 기능을 구현하지 않고, React 애플리케이션의 실행 가능한 최소 구조와 사람·AI가 함께 참고할 문서를 마련하는 데 한정한다.

## 2. 확정 범위

- Vite 기반 React 애플리케이션
- TypeScript `strict` 모드
- npm과 `package-lock.json`
- ESLint, Prettier, TypeScript 타입 검사
- 기능 중심 절충형 디렉터리 구조
- 프로젝트 실행과 협업 규칙 문서
- 백엔드 API 연동 원칙 문서
- `develop` CI의 Prettier 스크립트 이름을 소문자로 정합화

이번 범위에서는 화면, Router, 실제 HTTP 요청, 전역 상태 라이브러리, UI 프레임워크, Axios, 테스트 도구를 추가하지 않는다. 이 항목들은 첫 화면 또는 기능 요구사항이 확정될 때 별도로 설계한다.

## 3. 기술 선택과 근거

### 3.1 Vite + React + TypeScript

React 공식 문서는 새 클라이언트 전용 앱을 직접 구성할 때 Vite 같은 빌드 도구를 사용할 수 있다고 안내한다. TypeScript는 실행 전에 타입 오류를 검사하며 React 컴포넌트의 props와 상태 계약을 코드에 명시할 수 있다.

- React 앱 직접 구성: <https://react.dev/learn/build-a-react-app-from-scratch>
- React에서 TypeScript 사용: <https://react.dev/learn/typescript>
- TypeScript Handbook: <https://www.typescriptlang.org/docs/handbook/intro>

`strict` 모드를 유지하고 `any`는 외부 경계에서 불가피한 경우를 제외하고 사용하지 않는다. 알 수 없는 외부 값은 `unknown`으로 받은 뒤 검증해 좁힌다.

### 3.2 불필요한 초기 의존성 제외

현재는 화면과 상태 흐름이 확정되지 않았으므로 Router, 상태 관리, HTTP 클라이언트, UI 프레임워크를 미리 선택하지 않는다. 새 의존성은 실제 요구사항, 기존 플랫폼 기능으로 해결할 수 없는 이유, 유지 비용을 문서화한 뒤 도입한다.

## 4. 디렉터리 구조

최종적으로 다음 경계를 사용하되, 초기에는 실행 또는 설명에 필요한 파일만 생성한다. 빈 디렉터리를 추적하기 위한 `.gitkeep`은 만들지 않는다.

```text
src/
├── app/                 # 앱 전역 조립, Provider와 전역 설정
├── pages/               # URL 단위 화면 조립
├── features/            # 사용자 행동 단위 기능
├── entities/            # 도메인 타입과 모델
├── shared/
│   ├── api/             # 공통 HTTP 기반
│   ├── config/          # 환경변수와 앱 설정
│   ├── constants/       # 공통 상수
│   ├── hooks/           # 도메인 비종속 Hook
│   ├── lib/             # 순수 유틸리티
│   ├── types/           # 범용 타입
│   └── ui/              # 공용 UI
├── App.tsx
└── main.tsx
```

의존 방향은 다음과 같다.

```text
app -> pages -> features -> entities -> shared
```

- 하위 계층은 상위 계층을 import하지 않는다.
- `shared`는 다른 프로젝트 계층에 의존하지 않는다.
- `pages`는 기능을 조립하며 도메인 로직을 직접 구현하지 않는다.
- 기능 전용 코드는 재사용 가능성을 예상해 `shared`로 미리 올리지 않는다.
- 둘 이상의 실제 사용처가 확인될 때 공통화를 검토한다.

## 5. 문서 책임

### `AGENTS.md`

AI 코딩 에이전트의 작업 절차와 제한을 정의한다.

- 작업 전 `RULE.md`, `README.md`, 관련 `docs/` 읽기
- 기존 구현과 패턴을 먼저 확인
- 새 의존성, 공용 구조, 인증 방식 변경 전 승인 요청
- OpenAPI와 API 연동 문서를 계약 기준으로 사용
- 함수, Hook, 서비스 메서드에 책임을 설명하는 짧은 주석 작성
- 변경 후 관련 검증 실행 및 실제 결과 보고

Codex가 저장소 루트부터 현재 작업 디렉터리까지 `AGENTS.md`를 계층적으로 읽으므로 저장소 공통 지침은 루트에 둔다.

- OpenAI AGENTS.md 문서: <https://developers.openai.com/docs/agent-configuration/agents-md>

### `RULE.md`

사람과 AI가 공통으로 지킬 Git, PR, TypeScript, 파일 경계, 환경변수 규칙을 정의한다. 브랜치·커밋·PR 규칙은 MULO 백엔드 저장소의 협업 흐름과 동일하게 유지한다.

### `README.md`

프로젝트 목적, 요구 Node.js 버전, 설치·실행·검증 명령, 환경변수 준비, 문서 진입점을 제공한다.

### `docs/architecture.md`

각 계층의 책임, 허용되는 의존 방향, 새 기능을 추가하는 위치와 판단 예시를 기록한다.

### `docs/api-integration.md`

OpenAPI 우선순위, 인증 토큰, Cookie, CSRF, 401 재발급, query encoding과 오류 처리 원칙을 기록한다. 실제 클라이언트 구현은 후속 기능 작업에서 진행한다.

## 6. API 및 보안 사전 규칙

- 최신 OpenAPI 명세를 HTTP 경로, method, 요청·응답 필드와 상태 코드의 기준으로 사용한다.
- API base URL은 `VITE_API_BASE_URL`로 주입한다.
- `VITE_` 환경변수는 브라우저 번들에 노출되므로 Secret을 저장하지 않는다.
- Refresh Token은 JavaScript 상태, `localStorage`, `sessionStorage`에 저장하지 않는다.
- Access Token은 후속 인증 구현에서 메모리에만 저장한다.
- query parameter는 문자열을 직접 연결하지 않고 `URLSearchParams`를 사용한다.
- 상태 변경 요청의 CSRF 및 인증 실패 시 단일 refresh 규칙은 기존 프론트엔드 통합 가이드를 따른다.

## 7. Git 및 CI

이번 작업 정보:

```text
Issue: #112
Branch: chore/frontend-initial-setup-112
PR target: develop
```

장기 브랜치는 `main`, `develop`이며 직접 push하지 않는다. 작업 브랜치는 최신 `develop`에서 만들고 PR을 통해 반영한다.

현재 `develop` CI의 최소 검증 범위는 유지한다.

```text
npm ci
npm run prettier
npm run lint
npm run typecheck
```

기존 `npm run Prettier` 호출은 `package.json`에 정의할 소문자 스크립트와 일치하도록 `npm run prettier`로 변경한다. `main`의 별도 배포 워크플로는 이번 작업에서 수정하지 않는다.

## 8. 오류 처리

초기 틀에는 실제 API 호출이 없으므로 런타임 API 오류 처리를 구현하지 않는다. 후속 기능에서는 다음 원칙을 따른다.

- 외부 응답을 TypeScript 타입만으로 신뢰하지 않는다.
- 사용자에게 내부 오류나 Secret을 노출하지 않는다.
- 자동 재시도는 멱등성과 백엔드 계약이 확인된 요청에만 적용한다.
- 인증 refresh 실패가 재귀 호출로 이어지지 않게 한다.

## 9. 검증과 완료 조건

완료 시 다음 명령을 실제로 실행한다.

```bash
npm run prettier
npm run lint
npm run typecheck
npm run build
```

완료 조건:

- Node.js 24와 npm으로 설치 및 실행할 수 있다.
- TypeScript `strict` 설정이 활성화되어 있다.
- CI가 요구하는 세 스크립트가 존재하고 성공한다.
- production build가 성공한다.
- `AGENTS.md`와 `RULE.md`가 역할별로 분리되어 있다.
- 아키텍처와 API 연동 문서만으로 새 기능의 위치와 금지 사항을 판단할 수 있다.
- 화면, 비즈니스 기능, 승인되지 않은 의존성이 포함되지 않는다.

## 10. 변경 예정 파일

```text
.github/workflows/CI.yaml
.env.example
.gitignore
.prettierignore
.prettierrc.json
AGENTS.md
RULE.md
README.md
docs/architecture.md
docs/api-integration.md
eslint.config.js
index.html
package.json
package-lock.json
src/App.tsx
src/app/styles/global.css
src/main.tsx
src/shared/config/env.ts
tsconfig.json
tsconfig.app.json
tsconfig.node.json
vite.config.ts
```

이 목록은 초기 구조의 책임을 명확히 하기 위한 예상 목록이다. Vite 공식 템플릿의 현재 출력과 충돌할 경우 생성 결과를 먼저 확인하고, 동일한 책임을 유지하는 최소 변경만 적용한다.
