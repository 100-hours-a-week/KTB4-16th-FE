# API 연동 가능 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 구현된 사용자·음악 API는 실제 화면에 연결하고, 아직 계약만 있는 플레이리스트·기억 검색·리포트는 가짜 결과 없이 준비 중 상태로 전환한다.

**Architecture:** pages는 useSession().fetchAuthenticatedJson을 feature API에 주입하고, feature API는 React나 세션 상태를 직접 알지 못한다. 사용자 표시 타입은 entities/user, 변경·검색 행위와 검증은 features, URL·로딩·오류 조립은 pages, 여러 미구현 화면의 안내는 shared/ui에 둔다.

**Tech Stack:** React 19, TypeScript strict, React Router 8, Fetch API, Vitest 5, React Testing Library, user-event, CSS

**Spec:** docs/superpowers/specs/2026-09-25-api-backed-pages-design.md

## Global Constraints

- Node.js 24와 npm을 사용하며 새 런타임 의존성을 추가하지 않는다.
- app → pages → features → entities → shared 의존 방향을 지키고 feature끼리 내부 파일을 import하지 않는다.
- access token은 SessionProvider 메모리 상태에만 두고 token·Cookie·개인정보를 저장하거나 로그로 남기지 않는다.
- 보호 요청은 useSession().fetchAuthenticatedJson을 사용해 Bearer와 401 refresh 재시도 정책을 그대로 적용한다.
- PATCH는 getCsrfToken() 뒤 credentials: include, X-XSRF-TOKEN, JSON body를 보낸다. CSRF·네트워크 오류만으로 PATCH를 자동 재시도하지 않는다.
- 외부 JSON은 unknown에서 타입 가드로 검증하고 any를 쓰지 않는다.
- 음악 검색은 GET /api/music/search?q=<URLSearchParams>이며 trim 후 2~255자일 때만 보낸다.
- 함수·이벤트 처리기·API 함수에는 책임을 설명하는 짧은 한국어 주석을 남긴다.
- 상태 메시지는 role="status", 폼 오류는 role="alert", 비동기 조회 영역은 aria-live="polite"를 쓴다.
- 플레이리스트·기억 검색·리포트에 목업 곡, 목업 건수, 성공 토스트, 저장된 것처럼 보이는 문구를 남기지 않는다.
- 자물쇠 저장·사진 분석·임시 저장·로그아웃·회원 탈퇴는 이번 작업에 포함하지 않는다.

## Review Focus

- refresh 실패 후 마이페이지의 이전 닉네임·이메일이 남지 않고 /login 보호 라우트로 이동해야 한다.
- 409 닉네임 중복과 SAME_PASSWORD는 일반 오류가 아니라 고칠 수 있는 입력 설명으로 보여야 한다.
- 음악 제목의 공백·&·한글은 q 하나로 URL 인코딩되고 2자 미만 검색어는 요청하지 않아야 한다.
- 음악 검색 빈 배열 200은 빈 상태, 429는 잠시 후 재시도 안내여야 한다.
- /report/2026/3 직접 접근도 목업 상세 리포트를 보이지 않아야 한다.

---

### Task 1: 재사용 가능한 입력 필드의 계층 정리

**Files:**

- Create: src/shared/ui/FormField.tsx
- Create: src/shared/ui/FormField.test.tsx
- Delete: src/features/auth/ui/AuthFormField.tsx
- Delete: src/features/auth/ui/AuthFormField.test.tsx
- Modify: src/pages/login/LoginPage.tsx:6-12,102-121
- Modify: src/pages/signup/SignupPage.tsx:9-16,111-175
- Modify: src/app/styles/global.css:122-177

**Interfaces:**

- Consumes: React ChangeEventHandler<HTMLInputElement> and input autocomplete/type attributes.
- Produces: FormField(props: FormFieldProps), where props owns id, label, type, value, onChange, autoComplete and optional error, helperText, successText, placeholder, maxLength.

- [ ] **Step 1: 공용 입력 필드의 실패 테스트를 작성한다**

src/shared/ui/FormField.test.tsx:

