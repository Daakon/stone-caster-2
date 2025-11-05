# Early Access Runbook

## Overview

Early Access mode gates gameplay routes behind role-based access control. Users must have `early_access` or `admin` role to access protected routes.

## Feature Flag

Control Early Access via environment variable:

- **Worker**: `EARLY_ACCESS_MODE` in `wrangler.toml` or environment
- **Server**: `EARLY_ACCESS_MODE` environment variable

Values:
- `on` - Early Access enforcement active (default)
- `off` - All routes accessible (no gating)

## Role Cache Strategy

### Worker KV Cache

- **TTL**: 24-36 seconds (jittered ±20% from base 30s)
- **Key Format**: `bf:<bearer-fingerprint>:v<roleVersion>`
- **Purpose**: Reduce `/api/me` calls at the edge
- **Location**: Cloudflare KV namespace (`ROLE_CACHE`)

### Server LRU Cache

- **TTL**: 25-35 seconds (randomized)
- **Key Format**: `bf:<bearer-fingerprint>`
- **Purpose**: Reduce database queries for role lookups
- **Location**: In-process memory (per pod/instance)
- **Max Size**: 1000 entries

### Cache Invalidation

Role changes are immediately effective via **role versioning**:

1. `profiles.role_version` column increments on role changes
2. Cache keys include `:v<roleVersion>` when available
3. New role version creates new cache key, bypassing old entries
4. No manual cache invalidation needed

## Role Versioning

The `profiles.role_version` column is a monotonically incrementing integer that changes whenever a user's role is updated.

### Migration

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role_version INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS profiles_role_version_idx ON public.profiles (role_version);
```

### Incrementing on Approval

When promoting a user (e.g., `pending` → `early_access`):

```sql
UPDATE public.profiles
SET role = 'early_access',
    role_version = role_version + 1
WHERE id = <user_id>;
```

Or in application code:

```typescript
await supabaseAdmin
  .from('profiles')
  .update({
    role: 'early_access',
    role_version: supabaseAdmin.rpc('increment', { column: 'role_version' })
  })
  .eq('id', userId);
```

## Promoting a User

### Steps

1. **Update role in database**:
   ```sql
   UPDATE public.profiles
   SET role = 'early_access',
       role_version = role_version + 1
   WHERE id = '<user_id>';
   ```

2. **Verify role_version incremented**:
   ```sql
   SELECT id, role, role_version FROM public.profiles WHERE id = '<user_id>';
   ```

3. **User can navigate immediately** - no 30s wait required

### Why It Works Immediately

- Role version increment changes cache key format
- Old cache entries (with previous `roleVersion`) are no longer matched
- Next request fetches fresh role from `/api/me`
- New cache entry uses updated `roleVersion` in key

## Metrics to Watch

### Worker Metrics

- `ea_redirect` - Count of redirects to `/request-access`
- `role_cache_hit` - Cache hit rate (should be high)
- `role_cache_miss` - Cache miss rate
- `me_error` - `/api/me` fetch failures (with status/reason)

### Server Metrics

- `ea_block_401` - Unauthenticated requests blocked
- `ea_block_403` - Authenticated but insufficient role (pending/member)

### Monitoring

Check Workers Analytics Engine or your LOG sink for these events. High `me_error` rates may indicate:
- API server issues
- Network connectivity problems
- Rate limiting

## Backout Procedure

If Early Access causes issues:

1. **Worker**: Set `EARLY_ACCESS_MODE = "off"` in `wrangler.toml` and redeploy
2. **Server**: Set `EARLY_ACCESS_MODE=off` environment variable and restart

Both systems check the flag first, so disabling bypasses all guards immediately.

## Public Routes

Routes that remain accessible regardless of Early Access mode:

- `/` - Homepage
- `/privacy` - Privacy policy
- `/terms` - Terms of service
- `/request-access` - Request access page
- `/auth/*` - Authentication routes
- `/assets/*` - Static assets
- `/api/health` - Health check
- `/api/openapi.json` - OpenAPI spec
- `/api/docs` - Swagger UI
- `/api/catalog/*` - Catalog endpoints
- `/api/me` - User identity endpoint
- `/api/config` - Configuration endpoint

## Security Notes

- **No token logging**: Telemetry only logs `aud` (auth/anon), `path`, and `reason`
- **Fail-safe defaults**: On errors, default to blocking (pending role)
- **RLS enforcement**: Server-side role checks respect Supabase RLS policies
- **Short cache TTLs**: Keep TTLs short (25-35s) to minimize stale permissions

## Troubleshooting

### User reports they can't access after approval

1. Check `role_version` incremented:
   ```sql
   SELECT role, role_version FROM public.profiles WHERE id = '<user_id>';
   ```

2. Verify `/api/me` returns correct role:
   ```bash
   curl -H "Authorization: Bearer <token>" https://api.stonecaster.ai/api/me
   ```

3. Check cache key format includes `roleVersion`:
   - Worker: `bf:<fingerprint>:v<version>`
   - Server: `bf:<fingerprint>` (version handled in response)

### High cache miss rate

- Check `/api/me` response times
- Verify `role_version` is being returned in `/api/me` responses
- Check for network issues between Worker and API

### False positives (users blocked incorrectly)

1. Verify user's role in database
2. Check `role_version` is being included in cache keys
3. Review server logs for `ea_block_403` events

