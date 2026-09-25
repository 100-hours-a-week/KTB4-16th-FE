# API 연동 가능 화면 및 준비 중 기능 설계

## 1. 목적과 범위

이 문서는 현재 백엔드에서 구현된 API만 프론트엔드 화면에 연동하고, 아직 구현되지 않은 기능은 실제 결과처럼 보이는 목업 대신 명확한 준비 중 상태로 전환하는 설계를 정의한다.

이번 범위는 다음을 포함한다.

- 마이페이지의 현재 사용자 조회, 닉네임 변경, 비밀번호 변경
- 자물쇠 작성 화면의 음악 검색
- 추천 플레이리스트, AI 기억 검색, 월간 리포트 목록의 준비 중 안내
- 기존 목업 데이터와 가짜 성공 결과 제거
- 로딩·빈 상태·오류·인증 만료 상태의 화면 처리와 테스트

다음은 범위에서 제외한다.

- 추천 플레이리스트 생성·조회 API 연동
- AI 기억 검색 요청·검색 결과 렌더링
- 월간 리포트 목록·상세 API 연동
- 자물쇠 저장, 사진 분석, 임시 저장
- 로그아웃과 회원탈퇴

## 2. 기준 자료와 API 상태

### 프로젝트 기준

- `AGENTS.md`, `RULE.md`, `docs/architecture.md`: 계층 방향, 공용화 조건, API·토큰 규칙의 기준
- `docs/api-integration.md`: access token, refresh Cookie, CSRF 처리의 기준
- `mulo_mockup_0915.html`: 화면 문구와 시각적 구성의 참고 자료. 가짜 결과·인라인 이벤트·목업 성공 흐름은 채택하지 않는다.
- `MULO_OpenAPI_v2.7.yaml`: API 경로, method, 요청·응답, 구현 상태의 기준

### 최신 OpenAPI 기준 상태

| 기능              | API                                       | 상태                  | 화면 정책        |
| ----------------- | ----------------------------------------- | --------------------- | ---------------- |
| 내 정보 조회      | `GET /api/users/me`                       | implemented           | 실제 연동        |
| 닉네임 변경       | `PATCH /api/users/me/nickname`            | implemented           | 실제 연동 + CSRF |
| 비밀번호 변경     | `PATCH /api/users/me/password`            | implemented           | 실제 연동 + CSRF |
| 음악 검색         | `GET /api/music/search`                   | implemented           | 실제 연동        |
| 월간 리포트 목록  | `GET /api/monthly-reports`                | contract-only         | 준비 중          |
| 추천 플레이리스트 | `GET/POST /api/recommendations/playlists` | contract-only         | 준비 중          |
| 기억 검색         | `POST /api/memories/search`               | V1 제외·contract-only | 준비 중          |

`/api/monthly-reports/{monthlyReportId}`는 구현 상태이나 목록 API가 없으면 사용자가 유효한 식별자를 선택할 수 없으므로, 이번 범위에서는 상세 화면도 실제 데이터와 연결하지 않는다.

## 3. 선택한 사용자 경험

API가 없는 기능에는 세 가지 선택지가 있다.

1. 목업 데이터로 성공 결과를 보여준다.
2. 메뉴나 진입점을 숨긴다.
3. 화면은 유지하고 준비 중 안내를 보여준다.

3번을 채택한다. 사용자는 기능의 존재와 현재 제공 범위를 알 수 있고, 프론트가 존재하지 않는 응답 구조를 만들지 않는다. 이후 API가 구현되면 안내 컴포넌트만 실제 feature UI로 교체하면 된다.

준비 중 화면은 제목, 제공 예정 안내, 홈으로 돌아가기 버튼을 제공한다. 검색 폼의 제출, 플레이리스트 생성, 정적 결과·월별 카운트 링크는 제거하거나 비활성화한다. 성공 토스트나 저장된 데이터처럼 보이는 문구를 사용하지 않는다.

## 4. 구조와 책임

