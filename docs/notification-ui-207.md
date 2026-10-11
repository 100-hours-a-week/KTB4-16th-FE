# 알림 화면 및 진입 (#207)

## 변경 범위

| 기존                               | 변경                                                                  |
| ---------------------------------- | --------------------------------------------------------------------- |
| 홈 상단에는 로고와 날씨만 있다.    | 날씨 옆 알림 버튼에서 `/notifications`로 이동한다.                    |
| 알림 목록 라우트가 없다.           | 로그인 보호 라우트에서 알림 목록·빈 상태·오류·추가 페이지를 표시한다. |
| 친구 요청 알림의 이동 대상이 없다. | `/friends?tab=received`로 이동하고 받은 요청 탭을 연다.               |

친구 요청 입력을 검색으로 바꾸는 프론트 변경은 별도 작업으로 남긴다. 이 PR에서는 기존 친구 요청 입력 화면을 유지한다.

## API와 표시 정책

계약 근거: 백엔드 `specs/openapi/MULO_OpenAPI_v2.8.yaml`의 `GET /api/notifications`와 `PATCH /api/notifications/read`, 프론트 `docs/api-integration.md`의 인증·CSRF 규칙.

- 기존 인증 클라이언트로 `GET /api/notifications?size=20`을 호출한다. 다음 페이지는 서버 cursor를 `URLSearchParams`로 인코딩한다.
- 화면에서 조회한 미읽음 ID만 PATCH 본문에 담고 기존 CSRF 처리를 적용한다. GET 자체는 읽음 상태를 변경하지 않는다.
- 읽음 저장에 실패해도 목록을 유지하고 사용자에게 재시도 버튼을 제공한다. 서버 성공 응답 후에만 화면의 읽음 상태를 갱신한다.
- offset 없는 서버 `LocalDateTime`은 KST로 해석하고, offset이 있으면 보존한다.
- 친구 요청은 `/friends?tab=received`, 친구 수락은 `/friends`, 월간 리포트는 `/report`로 이동한다. 채팅 화면이 아직 없거나 대상 ID가 null인 알림은 이동 링크를 표시하지 않는다.
- 미읽음 개수 배지·폴링·알림 삭제 UI는 이 화면 범위에 포함하지 않는다.

## 검증

`npm test -- --run`, `npm run prettier`, `npm run lint`, `npm run typecheck`, `npm run build`를 실행한다. 알림 cursor·읽음 처리·오류 복구·홈 진입·친구 요청 탭 이동을 확인한다.

의존성, 공용 API 클라이언트, 인증·토큰 저장 방식, 환경변수, DB/Flyway는 변경하지 않는다.
