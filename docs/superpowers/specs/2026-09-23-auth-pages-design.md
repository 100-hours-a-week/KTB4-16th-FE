# 로그인·회원가입 화면 설계

## 1. 목적과 범위

이 문서는 MULO 프론트엔드의 첫 사용자 흐름인 로그인과 회원가입을 구현하기 위한 설계를 정의한다. 팀원이 서로의 구현 코드를 직접 보지 않더라도 문서와 명확한 모듈 경계를 통해 기능을 확장할 수 있어야 한다.

이번 범위는 다음과 같다.

- `/login` 로그인 화면과 `/signup` 회원가입 화면
- 로그인 성공 여부를 확인할 수 있는 최소 홈 화면(`/`)
- React Router 기반 페이지 이동
- 백엔드 OpenAPI 및 실제 보안 설정에 맞춘 로그인·회원가입 API 연동
- 메모리 기반 access token 세션
- 입력 검증, 서버 오류 표시, 중복 제출 방지
- 단위·통합 테스트 환경

소셜 로그인, 비밀번호 찾기, 프로필, 게시물, 영구 로그인, 토큰 재발급 자동화는 이번 범위에 포함하지 않는다.

## 2. 기준 자료

### 프로젝트 자료

- `mulo_mockup_0915.html`: 색상, 중앙 정렬 카드, 필드 구성만 참고한다. 인라인 이벤트, 한 파일 구조, `localStorage` 사용 방식은 채택하지 않는다.
- `MULO_OpenAPI_v2.7.yaml`: `/api/auth/login`, `/api/users/signup` 요청·응답 계약의 기준이다.
- 백엔드 `UserSignupRequest.java`, `LoginRequest.java`: 실제 입력 제약의 기준이다.
- 백엔드 `SecurityConfig.java`, `docs/login-api-implementation.md`: CSRF, Cookie, access token 처리의 기준이다.
- 프론트엔드 `AGENTS.md`, `RULE.md`, `docs/architecture.md`, `docs/api-integration.md`: 계층, 네이밍, 브랜치, 토큰 보관 규칙의 기준이다.

### 공식 문서

