# 디자인 유지·모바일 배치 통일 결과

기준 `origin/develop 77fc6b7`, 작업 브랜치 `fix/mobile-layout-only`. 전체 PR 원복 대신 PC·태블릿 확장 조건만 제거했다. 개발서버는 변경하지 않았으며 PR 리뷰·사람의 병합 이후 기존 CI/CD로 반영한다.

## 변경 전후와 코드 책임

| 대상·파일·현재 줄                                               | 기존                                       | 수정                                                                                     |
| --------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `src/app/styles/global.css:22`                                  | 모바일600·태블릿840·PC1440px 확장          | 공통 모바일 상한480px. 폰트·색상·간격 변수 유지                                          |
| `src/pages/pageShell.css:1`, `src/pages/home/ui/homePage.css:1` | 큰 창 외곽 여백·높이 감산·메뉴 위치 전환   | 기본100dvh·본문 스크롤·중앙 프레임 유지                                                  |
| `src/features/main-navigation/ui/MainNavigation.tsx:23`         | 하단/상단/왼쪽 메뉴와 wideOnly 분기        | 기존 메뉴는 항상 하단. 상세·검색·계정의 PC 전용 메뉴 제거. 활성 목적지·aria-current 유지 |
| `src/features/home-map/ui/HomeMap.tsx:895`                      | PC 목록을 열면 추천/생성 슬롯을 inert 처리 | 하단 목록 시트이므로 폭에 따른 슬롯 차단 제거. 부모 추천 모달 배경 차단은 유지           |
| `src/features/home-map/ui/homeMap.css:218`                      | 모바일/태블릿/PC 서로 다른 지도·도크 배치  | 모바일16:10 기준·최소220px, 추천→지도→생성 순서 유지                                     |
| `src/pages/lock-detail/ui/lockDetailPage.css:1`                 | PC 사진/음악2열·추가정보 전체 폭           | 사진→음악→추가정보1열. 기존 구획·카드·사진contain 유지                                   |
| `src/pages/chat-room/ui/chatRoomPage.css:27`                    | 넓은 창 확장 채팅 최대960px                | 모든 창에서 부모 모바일 영역의100%를 채움                                                |

`max-width`는 요소 폭 상한이고 미디어 쿼리는 viewport를 검사하므로 부모480px만 제한해도 내부 PC 규칙이 살아 있었다. 각 화면의 확장 규칙을 함께 제거했다. `inert`는 하위 요소의 초점·접근성 탐색을 차단하므로 보이는 홈 버튼에 PC 조건으로 남겨 두지 않았다. [MDN width media feature](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/width), [MDN inert](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert).

핵심 폭·스크롤 의도와 컴포넌트 책임은 코드 주석에 표시했다. 새 메서드·의존성·API·인증·환경변수·CI 설정·DB/Flyway 변경은 없다.

## 보존한 항목

- 현재 Pretendard 우선 고딕 글꼴, #129의 inherit, 모바일 색상·간격·버튼·카드 스타일.
- #128의 내용 높이 추천창과1/3/5곡 목록, 44px 닫기 버튼·초점 표시.
- `observeMapResize.ts`, `useMapSheetExit.ts`, 기본 `lockDetail.css`와 관련 회귀 테스트는 기준과 동일하다.
- 지도 중심/선택/초점·bounds 조회·GPS 재요청 방지·오래된 응답 차단과300ms 종료 fallback.
- 원래 모바일 리포트 월 목록3열·통계2열, 360px 이하 방어와 모션 감소 규칙.
- 기존 PC 설계·캡처·원본 checkout·디자인 worktree·미추적 자료.

기존 장르 온보딩의481px 중앙 대화상자 전환·사진 높이의72vw/최대420px 규칙은 두 PR 이전 디자인이라 유지했다. PC와 모바일 사진 높이까지 동일하게 고정하는 변경은 포함하지 않았다.

## 검증

