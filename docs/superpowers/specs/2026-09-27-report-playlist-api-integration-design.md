# 월별 리포트·AI 추천 플레이리스트 API 연동 설계

## 1. 목적과 범위

V1에서 이미 구현된 백엔드 API를 프론트의 준비 중 화면에 연결한다.

- 월별 리포트: 목록 조회, 월 선택, 상세 조회와 로딩·빈 목록·오류 상태
- AI 추천 플레이리스트: 기존 목록 조회, 현재 위치 기반 생성, 생성 결과 표시와 오류 상태

이번 범위에는 다음을 포함하지 않는다.

- 월간 리포트 생성 또는 AI 회고 재생성 요청
- 추천 결과를 Spotify 등 외부 서비스에 저장하는 기능
- 브라우저 위치 권한을 우회하거나, 사용자가 거절한 위치를 임의 좌표로 대체하는 기능
- 백엔드 API·DB·환경변수·의존성 변경

## 2. 계약 근거

프론트의 기존 설계 문서는 API를 `contract-only`로 기록했지만, 최신 백엔드 원본의 OpenAPI와 가이드는 다음 API를 `implemented`로 명시한다.

| 기능 | API | 인증 | 핵심 응답 |
| --- | --- | --- | --- |
| 월별 목록 | `GET /api/monthly-reports` | Bearer | `reports[]`: ID, 연·월, 기록 수, AI 회고 상태 |
| 월별 상세 | `GET /api/monthly-reports/{monthlyReportId}` | Bearer | 통계, 사진 장면, AI 회고 |
| 추천 조회 | `GET /api/recommendations/playlists` | Bearer | `playlist` 또는 `null` |
| 추천 생성 | `POST /api/recommendations/playlists` | Bearer, CSRF | 위치 좌표를 바탕으로 만든 `playlist` |

근거:

- `/Users/bohyeon/Documents/KTB/Team16/app/mulo-be/specs/openapi/MULO_OpenAPI_v2.7.yaml:3081-3700`
- `/Users/bohyeon/Documents/KTB/Team16/app/mulo-be/docs/monthly-report-guide.md:93-104`
- `/Users/bohyeon/Documents/KTB/Team16/app/mulo-be/docs/recommendation-playlist-guide.md:16-27`

## 3. 공통 요청 원칙

모든 API는 `useSession()`이 제공하는 `fetchAuthenticatedJson`을 통해 호출한다.

- 공통 요청기는 메모리 Access Token을 `Authorization: Bearer`로 붙인다.
- 최초 401은 refresh 후 원 요청을 한 번만 재시도한다.
- 추천 생성은 상태 변경이므로 기존 `getCsrfToken()`으로 CSRF Cookie와 `X-XSRF-TOKEN` 헤더를 준비하고 `credentials: 'include'`를 사용한다.
- 서버 응답은 TypeScript 타입만 믿지 않고 API 모듈 경계에서 런타임으로 검증한다.

## 4. 월별 리포트 화면 설계

### 목록: `/report`

1. 화면 진입 시 `GET /monthly-reports`를 한 번 요청한다.
2. 응답의 리포트를 연도별로 묶는다. 기본 선택 연도는 가장 최신 리포트의 연도이며, 리포트가 없으면 현재 연도다.
3. 1~12월 그리드에서 리포트가 있는 달만 클릭 가능한 버튼 또는 링크로 표시한다.
4. 각 활성 월은 기록 수와 AI 회고 상태를 함께 표시한다.
5. 클릭 시 연·월이 아닌 실제 `monthlyReportId`를 상태로 전달해 상세 화면이 조회에 사용할 식별자를 갖게 한다.
6. 빈 배열은 “아직 월별 리포트가 없어요” 안내로 표시한다. 가짜 월별 수치나 링크는 만들지 않는다.

### 상세: `/report/:year/:month`

1. 목록에서 이동할 때 route state에 `monthlyReportId`를 전달한다.
2. 상세 화면은 이 ID가 유효할 때만 `GET /monthly-reports/{monthlyReportId}`를 호출한다.
3. 응답의 기록 수, 대표 장소, 대표 아티스트, 평균 감정 점수, 사진 장면 태그, AI 회고를 표시한다.
4. `aiRecap.status`가 `COMPLETED`가 아니거나 회고 문장이 비어 있으면 완료된 회고처럼 보이지 않는 대기/실패 안내를 표시한다.
5. 직접 URL 진입처럼 ID가 없는 경우에는 추측 API 요청을 하지 않고 `/report`로 돌아가는 경로를 제공한다. URL의 연·월은 표시용이며 API 식별자가 아니다.
6. 404는 “찾을 수 없는 리포트”, 그 외 오류는 재시도 가능한 일반 오류로 구분한다.

