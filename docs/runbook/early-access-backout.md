# Early Access Backout Runbook

## When to Back Out

Back out Early Access mode immediately if:

- Users are stuck behind gate and cannot access the application
- Supabase outage affecting auth/me endpoints
- Elevated 401/403 error rates or redirect loops
- Cache invalidation issues causing users to wait unnecessarily
- Any critical production issue related to access control

## Immediate Backout Procedure

### Step 1: Flip Flag OFF

#### Cloudflare Worker (Edge)

**Option A: Update wrangler.toml and redeploy**

1. Edit `wrangler.toml`:
   ```toml
   [vars]
   EARLY_ACCESS_MODE = "off"
   ```

2. Deploy:
   ```bash
   npx wrangler deploy --config wrangler.toml
   ```

**Option B: Use Cloudflare Dashboard**

1. Navigate to Workers & Pages → Your Worker
2. Go to Settings → Variables
3. Set `EARLY_ACCESS_MODE` to `off`
4. Save and deploy

#### Server (Fly.io)

**Using Fly CLI:**

```bash
# Set the secret
flyctl secrets set EARLY_ACCESS_MODE=off -a stonecaster-api

# Restart all machines to pick up the change
flyctl machines restart -a stonecaster-api --all

# OR deploy (which will restart)
flyctl deploy -a stonecaster-api
```

**Using PowerShell script:**

```powershell
.\scripts\ea-toggle.ps1 -Mode off -App stonecaster-api
```

### Step 2: Verify Backout

#### Check Flag Status

```bash
# Server flag
curl https://api.stonecaster.ai/api/internal/flags \
  -H "Authorization: Bearer <admin-token>"

# Expected: { ok: true, data: { EARLY_ACCESS_MODE: "off" } }
```

#### Test Anonymous Access

1. **HTML Navigation:**
   ```bash
   curl -I https://stonecaster.ai/play
   # Expected: 200 OK (not 302)
   ```

2. **Protected API:**
   ```bash
   curl https://api.stonecaster.ai/api/games/health
   # Expected: 200 OK (or appropriate response, not 401)
   ```

3. **Browser Test:**
   - Open https://stonecaster.ai/play in incognito mode
   - **Expected**: Page loads normally (no redirect to /request-access)

#### Verify Telemetry

Check Workers Analytics Engine or logs:
- `ea_redirect` should drop to ~0 after turning off
- `ea_block_401/403` should drop accordingly

### Step 3: Monitor

Monitor for 5-10 minutes after backout:
- Error rates should decrease
- User reports of access issues should stop
- Telemetry should show no new EA-related blocks

## Roll-Forward After Fix

Once the issue is resolved:

### Step 1: Restore Flag

#### Cloudflare Worker
```bash
# Update wrangler.toml
[vars]
EARLY_ACCESS_MODE = "on"

# Deploy
npx wrangler deploy --config wrangler.toml
```

#### Server
```bash
flyctl secrets set EARLY_ACCESS_MODE=on -a stonecaster-api
flyctl machines restart -a stonecaster-api --all
```

Or use script:
```powershell
.\scripts\ea-toggle.ps1 -Mode on -App stonecaster-api
```

### Step 2: Smoke Test

Run the quick smoke test checklist (see below).

## Smoke Test Checklist (Quick 5)

After restoring Early Access mode, verify:

- [ ] **Anon HTML nav** → `/play` → 302 redirect to `/request-access` (EA=on)
- [ ] **Pending API** → `GET /api/games/health` with pending token → 403 (EA=on)
- [ ] **Early Access API** → `GET /api/games/health` with EA token → 200 (EA=on)
- [ ] **Catalog API** → `GET /api/catalog/npcs` (anon) → 200 (both modes)
- [ ] **/api/me headers** → Response includes `x-role` & `x-role-version` headers

### Quick Verification Script

```bash
# Test 1: Anonymous redirect
curl -I https://stonecaster.ai/play | grep -i location
# Expected: Location: /request-access

# Test 2: Pending user API
curl https://api.stonecaster.ai/api/games/health \
  -H "Authorization: Bearer <pending-token>" \
  -w "\nHTTP Status: %{http_code}\n"
# Expected: HTTP Status: 403

# Test 3: Early access user API
curl https://api.stonecaster.ai/api/games/health \
  -H "Authorization: Bearer <ea-token>" \
  -w "\nHTTP Status: %{http_code}\n"
# Expected: HTTP Status: 200

# Test 4: Catalog (public)
curl https://api.stonecaster.ai/api/catalog/npcs \
  -w "\nHTTP Status: %{http_code}\n"
# Expected: HTTP Status: 200

# Test 5: /api/me headers
curl -I https://api.stonecaster.ai/api/me \
  -H "Authorization: Bearer <token>" | grep -i "x-role"
# Expected: x-role: early_access (or pending)
# Expected: x-role-version: <number>
```

## Troubleshooting Fast

### Issue: Users still seeing redirects after flag turned off

**Check:**
1. Worker cache may be stale - wait 30-60s for KV cache to expire
2. Verify flag is actually off: `curl /api/internal/flags`
3. Check Cloudflare dashboard for Worker variable value
4. Clear browser cache/cookies

### Issue: /api/me unreachable from Worker

**Check:**
1. Verify `API_BASE_URL` in `wrangler.toml` is correct
2. Test Worker → API connectivity:
   ```bash
   curl https://api.stonecaster.ai/api/health
   ```
3. Check Worker logs for `me_error` events
4. Verify API server is running: `flyctl status -a stonecaster-api`

### Issue: KV namespace not configured

**Check:**
1. Verify `ROLE_CACHE` binding in `wrangler.toml`:
   ```toml
   [[kv_namespaces]]
   binding = "ROLE_CACHE"
   id = "role_cache_prod"
   ```
2. Check KV namespace exists in Cloudflare dashboard
3. Verify namespace IDs match between config and dashboard

### Issue: Role version not incrementing

**Check:**
1. Verify migration ran:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'profiles' AND column_name = 'role_version';
   ```
2. Check approval flow increments `role_version`:
   ```sql
   SELECT role, role_version FROM public.profiles WHERE id = '<user_id>';
   ```
3. Verify `/api/me` returns `roleVersion`:
   ```bash
   curl https://api.stonecaster.ai/api/me \
     -H "Authorization: Bearer <token>" | jq '.data.user.roleVersion'
   ```

### Issue: Telemetry not showing events

**Check:**
1. Verify Analytics Engine or LOG binding configured
2. Check Worker has permission to write to analytics
3. Review Worker logs for telemetry errors
4. Verify `track()` function is being called (add console.log temporarily)

## Emergency Contacts

- **On-Call Engineer**: [Add contact]
- **DevOps Lead**: [Add contact]
- **Product Owner**: [Add contact]

## Post-Mortem Template

After backout, document:

1. **What happened**: Brief description
2. **When**: Timestamp of issue
3. **Impact**: Users affected, error rates
4. **Root cause**: Why EA mode caused issue
5. **Resolution**: How backout fixed it
6. **Follow-up**: What needs to be fixed before roll-forward

## Prevention

To avoid needing backout:

- Monitor telemetry metrics proactively
- Set up alerts for high `ea_redirect` or `me_error` rates
- Test EA mode in staging before production
- Have rollback plan documented and tested
- Keep flag toggle scripts up-to-date