```
it('associates label and error description with the input', () => {
  render(<FormField id="nickname" label="닉네임" type="text" value="!" onChange={() => undefined} error="2~10자로 입력해주세요." autoComplete="nickname" />);
  expect(screen.getByRole('textbox', { name: '닉네임' })).toHaveAccessibleDescription('2~10자로 입력해주세요.');
});

it('prefers error feedback over success and helper feedback', () => {
  render(<FormField id="password" label="비밀번호" type="password" value="bad" onChange={() => undefined} error="형식을 확인해주세요." successText="사용할 수 있습니다." helperText="8~16자" autoComplete="new-password" />);
  expect(screen.queryByText('사용할 수 있습니다.')).not.toBeInTheDocument();
  expect(screen.queryByText('8~16자')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: npm test -- --run src/shared/ui/FormField.test.tsx

Expected: FAIL because FormField does not exist.

- [ ] **Step 3: feature 전용 입력 컴포넌트를 shared UI로 이동한다**

기존 AuthFormField의 label, aria-invalid, aria-describedby, helper/success/error 우선순위를 그대로 보존한다. 클래스 이름은 form-field와 form-field-message로 일반화하고 global.css의 selector도 함께 바꾼다. 함수 상단에는 “입력 label과 상태 설명을 접근 가능한 하나의 필드로 조립한다”는 책임 주석을 둔다.

로그인·회원가입 import와 JSX 이름을 FormField로 교체한다. 이 변경은 기존 features/auth/ui/AuthFormField(인증 화면 한 곳에 묶임)를 shared/ui/FormField(두 번째 실제 사용처인 사용자 설정도 사용 가능)로 옮기는 것이며 인증 동작은 바꾸지 않는다.

- [ ] **Step 4: 공용화와 기존 인증 화면을 검증한다**

Run: npm test -- --run src/shared/ui/FormField.test.tsx src/pages/login/LoginPage.test.tsx src/pages/signup/SignupPage.test.tsx

Expected: PASS; helper, success, error의 기존 인증 화면 테스트가 모두 유지된다.

- [ ] **Step 5: 입력 UI 계층 정리를 커밋한다**

```
git add src/shared/ui/FormField.tsx src/shared/ui/FormField.test.tsx src/features/auth/ui/AuthFormField.tsx src/features/auth/ui/AuthFormField.test.tsx src/pages/login/LoginPage.tsx src/pages/signup/SignupPage.tsx src/app/styles/global.css
git commit -m "refactor: 공용 입력 필드 계층 정리 #112"
```

### Task 2: 사용자 프로필 API·검증 경계

**Files:**

- Create: src/entities/user/model/user.types.ts
- Create: src/features/user-profile/api/userProfileApi.ts
- Create: src/features/user-profile/api/userProfileApi.test.ts
- Create: src/features/user-profile/model/userProfile.types.ts
- Create: src/features/user-profile/model/userProfile.validation.ts
- Create: src/features/user-profile/model/userProfile.validation.test.ts

**Interfaces:**

- Consumes: AuthenticatedApiClient['fetchJson'], getCsrfToken(): Promise<string>, ApiError.
- Produces: UserProfile, ProfileRequest, getMyProfile(request), changeNickname(request, values), changePassword(request, values), validateNicknameChange(values, currentNickname), validatePasswordChange(values).

- [ ] **Step 1: 사용자 API의 실패 테스트를 작성한다**

src/features/user-profile/api/userProfileApi.test.ts:

```
it('parses only a complete current-user response', async () => {
  const request = vi.fn().mockResolvedValue({ message: 'ok', data: { userId: 35, nickname: '뮤로', email: 'me@mulo.com' } });
  await expect(getMyProfile(request)).resolves.toEqual({ userId: 35, nickname: '뮤로', email: 'me@mulo.com' });
  await expect(getMyProfile(vi.fn().mockResolvedValue({ data: { nickname: '뮤로' } }))).rejects.toMatchObject({ status: 502, code: 'INVALID_RESPONSE' } satisfies Partial<ApiError>);
});

