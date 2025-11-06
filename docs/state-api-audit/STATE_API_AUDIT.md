# State & API Call Audit Report

**Date:** 2024-12-19  
**Scope:** Frontend state management and API call patterns  
**Objective:** Identify redundant fetches, missing caching, and deduplication opportunities

---

## Executive Summary

### Top 5 Duplicate-Call Hotspots

1. **`access-request-status`** - Queried in 5+ components simultaneously
   - `EarlyAccessRoute.tsx:28` - Route guard
   - `MyAdventuresPage.tsx:39` - Page component
   - `RequestAccessPage.tsx:56` - Page component
   - `LandingPage.tsx:26` - Landing page
   - `EarlyAccessBanner.tsx:21` - Banner component
   - **Impact:** Same query key, but multiple components mount simultaneously causing redundant network calls
   - **Fix:** Single top-level query in App or shared hook

2. **`wallet`** - Queried in 3+ components on every navigation
   - `UnifiedGamePage.tsx:156` - Game page
   - `GamePage.tsx:189` - Legacy game page
   - `MobileDrawerNav.tsx:32` - Navigation component (always mounted)
   - **Impact:** Wallet balance fetched multiple times per route change
   - **Fix:** Single query in layout/nav component, pass data down

3. **`worlds`** - Inconsistent query keys across pages
   - `WorldSelectionPage.tsx:11` - Uses `['worlds']` with `getWorldTemplates()`
   - `lib/queries.ts:12` - Uses `['worlds', { q }]` with `listWorlds()`
   - `UnifiedGamePage.tsx:143` - Uses `['content-worlds']` with `getContentWorlds()`
   - **Impact:** Same data fetched with different keys, no cache sharing
   - **Fix:** Standardize on single query key format and API endpoint

4. **`characters`** - Multiple query keys for same resource
   - `CharacterListPage.tsx:7` - Uses `['characters']` (no world filter)
   - `CharacterSelectionPage.tsx:82` - Uses `['characters', currentWorldId]` (world-filtered)
   - `lib/queries.ts:104` - Uses `['characters']` with `listCharacters()`
   - **Impact:** Unfiltered list may be fetched unnecessarily when filtered version exists
   - **Fix:** Use param-based keying consistently: `['characters', { worldId }]`

5. **`profile`** - Dual fetching via hook + query
   - `usePlayerAccount.ts:34-74` - Fetches via `useEffect` + `playerAccountService`
   - `ProfilePage.tsx:73` - Fetches via `useQuery` with `['profile']` key
   - **Impact:** Profile loaded twice on ProfilePage mount
   - **Fix:** Use single React Query hook, remove useEffect-based fetching

### Top 5 Quick Wins to Cut Calls by 50%

1. **Consolidate `access-request-status` query** (5 calls → 1)
   - Create `useAccessRequestStatus()` hook
   - Use in single top-level component (App or EarlyAccessRoute)
   - Pass status via context or props to children
   - **Expected reduction:** 80% fewer calls

2. **Standardize `worlds` query keys** (3 different keys → 1)
   - Migrate all pages to `useWorldsQuery()` from `lib/queries.ts`
   - Deprecate `getWorldTemplates()` and `getContentWorlds()`
   - Use single `['worlds', { q }]` key format
   - **Expected reduction:** 66% fewer calls

3. **Move `wallet` query to layout** (3 calls → 1)
   - Query once in `MobileDrawerNav` or App-level provider
   - Pass wallet data via context to consuming components
   - Remove duplicate queries from `UnifiedGamePage` and `GamePage`
   - **Expected reduction:** 66% fewer calls

4. **Unify `characters` query pattern** (2-3 calls → 1 per view)
   - Use param-based keying: `['characters', { worldId }]`
   - Always pass `worldId` (null for all characters)
   - Remove unfiltered `['characters']` key
   - **Expected reduction:** 50% fewer calls

5. **Remove `profile` useEffect fetching** (2 calls → 1)
   - Migrate `usePlayerAccount` to use React Query only
   - Remove direct `playerAccountService` calls in `useEffect`
   - Use `['profile']` query key consistently
   - **Expected reduction:** 50% fewer calls

### Global Config Tweaks to Prevent Refetch Churn

