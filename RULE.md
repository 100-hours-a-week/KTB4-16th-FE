# MULO Frontend Team Rules

이 문서는 `mulo-fe`에서 사람 개발자와 AI가 공통으로 지키는 협업 규칙이다.

- `AGENTS.md`: AI 작업 절차와 제한
- `RULE.md`: Git, PR, 코드, 환경변수, 검증에 대한 팀 공통 규칙

## 1. 장기 브랜치

```text
작업 브랜치 -> PR -> develop -> PR -> main
```

### `main`

- 배포 가능 상태를 유지한다.
- 직접 개발하거나 push하지 않는다.
- `develop`에서 검증된 변경만 PR로 반영한다.
- 삭제하지 않는다.

### `develop`

- 다음 배포를 위한 통합 브랜치다.
- 직접 개발하거나 push하지 않는다.
- 최신 `develop`에서 작업 브랜치를 만든다.
- 삭제하지 않는다.

## 2. 작업 브랜치

형식:

```text
<type>/<function>-<issueNumber>
```

허용 type:

```text
feat fix docs style refactor test chore
```

예:

```text
feat/login-34
fix/token-refresh-52
chore/frontend-initial-setup-112
```

- 실제 GitHub Issue 번호를 사용한다.
- 이슈 번호를 임의로 만들지 않는다.
- `#`은 브랜치 이름에 넣지 않는다.
- merge가 끝난 작업 브랜치는 삭제할 수 있다.

## 3. 커밋과 PR 제목

형식:

```text
<type>: <작업 내용> #<issueNumber>
```

예:

```text
feat: 로그인 화면 구현 #34
fix: 토큰 재발급 중복 요청 수정 #52
docs: 프론트엔드 구조 문서 작성 #112
```

- 커밋은 한 가지 책임을 가진 검토 가능한 단위로 만든다.
- 관련 없는 변경을 한 커밋이나 PR에 섞지 않는다.
- PR 본문에는 관련 이슈, 변경 내용, 실제 검증 결과를 기록한다.
- 의존성, API 계약, 환경변수, 빌드·배포 변경 여부를 명시한다.

## 4. 작업 흐름

```bash
git switch develop
git pull origin develop
git switch -c chore/frontend-initial-setup-112
```

PR 전 최신 `develop` 반영:

```bash
git fetch origin
git merge origin/develop
```

- 충돌은 작업 브랜치에서 해결한다.
- 다른 개발자의 변경을 임의로 덮어쓰지 않는다.
- force push와 auto-merge를 사용하지 않는다.
- PR은 최소 1명 승인 후 사람이 수동 merge한다.

## 5. TypeScript와 파일 경계

- TypeScript `strict`를 유지한다.
- 기능 코드는 `docs/architecture.md`의 의존 방향을 따른다.
- 화면 조립, 기능, 도메인, 공용 코드를 역할에 맞는 위치에 둔다.
- 둘 이상의 실제 사용처가 확인되기 전에 공용화하지 않는다.
- 공개 타입이나 공용 함수의 동작을 변경하면 사용처와 문서를 함께 확인한다.

## 6. 의존성

새 의존성을 추가하기 전 다음을 확인한다.

1. 브라우저 API, React, TypeScript 또는 현재 의존성으로 해결할 수 있는가?
2. 새 의존성이 필요한 구체적인 요구사항은 무엇인가?
3. 번들 크기, 보안, 유지보수에 어떤 영향을 주는가?

의존성 변경은 사전 공유하고 PR에 이유와 영향을 기록한다. `package.json`과 `package-lock.json`을 함께 커밋한다.

## 7. 환경변수와 Secret

커밋하지 않는다.

- 실제 `.env` 파일
- API key
- Access Token과 Refresh Token
- Cloud Credential
- Private Key
- 운영 Secret

`VITE_` 접두사가 붙은 값은 브라우저 번들에 공개된다. 공개 가능한 설정만 사용하고 예시는 `.env.example`에 값의 형태만 기록한다.

## 8. 검증

PR 전 기본 검사:

```bash
npm run prettier
npm run lint
npm run typecheck
```

빌드 또는 애플리케이션 코드 변경 시:

```bash
npm run build
```

- 검사가 실패한 상태로 merge하지 않는다.
- 실패 검사를 삭제하거나 설정을 약화해 통과시키지 않는다.
- 실행하지 않은 검증을 PASS로 기록하지 않는다.

## 9. 금지 사항

- `main`, `develop` 직접 개발 및 push
- PR 없는 장기 브랜치 변경
- force push
- 승인 없는 merge
- Secret 커밋
- 승인 없는 의존성·인증 구조·공용 경계 변경
- 다른 개발자의 변경 무단 덮어쓰기
- CI 또는 타입 검사를 우회하는 변경

## 10. PR 체크리스트

- [ ] 실제 Issue 번호와 브랜치 이름이 일치한다.
- [ ] 최신 `origin/develop`을 반영했다.
- [ ] 변경 범위에 관련 없는 파일이 없다.
- [ ] `npm run prettier`가 통과한다.
- [ ] `npm run lint`가 통과한다.
- [ ] `npm run typecheck`가 통과한다.
- [ ] 필요한 경우 `npm run build`가 통과한다.
- [ ] 의존성, API, 환경변수, 배포 영향 여부를 기록했다.
- [ ] Secret과 실제 `.env`가 포함되지 않았다.
- [ ] 최소 1명 리뷰 승인을 받는다.
