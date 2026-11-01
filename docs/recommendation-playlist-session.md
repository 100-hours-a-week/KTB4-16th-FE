# 홈 추천 플레이리스트 화면 세션

## 확정 동작

- 진입 시 이전 추천 GET과 자동 추천 POST를 보내지 않는다. 빈 화면에 최대 3회 안내와 `추천 받기`를 표시한다.
- 새 추천에 성공한 경우에만 1회를 사용한다. 실패·AI 저하로 기존 목록을 유지한 경우에는 차감하지 않는다.
- 요청에는 창 세션의 현재 회차인 필수 `recommendationAttempt`(1~3)를 보낸다. FE가 성공 횟수에서 다음 회차를 계산하며 Backend는 전달된 값의 범위만 검증한다.
- 매번 최신 5곡만 표시하고, 이번 화면에서 받은 외부 곡 ID는 중복 없이 누적한다.
- 첫 요청은 `excludeTrackIds: []`, 두 번째는 앞선 5개, 세 번째는 앞선 10개 ID를 보낸다.
- 세 번째 성공 후 버튼과 실행 가드로 추가 요청을 막는다.
- 새 추천의 `recommendationId`가 있고 추천 곡이 표시되면 해당 결과에 새 피드백을 제출해야 한다. 제출 전과 제출 중에는 시트 닫기·재추천을 막는다. LIKE는 추천 곡 중 1개를 선택하고, DISLIKE는 곡 선택 없이 제출한다. 제출 실패 시 현재 결과를 유지하고 다시 제출할 수 있다.
- 성공 응답은 최상위 `recommendationId`를 사용한다. fallback은 `data.replaced=false`이고 새 `recommendationId`가 생략되므로 회차를 차감하거나 피드백 대상으로 만들지 않는다. 오류·결과 없음·ID 누락에도 피드백을 강제하지 않는다.
- 요청 진행 중 버튼을 잠근다. 피드백 미제출 또는 제출 중에는 X·ESC·배경 닫기 시도에 브라우저 확인 창 대신 피드백 제출 안내를 표시한다. 닫기가 허용되는 상태에서는 브라우저 확인을 표시한다. 취소하면 현재 추천·횟수·진행 요청을 유지하고 확인하면 진행 요청을 중단하고 닫는다.
- 닫힘 애니메이션이 끝나면 컴포넌트를 제거한다. 다시 열면 현재 목록·횟수·제외 목록이 초기화된다.
- 추천 시트는 지도 내부가 아닌 하단 주요 메뉴까지 덮는 페이지 수준의 모달이며, 첫 진입부터 화면 높이의 70%를 확보하고 추천 버튼은 하단에 배치한다. 추천창과 배경은 하단 주요 메뉴까지 덮되 홈 페이지 바깥 테두리를 넘지 않으며, 긴 곡명은 줄바꿈하고 목록은 내부에서 스크롤한다. 배경 조작·스크롤을 막고 키보드 초점은 모달 안에서 순환한다.

## 기존 내용과 수정 내용

| 책임                     | 기존                          | 수정                                                          |
| ------------------------ | ----------------------------- | ------------------------------------------------------------- |
| `HomePlaylistSheet` 진입 | 마지막 DB 추천 조회           | 안내와 최초 추천 버튼                                         |
| 추천 생성                | 횟수·제외 목록 없이 호출      | 성공 최대 3회, 누적 제외 목록 전달                            |
| 생성 실패                | 오류 표시                     | 현재 세션의 표시 목록·횟수·제외 ID 유지                       |
| 시트 배치                | `HomeMap`의 자식              | `HomePage`에서 지도와 별도로 렌더링                           |
| 생성 요청 DTO            | `latitude`, `longitude`       | 필수 `recommendationAttempt` 및 선택 `excludeTrackIds` 추가   |
| 곡 응답 DTO              | 내부 `musicTrackId` 및 표시값 | `externalTrackId` 추가                                        |
| POST 응답                | 저장/유지에 따라 201/200      | `data.replaced`와 정상 생성 시 최상위 `recommendationId` 추가 |

생성 요청 본문은 기존 `JSON.stringify(coordinates)`에서 `JSON.stringify(request)`로 바뀌며 다음 세 필드를 전송한다.

```json
{
  "latitude": 37.5,
  "longitude": 127.0,
  "recommendationAttempt": 1,
  "excludeTrackIds": ["previous-track-1", "previous-track-2"]
}
```

POST 성공 시 `data.replaced=true`인 정상 5곡 응답과 최상위 `recommendationId`를 새 추천으로 표시하고 회차를 차감한다. `false`는 기존 DB 목록 유지 결과이므로 프론트는 재시도 가능한 fallback으로 처리하고 이전 DB 목록을 화면에 노출하지 않는다. fallback 응답은 새 `recommendationId`가 없으며 피드백 대상이 아니다. 요청한 제외 곡이 재등장하거나 한 응답에 동일 외부 ID가 반복되면 정상 추천으로 처리하지 않는다.

## 피드백 API와 책임 경계

