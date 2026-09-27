# Monthly Report API Integration Implementation Plan

> **For Codex:** Execute this plan task by task, run the stated checks after each task, and commit only the files listed in that task.

**Goal:** Replace the monthly-report placeholder with authenticated list and detail pages backed by the implemented v1 APIs, without fabricating user results.

**Architecture:** Keep HTTP parsing and API contracts in `features/monthly-report/api` and `model`; pages only coordinate session, loading, failure and routing state. A report list link passes its real `monthlyReportId` through React Router state to the existing year/month detail URL, so the client never guesses an identifier from date text.

**Tech Stack:** React 19, React Router 7, TypeScript strict mode, Vitest/Testing Library, existing `useSession` and `AuthenticatedApiClient`.

**Spec:** `docs/superpowers/specs/2026-09-27-report-playlist-api-integration-design.md`

## Global Constraints

- Use `fetchAuthenticatedJson`; do not create a second token, refresh, Cookie, or CSRF implementation.
- Validate every API response at runtime and expose a user-safe `ApiError` for invalid shapes.
- Do not add mock reports, mock AI recaps, fallback report IDs, local-storage cache, dependencies, environment values, or backend changes.
- Keep `/report` and `/report/:year/:month` protected by the existing router.
- Add short Korean responsibility comments to every new function, as required by `AGENTS.md`.

## Review Focus

- Empty reports must be an empty state, not an error or invented month.
- `aiRecap.status` that is not complete must not render a fake recap text.
- A malformed list/detail response, 401 after retry, 404 detail and missing Router state each have an understandable recovery route.
- The selected report must use its server `monthlyReportId`, not a year/month conversion.
- Existing navigation, CSS scope and accessibility labels must remain intact.

### Task 1: Add runtime-validated report contracts and API clients

**Files:**

- Create: `src/features/monthly-report/model/monthlyReport.types.ts`
- Create: `src/features/monthly-report/api/monthlyReportApi.ts`
- Create: `src/features/monthly-report/api/monthlyReportApi.test.ts`

**Interfaces:**

```ts
export type MonthlyReportSummary = {
  monthlyReportId: number;
  year: number;
  month: number;
  recordCount: number;
  aiRecapStatus: string;
};

export async function getMonthlyReports(
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
): Promise<MonthlyReportSummary[]>;

export async function getMonthlyReportDetail(
  monthlyReportId: number,
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
): Promise<MonthlyReportDetail>;
```

**RED:** Add tests proving valid list/detail payloads are transformed, `reports: []` remains valid, invalid field types reject with `ApiError(INVALID_RESPONSE)`, and a non-positive/non-integer ID does not issue a request.

**GREEN:** Implement request functions for `GET /api/monthly-reports` and `GET /api/monthly-reports/:monthlyReportId`. Parse only documented fields: `reports`, `stats`, `photoScenes`, and `aiRecap`; preserve optional statistics as `null` rather than inventing labels or numbers. Add Korean responsibility comments to each parser and request function.

**VERIFY:** `npm test -- monthlyReportApi`

**COMMIT:** `feat: 월별 리포트 API 클라이언트 추가 #130`

### Task 2: Render the report list from server state

**Files:**

- Create: `src/features/monthly-report/ui/MonthlyReportList.tsx`
- Create: `src/features/monthly-report/ui/MonthlyReportList.test.tsx`
- Modify: `src/pages/report/ui/ReportPage.tsx`
- Modify: `src/pages/report/ui/reportPage.css`

**Interfaces:**

```tsx
type MonthlyReportListProps = {
  reports: MonthlyReportSummary[];
};

<Link
  to={`/report/${report.year}/${report.month}`}
  state={{ monthlyReportId: report.monthlyReportId }}
>
```

**RED:** Test loading, empty, API failure with retry, and list rendering. Assert the detail link contains the report’s exact `monthlyReportId` in location state and no hard-coded report data is shown.

**GREEN:** In `ReportPage`, obtain `fetchAuthenticatedJson` from `useSession`, request once on mount, cancel stale requests on unmount, and offer retry after recoverable failures. In `MonthlyReportList`, group/filter only the returned reports for year navigation and render an accessible monthly link. Reuse the report page stylesheet while deleting styles that solely describe the placeholder.

**VERIFY:** `npm test -- ReportPage MonthlyReportList`

**COMMIT:** `feat: 월별 리포트 목록 화면 연동 #130`

### Task 3: Render a selected report detail and safe direct-URL recovery

**Files:**

- Create: `src/features/monthly-report/ui/MonthlyReportDetail.tsx`
- Create: `src/features/monthly-report/ui/MonthlyReportDetail.test.tsx`
- Modify: `src/pages/report/ui/ReportDetailPage.tsx`
- Modify: `src/pages/report/ui/ReportDetailPage.test.tsx`
- Modify: `src/pages/report/ui/reportPage.css`

**Interfaces:**

```ts
type ReportRouteState = { monthlyReportId: number };

function readMonthlyReportId(state: unknown): number | null;
```

**RED:** Test valid route state loading each documented section, empty/absent optional statistic values, recap pending state, API failure retry, and direct navigation without valid state. The final case must not call the detail API and must offer `/report` navigation.

**GREEN:** Read and validate `location.state.monthlyReportId`; fetch only if valid. Display title period from route params, record count and available top-place/top-artist/mood/photo-scene data. Show the server’s recap text only when the API marks it complete; otherwise show a neutral preparation/absence state. For invalid direct links, render a clear message and a report-list link rather than deriving an ID.

**VERIFY:** `npm test -- ReportDetailPage MonthlyReportDetail`

**COMMIT:** `feat: 월별 리포트 상세 화면 연동 #130`

### Task 4: Execute full regression and review

**Files:** all files above only.

1. Run `npm run prettier`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
2. Inspect `git diff --check` and `git diff origin/develop...HEAD` for accidental API/base-URL/environment changes.
3. Manually check a protected `/report` flow, list-empty flow and direct `/report/2026/9` URL flow in the browser.
4. Request a code review focused on the five Review Focus cases before preparing a PR.

**COMMIT:** No new commit unless verification needs a scoped correction.
