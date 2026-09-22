# MULO 프론트엔드 아키텍처

## 1. 목적

기능별 담당자가 서로의 내부 구현을 직접 확인하지 않아도 파일의 책임과 허용 의존성을 예측할 수 있게 한다. 구조는 현재 필요한 만큼만 만들고, 화면과 기능이 추가될 때 이 문서의 경계에 맞춰 확장한다.

## 2. 의존 방향

```text
app -> pages -> features -> entities -> shared
```

왼쪽 계층은 오른쪽 계층을 참조할 수 있다. 오른쪽 계층은 왼쪽 계층을 참조하지 않는다.

예:

```text
허용: features/auth -> entities/user
허용: entities/user -> shared/types
금지: shared/api -> features/auth
금지: entities/user -> pages/login
```

## 3. 계층 책임

### `app`

애플리케이션 전체를 한 번만 구성하는 계층이다.

- 전역 Provider
- Router 조립
- 전역 오류 경계
- 앱 초기화
- 전역 스타일 진입점

특정 기능의 요청, 상태, 비즈니스 규칙을 구현하지 않는다.

### `pages`

URL 단위 화면을 조립한다.

- 여러 feature와 entity UI 배치
- 페이지 레이아웃과 URL 진입점
- 페이지 수준 loading·empty·error 조립

재사용 가능한 기능 로직이나 공용 HTTP 코드를 직접 구현하지 않는다.

### `features`

사용자가 수행하는 한 가지 행동 또는 유스케이스를 구현한다.

```text
features/auth/login
features/music-search
features/record-create
```

각 feature는 필요한 UI, Hook, 요청 함수와 feature 전용 타입을 가까이 둔다. 다른 feature 내부 파일을 직접 import하지 않는다.

### `entities`

서비스의 핵심 도메인 표현을 담당한다.

```text
entities/user
entities/record
entities/weather
entities/music
```

도메인 타입, 표시용 순수 변환, 도메인 단위 UI를 둘 수 있다. 특정 페이지 흐름이나 사용자 행동을 소유하지 않는다.

### `shared`

도메인에 종속되지 않은 기반을 담당한다.

```text
shared/api       HTTP 기반과 공통 전송 타입
shared/config    환경변수와 앱 설정
shared/constants 전역 상수
shared/hooks     도메인 비종속 Hook
shared/lib       순수 유틸리티
shared/types     범용 타입
shared/ui        공용 UI primitive
```

`shared`는 `app`, `pages`, `features`, `entities`를 import하지 않는다.

## 4. 새 코드 배치 판단

1. 특정 URL 화면을 조립하는가? `pages`
2. 로그인·검색·생성처럼 사용자 행동 하나를 완성하는가? `features`
3. User·Record처럼 여러 기능이 공유하는 도메인 표현인가? `entities`
4. MULO 도메인을 몰라도 사용할 수 있는가? `shared`
5. 앱 전체에서 한 번만 조립하는가? `app`

공용화는 둘 이상의 실제 사용처가 확인된 뒤 진행한다. 아직 한 기능에서만 쓰는 코드는 해당 feature에 둔다.

## 5. import 원칙

- 계층의 공개 진입점이 생기면 외부에서는 그 진입점을 사용한다.
- 다른 feature의 내부 경로를 직접 참조하지 않는다.
- 순환 의존성이 생기면 공용 계층으로 즉시 옮기지 말고 책임 분리가 잘못됐는지 먼저 확인한다.
- alias는 실제 import 깊이가 문제가 된 뒤 별도 합의로 추가한다.

## 6. 주석 원칙

- 함수, Hook, 서비스 메서드에는 책임과 역할을 짧게 설명한다.
- 타입과 이름으로 명확한 사실을 반복하지 않는다.
- 보안, API 계약, 브라우저 제약처럼 제거하면 위험한 이유를 우선 기록한다.

## 7. 근거

React는 컴포넌트를 자체 로직과 표현을 가진 UI 단위로 설명한다. 이 프로젝트는 그 원칙을 기능 및 도메인 경계까지 확장해 독립적으로 이해하고 변경할 수 있게 한다.

- [React Quick Start](https://react.dev/learn)
- [React Thinking in React](https://react.dev/learn/thinking-in-react)