- 기준: 97파일·719테스트 PASS.
- 변경 전 새 정책 회귀6건이 기존 PC 메뉴/접근 차단 때문에 예상대로 실패했다. 수정 후 관련10파일·85테스트 PASS.
- 최종 전체: 97파일·719테스트 PASS.
- `npm run prettier`, `npm run lint`, `npm run typecheck`, `SENTRY_AUTH_TOKEN= npm run build`, `git diff --check` PASS.
- 빌드는 기존500kB 초과 chunk 경고만 남았다. 번들 분할은 요청 범위 밖이다.
- 독립 읽기 전용 리뷰에서 Critical/Important 문제 없음. 부정확한 잔여 주석과 문서 상태를 정리했다.

가상 데이터와 실제 앱 컴포넌트를 iframe의 CSS viewport 안에서 실행했다. 수치는 부모 화면의 축소와 별개인 내부 viewport 좌표이며 실기기 검증과 구분한다. 총60개 측정 기록을 보존했다.

| 검사                                       | 결과                                                           |
| ------------------------------------------ | -------------------------------------------------------------- |
| 홈320/390/480/600/767/768/1023/1024/1440px | 폭min(viewport,480), 중앙 정렬·하단 메뉴, 가로 넘침 없음       |
| 홈 외16화면을390/1440px에서 검사           | 프레임390/480px, 가로 넘침 없음, 추가 PC 메뉴 없음             |
| 상세6변형×390/1440px                       | 세로/가로 사진·긴 제목/코멘트·친구/빈 정보 모두 사진→음악→정보 |
| 확장 인라인 채팅390/1440×640               | 부모 폭390/480px·높이640px 유지                                |
| 홈390×640 내부 스크롤                      | 생성 버튼y509–557에 도달, 메뉴y573 유지                        |
| 추천창390×640 및1440×900                   | 앱 하단·폭390/480px, 배경 메뉴 접근 차단                       |
| 친구 추가 대화상자                         | 360px로 프레임 안에 표시, 닫으면 친구 추가 버튼 초점 복원      |
| 친구 지역→중첩 상세→닫기                   | 부모 메뉴 차단/복원, 원래 기록 링크 초점 복원                  |

1440×900에서 변경 전 홈 프레임은1377×852px·왼쪽 메뉴184px이었다. 변경 후 프레임은480×900px·x480이며 하단 메뉴는480×67px·y833이다.

수치 원본: [geometry.json](../assets/mobile-layout-only/geometry.json).

## 화면 캡처

가상 데이터 캡처이며 실제 지도/GPS 연결을 의미하지 않는다. 변경 전은 PC 전체 영역을 축소했고 변경 후는 중앙 앱 영역을 표시해 두 이미지의 표시 배율은 다르다.

- [변경 전 홈1440](../assets/mobile-layout-only/home-before-1440.png)
- [변경 후 홈1440](../assets/mobile-layout-only/home-after-1440.png)
- [변경 후 홈390](../assets/mobile-layout-only/home-after-390.png)
- [상세1열1440](../assets/mobile-layout-only/detail-after-1440.png)
- [대시보드1440](../assets/mobile-layout-only/dashboard-after-1440.png)
- [추천 하단 시트1440](../assets/mobile-layout-only/recommendation-after-1440.png)

## 검증 한계와 후속

실제 SDK/GPS·지도 키·백엔드 연결, 실제 추천 생성·저장, 실기기 키보드/safe-area·브라우저200% 확대는 검증하지 않았다. 추천1/3/5곡·닫기/재진입과 검색 결과 시트의 초점/배경 차단은 기존 통합 테스트로 검증했다. 브라우저 추천창은 위치 미확인 안내 상태로 확인했다. 인라인 채팅은 외부 연결 없는 표시 fixture다.

개발 VM의 현재 이미지 tag/digest 조회·재배포는 수행하지 않았다. 팀원의 수동 develop 병합 전 복구 이미지를 기록하고, 이후 새CI이미지·CD 선택 이미지·실행 컨테이너·개발 도메인의 실제 결과를 확인해야 한다. main/prod는 변경 대상이 아니다.
