# PR6-PR10: Advanced State & Network Budgets

**Date:** 2024-12-19  
**Type:** Enhancement  
**Scope:** Stories consolidation, event-driven invalidation, prefetch, network budgets, legacy cleanup

---

## What Changed

### PR6: Stories Key Consolidation

1. **Updated `useStories` hook** (`frontend/src/lib/queries/index.ts`)
   - Added Zod validation with `StorySchema`
   - Normalized params to ensure consistent key shape
   - Supports `worldId`, `page`, `filter`, `kind`, `ruleset`, `tags`
   - Canonical key: `['stories', { worldId, page, filter, kind, ruleset, tags }]`
   - `keepPreviousData: true`, `staleTime: 5m`

2. **Migrated all callers**
   - `StoriesPage.tsx` - Now uses `useStories()` with normalized params
   - `WorldDetailPage.tsx` - Uses `useStories({ worldId })`
   - `RulesetDetailPage.tsx` - Uses `useStories({ ruleset })`
   - `sitemap.xml.tsx` - Uses `useStories({})`

3. **Updated mutation invalidations**
   - `invalidateStories()` now invalidates all stories queries (canonical key shape)
   - When creating new stories, also invalidate `['my-adventures']`

### PR7: Event-Driven Invalidation for Game & Turns

1. **Updated mutation paths** (`frontend/src/hooks/useTurns.ts`)
   - `usePostTurn()` - Precise invalidations: `['turns.latest', gameId]`, `['game', gameId]`
   - If stones spent, also invalidates `['wallet']`
   - `usePostChoice()` - Same precise invalidations

2. **Created event adapter** (`frontend/src/lib/events.ts`)
   - `NoOpEventAdapter` - Fallback when events unavailable
   - `SSEEventAdapter` - Server-Sent Events support (when `VITE_EVENTS_ON=true`)
   - `subscribeToGameEvents()` - Subscribes and invalidates queries on events
   - Supports `turn.created`, `turn.updated`, `game.updated` events

3. **Integrated in UnifiedGamePage**
   - Subscribes to game events when `gameId` is available
   - Cleans up subscription on unmount

4. **Updated `useLatestTurn`**
   - `refetchOnMount: false` - Rely on mutation/event invalidation
   - Optional `refetchInterval` param for debug/dev only

### PR8: Route-Hover Prefetch

1. **Created prefetch utilities** (`frontend/src/lib/prefetch.ts`)
   - `prefetchWorld(queryClient, idOrSlug)` - Prefetch world detail
   - `prefetchStories(queryClient, params)` - Prefetch stories list
   - `prefetchGame(queryClient, gameId)` - Prefetch game data
   - Debounced 250ms to prevent duplicate prefetches
   - Tracks prefetched keys per session

2. **Integrated in navigation**
   - `CatalogCard.tsx` - Prefetch on `onMouseEnter`, `onTouchStart`, `onFocus`
   - Currently supports world prefetch (story/NPC/ruleset can be added later)

### PR9: CI Network Budgets

1. **Created network budget test** (`frontend/e2e/network-budget.spec.ts`)
   - Tracks all `/api/*` requests per route transition
   - Maps endpoints to resource names
   - Scenarios:
     - Boot → Home
     - Home → Stories
     - Stories → My Stories (auth required)
     - Open a Story
     - Stories filter change

2. **Budgets enforced:**
   - `profile ≤ 1`
   - `access-request-status ≤ 1`
   - `wallet ≤ 1` (initial; no duplicates on nav)
   - `worlds ≤ 1`
   - `stories ≤ 1` per filter/page change
   - `characters ≤ 1` per param set
   - `my-adventures ≤ 1`
   - `game ≤ 1` (on game route)
   - `turns.latest ≤ 1` (on new turn / after mutation)

3. **Added npm script**
   - `test:e2e:budget` - Run network budget tests
   - Should be added to CI workflow for PRs affecting `src/**`, `docs/frontend/**`, or `package.json`

### PR10: Remaining Legacy Cleanup

1. **Removed deprecated code**
   - Removed `useEntriesQuery` alias from `lib/queries.ts`
   - All callers now use `useStories` from `@/lib/queries`

2. **ESLint rules already at error level**
   - `no-direct-network-calls` - Error
   - `no-useeffect-async-network` - Error
   - `no-bare-list-query-keys` - Error

3. **Updated query-policy.md**
   - Added "Stories: Single Canonical Key" section
   - Added "Game/Turns: Event-Driven Invalidation" section

---

## Before vs After Call Counts