```text
src/
├── entities/
│   └── user/
│       └── model/user.types.ts
├── features/
│   ├── user-profile/
│   │   ├── api/userProfileApi.ts
│   │   ├── model/userProfile.validation.ts
│   │   └── ui/
│   │       ├── NicknameChangeForm.tsx
│   │       └── PasswordChangeForm.tsx
│   └── music-search/
│       ├── api/musicSearchApi.ts
│       ├── model/musicSearch.types.ts
│       └── ui/MusicSearchField.tsx
├── pages/
│   ├── mypage/ui/MyPage.tsx
│   ├── mypage/ui/NicknameChangePage.tsx
│   ├── mypage/ui/PasswordChangePage.tsx
│   ├── memory-search/ui/MemorySearchPage.tsx
│   ├── report/ui/ReportPage.tsx
│   └── lock-create/ui/LockCreatePage.tsx
└── shared/
    └── ui/FeatureUnavailableNotice.tsx
```

- `entities/user`: 여러 화면에서 사용할 사용자 표시 타입만 소유한다.
- `features/user-profile`: 사용자 조회·변경 요청, 입력 검증, 변경 폼을 소유한다.
- `features/music-search`: 검색 API 요청, 검색 결과 타입, 검색 UI를 소유한다.
- `pages`: URL별 화면을 조립하고 `useSession()`의 `fetchAuthenticatedJson`을 feature API에 전달한다.
- `shared/ui/FeatureUnavailableNotice`: 실제 사용처가 플레이리스트·기억 검색·리포트 세 곳이므로, 공통 준비 중 UI를 제공한다.

`shared`는 `entities`, `features`, `pages`를 import하지 않는다. feature API는 React Hook을 호출하지 않으며, 페이지에서 받은 인증 요청 함수를 인자로 받는다. 이 방식은 `app → pages → features → entities → shared` 의존 방향을 유지한다.

## 5. API와 보안 흐름

### 보호 요청 전달

마이페이지와 음악 검색은 `useSession()`의 `fetchAuthenticatedJson`을 사용한다. 이 공통 클라이언트는 access token을 메모리에서 읽어 `Authorization: Bearer <accessToken>`을 추가하고, 401이면 refresh 후 원 요청을 한 번 재시도한다.

feature API가 받는 인증 요청 함수의 형태는 다음과 같다.

```ts
type AuthenticatedRequest = <T>(path: string, init?: RequestInit) => Promise<T>;
```

### 사용자 정보 조회

1. `/mypage` 진입 시 `GET /api/users/me`을 요청한다.
2. 응답의 `data.userId`, `data.nickname`, `data.email`을 런타임에서 검증한다.
3. 로딩 중에는 프로필 skeleton 또는 상태 문구를, 성공 시 실제 닉네임·이메일을 표시한다.
4. 401·refresh 실패는 세션이 제거된 뒤 로그인 화면으로 이동한다. 네트워크·5xx는 재시도 버튼을 표시한다.

### 닉네임과 비밀번호 변경

1. 변경 페이지는 현재 사용자 정보를 조회해 닉네임 표시와 프로필 갱신에 사용한다.
2. 클라이언트 검증을 통과하면 `GET /api/csrf`로 `XSRF-TOKEN` Cookie를 준비한다.
3. `PATCH /api/users/me/nickname` 또는 `PATCH /api/users/me/password`에 `credentials: 'include'`, `X-XSRF-TOKEN`, Bearer token을 전달한다.
4. 성공 시 상태 안내를 표시하고 마이페이지로 돌아가 최신 사용자 정보를 다시 조회한다.
5. 400 필드 오류와 409 중복 닉네임은 해당 입력 아래에 표시한다. 401, 403, 네트워크, 5xx는 폼 공통 오류로 표시한다.

비밀번호 확인은 OpenAPI 요청에는 없으며 프론트에서만 `newPassword`와 동일한지 검증한다. 현재 비밀번호와 새 비밀번호가 같은 경우도 요청 전에 막는다.

### 음악 검색

1. 자물쇠 작성 화면에서 사용자가 곡명·아티스트를 입력한다.
2. 공백만 입력한 경우 요청하지 않는다.
3. `GET /api/music/search?query=...`를 `URLSearchParams`로 인코딩해 요청한다.
4. 결과 목록에서 한 곡을 선택하면 작성 폼의 음악 입력값만 채운다.
5. 검색 결과 없음, rate limit, 네트워크 오류를 구분해 표시한다.

자물쇠 저장 API는 범위 밖이므로 선택한 음악은 현재 화면 상태에만 남고 저장 버튼은 비활성 상태를 유지한다.

## 6. 라우팅과 화면 전환