## 5. AI 추천 플레이리스트 화면 설계

### 기존 목록 조회

1. 홈 지도에서 시트가 열릴 때, 로그인 상태이면 `GET /recommendations/playlists`를 요청한다.
2. `playlist=null`은 오류가 아닌 “아직 추천이 없습니다” 상태다.
3. 저장된 목록이 있으면 곡의 제목·아티스트·외부 링크를 순서대로 표시한다.
4. API 계약에는 앨범 이미지가 없으므로 기존 그라데이션 커버를 유지하고, 존재하지 않는 이미지 필드는 추측하지 않는다.

### 새 추천 생성

1. 저장된 목록이 없거나 사용자가 “새 추천 받기”를 누르면 브라우저 geolocation을 요청한다.
2. 위치를 얻은 경우에만 `POST /recommendations/playlists`에 `latitude`, `longitude`를 전송한다.
3. 성공한 응답의 플레이리스트로 화면 상태를 즉시 교체한다.
4. 위치 권한 거부·지원하지 않음·시간 초과는 위치 필요 안내를 보인다.
5. 502 `WEATHER_API_ERROR`, 502 `AI_SERVICE_ERROR`, 네트워크/서버 오류는 기존 목록을 지우지 않고 안내와 재시도 버튼을 제공한다.
6. 생성 중에는 버튼을 비활성화해 중복 생성 요청을 막는다.

## 6. 파일 경계

```text
features/
  monthly-report/
    api/                 # 목록·상세 요청과 런타임 파서
    model/               # API 응답과 화면 모델
    ui/                  # 목록·상세의 데이터 표시 컴포넌트
  home-playlist/
    api/                 # 조회·생성 요청과 런타임 파서
    model/               # 추천 플레이리스트 모델
    ui/                  # 기존 HomePlaylistSheet 확장
pages/report/ui/         # route state, 페이지 조립, 네비게이션
```

`pages`는 라우팅과 화면 조립만 담당하고, API 호출·응답 검증은 `features` 안에 둔다. 이 구조는 프로젝트의 `app -> pages -> features -> entities -> shared` 의존 방향을 보존한다.

## 7. 오류·보안 정책

- 인증 401은 기존 공통 인증 요청기의 refresh 정책을 사용한다.
- 목록·상세·추천 조회가 실패해도 가짜 데이터나 마지막 오류 메시지를 성공 결과처럼 표시하지 않는다.
- 추천 생성 실패 시 마지막으로 조회한 유효 목록은 유지한다.
- Access Token, Refresh Token, 위치 좌표는 로그·브라우저 저장소에 기록하지 않는다.
- 외부 음악 URL은 화면에 링크로만 제공하고 서버가 준 URL 형식을 런타임 검증한다.

## 8. 테스트 계획

### 월별 리포트

- 목록 응답을 연도·월로 표시하고 올바른 `monthlyReportId`로 상세 이동한다.
- 빈 배열, 목록 오류, 상세 404, 상세 일반 오류를 구분한다.
- `COMPLETED`가 아닌 AI 회고를 완료된 내용처럼 렌더링하지 않는다.
- 직접 상세 URL에 식별자가 없으면 API를 호출하지 않는다.

### 추천 플레이리스트

- 기존 목록, `playlist=null`, 조회 오류를 구분한다.
- 위치 좌표를 사용해 생성 요청을 보내고 성공 곡을 표시한다.
- 위치 거부·생성 중 중복 클릭·502 오류를 처리하고 기존 목록을 보존한다.
- CSRF 헤더와 `credentials: 'include'`를 요청에 포함한다.

전체 구현 후 `npm test -- --run`, `npm run prettier`, `npm run lint`, `npm run typecheck`, `npm run build`를 실행한다.

## 9. PR 분리

두 기능은 API와 사용자 흐름이 독립적이므로 다음 순서로 별도 PR을 만든다.

1. `feat: 월별 리포트 API 연동 #130`
2. `feat: AI 추천 플레이리스트 API 연동 #130`

각 PR은 이슈 #130을 참조하고, API 계약 변경이 없음을 기록한다.
