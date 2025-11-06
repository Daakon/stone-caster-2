# Frontend Query Policy

**Last Updated:** 2024-12-19  
**Purpose:** Establish canonical patterns for React Query usage across StoneCaster frontend

---

## Canonical Query Key Shapes

All query keys must follow these exact shapes:

```typescript
['profile']
['admin-user-roles', userId]
['access-request-status']
['wallet']
['worlds', { q }]
['world', idOrSlug]
['stories', params]
['characters', { worldId: string | null }]
['my-adventures']
['game', gameId]
['turns.latest', gameId]
```

### Rules

- **List keys must include an object param** - Never use bare string keys for list data
- **Use null for "all" filters** - `{ worldId: null }` means all characters, not `[]` or missing
- **Consistent param shapes** - Same resource type uses same param structure

---

## Default Cache Policy

### Global Defaults

Applied to all queries unless overridden:

```typescript
{
  staleTime: 5 * 60 * 1000,        // 5 minutes
  gcTime: 10 * 60 * 1000,          // 10 minutes
  refetchOnWindowFocus: false,      // No refetch on tab focus
  refetchOnReconnect: true,         // Refetch on network reconnect
  refetchOnMount: false,            // No refetch on component mount (use cache)
  retry: 1,                         // Retry once on failure
}
```

### Per-Resource Overrides

#### Profile
- `staleTime: 10 * 60 * 1000` (10 minutes)
- `refetchOnMount: false`
- **Rationale:** Profile changes infrequently, stable for session

#### Roles
- `staleTime: 15 * 60 * 1000` (15 minutes)
- `refetchOnMount: false`
- **Rationale:** Roles change very infrequently

#### Access Request Status
- `staleTime: 10 * 60 * 1000` (10 minutes)
- `refetchOnMount: false`
- **Rationale:** Status changes only when request is approved/denied

#### Wallet
- `staleTime: 30 * 1000` to `60 * 1000` (30-60 seconds)
- `refetchInterval: 60 * 1000` when visible (optional)
- `refetchOnMount: false`
- **Rationale:** Balance updates frequently, but not on every navigation

#### Worlds, Stories, Characters (Lists)
- `staleTime: 5 * 60 * 1000` to `10 * 60 * 1000` (5-10 minutes)
- `keepPreviousData: true`
- `refetchOnMount: false`
- **Rationale:** Lists change infrequently, keepPreviousData prevents loading flicker

#### Game
- `staleTime: 30 * 1000` to `60 * 1000` (30-60 seconds)
- `refetchOnMount: false`
- **Rationale:** Game state updates during play, but cache prevents unnecessary refetches

#### Latest Turn
- `staleTime: 10 * 1000` to `30 * 1000` (10-30 seconds)
- `refetchOnMount: false`
- **Rationale:** Turns update frequently, but use event invalidation when possible

---

## Rules

### 1. No Direct Network Calls in Components

**Forbidden:**
```typescript
// ❌ BAD - Direct fetch in component
function MyComponent() {
  useEffect(() => {
    fetch('/api/profile').then(...)
  }, [])
}

// ❌ BAD - Direct axios in component
function MyComponent() {
  useEffect(() => {
    axios.get('/api/profile').then(...)
  }, [])
}

// ❌ BAD - Direct Supabase in component
function MyComponent() {
  useEffect(() => {
    supabase.from('profiles').select().then(...)
  }, [])
}
```

**Required:**
```typescript
// ✅ GOOD - Use React Query hook
function MyComponent() {
  const { data: profile } = useProfile()
}
```

### 2. No useEffect(async => ...) Network Calls

**Forbidden:**
```typescript
// ❌ BAD
useEffect(() => {
  async function loadData() {
    const result = await apiFetch('/api/profile')
    setData(result.data)
  }
  loadData()
}, [])
```

**Required:**
```typescript
// ✅ GOOD - Use React Query
const { data } = useProfile()
```

### 3. One Endpoint to One Exported Hook

Each API endpoint should have exactly one exported React Query hook:

```typescript
// ✅ GOOD - Single hook per endpoint
export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => ProfileService.getProfile(),
    // ...
  })
}
```

### 4. List Keys Must Include Object Param

**Forbidden:**
```typescript
// ❌ BAD - Bare string key
queryKey: ['characters']
queryKey: ['worlds']
```

**Required:**
```typescript
// ✅ GOOD - Object param in key
queryKey: ['characters', { worldId: null }]
queryKey: ['worlds', { q: '' }]
```

### 5. Mutations Must Call Fine-Grained Invalidations

**Forbidden:**
```typescript
// ❌ BAD - Too broad
onSuccess: () => {
  queryClient.invalidateQueries() // Invalidates everything
}
```

**Required:**
```typescript
// ✅ GOOD - Specific invalidation
onSuccess: () => {
  invalidateProfile(queryClient)
  // or
  queryClient.invalidateQueries({ queryKey: ['profile'] })
}
```

---

## ESLint Guards

The following rules are enforced via ESLint:

1. **Forbid fetch, axios, supabase imports in `**/*.{tsx,jsx}` files**
   - Allowed only in `src/lib/api.ts` and `src/lib/queries/**`
   - Prevents direct network calls in components

2. **Forbid `useEffect(async` patterns that perform network I/O**
   - Forces use of React Query hooks

3. **Forbid bare string React Query keys for list data**
   - Enforces object param requirement

---

## Migration Notes

When migrating existing code:

1. Replace all `useEffect` network calls with React Query hooks
2. Replace direct `fetch`/`axios`/`supabase` calls with service functions + hooks
3. Consolidate duplicate queries using providers (AccessStatusProvider, WalletProvider)
4. Update query keys to canonical shapes
5. Add Zod validation to all query responses

---

## Endpoints

Prefer these endpoints (from audit):

- `/api/catalog/worlds` - Worlds list
- `/api/catalog/worlds/:idOrSlug` - World detail
- `/api/catalog/stories` - Stories list
- `/api/catalog/stories/:idOrSlug` - Story detail
- `/api/profile` - Profile
- `/api/admin/user/roles` - Admin roles
- `/api/request-access/status` - Access status
- `/api/stones/wallet` - Wallet
- `/api/games` - My adventures
- `/api/games/:gameId` - Game detail
- `/api/games/:gameId/turns/latest` - Latest turn
- `/api/characters` - Characters (with worldId param)

**Deprecated endpoints to remove:**
- `/api/worlds` (legacy)
- `/api/content/worlds` (legacy)
- `/api/stories` (legacy, if unused)

---

## Stories: Single Canonical Key

All stories list queries must use `useStories(params)` from `@/lib/queries` with the canonical key shape:
```typescript
['stories', { worldId: string | null, page: number, filter: string, kind: string | null, ruleset: string | null, tags: string[] | null }]
```

**Invalidations:** Use `invalidateStories(queryClient, params?)` in mutation `onSuccess` blocks. If a mutation creates a new story, also invalidate `['my-adventures']`.

---

## Game/Turns: Event-Driven Invalidation

**Preferred:** Use event-driven invalidation via `subscribeToGameEvents()` when `VITE_EVENTS_ON=true` and backend supports SSE/WebSocket.

**Fallback:** Rely on mutation invalidations. `useLatestTurn()` should not refetch on mount if data is fresh - rely on mutation/event invalidation.

**Mutations:** When submitting a turn/choice:
- Always invalidate: `['turns.latest', gameId]`, `['game', gameId]`
- If stones spent: also invalidate `['wallet']`
- Never use blanket `invalidateQueries()` without queryKey filter

---

**End of Policy**

