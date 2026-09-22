# MULO Frontend

음악과 장소를 기반으로 추억을 기록하는 MULO 서비스의 프론트엔드 저장소다. 현재 단계는 화면 구현 전 React·TypeScript 개발 기반과 협업 규칙을 제공한다.

## 요구 환경

- Node.js 24
- npm 11 이상

CI도 Node.js 24와 `npm ci`를 사용한다.

## 시작하기

```bash
cp .env.example .env
npm ci
npm run dev
```

기본 개발 서버는 Vite가 출력하는 로컬 주소에서 확인한다. API base URL은 `.env`의 `VITE_API_BASE_URL`로 설정하며 기본 예시는 `/api`다.

## 명령어

```bash
npm run dev        # 개발 서버
npm run build      # TypeScript 검사 후 production build
npm run preview    # production build 미리보기
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
```

## 디렉터리 방향

```text
app -> pages -> features -> entities -> shared
```

초기 저장소는 실행에 필요한 파일만 포함한다. 화면과 기능을 추가할 때 [아키텍처 문서](docs/architecture.md)에서 책임과 위치를 먼저 확인한다.

## 문서

- [팀 협업 규칙](RULE.md)
- [AI 작업 규칙](AGENTS.md)
- [아키텍처](docs/architecture.md)
- [백엔드 API 연동](docs/api-integration.md)
- [초기 구조 설계](docs/superpowers/specs/2026-09-22-frontend-initial-setup-design.md)

## 참고 근거

- [React: Build a React app from Scratch](https://react.dev/learn/build-a-react-app-from-scratch)
- [React: Using TypeScript](https://react.dev/learn/typescript)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro)
- [Vite 환경변수와 모드](https://vite.dev/guide/env-and-mode)