it('sends nickname PATCH with CSRF, credentials, and normalized nickname', async () => {
  vi.mocked(getCsrfToken).mockResolvedValue('csrf-token');
  const request = vi.fn().mockResolvedValue({ message: '변경됨', data: { nickname: '새닉네임' } });
  await changeNickname(request, { nickname: ' 새닉네임 ' });
  expect(request).toHaveBeenCalledWith('/users/me/nickname', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': 'csrf-token' }, body: JSON.stringify({ nickname: '새닉네임' }) });
});

it('does not send password PATCH when CSRF preparation fails', async () => {
  vi.mocked(getCsrfToken).mockRejectedValue(new ApiError(403, 'csrf', 'CSRF_TOKEN_MISSING'));
  const request = vi.fn();
  await expect(changePassword(request, { currentPassword: 'Password1!', newPassword: 'NewPassword1!' })).rejects.toMatchObject({ code: 'CSRF_TOKEN_MISSING' });
  expect(request).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 사용자 API 테스트가 실패하는지 확인한다**

Run: npm test -- --run src/features/user-profile/api/userProfileApi.test.ts

Expected: FAIL because user-profile modules do not exist.

- [ ] **Step 3: 도메인 타입, 런타임 파서, PATCH DTO를 구현한다**

entities/user/model/user.types.ts는 공유 표시 모델만 만든다.

```
export interface UserProfile {
  userId: number;
  nickname: string;
  email: string;
}
```

userProfile.types.ts는 ProfileRequest = AuthenticatedApiClient['fetchJson'], NicknameChangeValues, PasswordChangeValues, ProfileFieldErrors를 만든다. userProfileApi.ts에 다음 세 API 함수의 책임 주석을 남긴다.

```
getMyProfile(request: ProfileRequest): Promise<UserProfile>
changeNickname(request: ProfileRequest, values: NicknameChangeValues): Promise<{ nickname: string }>
changePassword(request: ProfileRequest, values: PasswordChangeValues): Promise<void>
```

모든 응답은 request<unknown>에서 isRecord로 좁힌다. getMyProfile은 data.userId 정수·비어 있지 않은 nickname·email을 확인한다. nickname 성공은 message와 data.nickname, password 성공은 message를 확인한다. 형식 오류는 ApiError(502, '서버 응답 형식을 확인할 수 없습니다.', 'INVALID_RESPONSE')다. 기존 ApiError는 바꾸지 않아 400 fieldErrors와 409가 UI까지 전달된다.

- [ ] **Step 4: 검증 실패 테스트를 작성하고 구현한다**

src/features/user-profile/model/userProfile.validation.test.ts:

```
it.each(['a', '가나다라마바사아자차카', '닉네임!'])('rejects invalid nickname %s', (nickname) => {
  expect(validateNicknameChange({ nickname }, '현재닉네임').nickname).toBeDefined();
});
it('rejects the unchanged nickname', () => {
  expect(validateNicknameChange({ nickname: ' 현재닉네임 ' }, '현재닉네임').nickname).toContain('동일');
});
it.each(['password1!', 'PASSWORD1!', 'Password!!', 'Password1', 'Pass1!'])('rejects invalid new password %s', (newPassword) => {
  expect(validatePasswordChange({ currentPassword: 'Password1!', newPassword, newPasswordConfirm: newPassword }).newPassword).toBeDefined();
});
it('rejects same current/new password and mismatched confirmation', () => {
  expect(validatePasswordChange({ currentPassword: 'Password1!', newPassword: 'Password1!', newPasswordConfirm: 'OtherPassword1!' })).toMatchObject({ newPassword: expect.any(String), newPasswordConfirm: expect.any(String) });
});
```

닉네임은 한글·영문·숫자 2~10자, 비밀번호는 대/소문자·숫자·특수문자 포함 8~16자를 적용한다. newPasswordConfirm은 프론트 전용이고 changePassword body에는 절대 넣지 않는다.

- [ ] **Step 5: API와 검증 경계를 검증한다**

Run: npm test -- --run src/features/user-profile/api/userProfileApi.test.ts src/features/user-profile/model/userProfile.validation.test.ts

Expected: PASS; malformed response, CSRF 실패, PATCH body, 길이와 일치 경계가 확인된다.

- [ ] **Step 6: 사용자 프로필 경계를 커밋한다**

```
git add src/entities/user/model/user.types.ts src/features/user-profile
git commit -m "feat: 사용자 프로필 API 경계 추가 #112"
```

### Task 3: 내 정보 조회와 닉네임·비밀번호 변경 화면

**Files:**

- Create: src/features/user-profile/ui/NicknameChangeForm.tsx
- Create: src/features/user-profile/ui/PasswordChangeForm.tsx
- Create: src/pages/mypage/ui/NicknameChangePage.tsx
- Create: src/pages/mypage/ui/PasswordChangePage.tsx
- Create: src/pages/mypage/ui/MyPage.test.tsx
- Create: src/pages/mypage/ui/NicknameChangePage.test.tsx
- Create: src/pages/mypage/ui/PasswordChangePage.test.tsx
- Modify: src/pages/mypage/ui/MyPage.tsx:1-44
- Modify: src/pages/mypage/ui/myPage.css
- Modify: src/app/router/AppRouter.tsx:3-49
- Modify: src/app/router/AppRouter.test.tsx:34-58

**Interfaces:**

- Consumes: Task 1 FormField, Task 2 user-profile functions/types, useSession().fetchAuthenticatedJson, useNavigate, useLocation.
- Produces: /mypage, /mypage/nickname, /mypage/password 인증 라우트와 실제 조회·변경 화면.

- [ ] **Step 1: 마이페이지 실제 조회의 실패 테스트를 작성한다**

```
it('shows loading then the API nickname and email', async () => {
  vi.mocked(getMyProfile).mockResolvedValue({ userId: 35, nickname: '뮤로', email: 'me@mulo.com' });
  renderMyPage();
  expect(screen.getByRole('status')).toHaveTextContent('내 정보를 불러오는 중');
  expect(await screen.findByText('뮤로')).toBeInTheDocument();
  expect(screen.getByText('me@mulo.com')).toBeInTheDocument();
});

it('shows retry for a network error without a fake profile', async () => {
  vi.mocked(getMyProfile).mockRejectedValue(new ApiError(0, 'network', 'NETWORK_ERROR'));
  renderMyPage();
  expect(await screen.findByRole('alert')).toHaveTextContent('내 정보를 불러오지 못했습니다.');
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeEnabled();
  expect(screen.queryByText('mulo유저')).not.toBeInTheDocument();
});

it('does not render a profile while the protected route is unauthenticated', async () => {
  renderRoute('/mypage');
  expect(await screen.findByRole('heading', { name: '로그인' })).toBeInTheDocument();
  expect(screen.queryByText('mulo유저')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: 페이지 테스트가 실패하는지 확인한다**

Run: npm test -- --run src/pages/mypage/ui/MyPage.test.tsx

Expected: FAIL because MyPage renders fixed profile text and never calls getMyProfile.

- [ ] **Step 3: 프로필 조회와 메뉴 이동을 구현한다**

MyPage는 session request를 getMyProfile에 전달한다. loadProfile은 초기 effect와 재시도 버튼에서만 쓰며 시작 시 profile을 null로 비워 만료 후 이전 개인정보가 남지 않게 한다. nickname 첫 글자만 아바타로 쓴다.

기존 accountMenus 문자열 배열과 동작 없는 MenuGroup은 다음의 명시 경로 Link로 바꾼다.

```
const accountMenus = [
  { label: '닉네임 변경', to: '/mypage/nickname' },
  { label: '비밀번호 변경', to: '/mypage/password' },
] as const;
```

로그아웃·회원 탈퇴는 범위 밖이므로 disabled와 “준비 중” 설명만 두며 성공 동작을 만들지 않는다.

- [ ] **Step 4: 변경 폼의 실패 테스트를 작성한다**

각 renderNicknamePage/renderPasswordPage helper는 기본으로 getMyProfile을 { userId: 35, nickname: '현재닉네임', email: 'me@mulo.com' }에 resolve해, 화면이 검증된 프로필을 받은 뒤에 form을 표시하는 계약을 함께 고정한다.

```
it('waits for profile data before rendering the password form', async () => {
  let resolveProfile: ((profile: UserProfile) => void) | undefined;
  vi.mocked(getMyProfile).mockReturnValue(new Promise((resolve) => { resolveProfile = resolve; }));
  renderPasswordPage();
  expect(screen.getByRole('status')).toHaveTextContent('내 정보를 불러오는 중');
  expect(screen.queryByLabelText('현재 비밀번호')).not.toBeInTheDocument();
  resolveProfile?.({ userId: 35, nickname: '현재닉네임', email: 'me@mulo.com' });
  expect(await screen.findByLabelText('현재 비밀번호')).toBeInTheDocument();
});

it('submits a valid nickname and returns with a success status', async () => {
  vi.mocked(changeNickname).mockResolvedValue({ nickname: '새닉네임' });
  renderNicknamePage();
  await user.type(screen.getByLabelText('새 닉네임'), '새닉네임');
  await user.click(screen.getByRole('button', { name: '닉네임 변경' }));
  expect(changeNickname).toHaveBeenCalledWith(expect.any(Function), { nickname: '새닉네임' });
  expect(await screen.findByRole('status')).toHaveTextContent('닉네임이 변경되었습니다.');
});

it('announces a password API field error on the matching input', async () => {
  vi.mocked(changePassword).mockRejectedValue(new ApiError(400, '입력 오류', 'INVALID_INPUT_VALUE', { currentPassword: '현재 비밀번호가 일치하지 않습니다.' }));
  renderPasswordPage();
  await fillValidPasswordForm(user);
  await user.click(screen.getByRole('button', { name: '비밀번호 변경' }));
  expect(await screen.findByLabelText('현재 비밀번호')).toHaveAccessibleDescription('현재 비밀번호가 일치하지 않습니다.');
});

it('renders a duplicate nickname as input feedback', async () => {
  vi.mocked(changeNickname).mockRejectedValue(new ApiError(409, '이미 사용 중인 닉네임입니다.', 'NICKNAME_DUPLICATED'));
  renderNicknamePage();
  await user.type(screen.getByLabelText('새 닉네임'), '새닉네임');
  await user.click(screen.getByRole('button', { name: '닉네임 변경' }));
  expect(await screen.findByLabelText('새 닉네임')).toHaveAccessibleDescription('이미 사용 중인 닉네임입니다.');
});

it('renders SAME_PASSWORD as new-password feedback', async () => {
  vi.mocked(changePassword).mockRejectedValue(new ApiError(409, '새 비밀번호는 현재 비밀번호와 달라야 합니다.', 'SAME_PASSWORD'));
  renderPasswordPage();
  await fillValidPasswordForm(user, { currentPassword: 'OldPassword1!', newPassword: 'NewPassword1!' });
  await user.click(screen.getByRole('button', { name: '비밀번호 변경' }));
  expect(await screen.findByLabelText('새 비밀번호')).toHaveAccessibleDescription('새 비밀번호는 현재 비밀번호와 달라야 합니다.');
});
```

- [ ] **Step 5: 변경 폼과 라우트를 구현한다**

NicknameChangePage와 PasswordChangePage는 진입 시에도 getMyProfile(session request)를 호출한다. 닉네임 페이지는 현재 닉네임을 읽기 전용 문구로, 비밀번호 페이지는 검증된 email을 "비밀번호를 변경할 계정" 문구로 표시한다. 조회 중에는 role="status", 실패하면 재시도 버튼을 보이며 profile을 받기 전에는 form을 렌더하지 않는다. 두 form은 FormField를 쓰고 isSubmitting 동안 중복 전송을 막는다. nickname form은 nickname, password form은 currentPassword·newPassword·newPasswordConfirm만 소유한다. 400 fieldErrors와 409 NICKNAME_DUPLICATED/SAME_PASSWORD는 해당 input에, 403·네트워크·5xx는 role="alert" 공통 오류에 둔다. 성공은 navigate('/mypage', { replace: true, state: { profileMessage: '…' } })이며 MyPage는 문자열 route state만 role="status"로 표시한다.

AppRouter.tsx에는 현재 /mypage 보호 Route 뒤에 다음을 추가한다.

```
<Route path="/mypage/nickname" element={isAuthenticated ? <NicknameChangePage /> : <Navigate to="/login" replace />} />
<Route path="/mypage/password" element={isAuthenticated ? <PasswordChangePage /> : <Navigate to="/login" replace />} />
```

모든 새 컴포넌트, loadProfile, handleSubmit, 오류 변환 함수에 책임 주석을 붙인다. myPage.css는 기존 card·보라색 톤을 유지하며 뒤로가기, form 간격, status/error만 추가한다.

- [ ] **Step 6: 프로필 화면과 보호 라우트를 검증한다**

Run: npm test -- --run src/pages/mypage/ui/MyPage.test.tsx src/pages/mypage/ui/NicknameChangePage.test.tsx src/pages/mypage/ui/PasswordChangePage.test.tsx src/app/router/AppRouter.test.tsx

Expected: PASS; 실제 값·재시도·필드 오류·성공 이동·비로그인 보호 경로가 확인된다. 기존 authenticatedFetchJson.test.ts의 refresh 실패 시 clearSession 검증도 그대로 통과해, 세션이 해제된 뒤 해당 보호 라우트가 이 테스트의 로그인 경로로 재평가된다.

- [ ] **Step 7: 사용자 설정 화면을 커밋한다**

```
git add src/pages/mypage src/features/user-profile/ui src/app/router/AppRouter.tsx src/app/router/AppRouter.test.tsx
git commit -m "feat: 마이페이지 사용자 정보 연동 #112"
```

### Task 4: 음악 검색 feature와 자물쇠 작성 화면 연결

**Files:**

- Create: src/features/music-search/model/musicSearch.types.ts
- Create: src/features/music-search/api/musicSearchApi.ts
- Create: src/features/music-search/api/musicSearchApi.test.ts
- Create: src/features/music-search/ui/MusicSearchField.tsx
- Create: src/features/music-search/ui/MusicSearchField.test.tsx
- Modify: src/pages/lock-create/ui/LockCreatePage.tsx:1-78
- Modify: src/pages/lock-create/ui/lockCreatePage.css
- Create: src/pages/lock-create/ui/LockCreatePage.test.tsx

**Interfaces:**

- Consumes: AuthenticatedApiClient['fetchJson'], ApiError.
- Produces: MusicSearchResult, searchMusic(request, query), MusicSearchField({ request, onSelect }).

- [ ] **Step 1: 음악 API의 실패 테스트를 작성한다**

```
it('uses q and URLSearchParams encoding', async () => {
  const request = vi.fn().mockResolvedValue({ message: 'ok', data: [] });
  await searchMusic(request, ' 아이유 & 밤편지 ');
  expect(request).toHaveBeenCalledWith('/music/search?q=%EC%95%84%EC%9D%B4%EC%9C%A0+%26+%EB%B0%A4%ED%8E%B8%EC%A7%80');
});

it('rejects a malformed track before UI receives it', async () => {
  await expect(searchMusic(vi.fn().mockResolvedValue({ message: 'ok', data: [{ title: '밤편지' }] }), '밤편지')).rejects.toMatchObject({ status: 502, code: 'INVALID_RESPONSE' } satisfies Partial<ApiError>);
});
```

- [ ] **Step 2: 음악 API 테스트가 실패하는지 확인한다**

Run: npm test -- --run src/features/music-search/api/musicSearchApi.test.ts

Expected: FAIL because music-search does not exist.

- [ ] **Step 3: 검색 응답 파서와 요청 함수를 구현한다**

MusicSearchResult는 provider: 'SPOTIFY', externalTrackId, title, artistName, albumImageUrl, externalUrl을 모두 string으로 갖는다. searchMusic은 trim한 query에서 new URLSearchParams({ q: normalizedQuery })를 만들고 request<unknown>('/music/search?' + params)를 호출한다. message, data array, 각 track 필수 필드를 모두 확인한다. 2자 미만 또는 255자 초과면 요청 전 ApiError(400, '검색어는 2~255자로 입력해 주세요.', 'INVALID_SEARCH_QUERY')를 던진다.

- [ ] **Step 4: 검색 UI의 실패 테스트를 작성한다**

```
it('does not request for a one-character query', async () => {
  render(<MusicSearchField request={request} onSelect={vi.fn()} />);
  await user.type(screen.getByLabelText('음악 검색어'), '밤');
  await user.click(screen.getByRole('button', { name: '음악 검색' }));
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('2자 이상');
});

it('renders empty and rate-limit states separately', async () => {
  vi.mocked(searchMusic).mockResolvedValue([]);
  render(<MusicSearchField request={request} onSelect={vi.fn()} />);
  await searchFor(user, '밤편지');
  expect(await screen.findByText('검색 결과가 없어요.')).toBeInTheDocument();
  vi.mocked(searchMusic).mockRejectedValue(new ApiError(429, 'too many', 'RATE_LIMITED'));
  await searchFor(user, '아이유');
  expect(await screen.findByRole('alert')).toHaveTextContent('잠시 후 다시 검색해 주세요.');
});
```

- [ ] **Step 5: 검색 UI와 선택 상태를 구현한다**

MusicSearchField는 검색어·결과·요청 상태만 소유한다. handleSubmit은 whitespace-only 또는 1자 검색을 요청하지 않고 오류를 보인다. 결과 title과 artistName은 button으로 렌더하고 선택 시 onSelect(track)을 호출하여 목록을 닫는다. 외부 albumImageUrl에는 alt=""와 로딩 실패 대체 cover를 둔다. externalUrl 새 창 열기는 만들지 않는다.

LockCreatePage는 session request를 MusicSearchField에 전달하고 선택한 MusicSearchResult를 로컬 상태로 보관해 정적 input 자리에서 title — artistName을 보여 준다. 저장 버튼은 여전히 disabled이며, “자동 임시저장”은 “자물쇠 저장 기능은 준비 중이에요.”로 바꾼다. 사진 추천은 disabled와 준비 중 설명만 유지한다.

- [ ] **Step 6: 음악 검색과 자물쇠 선택을 검증한다**

Run: npm test -- --run src/features/music-search/api/musicSearchApi.test.ts src/features/music-search/ui/MusicSearchField.test.tsx src/pages/lock-create/ui/LockCreatePage.test.tsx

Expected: PASS; q 인코딩, malformed 응답, 최소 길이, 빈 결과, 429, 선택 표시를 확인한다.

- [ ] **Step 7: 음악 검색 연동을 커밋한다**

```
git add src/features/music-search src/pages/lock-create
git commit -m "feat: 자물쇠 음악 검색 연동 #112"
```

### Task 5: API 미구현 화면의 안전한 준비 중 전환

**Files:**

- Create: src/shared/ui/FeatureUnavailableNotice.tsx
- Create: src/shared/ui/FeatureUnavailableNotice.test.tsx
- Create: src/shared/ui/featureUnavailableNotice.css
- Modify: src/features/home-playlist/ui/HomePlaylistSheet.tsx:1-47
- Modify: src/features/home-playlist/ui/homePlaylistSheet.css
- Modify: src/pages/memory-search/ui/MemorySearchPage.tsx:1-71
- Modify: src/pages/memory-search/ui/memorySearchPage.css
- Modify: src/pages/report/ui/ReportPage.tsx:1-67
- Modify: src/pages/report/ui/ReportDetailPage.tsx
- Modify: src/pages/report/ui/reportPage.css
- Create: src/pages/memory-search/ui/MemorySearchPage.test.tsx
- Create: src/pages/report/ui/ReportPage.test.tsx
- Create: src/pages/report/ui/ReportDetailPage.test.tsx
- Create: src/features/home-playlist/ui/HomePlaylistSheet.test.tsx

**Interfaces:**

- Consumes: React Router Link.
- Produces: FeatureUnavailableNotice({ title, description, homeLabel? }) and preparation screens with a home return link.

- [ ] **Step 1: 공통 준비 중 안내의 실패 테스트를 작성한다**

```
it('explains the unavailable feature and provides a home link', () => {
  render(<MemoryRouter><FeatureUnavailableNotice title="AI 기억 검색" description="기억 검색 기능을 준비하고 있어요." /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'AI 기억 검색' })).toBeInTheDocument();
  expect(screen.getByText('기억 검색 기능을 준비하고 있어요.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '홈으로 돌아가기' })).toHaveAttribute('href', '/');
});
```

- [ ] **Step 2: 준비 중 컴포넌트 테스트가 실패하는지 확인한다**

Run: npm test -- --run src/shared/ui/FeatureUnavailableNotice.test.tsx

Expected: FAIL because the common notice does not exist.

- [ ] **Step 3: 가짜 결과 부재의 실패 테스트를 작성한다**

```
it('does not render a fabricated memory answer', () => {
  renderMemorySearchPage();
  expect(screen.getByText('기억 검색 기능을 준비하고 있어요.')).toBeInTheDocument();
  expect(screen.queryByText(/홍대 근처에서/)).not.toBeInTheDocument();
});
it('does not render monthly counts or report-detail mock data', () => {
  renderReportPage();
  expect(screen.getByText('월별 리포트를 준비하고 있어요.')).toBeInTheDocument();
  expect(screen.queryByText('14개')).not.toBeInTheDocument();
});
it('keeps a direct report-detail route in the unavailable state', () => {
  renderReportDetailPage('/report/2026/3');
  expect(screen.getByText('월별 리포트를 준비하고 있어요.')).toBeInTheDocument();
  expect(screen.queryByText(/이번 달/)).not.toBeInTheDocument();
});
it('does not render playlist mock tracks or Spotify save action', () => {
  renderPlaylistSheet();
  expect(screen.getByText('추천 플레이리스트를 준비하고 있어요.')).toBeInTheDocument();
  expect(screen.queryByText('비 오는 날엔')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '내 Spotify에 저장하기' })).not.toBeInTheDocument();
});
```

- [ ] **Step 4: 공통 안내와 가짜 결과 제거를 구현한다**

FeatureUnavailableNotice는 title, description, /로 향하는 홈으로 돌아가기 Link를 제공하고 설명은 role="status"다. shared는 feature·page를 import하지 않는다.

MemorySearchPage에서는 query state, form, submit handler, 홍대 검색 결과 card를 제거한다. ReportPage에서는 months, recordCounts, 연도 조작, 월별 Link를 제거한다. ReportDetailPage도 직접 URL의 목업 상세 data 대신 리포트 준비 중 안내만 보인다. HomePlaylistSheet에서는 playlistTracks, 날씨·시간 목업, Spotify 저장 버튼을 제거하고 sheet 안에 안내를 둔다. 즉 기존 성공처럼 보이는 목업 UI를 API 구현 상태를 알리는 화면으로 바꾼다.

- [ ] **Step 5: 공통 안내와 세 진입점을 검증한다**

Run: npm test -- --run src/shared/ui/FeatureUnavailableNotice.test.tsx src/pages/memory-search/ui/MemorySearchPage.test.tsx src/pages/report/ui/ReportPage.test.tsx src/pages/report/ui/ReportDetailPage.test.tsx src/features/home-playlist/ui/HomePlaylistSheet.test.tsx

Expected: PASS; 홈 복귀 경로와 목업 성공 데이터 제거가 확인된다.

- [ ] **Step 6: 미구현 기능 안내 전환을 커밋한다**

```
git add src/shared/ui/FeatureUnavailableNotice.tsx src/shared/ui/FeatureUnavailableNotice.test.tsx src/shared/ui/featureUnavailableNotice.css src/features/home-playlist src/pages/memory-search src/pages/report
git commit -m "feat: 미구현 기능 준비 중 안내 적용 #112"
```

### Task 6: 전체 회귀 검증과 개발 문서 동기화

**Files:**

- Modify: docs/api-integration.md:49-69
- Modify: docs/superpowers/specs/2026-09-25-api-backed-pages-design.md:107-115

**Interfaces:**

- Consumes: Tasks 1~5 test and UI contracts.
- Produces: protected-request usage and unavailable-feature policy consistent with source, plus passing quality gates.

- [ ] **Step 1: 문서의 실제 API 사용처를 갱신한다**

docs/api-integration.md의 보호 요청 설명에 /api/users/me, nickname/password PATCH, /api/music/search가 fetchAuthenticatedJson을 쓰는 사례를 기록한다. CSRF에는 nickname/password PATCH가 credentials: include와 X-XSRF-TOKEN을 요구한다고 적는다. 아직 구현되지 않은 기능을 구현됐다고 기록하지 않는다.

- [ ] **Step 2: 설계 문서의 구현 범위를 동기화한다**

설계 문서의 기존 화면에서 달라지는 점 표기를 실제 사용자 조회·변경·음악 검색·준비 중 전환과 일치시킨다. OpenAPI가 계약의 원문이라는 설명은 유지하며 코드를 문서에 반복해서 옮기지 않는다.

- [ ] **Step 3: 형식·정적 검사·테스트·번들을 순서대로 실행한다**

Run: npm run prettier

Expected: PASS.

Run: npm run lint

Expected: PASS with no ESLint errors.

Run: npm run typecheck

Expected: PASS with strict TypeScript errors 0.

Run: npm test -- --run

Expected: PASS for all existing and new tests.

Run: npm run build

Expected: PASS; tsc -b and Vite production build both finish successfully.

- [ ] **Step 4: 최종 검증과 문서 갱신을 커밋한다**

```
git add docs/api-integration.md docs/superpowers/specs/2026-09-25-api-backed-pages-design.md
git commit -m "docs: API 연동 화면 운영 기준 갱신 #112"
```
