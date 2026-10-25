# 디자인 유지·반응형 확장 제거 실행 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 현재 모바일 디자인·동작 보완을 유지하고 태블릿/PC 확장만 제거해 모든 창에서 최대 480px 모바일 배치로 표시한다.

**Architecture:** 최신 develop에서 확장 관련 CSS·JSX·JS 조건을 선택 수정한다. 공통 프레임·하단 메뉴·홈·개별 페이지를 같은 모바일 정책으로 맞추고 지도/시트 기능은 보존한다. 두 PR 전체 revert는 실행하지 않는다.

**Tech Stack:** Node.js 24, npm, React/TypeScript/Vite, 기존 CSS·Vitest·브라우저 캡처, 기존 개발 CI/CD.

**Spec:** [사용자 수정 범위·변경 전후·보존 기준](../specs/2026-10-25-mobile-ui-rollback-design.md)

## 현재 상태와 Global Constraints

- 2026-10-25의 “두 디자인 PR 전체 원복” 선택은 이후 사용자 지시로 대체되었다. 이 문서의 이전 전체 revert 절차는 폐기한다.
- 사용자는 상세도 모바일 1열로 배치하고 폰트·색상·카드 스타일을 유지한다고 확인했다.
- 조사 기준 HEAD `37a8cae`; 마지막 확인 origin/develop `77fc6b7`. 실행 직전 fetch로 후속 변경을 확인한다.
- 최대 480px 중앙 프레임, 좁은 화면 100% 폭. `100dvh`·본문 스크롤·safe-area·현재 모바일 디자인 유지. 옛 800px 높이 상한·바깥 여백은 복원하지 않는다.
- #128/#129, 지도 ResizeObserver·선택/초점·bounds 처리, 시트 종료 fallback과 해당 테스트를 유지한다.
- Git 전체 revert/reset/clean/강제 push/일괄 옛 파일 복원 금지. 원본 checkout·디자인 worktree·미추적 자료·백업 보존.
- 의존성·API·인증·환경변수·CI/CD 설정 변경 없음. 새 함수/Hook에는 책임 주석, 핵심 스타일에는 폭 제한·스크롤 의도 주석을 둔다.
- 이슈 번호는 기존 사용자 “번호없이 PR 진행” 지시로 생략한다. 팀 규칙의 리뷰·사람의 수동 병합은 유지한다.
- 별도 worktree의 fix/mobile-layout-only에서 구현·로컬 검증을 완료했다. PR은 develop 대상으로 준비하며 실제 서버는 변경하지 않는다. 배포 단계는 사람의 병합 이후에 수행한다.

- 실행 판단: 기존 장르 온보딩 대화상자 전환·사진 높이 clamp는 PR #130/#131 이전 디자인이므로 보존한다. 최상위 scrollbar-gutter의 넓은 창 전환은 제거해 중심 정렬을 일정하게 유지했다.

## Review Focus

- 480px 부모 안에서도 큰 viewport 때문에 자식 PC Grid·fixed 토스트·중앙 시트가 남지 않는가.
- 큰 창에서 홈 추천/생성 버튼이 desktop `inert` 분기로 숨겨지지 않는가.
- 짧은 창·긴 곡명·긴 상세에서 하단 메뉴와 주요 버튼까지 스크롤로 도달하는가.
- 상세/계정/검색의 PC 전용 메뉴 제거 후 뒤로 가기·모달 초점·배경 차단은 유지되는가.
- 코드 SHA·새 이미지·CD 선택 이미지·VM 실행 이미지가 일치하는가.

---

## Task 1: 최신 기준·작업 공간·배포 복구 지점

**Files:** 기존 저장소 상태, `.github/workflows/{ci,cd}-dev.yml`, `release.config.develop.json`(읽기), 운영 이미지 기록(저장소 밖).

- [x] `mulo-safe-pull`·`using-git-worktrees`로 최신 develop을 fetch하고 기존 artifact/worktree를 점검한다. 적절한 원복용 worktree가 없으면 최신 develop에서 `fix/mobile-layout-only`를 별도 생성한다.
- [ ] 현재 개발 frontend의 정확한 tag/digest와 복구 가능 이미지를 기록한다. 비밀 값은 출력·커밋하지 않는다.
- [ ] 동시에 진행 중인 개발 릴리스/CD와 병합 여부를 확인한다. 기존 자료는 그대로 둔다.

## Task 2: 공통 모바일 프레임·메뉴

**Modify:** `src/app/styles/global.css:21–27,80–84,368–400`, `src/pages/pageShell.css:54–108`, `src/pages/home/ui/homePage.css:229–308`, `src/features/main-navigation/ui/{MainNavigation.tsx:7–35,mainNavigation.css:41–115}`.