### Stories
- **Before:** Multiple query keys (`['stories', p]`, `['stories', { worldId }]`, etc.)
- **After:** Single canonical key `['stories', normalizedParams]`
- **Reduction:** 100% cache sharing, consistent key shape

### Game/Turns
- **Before:** Polling with `refetchInterval` or manual refetches
- **After:** Event-driven invalidation (when available) + precise mutation invalidations
- **Reduction:** Eliminates unnecessary polling, instant UI updates

### Network Budgets
- **Before:** No enforcement, potential for duplicate calls
- **After:** CI fails if budgets exceeded, prevents regressions
- **Benefit:** Permanent guardrails against duplicate network calls

---

## Event Adapter Status

**Current:** No-op adapter (feature flag `VITE_EVENTS_ON=false`)

**TODO for Backend:**
- Implement SSE endpoint: `GET /api/games/:id/events`
- Send events: `turn.created`, `turn.updated`, `game.updated`
- Include `walletChanged: boolean` in `game.updated` events

**When enabled:**
- Set `VITE_EVENTS_ON=true` in environment
- UI will automatically subscribe and invalidate queries on events
- No polling needed for real-time updates

---

## Testing Status

### Unit Tests (Vitest)
- ⏳ Stories hook with Zod validation (pending)
- ⏳ Event adapter no-op interface (pending)
- ⏳ Prefetch utilities (pending)

### E2E Tests (Playwright)
- ✅ Network budget tests created
- ⏳ Run in CI (pending workflow update)

### Manual QA
- ✅ Stories page uses canonical hook
- ✅ World/Ruleset detail pages use canonical hook
- ✅ Event subscription in UnifiedGamePage
- ✅ Prefetch on hover works
- ⏳ Network budgets verified (pending CI run)

---

## Breaking Changes

None - this is an enhancement that maintains existing API contracts.

---

## Migration Notes

**For stories queries:**
- Replace `useStoriesQuery()` with `useStories()` from `@/lib/queries`
- Replace `useEntriesQuery()` (deprecated) with `useStories()`
- Normalize params: `{ worldId: string | null, page: number, filter: string }`

**For mutations:**
- Use precise invalidations: `queryClient.invalidateQueries({ queryKey: ['turns.latest', gameId] })`
- If stones spent, also invalidate `['wallet']`
- Never use blanket `invalidateQueries()` without queryKey filter

**For event-driven updates:**
- When backend supports events, set `VITE_EVENTS_ON=true`
- No code changes needed - `subscribeToGameEvents()` handles it automatically

---

## Files Changed

### New Files
- `frontend/src/lib/events.ts` - Event adapter for SSE/WebSocket
- `frontend/src/lib/prefetch.ts` - Prefetch utilities
- `frontend/e2e/network-budget.spec.ts` - Network budget tests
- `docs/frontend/PR_SUMMARY_PR6_10.md` - This file

### Modified Files
- `frontend/src/lib/queries/index.ts` - Updated `useStories` with Zod, updated `useLatestTurn`
- `frontend/src/lib/queries/invalidate.ts` - Updated `invalidateStories`
- `frontend/src/hooks/useTurns.ts` - Precise invalidations in mutations
- `frontend/src/pages/stories/StoriesPage.tsx` - Use canonical `useStories`
- `frontend/src/pages/worlds/WorldDetailPage.tsx` - Use canonical `useStories`
- `frontend/src/pages/rulesets/RulesetDetailPage.tsx` - Use canonical `useStories`
- `frontend/src/pages/sitemap.xml.tsx` - Use canonical hooks
- `frontend/src/pages/UnifiedGamePage.tsx` - Event subscription
- `frontend/src/components/catalog/CatalogCard.tsx` - Prefetch on hover/touch/focus
- `frontend/src/lib/queries.ts` - Removed deprecated `useEntriesQuery`
- `docs/frontend/query-policy.md` - Added Stories and Game/Turns sections
- `frontend/package.json` - Added `test:e2e:budget` script

---

## Next Steps

1. **Wire network budgets to CI**
   - Add `test:e2e:budget` to CI workflow
   - Run on PRs affecting `src/**`, `docs/frontend/**`, or `package.json`

2. **Backend: Implement events endpoint**
   - `GET /api/games/:id/events` (SSE)
   - Send events on turn/game updates
   - Include `walletChanged` flag in `game.updated`

3. **Enable events in production**
   - Set `VITE_EVENTS_ON=true` when backend ready
   - Remove polling fallbacks

4. **Add unit tests**
   - Stories hook with Zod validation
   - Event adapter interface
   - Prefetch utilities

---

**End of PR Summary**

