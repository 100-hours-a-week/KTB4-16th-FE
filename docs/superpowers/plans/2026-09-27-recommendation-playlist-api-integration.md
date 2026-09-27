# Recommendation Playlist API Integration Implementation Plan

> **For Codex:** Execute this plan task by task, run the stated checks after each task, and commit only the files listed in that task.

**Goal:** Replace the home playlist placeholder with the implemented authenticated recommendation-playlist read/create flow while accurately handling login, browser location permission, and backend availability.

**Architecture:** Put playlist payload parsing and HTTP calls in `features/home-playlist/api` and `model`. Keep `HomePlaylistSheet` as the UI coordinator; `HomePage` owns only sheet animation. Reuse the existing `HomeMap` callback: it will expose the browser-verified current location separately from the default map center, preventing fallback map coordinates from being submitted as the user’s location.

**Tech Stack:** React 19, React Router 7, TypeScript strict mode, Vitest/Testing Library, existing session-aware API client and CSRF utility.

**Spec:** `docs/superpowers/specs/2026-09-27-report-playlist-api-integration-design.md`

## Global Constraints

- Request `GET /api/playlists/recommendations` when an authenticated user opens the sheet; `playlist: null` is a valid no-playlist result.
- Send `POST /api/playlists/recommendations` only after browser geolocation succeeds; do not submit the map’s default coordinates or invent a fallback location.
- Reuse `fetchAuthenticatedJson` for Bearer/401-refresh behavior and `getCsrfToken` for the POST header and Cookie bootstrap.
- Runtime-validate all external values; show safe errors, never tokens/Cookies/personal data in logs or browser storage.
- Keep backend mock tracks labelled as recommendation results only; do not claim that an AI or Spotify save integration has run.
- Add short Korean responsibility comments to every new function, as required by `AGENTS.md`.

## Review Focus

- Unauthenticated users do not make protected playlist calls and can reach login.
- Reopening an existing sheet uses server state rather than stale fabricated tracks.
- Geolocation rejection, unsupported browser and timeout are distinguishable and recoverable without POST.
- 429 and documented 502 recommendation failures retain a retry path and do not erase a successfully loaded playlist.
- Existing sheet open/close animation and home map controls remain functional.

### Task 1: Add runtime-validated playlist contracts and API clients

**Files:**

- Create: `src/features/home-playlist/model/recommendationPlaylist.types.ts`
- Create: `src/features/home-playlist/api/recommendationPlaylistApi.ts`
- Create: `src/features/home-playlist/api/recommendationPlaylistApi.test.ts`

**Interfaces:**

```ts
export type RecommendationPlaylist = {
  recommendationPlaylistId: number;
  tracks: RecommendationTrack[];
};

export async function getRecommendationPlaylist(
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
): Promise<RecommendationPlaylist | null>;

export async function createRecommendationPlaylist(
  coordinates: MapCenter,
  fetchAuthenticatedJson: AuthenticatedApiClient['fetchJson'],
): Promise<RecommendationPlaylist>;
```

**RED:** Test `data.playlist: null`, a valid playlist, invalid track fields, and POST request composition. Assert POST uses `credentials: 'include'`, JSON body `{ latitude, longitude }`, and an `X-XSRF-TOKEN` obtained through the existing CSRF function.

**GREEN:** Implement documented GET/POST endpoints and parsers. Validate finite latitude/longitude before POST. Parse only server fields that the UI needs (playlist identity and track title/artist/external URL); reject malformed payloads as `ApiError(INVALID_RESPONSE)`.

**VERIFY:** `npm test -- recommendationPlaylistApi`

**COMMIT:** `feat: 추천 플레이리스트 API 클라이언트 추가 #130`

### Task 2: Preserve real geolocation separately from the map fallback

**Files:**

- Modify: `src/features/home-map/ui/HomeMap.tsx`
- Modify: `src/pages/home/ui/HomePage.tsx`
- Modify/create focused HomeMap/HomePage tests if the current test suite has them.

**Interfaces:**

```ts
type HomeMapProps = {
  children?: ReactNode;
  onInitialCenterResolved?: (center: MapCenter) => void;
  onCurrentLocationResolved?: (location: MapCenter | null) => void;
};
```

**RED:** Test that successful browser geolocation sends the actual coordinate through `onCurrentLocationResolved`, while denied/unavailable geolocation sends `null` even though the map still receives `DEFAULT_CENTER`.

**GREEN:** Add the optional callback to `HomeMap` at the point where `getInitialMapCenter()` resolves, and store its value in `HomePage`. Pass it to the sheet. Preserve `onInitialCenterResolved` for weather/map behavior exactly as today; this is a data-flow addition, not a new location request.

**VERIFY:** `npm test -- HomeMap HomePage`

**COMMIT:** `feat: 홈 추천에 실제 위치 상태 전달 #130`

### Task 3: Replace the unavailable sheet with authenticated states and create flow

**Files:**

- Modify: `src/features/home-playlist/ui/HomePlaylistSheet.tsx`
- Create: `src/features/home-playlist/ui/HomePlaylistSheet.test.tsx`
- Modify: `src/features/home-playlist/ui/homePlaylistSheet.css`

**Interfaces:**

```ts
type HomePlaylistSheetProps = {
  isOpen: boolean;
  onExited: () => void;
  currentLocation: MapCenter | null;
};
```

**RED:** Add UI tests for unauthenticated login CTA, initial GET loading, existing playlist tracks, `null` playlist create CTA, location-not-available notice, POST success, 429/502 failure retry, and sheet exit callback. Assert no API call occurs for unauthenticated and missing-location states.

**GREEN:** Use `useSession` inside the sheet. When it becomes open and the user is authenticated, GET the current playlist with cancellation/stale-response protection. Render an explicit login CTA otherwise. For `null`, allow create only with `currentLocation`; pass it to POST, then replace state with the returned playlist. Render external track links only for validated safe URLs and retain loaded data if a refresh/create error occurs. Reuse the sheet’s existing track/cover/button classes and remove `FeatureUnavailableNotice` only from this now-backed surface.

**VERIFY:** `npm test -- HomePlaylistSheet`

**COMMIT:** `feat: 홈 추천 플레이리스트 화면 연동 #130`

### Task 4: Execute full regression and review

**Files:** all files above only.

1. Run `npm run prettier`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
2. Inspect `git diff --check` and `git diff origin/develop...HEAD` for accidental API/base-URL/environment changes.
3. Manually check logged-out home, logged-in existing-playlist, no-playlist, denied-location, and successful create flows.
4. Request a code review focused on the five Review Focus cases before preparing a PR.

**COMMIT:** No new commit unless verification needs a scoped correction.