- [x] `--mulo-mobile-max-width`를 480px로 설정한다. 전체 사용처를 확인한 뒤 더 이상 참조되지 않는 tablet/sidebar/detail 폭 변수와 그 전용 override를 정리한다. 폰트·색상·page-gap 변수는 유지한다.
- [x] 공통/홈 셸의 768/1024 확장·외곽 여백/높이 감산·메뉴 위치 전환을 제거한다. 기본 높이·내부 스크롤·카드·타이포를 유지한다.
- [x] 현재 모바일 인증 배치(`global.css:368–400`)를 큰 창에도 적용해 로그인/가입도 최대 480px로 일관되게 표시한다. 기본 인증 마크업·폼 동작은 유지한다.
- [x] 주요 메뉴의 상단/왼쪽 전환을 제거한다. 아래 Task 4의 전용 사용처 제거 후 `wideOnly` prop/class도 삭제한다. 현재 활성 목적지·단일 `aria-current`, 44px 조작 크기와 포커스 표시를 유지한다.
- [x] `MainNavigation.test.tsx`의 명시적 목적지·중첩 URL·현재 페이지 단일 표시 검증을 유지한다. 브라우저에서 메뉴는 항상 하단이며 가로 넘침이 없는지 측정한다.

## Task 3: 홈 지도·시트의 모바일 배치와 동작 보존

**Modify:** `homeMap.css:218–289`, `HomeMap.tsx:224–235,907–914,1056–1060`, `myLocksSheet.css:140–175`, `popularTracksSheet.css:155–192`(모두 `src/features/home-map/ui/`), `src/features/home-playlist/ui/homePlaylistSheet.css:195–214`.

**Test:** `src/features/home-map/ui/HomeMap.test.tsx:569–600`, 기존 `MapSheetExit.test.tsx`, 홈·추천창 통합 테스트.

- [x] 기존 desktop slot 테스트를 새 정책에 맞는 회귀로 바꾸고 실패를 확인한다. `matchMedia.matches=true`인 큰 창·지도 목록 열림 상태에서도 추천/생성 버튼이 각각 한 번 렌더링되고 부모에 `inert`/`aria-hidden=true`가 없으며, 시트 닫기 후 버튼을 조작할 수 있어야 한다.
- [x] `isDesktopPanel` 상태·matchMedia effect·`hideDefaultPanel`·해당 슬롯 차단 속성만 제거한다. 추천 모달 자체의 배경 차단을 제거하지 않는다.
- [x] `<1024px` 안의 모바일 `flex:1 0 auto`·지도 `aspect-ratio:16/10`을 기본 규칙으로 옮긴다. 최소 220px은 유지하고 태블릿 360px override·PC Grid/옆 도킹을 제거한다.
- [x] 지도 목록과 추천창을 모든 창에서 하단 시트로 표시한다. 현재 모바일 타이포·간격을 유지하며 PC 전용 글자 확대를 기본 규칙으로 옮기지 않는다.
- [x] `observeMapResize.ts`, `useMapSheetExit.ts`와 관련 테스트는 수정/삭제하지 않는다. resize 시 중심/선택/초점 보존·GPS 재요청 방지·bounds 조회·300ms fallback 테스트를 실행한다.
- [x] 홈 슬롯·지도 viewport wrapper를 유지하고 관련 주석만 모바일 문서 순서에 맞춘다. 추천 1/3/5곡·닫기·재진입·재추천과 모달 배경 차단을 검증한다.

## Task 4: 상세·개별 페이지의 PC 분기 정리

**Modify:** 아래 CSS의 지정된 확장 규칙 및 PC 전용 메뉴 사용처.