- [React Router Declarative Routing](https://reactrouter.com/start/declarative/routing): URL과 페이지 컴포넌트의 선언적 연결 근거
- [React Router Installation](https://reactrouter.com/start/declarative/installation): React Router 설치 및 `BrowserRouter` 구성 근거
- [Vitest Guide](https://main.vitest.dev/guide/why): Vite 설정과 호환되는 테스트 러너 선택 근거
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/): 사용자 관점 컴포넌트 테스트 근거
- [user-event](https://testing-library.com/docs/user-event/intro/): 실제 사용자 입력에 가까운 상호작용 테스트 근거

## 3. 기술 선택

### 라우팅

`react-router`를 사용한다. 초기 화면 수는 적지만 URL 단위로 페이지 책임을 나누고, 로그인·회원가입·홈 사이의 이동 조건을 명확히 유지하기 위해 필요하다.

### HTTP 통신

브라우저 기본 `fetch`를 감싼 얇은 공통 모듈을 사용한다. 현재 필요한 기능은 JSON 변환, 공통 오류 정규화, Cookie 포함, CSRF 헤더뿐이므로 별도 HTTP 라이브러리는 추가하지 않는다.

### 테스트

`vitest`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/jest-dom`을 개발 의존성으로 사용한다. 검증 함수는 단위 테스트하고, 화면과 API 흐름은 사용자 상호작용 중심으로 통합 테스트한다.

## 4. 구조와 책임

```text
src/
├── app/
│   ├── providers/AppProviders.tsx
│   ├── router/AppRouter.tsx
│   └── styles/global.css
├── pages/
│   ├── home/HomePlaceholderPage.tsx
│   ├── login/LoginPage.tsx
│   └── signup/SignupPage.tsx
├── features/auth/
│   ├── api/authApi.ts
│   ├── model/auth.types.ts
│   ├── model/auth.validation.ts
│   └── ui/AuthFormField.tsx
├── entities/session/model/SessionContext.tsx
└── shared/api/
    ├── apiError.ts
    ├── csrf.ts
    └── fetchJson.ts
```

- `app`: 전역 Provider와 최상위 라우팅을 조합한다.
- `pages`: 한 URL의 화면 구성과 제출 상태를 관리한다.
- `features/auth`: 인증 API, 입력 모델, 검증, 인증 폼 공통 UI를 소유한다.
- `entities/session`: 로그인한 사용자 세션의 access token과 인증 여부를 메모리에서 관리한다.
- `shared/api`: 도메인과 무관한 HTTP·오류·CSRF 처리를 담당한다.

상위 계층만 하위 계층을 참조하며 `app → pages → features → entities → shared` 방향을 지킨다. 각 함수·컴포넌트에는 책임이 불명확하지 않도록 짧은 역할 주석을 남긴다.

## 5. 라우팅과 세션

| 경로      | 비로그인          | 로그인            |
| --------- | ----------------- | ----------------- |
| `/`       | `/login`으로 이동 | 최소 홈 화면 표시 |
| `/login`  | 로그인 화면       | `/`로 이동        |
| `/signup` | 회원가입 화면     | `/`로 이동        |
| 그 외     | `/`로 이동        | `/`로 이동        |

로그인 성공 시 응답의 `accessToken`을 `SessionContext` 상태에만 저장한다. `localStorage`, `sessionStorage`, 일반 Cookie에는 저장하지 않는다. 브라우저 새로고침 시 메모리 토큰이 사라져 로그인 화면으로 돌아가는 동작은 이번 범위에서 의도된 결과다. refresh token은 백엔드의 HttpOnly Cookie가 관리하며 프론트엔드 JavaScript로 읽지 않는다.

## 6. API 흐름

### 로그인

1. 사용자가 이메일과 비밀번호를 제출한다.
2. 클라이언트 검증을 통과하면 `GET /api/csrf`를 `credentials: 'include'`로 요청한다.
3. 브라우저 Cookie의 `XSRF-TOKEN`을 읽는다.
4. `POST /api/auth/login`에 `credentials: 'include'`, `X-XSRF-TOKEN` 헤더, JSON 본문을 보낸다.
5. `200` 응답의 `accessToken`을 메모리 세션에 저장하고 `/`로 이동한다.

로그인 이메일은 앞뒤 공백을 제거하고 소문자로 정규화한다. 비밀번호는 사용자가 입력한 문자열 자체가 인증값이므로 공백을 제거하지 않는다.

### 회원가입

1. 닉네임, 이메일, 비밀번호, 비밀번호 확인을 입력한다.
2. 클라이언트 검증을 통과하면 `POST /api/users/signup`에 JSON 본문을 보낸다.
3. 비밀번호 확인 값은 서버에 보내지 않는다.
4. `201` 응답이면 `/login`으로 이동하고 가입 완료 안내를 표시한다.

백엔드 설정상 회원가입 요청은 CSRF 검사 예외이므로 CSRF 선행 요청을 하지 않는다. Cookie가 필요한 배포 구성을 방해하지 않도록 API 요청에는 `credentials: 'include'`를 유지한다.

로컬 개발에서는 Vite가 `/api`를 `http://localhost:8080`으로 프록시한다. 브라우저에는 동일 출처 요청처럼 보이게 해 개발 중 CORS·Cookie 차이를 줄인다.

## 7. 입력 검증

### 로그인

- 이메일: 필수, 이메일 형식
- 비밀번호: 필수

### 회원가입

- 닉네임: 영문·숫자·한글만 허용, 2자 이상 10자 이하
- 이메일: 필수, 이메일 형식
- 비밀번호: 8자 이상 16자 이하이며 영문 소문자·대문자·숫자·특수문자를 각각 하나 이상 포함
- 비밀번호 확인: 비밀번호와 일치

클라이언트 검증은 빠른 피드백을 위한 것이며 서버 검증을 대체하지 않는다. 서버의 `400` 필드 오류와 `409 DUPLICATE_RESOURCE`의 이메일·닉네임 오류를 해당 필드에 병합해 표시한다.

## 8. 오류와 상태 처리

`fetchJson`은 성공 JSON과 실패 응답을 한곳에서 처리한다. 외부 응답은 `unknown`으로 받은 뒤 타입 가드로 확인한다. 정규화된 `ApiError`에는 HTTP 상태, 서버 오류 코드, 사용자 메시지, 필드 오류를 담는다.

- `400`: 서버 필드 오류를 각 입력 아래에 표시
- `401`: 로그인 정보가 일치하지 않는다는 일반 메시지 표시
- `403`: 보안 토큰을 다시 받을 수 있도록 CSRF 관련 안내 표시
- `409`: 이메일·닉네임 중복 오류를 해당 필드에 표시
- `500` 또는 형식이 다른 실패 응답: 잠시 후 다시 시도하라는 일반 메시지 표시
- 네트워크 실패: 서버 연결을 확인하라는 메시지 표시

각 폼은 제출 중 버튼을 비활성화해 중복 요청을 막는다. 필드 오류는 `aria-describedby`, 폼 오류는 `role="alert"`, 성공·처리 상태는 `role="status"`로 보조 기술에 전달한다.

## 9. 화면 설계

기존 목업의 파스텔 라일락·피치·민트 분위기와 375px 인증 화면의 시각 계층을 기준으로 삼는다. 로그인과 회원가입은 같은 시각 언어를 공유하고, 데스크톱에서는 목업의 안쪽 화면을 중앙 카드로 확장한다.

- 로그인은 `mulo` 로고, `장소에 음악을 걸어두는 앱` 설명, 목업 placeholder를 사용한다.
- 회원가입은 상단 뒤로가기, 중앙 제목, `가입 완료` 버튼 구조를 사용한다.
- 닉네임과 비밀번호 규칙은 입력 전에도 필드 아래에 헬퍼 텍스트로 표시한다.
- 필드 메시지는 `오류 > 성공 > 기본 안내` 순으로 하나만 표시하고 `aria-describedby`로 input과 연결한다.
- 로그인 비밀번호는 백엔드 계약에 맞춰 필수 입력만 검사하며, 회원가입의 복잡도 규칙을 로그인에 강제하지 않는다.

- 명시적인 `label`과 충분한 터치 영역
- 키보드 포커스가 분명한 입력·버튼
- 오류 시 색상뿐 아니라 텍스트로 상태 전달
- 좁은 화면에서는 카드 여백과 글자 크기를 조정
- 인라인 스타일과 인라인 이벤트 핸들러는 사용하지 않음

홈 화면은 인증 연동 결과를 확인하기 위한 최소 자리표시자이며, 이후 화면 논의 시 교체 가능하도록 인증 기능과 분리한다.

## 10. 테스트와 완료 조건

### 자동 테스트

- 닉네임·이메일·비밀번호·비밀번호 확인 검증 경계값
- 회원가입 성공 시 로그인 이동 및 안내
- 회원가입 `400`, `409`, 네트워크 실패 표시
- 로그인 시 CSRF 요청 → Cookie 추출 → 로그인 요청 순서와 헤더
- 로그인 성공 시 메모리 토큰 저장 및 홈 이동
- 로그인 `401`, `403`, 네트워크 실패 표시
- 제출 중 중복 제출 차단
- 비로그인·로그인 라우팅 분기
- 토큰을 영구 저장소에 기록하지 않음

### 검증 명령

```bash
npm test -- --run
npm run prettier
npm run lint
npm run typecheck
npm run build
```

### 완료 조건

- 위 자동 테스트와 검증 명령이 모두 통과한다.
- 백엔드가 실행 중이면 브라우저에서 회원가입과 로그인 요청이 명세대로 전송된다.
- 백엔드가 없더라도 네트워크 오류가 화면에 안전하게 표시된다.
- 데스크톱과 모바일 너비에서 폼이 잘리지 않고 키보드로 조작할 수 있다.
- 구현의 책임, API 흐름, 후속 확장 지점이 문서와 코드 주석에서 확인된다.

## 11. 기존 코드에서 달라지는 점

| 기존                                      | 변경                                                            |
| ----------------------------------------- | --------------------------------------------------------------- |
| `App.tsx` 한 화면이 초기 설정 안내만 표시 | `AppProviders`와 `AppRouter`가 로그인·회원가입·홈을 조합        |
| 라우팅 없음                               | React Router로 URL별 페이지와 인증 분기 제공                    |
| API 호출 계층 없음                        | `shared/api`와 `features/auth/api`로 공통 통신과 인증 계약 분리 |
| 세션 상태 없음                            | `SessionContext`에서 access token을 메모리로 관리               |
| 테스트 환경 없음                          | Vitest와 Testing Library로 검증·사용자 흐름 테스트 추가         |
| Vite 개발 서버 기본값                     | 포트 `3000`, `/api` 백엔드 프록시 추가                          |

이 변경은 이후 도메인 페이지가 인증 구현을 다시 알 필요 없이 세션 상태와 공통 API 기반을 재사용하도록 만드는 최소 토대다.
