# 음악 미리듣기 패널

## 적용 전 → 적용 후

| 화면              | 기존                  | 변경                                     |
| ----------------- | --------------------- | ---------------------------------------- |
| 자물쇠 상세       | 음악 오른쪽 음표 장식 | 오른쪽 미리듣기 버튼                     |
| 추천 플레이리스트 | 곡 전체가 외부 링크   | 곡 정보 링크와 오른쪽 미리듣기 버튼 분리 |
| 지도 인기 자물쇠  | 순위·곡·집계 횟수     | 오른쪽 미리듣기 버튼 추가                |
| 지도 내 자물쇠    | 전체 행이 상세 링크   | 상세 링크와 오른쪽 미리듣기 버튼 분리    |

버튼을 누르면 원래 화면 위에 Spotify 플레이어 패널을 화면 중앙에 띄운다. 재생은 공식 플레이어 안의 버튼으로 시작한다. 닫기·바깥 영역·ESC로 패널을 닫으면 iframe을 제거한다. native 모달을 먼저 닫은 뒤 원래 재생 버튼으로 초점을 복원한다. 원래 페이지와 목록 상태는 유지한다. 페이지 이동이나 원본 컴포넌트 제거 시에도 iframe을 제거한다.

## 구현 개념

- `entities/music/ui/MusicPreviewButton.tsx`: 네 실제 사용처가 공유하는 음악 도메인 UI. 각 곡 버튼이 패널 수명을 소유한다.
- native `dialog.showModal()`의 top layer: 추천 모달 위에서도 패널이 표시되고 뒤쪽 입력을 막는다. 별도 전역 상태나 Provider가 필요하지 않다.
- portal: 기존 시트의 overflow·transform·inert 영역과 분리한다. ESC/Tab 전파를 막아 추천 창의 키보드 이벤트가 함께 실행되지 않게 한다.
- `getSpotifyTrackId`: 공식 HTTPS Spotify 트랙 링크 또는 22자리 곡 ID만 허용하며 임의 URL을 iframe에 넣지 않는다.
- 올바른 식별자가 없으면 버튼을 비활성화한다. 제목 검색으로 다른 곡을 추측하거나 서버 비밀 키를 브라우저에 노출하지 않는다.

## API 영향

지도 `POST /places/popular-tracks/search`의 `music[]`와 `POST /users/me/records/search`의 `records[]`에 `externalUrl`을 추가한다. 저장된 MusicTrack 링크를 기존 조회에서 함께 가져온다. 같은 DTO를 쓰는 지역별 자물쇠 목록에도 필드가 추가된다. DB 스키마와 요청 필드는 변경하지 않는다.

프론트는 구버전 서버에서 필드가 누락되어도 목록을 표시한다. 이 경우 지도 미리듣기 버튼은 비활성화되므로 지도 기능을 사용하려면 백엔드 변경도 배포해야 한다. 상세·추천은 기존 링크/ID를 사용한다.

## 제공 범위와 검증 한계

기존 Spotify API 실측에서 5곡 모두 `preview_url`이 없었다. 이 구현은 MP3를 직접 재생하거나 정확히 30초를 보장하는 구현이 아니다. Spotify 공식 Embed가 브라우저·사용자·곡에 따라 제공하는 재생 범위를 사용한다. 외부 서비스 오류와 Spotify 이동은 공식 카드 내부에서 처리하며 별도의 이동 링크는 표시하지 않는다.

브라우저 자동화가 Work 설정에서 비활성화되어 실제 소리와 모바일 배치는 직접 확인해야 한다. 단위 테스트는 패널 열기·닫기, ESC 격리, iframe 제거, URL 검증과 API 링크 전달을 검증한다.

## 근거

- [Spotify Embed 생성](https://developer.spotify.com/documentation/embeds/tutorials/creating-an-embed): 공식 iframe과 제공되는 재생 경험.
- [Spotify Embed 문제 해결](https://developer.spotify.com/documentation/embeds/tutorials/troubleshooting): 환경에 따라 30초 미만 미리듣기가 제공될 수 있음.
- [MDN dialog showModal](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal): top layer와 배경 비활성화.
- [React createPortal](https://react.dev/reference/react-dom/createPortal): DOM 배치 분리와 React 트리의 이벤트 전파.
- [프로젝트 구조](architecture.md): features에서 entities UI로 의존하며 feature끼리 내부 코드를 참조하지 않는다.
