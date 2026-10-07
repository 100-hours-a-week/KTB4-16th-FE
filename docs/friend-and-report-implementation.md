# 친구 화면 및 리포트 화면 구현

> 기준: 작업번호 193, `develop`에 병합된 프론트엔드 PR #66. 백엔드 계약은 `mulo-be/specs/openapi/MULO_OpenAPI_v2.8.yaml`을 따른다.

## 친구 흐름

`src/app/router/AppRouter.tsx:46-58`은 로그인 보호 경로 `/friends`와 `/friends/:friendUserId/dashboard`를 연결한다. `src/features/main-navigation/ui/MainNavigation.tsx:16-20`은 하단 탐색에 홈·대시보드·리포트·친구·마이페이지 순서로 진입점을 제공한다.

| 역할               | 구현 위치                                                                                      | 동작                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| API 요청·응답 검증 | `src/features/friend/api/friendApi.ts:28-249`                                                  | 친구·요청 cursor 목록, 닉네임 요청, 수락, 거절·취소, 친구 삭제. 외부 응답은 런타임에서 검사한다. |
| 친구 화면          | `src/pages/friend/ui/FriendsPage.tsx:25-470`                                                   | 친구·받은 요청·보낸 요청 탭, 더 보기, 요청 결과 안내, 친구 삭제 확인 대화상자.                   |
| 친구 대시보드      | `src/pages/friend-dashboard/ui/FriendDashboardPage.tsx:9-37`                                   | URL의 친구 ID를 확인하고 프로필·지역별 자물쇠 화면을 연다.                                       |
| 대시보드 데이터    | `src/features/dashboard/ui/FriendDashboardContent.tsx:15-311`                                  | 지역 선택, cursor 추가 조회, 자물쇠 상세 링크, 친구 관계 종료 안내.                              |
| 지역 API           | `src/features/dashboard/api/getFriendRecordRegions.ts:12-75`, `getFriendRegionRecords.ts:5-99` | 친구 프로필·지역 요약 및 선택 지역 자물쇠 페이지를 읽는다.                                       |

친구 요청·수락·삭제는 `friendApi.ts:76-140`에서 CSRF 토큰을 준비한 뒤 인증된 요청으로 보낸다. 읽기 요청은 현재 세션의 인증 클라이언트를 사용한다. 친구 관계와 자물쇠 상세 권한은 화면 표시 여부만으로 결정하지 않으며, 백엔드가 **요청마다** 현재 friendship을 검사한다. 친구 삭제 후 대시보드 또는 자물쇠 접근이 404면 목록으로 돌아갈 수 있는 안내를 표시한다.

## 리포트 화면

`src/features/monthly-report/ui/MonthlyReportList.tsx:11-123`은 `Asia/Seoul`의 현재 연도를 기본으로 1~12월을 달력형 카드로 표시한다. 리포트가 있는 달만 상세 링크로 열리며 없는 달은 비활성 상태로 남는다. 이전·다음 연도 버튼과 직접 연도 입력을 지원한다. `src/pages/report/ui/ReportPage.tsx:15-70`은 리포트 화면에 새로 진입할 때 목록 컴포넌트를 다시 만들어 해당 시점의 현재 연도를 선택한다.

## 검증 범위

- 친구 API·화면·친구 대시보드·자물쇠 상세 권한·하단 탐색·리포트 연도 이동 테스트를 포함해 63개 테스트 파일의 371개 테스트가 통과했다.
- `npm run prettier`, `npm run lint`, `npm run typecheck`, `npm run build`가 통과했다.
- 의존성, 환경변수 이름, 인증 토큰 저장 방식은 변경하지 않았다.