- 피드백 요청은 `POST /api/ai-recommendations/{recommendationId}/feedback`이며 `feedback`은 `LIKE` 또는 `DISLIKE`다. PLAYLIST LIKE에만 추천 곡 중 하나의 `selectedTrackId`가 필요하다. DISLIKE는 곡 선택 없이 제출한다.
- FE는 정상 결과의 피드백 성공 전 시트 닫기와 재추천을 막는다. 제출 중에도 닫기와 재추천을 막는다. 시트를 닫고 다시 열면 컴포넌트 상태와 회차가 초기화된다.
- Backend는 인증, 추천 결과 소유권, 입력 규칙, 선택 곡이 그 추천 결과에 속하는지, 중복 피드백을 검증한다. Backend는 미제출 피드백을 근거로 다음 추천 POST나 자물쇠 생성 요청을 차단하지 않으며, 시트 세션의 3회 제한도 독립적으로 강제하지 않는다.
- 기존 `GET /api/recommendations/playlists`는 현재 저장 플레이리스트 조회용이며 추천 이력 ID를 연결하지 않는다. `recommendationPlaylistId`는 `recommendationId`가 아니고 GET 결과는 피드백 대상이 아니다.
- 추천 실패, 결과가 없거나 정상 결과 ID가 없는 예외 응답에서는 피드백 제출을 요구하지 않는다. 제출 실패는 현재 추천 상태를 유지하여 재시도할 수 있게 한다.

## 사진 기반 추천 피드백

- 정상 사진 추천 결과에는 최상위 `recommendationId`와 5곡이 포함된다. 사진 평가도 추천 결과 전체에 대한 LIKE/DISLIKE이며 두 요청 모두 `selectedTrackId: null`로 곡 선택은 없다.
- FE는 피드백 제출 성공 전 추천 화면 닫기, 추천 곡 선택, 직접 음악 검색·자물쇠 생성 다음 단계 진행을 막는다. 제출 중에도 닫기와 진행을 막는다. 제출이 실패하면 추천 결과를 유지하고 재시도를 허용한다.
- 추천 실패, 곡 결과 없음, 또는 `recommendationId`가 없는 경우에는 피드백을 요구하지 않고 닫기·다음 단계 제한을 적용하지 않는다.

## 개념과 범위

- 화면 세션은 컴포넌트가 열린 동안의 임시 메모리 상태다. 로그인 세션, 서버 세션, 브라우저 저장소와 연결하지 않는다.
- `musicTrackId`는 서비스 DB 식별자이며 `externalTrackId`는 AI 중복 제외와 피드백 `selectedTrackId`에 사용하는 Spotify 식별자다.
- 서버는 `recommendationAttempt` 1~3, 제외 목록 최대 50개와 빈 ID를 검증한다. `excludeTrackIds` 생략·null은 빈 목록이다. 회차와 3회 제한은 FE가 관리하며, 서버는 각 요청 값의 범위만 검사하고 서버 호출량 제한을 제공하지 않는다.
- DB 저장과 기존 GET API는 유지한다. 테이블 삭제나 추천 비저장 전환은 이번 범위에 포함하지 않는다. 새 엔드포인트·Redis·의존성·환경변수·스키마 변경은 없다.
- 브라우저 요청 취소는 이미 시작된 서버·AI 처리의 중단을 보장하지 않는다. 닫힌 화면의 응답은 무시하지만 서버가 결과를 저장할 수 있다. 새 화면에서는 저장된 결과를 조회하지 않는다.
- 닫기 안내는 기본 브라우저 확인 창이며, 종료 경로의 최종 디자인은 추후 조정한다.

## 근거

- [React 상태 초기화](https://react.dev/learn/preserving-and-resetting-state)
- [W3C 모달 대화상자 초점 관리](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [MDN AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort)
- 백엔드 OpenAPI v2.8의 `/api/recommendations/playlists`, 서비스 정책 `REC-014`, `REC-015`

## PR 검증 기록 (2026-10-19)

이번 PR에 포함하는 플리 변경만 최신 develop 기준으로 분리해 검증했다.

| 검사                                       | 결과                                                                              |
| ------------------------------------------ | --------------------------------------------------------------------------------- |
| 프론트 전체 테스트                         | 93개 파일, 629개 테스트 통과                                                      |
| 프론트 prettier / lint / typecheck / build | 모두 통과. 빌드는 500kB 청크 경고 있음                                            |
| 백엔드 전체 테스트                         | 일회용 MySQL 8.4와 저장소 CI 환경 설정에서 통과                                   |
| 백엔드 checkstyleMain / checkstyleTest     | 통과                                                                              |
| OpenAPI                                    | 추천 경로 JSON/YAML 동일, Swagger 내장 JSON과 전체 JSON 동일                      |
| 브라우저                                   | 3회 제한·재진입 초기화, 홈 테두리 안에서 하단 메뉴 덮기, 긴 곡명 내부 스크롤 확인 |
| 화면 흔들림                                | 스크롤바 공간 유지 후 열기 전후 홈 왼쪽 392.5px, 위쪽 24px로 이동 0px 확인        |

원본 작업 경로에 있던 알림·날씨 변경과 별도 문서는 PR에 포함하지 않았다. 원본 혼합 작업 경로에서 관찰한 DB 환경 실패 및 포맷 경고는 이번 PR 검증 경로에서 재현되지 않았다.
