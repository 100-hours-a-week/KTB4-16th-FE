# Refresh Token Session Restore #149 Implementation Plan

> **For agentic workers:** Implement this bounded change with a test-first cycle. Keep the existing access-token storage policy unchanged.

**Goal:** Restore an in-memory access token from the existing HttpOnly refresh Cookie when the SPA starts, so a page refresh preserves an authenticated session.

**Architecture:** `SessionProvider` owns initial session restoration and exposes a temporary restoring state through the existing session context. The existing authenticated API client reuses its refresh request and Promise deduplication for startup restoration. `AppRouter` delays authentication-dependent routes until restoration completes.

**Tech Stack:** React 19, React Router, TypeScript, Vitest, Testing Library

**Spec:** Bounded change based on the approved in-chat design for issue #149.

## Global Constraints

- Keep the access token in React memory only; never use `localStorage`, `sessionStorage`, or a JavaScript-readable refresh token.
- Reuse `POST /auth/refresh` with `credentials: 'include'` and the existing CSRF request/header flow.
- Add only focused regression tests; do not add dependencies or change the backend API contract.

## Review Focus

- A valid refresh Cookie restores access before a protected route redirects.
- An invalid or absent refresh Cookie ends restoration and permits the login route.
- `/login` and `/signup` cannot submit a new login while a previous refresh restoration is pending.
- React StrictMode shares one startup refresh request instead of issuing duplicates.

### Task 1: Add startup restoration regression tests

**Files:**

- Modify: `src/entities/session/model/SessionContext.test.tsx`
- Modify: `src/app/router/AppRouter.test.tsx`

- [x] Write a failing Provider test: mocked `GET /csrf` then successful `POST /auth/refresh` exposes the restored access token.
- [x] Write a failing router test: a protected route renders a pending status before delayed refresh completion, then renders the requested page.
- [x] Write a failing router test: `/login` remains pending during delayed refresh and appears after refresh failure.
- [x] Run `npm test -- --run src/entities/session/model/SessionContext.test.tsx src/app/router/AppRouter.test.tsx`; confirm failures are caused by missing restoration behavior.

### Task 2: Expose and execute session restoration

**Files:**

- Modify: `src/shared/api/authenticatedFetchJson.ts:15-80`
- Modify: `src/entities/session/model/sessionContext.ts:3-10`
- Modify: `src/entities/session/model/SessionProvider.tsx:51-87`

- [x] Add `restoreSession(): Promise<void>` to the authenticated API client, delegating to the existing refresh request and its shared Promise.
- [x] Add `isSessionRestoring` to the session context.
- [x] On Provider mount, call `restoreSession`, retain the resulting access token on success, and always end the restoring state without surfacing refresh failure as an unhandled rejection.
- [x] Run the Task 1 tests; confirm they pass.

### Task 3: Gate authentication routes during restoration

**Files:**

- Modify: `src/app/router/AppRouter.tsx:18-122`

- [x] Add a small route helper that returns an accessible pending status while restoration is active.
- [x] Use it for protected routes and `/login`/`/signup`; after restoration, preserve the existing authenticated/anonymous route behavior.
- [x] Run the router regression tests; confirm they pass.

### Task 4: Document and verify

**Files:**

- Modify: `docs/api-integration.md:67-71`

- [x] Replace the prior “recover on a protected API 401” startup description with the actual startup refresh behavior.
- [x] Run `npm test -- --run`, `npm run typecheck`, `npm run lint`, `npm run prettier`, and `npm run build`.
- [x] Inspect `git diff --check` and manually verify that no token is persisted in browser storage.