1. **Increase `staleTime` for stable data:**
   - `role`: 15 minutes (currently 5 min in `AppRolesProvider`)
   - `profile`: 10 minutes (currently missing, defaults to 5 min)
   - `worlds`: 10 minutes (currently 5 min)
   - `access-request-status`: 10 minutes (currently 5 min)

2. **Disable `refetchOnMount` for stable resources:**
   - Add per-query override: `refetchOnMount: false` for:
     - `['profile']`
     - `['admin-user-roles', userId]`
     - `['access-request-status']`
     - `['worlds']` (when no search query)

3. **Add `keepPreviousData: true` for list queries:**
   - `['stories', params]`
   - `['worlds', { q }]`
   - `['characters', { worldId }]`
   - Prevents loading states during filter changes

---

## Current Patterns

### React Query Configuration

**Location:** `frontend/src/App.tsx:44-58`

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 minutes
      gcTime: 10 * 60 * 1000,          // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,     // ✅ Good
      refetchOnMount: true,             // ⚠️ Can cause churn
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});
```

**Issues:**
- `refetchOnMount: true` causes refetches on every component mount, even with valid cache
- Default `staleTime` of 5 minutes is too short for stable data (role, profile)
- No per-resource tuning for different data volatility

### Global State Management

**Zustand Stores:**
- `store/auth.ts` - Auth state (user, profile, loading)
- `store/game.ts` - Game state (currentCharacter, currentGame)

**React Context:**
- `contexts/theme-context-provider.tsx` - Theme only
- `admin/routeGuard.tsx` - AppRoles context

**Pattern Analysis:**
- Auth store loads profile via `authService.initialize()` (not React Query)
- Profile is also fetched via `usePlayerAccount` hook (useEffect + service)
- No single source of truth for profile data
- Role is fetched via React Query in `AppRolesProvider`, but also via `useAdminRole` hook (Zustand)

---

## Endpoint-to-Component Map

### Key Resources

#### Role

| Endpoint | Hook/File | Query Key | Cache Settings | Notes | Risk |
|----------|-----------|-----------|----------------|-------|------|
| `/api/admin/user/roles` | `admin/routeGuard.tsx:51` | `['admin-user-roles', userId]` | staleTime: 5min, gcTime: 10min | Fetched in AppRolesProvider | Low - cached well |
| `/api/admin/user/roles` | `hooks/useAdminRole.ts:49` | N/A (Zustand) | Cached in adminStore | Fetched via Zustand store | Medium - dual fetching |

**Issues:**
- Role fetched via both React Query and Zustand
- `useAdminRole` uses Zustand store which may not share cache with React Query

#### Profile

| Endpoint | Hook/File | Query Key | Cache Settings | Notes | Risk |
|----------|-----------|-----------|----------------|-------|------|
| `/api/profile` | `services/profile.ts:68` | N/A | N/A | Called via `ProfileService.getProfile()` | High - no React Query |
| `usePlayerAccount.ts:49` | `hooks/usePlayerAccount.ts:34` | N/A | N/A | Fetched in useEffect | High - bypasses React Query |
| `ProfilePage.tsx:73` | `pages/ProfilePage.tsx:74` | `['profile']` | Default (5min) | Uses `usePlayerAccount` data as initialData | Medium - dual fetching |

**Issues:**
- Profile fetched via `useEffect` in `usePlayerAccount` (bypasses React Query)
- Profile also queried in `ProfilePage` with React Query
- No single source of truth

#### Worlds

| Endpoint | Hook/File | Query Key | Cache Settings | Notes | Risk |
|----------|-----------|-----------|----------------|-------|------|
| `/api/worlds` | `pages/WorldSelectionPage.tsx:11` | `['worlds']` | Default (5min) | Uses `getWorldTemplates()` | High - inconsistent key |
| `/api/catalog/worlds` | `lib/queries.ts:12` | `['worlds', { q }]` | staleTime: 5min, gcTime: 10min | Uses `listWorlds()` | Medium - different endpoint |
| `/api/content/worlds` | `pages/UnifiedGamePage.tsx:143` | `['content-worlds']` | staleTime: 5min | Uses `getContentWorlds()` | High - different key/endpoint |

**Issues:**
- Three different endpoints for worlds data
- Three different query keys (no cache sharing)
- `WorldSelectionPage` uses legacy endpoint

#### Stories

| Endpoint | Hook/File | Query Key | Cache Settings | Notes | Risk |
|----------|-----------|-----------|----------------|-------|------|
| `/api/catalog/stories` | `lib/queries.ts:55` | `['stories', p]` | staleTime: 5min, gcTime: 10min | Param-based keying | Low - well structured |
| `/api/stories` | `lib/api.ts:401` | N/A | N/A | Legacy endpoint (unused?) | Low - deprecated |

**Issues:**
- Legacy endpoint exists but appears unused
- Query key structure is good (param-based)

#### My Stories (My Adventures)

| Endpoint | Hook/File | Query Key | Cache Settings | Notes | Risk |
|----------|-----------|-----------|----------------|-------|------|
| `/api/games` | `pages/MyAdventuresPage.tsx:59` | `['my-adventures']` | Default (5min) | Fetched with access check | Low - single source |

**Issues:**
- Query depends on `access-request-status` (causes cascade)
- No pagination support

---

## Detailed Findings by Resource

### 1. Role

**Current State:**
- Fetched in `AppRolesProvider` via React Query: `['admin-user-roles', userId]`
- Also fetched in `useAdminRole` hook via Zustand store
- Backend endpoint: `/api/admin/user/roles`

**Duplicate Call Sites:**
- `admin/routeGuard.tsx:50` - React Query
- `hooks/useAdminRole.ts:49` - Zustand store (may trigger API call)

**Recommendations:**
- Use single React Query hook for role
- Remove Zustand role fetching, use React Query cache
- Increase `staleTime` to 15 minutes (roles change infrequently)

### 2. Profile

**Current State:**
- Loaded in `authService.initialize()` (not React Query)
- Fetched in `usePlayerAccount` via `useEffect` (bypasses React Query)
- Queried in `ProfilePage` via React Query with `['profile']` key
- Backend endpoint: `/api/profile`

**Duplicate Call Sites:**
- `services/auth/AuthService.ts:33` - Initial load (not React Query)
- `hooks/usePlayerAccount.ts:45` - useEffect fetch (bypasses React Query)
- `pages/ProfilePage.tsx:73` - React Query

**Recommendations:**
- Migrate all profile fetching to React Query
- Remove `useEffect`-based fetching from `usePlayerAccount`
- Use `['profile']` query key consistently
- Set `staleTime: 10 * 60 * 1000` (10 minutes)

### 3. Worlds

**Current State:**
- Three different endpoints:
  - `/api/worlds` (legacy, used in `WorldSelectionPage`)
  - `/api/catalog/worlds` (new, used in `lib/queries.ts`)
  - `/api/content/worlds` (used in `UnifiedGamePage`)
- Three different query keys:
  - `['worlds']`
  - `['worlds', { q }]`
  - `['content-worlds']`

**Duplicate Call Sites:**
- `pages/WorldSelectionPage.tsx:11` - `['worlds']` with legacy endpoint
- `lib/queries.ts:12` - `['worlds', { q }]` with catalog endpoint
- `pages/UnifiedGamePage.tsx:143` - `['content-worlds']` with content endpoint

**Recommendations:**
- Standardize on `/api/catalog/worlds` endpoint
- Use single query key format: `['worlds', { q }]`
- Migrate `WorldSelectionPage` to use `useWorldsQuery()` hook
- Remove `getWorldTemplates()` and `getContentWorlds()` functions

### 4. Stories

**Current State:**
- Well-structured with param-based query key: `['stories', p]`
- Uses catalog endpoint: `/api/catalog/stories`
- Query hook: `useStoriesQuery()` in `lib/queries.ts`

**Issues:**
- Legacy endpoint `/api/stories` exists but appears unused
- No duplicate call issues found

**Recommendations:**
- Remove legacy endpoint if confirmed unused
- Consider adding `keepPreviousData: true` for filter changes

### 5. My Stories (My Adventures)

**Current State:**
- Single query: `['my-adventures']` in `MyAdventuresPage`
- Endpoint: `/api/games`
- Depends on `access-request-status` query

**Issues:**
- Query is gated by access status, causing cascade
- No pagination support

**Recommendations:**
- Consider pagination for large lists
- Keep access gating but ensure `access-request-status` is cached

---

## Deduplication Opportunities

### 1. Access Request Status

**Location:** Multiple components
- `components/auth/EarlyAccessRoute.tsx:28`
- `pages/MyAdventuresPage.tsx:39`
- `pages/RequestAccessPage.tsx:56`
- `pages/LandingPage.tsx:26`
- `components/earlyAccess/EarlyAccessBanner.tsx:21`

**Problem:** Same query key `['access-request-status']` used in 5+ components that may mount simultaneously.

**Solution:**
- Create `useAccessRequestStatus()` hook
- Use in single top-level component (e.g., `EarlyAccessRoute` or App)
- Pass status via context to children

**Code Reference:**
```typescript
// Create: hooks/useAccessRequestStatus.ts
export function useAccessRequestStatus() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['access-request-status'],
    queryFn: () => publicAccessRequestsService.getStatus(),
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnMount: false,
  });
}
```

### 2. Wallet Query

**Location:** Multiple components
- `components/layout/MobileDrawerNav.tsx:32`
- `pages/UnifiedGamePage.tsx:156`
- `pages/GamePage.tsx:189`

**Problem:** Wallet fetched in nav (always mounted) and game pages (mount on navigation).

**Solution:**
- Query once in `MobileDrawerNav` (layout component)
- Pass wallet data via context or remove queries from game pages
- Game pages can read wallet from context if needed

**Code Reference:**
```typescript
// In MobileDrawerNav or App-level provider
const WalletContext = createContext<WalletData | null>(null);

