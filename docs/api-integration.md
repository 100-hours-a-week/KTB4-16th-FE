# MULO 프론트엔드 API 연동 규칙

## 1. 계약 우선순위

1. 최신 MULO OpenAPI 명세: 경로, HTTP method, 요청·응답 필드, 상태 코드
2. 이 문서: Cookie, CSRF, 토큰 보관, 재시도처럼 OpenAPI만으로 충분히 표현하기 어려운 동작
3. 기능별 확정 설계 문서

문서와 백엔드 구현이 다르면 프론트가 임의로 추측해 맞추지 않고 차이를 공유한다.

## 2. API base URL

```dotenv
VITE_API_BASE_URL=/api
```

- 애플리케이션에서는 `src/shared/config/env.ts`의 `env.apiBaseUrl`을 사용한다.
- 운영은 same-origin `/api` 구성을 기본으로 한다.
- `VITE_` 접두사 값은 브라우저 번들에 포함되므로 Secret을 넣지 않는다.
- 로컬에서 origin이 다르면 백엔드 CORS와 Cookie 정책을 함께 확인한다.

Vite 공식 문서는 `VITE_` 접두사가 붙은 환경변수가 클라이언트 소스에 노출되므로 민감 정보를 포함하지 말라고 안내한다.

- [Vite Env Variables and Modes](https://vite.dev/guide/env-and-mode)

## 3. 토큰 보관

### Access Token

- 로그인 또는 재발급 응답으로 받는다.
- 메모리 상태에만 저장한다.
- 보호 API에 `Authorization: Bearer <accessToken>`으로 전달한다.
- `localStorage`, `sessionStorage`, 일반 Cookie에 저장하지 않는다.

### Refresh Token

- 서버가 설정하는 `HttpOnly` Cookie에만 보관한다.
- JavaScript에서 읽거나 복사하지 않는다.
- 프론트 상태와 브라우저 저장소에 넣지 않는다.
- refresh와 logout 요청에서는 Cookie 전송을 위해 `credentials: 'include'`를 사용한다.
- 로컬처럼 프론트와 API의 origin이 다르면 CSRF 발급, Cookie가 필요한 모든 상태 변경 요청, refresh, logout에 `credentials: 'include'`를 사용한다.

## 4. CSRF

앱 시작 시 백엔드 계약에 따라 다음 요청으로 CSRF Cookie를 준비한다.

```http
GET /api/csrf
```

상태 변경 요청에는 `XSRF-TOKEN` Cookie 값을 헤더로 전달한다.

```http
X-XSRF-TOKEN: <cookie-value>
```

- `POST`, `PATCH`, `DELETE`는 명세의 예외를 제외하고 CSRF 처리를 적용한다.
- `GET` 요청에는 CSRF 헤더를 추가하지 않는다.
- `403 CSRF_TOKEN_INVALID`가 발생한 상태 변경 요청을 자동 반복하지 않는다.

## 5. 401과 토큰 재발급

```text
보호 API 401
  -> POST /api/auth/refresh 한 번
  -> 성공: Access Token 교체 후 원 요청 한 번 재시도
  -> 실패: 메모리 인증 상태 제거 후 로그인 흐름으로 이동
```

- refresh 요청 자체의 401은 다시 refresh하지 않는다.
- 동시에 여러 요청이 401을 받으면 하나의 refresh Promise를 공유한다.
- 원 요청 자동 재시도는 최대 한 번이다.
- 상태 변경 요청은 멱등성이 확인되지 않으면 CSRF 오류나 네트워크 오류만으로 자동 반복하지 않는다.

## 6. 요청 작성

- query parameter는 `URLSearchParams` 또는 검증된 클라이언트의 `params` 기능으로 인코딩한다.
- URL 문자열에 사용자 입력을 직접 이어 붙이지 않는다.
- 날짜·시간은 OpenAPI 형식을 따르고 timezone offset을 보존한다.
- 요청 DTO와 응답 DTO를 TypeScript 타입으로 분리한다.
- TypeScript 타입은 런타임 검증을 대신하지 않으므로 신뢰할 수 없는 외부 값은 경계에서 확인한다.

예:

```ts
const query = new URLSearchParams({
  latitude: String(latitude),
  longitude: String(longitude),
  at: new Date().toISOString(),
});
```

## 7. 오류 처리

- HTTP 상태와 OpenAPI 오류 코드를 함께 확인한다.
- 사용자 메시지와 개발자 진단 정보를 분리한다.
- 응답 본문, 토큰, Cookie, 개인정보를 콘솔에 그대로 기록하지 않는다.
- 네트워크 오류와 서버의 명시적 오류 응답을 구분한다.
- 자동 재시도 여부는 method의 멱등성과 기능 계약을 기준으로 정한다.

## 8. 구현 전 확인 목록

- [ ] 최신 OpenAPI 경로와 schema를 확인했다.
- [ ] 인증 필요 여부를 확인했다.
- [ ] Cookie와 `credentials` 필요 여부를 확인했다.
- [ ] 상태 변경 요청의 CSRF 처리를 확인했다.
- [ ] 401 재발급 대상과 제외 요청을 구분했다.
- [ ] query를 안전하게 인코딩했다.
- [ ] 오류 상태별 사용자 처리를 정의했다.
- [ ] Secret 또는 토큰을 영구 저장하지 않는다.
