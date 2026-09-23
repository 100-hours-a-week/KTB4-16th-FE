# MULO Frontend

음악과 장소를 기반으로 추억을 기록하는 MULO 서비스의 프론트엔드 저장소다. React·TypeScript 기반에서 로그인과 회원가입 흐름을 우선 제공한다.

## 요구 환경

- Node.js 24
- npm 11 이상

CI도 Node.js 24와 `npm ci`를 사용한다.

## 시작하기

```bash
cp .env.example .env
npm install
npm run dev
```

프론트엔드는 `http://localhost:3000`에서 실행된다. 기본 `/api` 요청은 Vite 개발 서버가 `http://localhost:8080`의 백엔드로 전달한다. 다른 API 주소가 필요하면 `.env`의 `VITE_API_BASE_URL`을 변경한다.

테스트만 한 번 실행하려면 다음 명령을 사용한다.

```bash
npm test -- --run
```

## 명령어

```bash
npm run dev        # 개발 서버
npm run build      # TypeScript 검사 후 production build
npm run preview    # production build 미리보기
npm test           # Vitest 감시 모드
npm run prettier   # 포맷 검사
npm run format     # 포맷 자동 적용
npm run lint       # ESLint 검사
npm run typecheck  # TypeScript 타입 검사
```

PR 전 기본 검증:

```bash
npm run prettier
npm run lint
npm run typecheck
npm run build
npm test -- --run
```

## 디렉터리 방향

```text
app -> pages -> features -> entities -> shared
```

화면과 기능을 추가할 때 [아키텍처 문서](docs/architecture.md)에서 책임과 위치를 먼저 확인한다. 로그인 성공 access token은 메모리에만 보관하므로 현재 단계에서는 새로고침하면 다시 로그인해야 한다.

## 문서

- [팀 협업 규칙](RULE.md)
- [AI 작업 규칙](AGENTS.md)
- [아키텍처](docs/architecture.md)
- [백엔드 API 연동](docs/api-integration.md)
- [초기 구조 설계](docs/superpowers/specs/2026-09-22-frontend-initial-setup-design.md)
- [로그인·회원가입 설계](docs/superpowers/specs/2026-09-23-auth-pages-design.md)

## 참고 근거

- [React: Build a React app from Scratch](https://react.dev/learn/build-a-react-app-from-scratch)
- [React: Using TypeScript](https://react.dev/learn/typescript)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro)
- [Vite 환경변수와 모드](https://vite.dev/guide/env-and-mode)