| 경로               | 인증 | 화면                            |
| ------------------ | ---- | ------------------------------- |
| `/mypage`          | 필요 | 내 정보 조회와 메뉴             |
| `/mypage/nickname` | 필요 | 닉네임 변경 폼                  |
| `/mypage/password` | 필요 | 비밀번호 변경 폼                |
| `/locks/create`    | 필요 | 음악 검색 연동 자물쇠 작성 화면 |
| `/memory-search`   | 필요 | 준비 중 안내                    |
| `/report`          | 필요 | 준비 중 안내                    |
| 플레이리스트 진입  | 필요 | 준비 중 sheet 또는 안내 페이지  |

마이페이지의 닉네임·비밀번호 메뉴는 각각 새 경로로 이동한다. 로그인하지 않은 사용자가 위 경로로 접근하면 기존 라우팅 정책대로 `/login`으로 이동한다. 공개 홈 정책은 바꾸지 않는다.

## 7. 오류·접근성·상태

- 외부 응답은 `unknown`으로 받고 타입 가드로 검증한다. `any`를 사용하지 않는다.
- 네트워크 오류와 서버 오류에는 토큰·Cookie·개인정보를 표시하거나 로그에 남기지 않는다.
- 제출 중에는 버튼을 비활성화해 중복 요청을 막는다.
- 폼 오류는 `role="alert"`, 처리 결과는 `role="status"`, 비동기 조회 영역은 `aria-live="polite"`를 사용한다.
- 준비 중 안내는 단순히 비활성화된 빈 버튼이 아니라, 사용할 수 없는 이유와 홈 복귀 방법을 텍스트로 제공한다.
- 만료된 세션에서 보호 요청이 실패하면 사용자 데이터나 이전 입력을 성공한 것처럼 표시하지 않는다.

## 8. 테스트 전략

### API·모델 단위 테스트

- `/users/me`의 정상, 잘못된 응답, 401, 네트워크 실패
- 닉네임·비밀번호 PATCH의 method, DTO, CSRF 헤더, 필드 오류 정규화
- 닉네임 길이·문자·현재 값 중복, 비밀번호 복잡도·확인·동일 비밀번호 경계
- 음악 검색 query 인코딩, 빈 검색어 미요청, 잘못된 응답

### 화면 통합 테스트

- 마이페이지가 실제 사용자 닉네임·이메일과 로딩·오류·재시도를 보여줌
- 닉네임·비밀번호 폼이 성공 후 마이페이지로 이동하고 최신 정보 표시
- 서버 필드 오류와 공통 오류의 접근 가능한 표시
- 음악 검색 결과 선택이 자물쇠 작성 폼을 채움
- 기억 검색·플레이리스트·리포트가 가짜 결과 대신 준비 중 안내를 보임
- 비로그인 사용자가 보호 경로에서 로그인 화면으로 이동함

### 완료 검증

```bash
npm test -- --run
npm run prettier
npm run lint
npm run typecheck
npm run build
```

## 9. 기존 화면에서 달라지는 점

| 기존                                                  | 변경                                        |
| ----------------------------------------------------- | ------------------------------------------- |
| 마이페이지에 `mulo유저`, `example@mulo.com` 고정 표시 | `/api/users/me`의 검증된 닉네임·이메일 표시 |
| 닉네임·비밀번호 메뉴가 동작하지 않음                  | 전용 변경 경로와 실제 PATCH 요청 연결       |
| 기억 검색 제출 후 가짜 검색 결과 표시                 | API 구현 전 준비 중 안내만 표시             |
| 리포트 월별 목업 카운트와 링크 표시                   | 목록 API 구현 전 준비 중 안내 표시          |
| 자물쇠 작성의 음악 입력이 정적 input                  | 구현된 음악 검색 API 결과 선택 지원         |
| 플레이리스트가 목업 sheet를 표시                      | API 구현 전 준비 중 안내 표시               |

## 10. 후속 확장 조건

- 추천 플레이리스트 API가 implemented가 되면 준비 중 UI를 `features/recommendation`의 조회·생성 흐름으로 교체한다.
- 기억 검색이 V1 범위에 들어오고 API가 implemented가 되면 검색 form과 결과 타입을 `features/memory-search`로 분리한다.
- 월간 리포트 목록 API가 implemented가 되면 `ReportPage`가 실제 목록에서 `monthlyReportId`를 얻어 상세 페이지 연결을 활성화한다.
- 자물쇠 저장 API가 구현되기 전에는 작성 내용을 브라우저 저장소에 영구 저장하지 않는다.