export function WalletProvider({ children }) {
  const { data: wallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: async () => {
      const result = await getWallet();
      return result.ok ? result.data : null;
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchOnMount: false,
  });
  
  return (
    <WalletContext.Provider value={wallet || null}>
      {children}
    </WalletContext.Provider>
  );
}
```

### 3. Worlds Query Keys

**Location:** Multiple files
- `pages/WorldSelectionPage.tsx:11` - `['worlds']`
- `lib/queries.ts:12` - `['worlds', { q }]`
- `pages/UnifiedGamePage.tsx:143` - `['content-worlds']`

**Problem:** Same data fetched with different keys, no cache sharing.

**Solution:**
- Migrate all to `useWorldsQuery()` from `lib/queries.ts`
- Standardize on `['worlds', { q }]` key format
- Remove legacy endpoints

**Code Reference:**
```typescript
// Update WorldSelectionPage.tsx
import { useWorldsQuery } from '@/lib/queries';

export default function WorldSelectionPage() {
  const { data: worlds, isLoading } = useWorldsQuery(); // Uses ['worlds', { q }]
  // ...
}
```

### 4. Characters Query

**Location:** Multiple files
- `pages/CharacterListPage.tsx:7` - `['characters']`
- `pages/CharacterSelectionPage.tsx:82` - `['characters', currentWorldId]`
- `lib/queries.ts:104` - `['characters']`

**Problem:** Unfiltered list may be fetched when filtered version exists.

**Solution:**
- Use param-based keying: `['characters', { worldId }]`
- Always pass `worldId` (null for all characters)
- Update `useCharactersQuery` to accept optional `worldId`

**Code Reference:**
```typescript
// Update lib/queries.ts
export const useCharactersQuery = (worldId?: string) =>
  useQuery({ 
    queryKey: ['characters', { worldId }], 
    queryFn: () => listCharacters(worldId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
```

### 5. Profile Dual Fetching

**Location:**
- `hooks/usePlayerAccount.ts:34` - useEffect fetch
- `pages/ProfilePage.tsx:73` - React Query

**Problem:** Profile loaded twice on ProfilePage mount.

**Solution:**
- Migrate `usePlayerAccount` to use React Query only
- Remove `useEffect`-based fetching
- Use `['profile']` query key consistently

**Code Reference:**
```typescript
// Update hooks/usePlayerAccount.ts
export function usePlayerAccount() {
  const { user } = useAuthStore();
  
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      if (!user) return null;
      const result = await ProfileService.getProfile();
      return result.ok ? result.data : null;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
    refetchOnMount: false,
  });
  
  // ... rest of hook
}
```

---

## Navigation Trace Analysis

### App Boot to Home

**Queries Fired:**
1. `['access-request-status']` - EarlyAccessRoute, LandingPage, EarlyAccessBanner (3+ calls)
2. Auth store initialization - `authService.initialize()` (profile fetch)
3. `['admin-user-roles', userId]` - AppRolesProvider (if authenticated)

**Issues:**
- `access-request-status` queried 3+ times simultaneously
- Profile fetched outside React Query

### Home to Stories

**Queries Fired:**
1. `['stories', params]` - Stories page (if using catalog)
2. `['worlds', { q }]` - May be prefetched
3. `['wallet']` - MobileDrawerNav (always mounted)

**Issues:**
- Wallet refetched if cache expired (10s staleTime)

### Stories to My Stories

**Queries Fired:**
1. `['access-request-status']` - MyAdventuresPage (duplicate if EarlyAccessRoute already fetched)
2. `['my-adventures']` - MyAdventuresPage (gated by access status)

**Issues:**
- `access-request-status` may be refetched unnecessarily

### Opening a Story

**Queries Fired:**
1. `['story', idOrSlug]` - Story detail page
2. `['game', gameId]` - If starting/continuing game
3. `['turns.latest', gameId]` - Latest turn
4. `['conversation.history', gameId]` - Conversation history
5. `['wallet']` - If in UnifiedGamePage (duplicate if nav already fetched)

**Issues:**
- Wallet may be refetched in game page
- Game data has short staleTime (30s) causing frequent refetches

---

## Recommendations Summary

### Immediate Actions (High Impact, Low Risk)

1. **Consolidate `access-request-status` query**
   - Create shared hook, use in single component
   - **Files:** Create `hooks/useAccessRequestStatus.ts`, update 5 components

2. **Move `wallet` query to layout**
   - Query in `MobileDrawerNav`, remove from game pages
   - **Files:** `components/layout/MobileDrawerNav.tsx`, `pages/UnifiedGamePage.tsx`, `pages/GamePage.tsx`

3. **Standardize `worlds` queries**
   - Migrate to `useWorldsQuery()` hook
   - **Files:** `pages/WorldSelectionPage.tsx`, `pages/UnifiedGamePage.tsx`

### Medium-Term Actions (Medium Impact, Medium Risk)

4. **Migrate profile to React Query only**
   - Remove `useEffect` fetching from `usePlayerAccount`
   - **Files:** `hooks/usePlayerAccount.ts`, `pages/ProfilePage.tsx`

5. **Unify characters query pattern**
   - Use param-based keying consistently
   - **Files:** `lib/queries.ts`, `pages/CharacterListPage.tsx`, `pages/CharacterSelectionPage.tsx`

### Long-Term Actions (Low Impact, High Value)

6. **Increase staleTime for stable data**
   - Role: 15 minutes
   - Profile: 10 minutes
   - Worlds: 10 minutes
   - Access status: 10 minutes

7. **Add `keepPreviousData` for list queries**
   - Stories, worlds, characters lists
   - Prevents loading states during filter changes

8. **Remove legacy endpoints**
   - `/api/worlds` (use `/api/catalog/worlds`)
   - `/api/stories` (if unused)

---

## Appendix: File References

### Key Files for Review

- `frontend/src/App.tsx:44` - QueryClient config
- `frontend/src/lib/queries.ts` - Catalog query hooks
- `frontend/src/store/auth.ts` - Auth store (Zustand)
- `frontend/src/hooks/usePlayerAccount.ts` - Profile fetching hook
- `frontend/src/pages/MyAdventuresPage.tsx:39` - Access status query
- `frontend/src/components/auth/EarlyAccessRoute.tsx:28` - Access status query
- `frontend/src/components/layout/MobileDrawerNav.tsx:32` - Wallet query
- `frontend/src/pages/WorldSelectionPage.tsx:11` - Worlds query (legacy)
- `frontend/src/pages/UnifiedGamePage.tsx:143` - Worlds query (content)
- `frontend/src/admin/routeGuard.tsx:51` - Role query

---

**End of Report**