| 파일                                                      | 제거 또는 모바일 기본 적용                                                         |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/pages/lock-detail/ui/lockDetailPage.css:41–124`      | 넓은 상세·PC 중앙 정렬·사진/음악 Grid 제거                                         |
| `src/features/dashboard/ui/dashboardContent.css:211–248`  | PC 2/3열 제거                                                                      |
| `src/pages/report/ui/reportPage.css:245–297`              | 확장된 월 카드·PC 상세 2열 제거. 기본 모바일 월 3열·통계 2열 보존                  |
| `src/pages/friend/ui/friendsPage.css:464–491`             | 확장·제목 확대·viewport fixed 토스트 제거                                          |
| `src/pages/lock-create/ui/lockCreatePage.css:628–685`     | 헤더 확대·PC 작성 2열·가로 사진·지도 확대 제거                                     |
| `src/pages/chat-room/ui/chatRoomPage.css:295–336`         | 독립 채팅 확대 제거, 인라인 확장의 모바일 width/height/min-height를 모든 창에 적용 |
| `src/pages/memory-search/ui/memorySearchPage.css:486–517` | 읽기 폭 확대·중앙 결과창 제거                                                      |
| `src/pages/mypage/ui/myPage.css:140–149`                  | PC 여백·글자 확대 제거                                                             |
| `src/pages/matching/ui/matchingPage.css:35–44`            | 840px·헤더 여백 확대 제거                                                          |
| `src/pages/notification/ui/notificationsPage.css:35–41`   | 840px 확장 제거                                                                    |

- [x] `LockDetail.tsx:146–174,248`의 요약/정보 구획과 `lockDetail.css:65–73`의 간격을 유지한다. 사진·앨범·날씨·기분·코멘트·삭제 동작을 사진 → 음악 → 정보 순서로 표시한다. PC 사진 absolute 규칙은 기본으로 옮기지 않는다.
- [x] `LockDetailPage.tsx`, `MemorySearchPage.tsx`, `NicknameChangePage.tsx`, `PasswordChangePage.tsx`, `WithdrawalPage.tsx`의 `wideOnly` 메뉴·전용 wrapper/import를 제거한다. 일반 하단 메뉴와 뒤로 가기 버튼은 유지한다.
- [x] 대응 테스트의 PC 메뉴 이동 기대만 새 정책으로 수정한다. 메뉴가 없고 기존 뒤로 가기 목적지가 맞는지 확인한다. 검색/상세/계정의 입력·요청·오류·초점 테스트는 유지한다.
- [x] `FriendDashboardPage.test.tsx:158–161`의 상세 표시 중 부모 메뉴 차단 검증을 유지한다. 기억 검색 결과의 배경 차단 검증에서 제거된 메뉴 wrapper만 정리한다.
- [x] 360px 이하 좁은 화면·prefers-reduced-motion 등 확장과 무관한 규칙을 보존한다. 무해한 wrapper/class를 제거하기 위한 추가 리팩터링은 하지 않는다.

## Task 5: 통합 검증·번호 없는 PR

- [x] Node.js 24·lockfile 의존성을 준비하고 `npm test -- --run`, `npm run prettier`, `npm run lint`, `npm run typecheck`, `SENTRY_AUTH_TOKEN= npm run build`를 실행한다. 실제 결과만 기록한다.
- [x] 320×640, 390×844, 480×800, 600×800, 767×768, 768×768, 1023×768, 1024×768, 1440×900에서 프레임이 480px을 넘지 않고 중앙에 있으며 같은 모바일 구성인지 브라우저로 측정/캡처한다.
- [ ] 홈·인증·대시보드·리포트·친구·작성·마이페이지/계정·기억 검색·채팅·상세를 확인한다. 긴 문구·낮은 높이·200% 확대·가상 키보드/safe-area의 실제 검증 범위를 구분한다.
- [x] 지도 선택 목록, 추천창, 검색 결과, 친구 상세, 인라인 확장 채팅의 스크롤·뒤로 가기·초점·배경 차단을 확인한다. 실제 SDK/GPS·실제 기기 미확인 항목은 명시한다.
- [x] 변경 전/후 캡처·보존 동작·파일/줄·검증 결과를 보고서에 기록한다. 기존 PC 설계/캡처는 이력으로 보존한다. 형식적인 CSS 문자열 단위 테스트는 추가하지 않는다.
- [x] 최종 diff에서 두 PR 전체 revert가 없고, 범위 밖 기능·환경변수·의존성·CI 설정이 변하지 않았는지 리뷰한다.
- [ ] `fix: 디자인을 유지하고 모바일 배치로 통일` 커밋과 `fix/mobile-layout-only → develop` PR을 준비한다. 이슈 번호는 생략하고 사람이 리뷰 후 병합한다.

## Task 6: 개발서버 재배포 확인

팀원의 수동 병합 이후 담당자가 수행할 후속 단계다. 이 PR 준비 작업에서는 merge·배포·서버 변경을 실행하지 않는다.

- [ ] 병합 SHA에 연결된 개발 CI 성공과 새 `dev-*` 이미지 tag/digest를 기록한다.
- [ ] 후속 개발 CD 성공과 선택된 이미지가 이번 이미지인지 확인한다. CD workflow 정의의 main SHA는 앱 소스 SHA와 다르며, Registry의 최신 태그 선택을 임의 재실행한 결과를 원복으로 간주하지 않는다.
- [ ] VM의 frontend 실행 tag/digest·health·nginx 상태와 개발 도메인의 모바일 배치를 확인한다. 실패하면 Task 1에 기록한 정확한 기존 이미지로 frontend를 복구하는 운영 절차를 사용한다.
- [ ] 코드/PR/병합/이미지/실제 화면 검증을 구분해 보고한다. main/prod에는 적용하지 않는다.

## 근거와 검증 상태

- 프로젝트 `AGENTS.md`, `RULE.md`, 기존 `docs/superpowers/specs/2026-10-24-desktop-responsive-design.md`의 확장 기준과 모바일 디자인 기준.
- [MDN width media feature](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/width), [MDN max-width](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/max-width).
- 과거 전체 역패치의 264파일 동일성 검증은 이번 부분 수정의 검증이 아니다. 이번에는 보존할 변경이 있으므로 `f297da5` 전체 트리 동일성을 완료 기준으로 사용하지 않는다.
- 구현 및 로컬 검증 완료: 97파일·719테스트, prettier/lint/typecheck/build PASS. [화면·검증 보고서](../reports/2026-10-25-mobile-layout-only.md). 실제 배포와 VM tag/digest 확인은 아직 수행하지 않았다.
