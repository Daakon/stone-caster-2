# Early Access QA Matrix

**Feature Flag:** `EARLY_ACCESS_MODE = on|off`

## Test Matrix

| Role         | Flag | App HTML nav (/play, etc.) | Protected APIs (/api/games, /turns, …) | Catalog APIs (/api/catalog) | Request-Access UX | Expected Headers/Errors |
|--------------|------|----------------------------|-----------------------------------------|-----------------------------|-------------------|-------------------------|
| anonymous    | on   | 302 → /request-access      | 401 + WWW-Authenticate                  | 200                         | Visible           | 302; 401 {code:UNAUTHORIZED} |
| pending      | on   | 302 → /request-access      | 403 {EARLY_ACCESS_REQUIRED}             | 200                         | Status shown      | 403 + `x-reason: EARLY_ACCESS_REQUIRED` |
| member       | on   | 302 → /request-access      | 403 {EARLY_ACCESS_REQUIRED}             | 200                         | Status shown      | 403 + `x-reason: EARLY_ACCESS_REQUIRED` |
| early_access | on   | 200                         | 200                                     | 200                         | Hidden            | —                       |
| admin        | on   | 200                         | 200                                     | 200                         | Hidden            | —                       |
| anonymous    | off  | 200                         | 200                                     | 200                         | Hidden            | —                       |
| pending      | off  | 200                         | 200                                     | 200                         | Hidden            | —                       |
| member       | off  | 200                         | 200                                     | 200                         | Hidden            | —                       |
| early_access | off  | 200                         | 200                                     | 200                         | Hidden            | —                       |
| admin        | off  | 200                         | 200                                     | 200                         | Hidden            | —                       |

## Public Routes (Always Accessible)

These routes remain accessible regardless of Early Access mode or user role:

- `/` - Homepage
- `/privacy` - Privacy policy
- `/terms` - Terms of service
- `/auth/*` - Authentication routes
- `/request-access` - Request access page
- `/assets/*` - Static assets
- `/api/health` - Health check
- `/api/openapi.json` - OpenAPI specification
- `/api/docs` - Swagger UI documentation
- `/api/catalog/*` - Catalog endpoints (NPCs, worlds, etc.)
- `/api/me` - User identity endpoint
- `/api/config` - Configuration endpoint

## Protected Routes (Gated when EA=on)

These routes require `early_access` or `admin` role when `EARLY_ACCESS_MODE=on`:

- `/api/games/*` - Game endpoints
- `/api/turns/*` - Turn endpoints
- `/api/saves/*` - Save endpoints
- `/api/progress/*` - Progress endpoints
- `/api/story/*` - Story endpoints
- `/api/adventures/*` - Adventure endpoints
- `/api/characters/*` - Character endpoints
- `/api/players-v3/*` - Player endpoints
- `/api/premades/*` - Premade character endpoints
- `/api/stones/*` - Stones/currency endpoints
- `/api/subscription/*` - Subscription endpoints
- `/api/telemetry/*` - Telemetry endpoints

## Expected Response Codes

### 401 Unauthorized
- **When**: Anonymous user attempts to access protected API
- **Headers**: `WWW-Authenticate: Bearer realm="StoneCaster API"`
- **Body**: `{ ok: false, code: 'UNAUTHORIZED', message: 'Sign in required.' }`

### 403 Forbidden
- **When**: Authenticated user with insufficient role (pending/member) attempts to access protected route
- **Headers**: `x-reason: EARLY_ACCESS_REQUIRED`
- **Body**: `{ ok: false, code: 'EARLY_ACCESS_REQUIRED', message: 'Early access approval required.' }`

### 302 Redirect
- **When**: Anonymous or insufficient-role user attempts HTML navigation to protected route
- **Location**: `/request-access`

## Telemetry to Watch

### Worker Metrics
- `ea_redirect` - Count of redirects to `/request-access`
- `role_cache_hit` - Cache hit rate (should be high)
- `role_cache_miss` - Cache miss rate
- `me_error` - `/api/me` fetch failures (with status/reason)

### Server Metrics
- `ea_block_401` - Unauthenticated requests blocked
- `ea_block_403` - Authenticated but insufficient role (pending/member)

## Test Scenarios

### Scenario 1: Anonymous User Navigation (EA=on)
1. Navigate to `/play` without authentication
2. **Expected**: Redirect to `/request-access` (302)
3. **Expected**: Request access page visible

### Scenario 2: Anonymous User API Call (EA=on)
1. Call `GET /api/games/health` without `Authorization` header
2. **Expected**: 401 Unauthorized
3. **Expected**: `WWW-Authenticate` header present
4. **Expected**: Body contains `{ code: 'UNAUTHORIZED' }`

### Scenario 3: Pending User Navigation (EA=on)
1. Sign in as user with `role='pending'`
2. Navigate to `/play`
3. **Expected**: Redirect to `/request-access` (302)
4. **Expected**: Request access page shows pending status

### Scenario 4: Pending User API Call (EA=on)
1. Call `GET /api/games/health` with valid Bearer token for pending user
2. **Expected**: 403 Forbidden
3. **Expected**: `x-reason: EARLY_ACCESS_REQUIRED` header
4. **Expected**: Body contains `{ code: 'EARLY_ACCESS_REQUIRED' }`

### Scenario 5: Early Access User (EA=on)
1. Sign in as user with `role='early_access'`
2. Navigate to `/play`
3. **Expected**: 200 OK, page loads normally
4. Call `GET /api/games/health` with valid Bearer token
5. **Expected**: 200 OK, response body contains game data

### Scenario 6: Admin User (EA=on)
1. Sign in as user with `role='admin'`
2. Navigate to `/play`
3. **Expected**: 200 OK, page loads normally
4. Call `GET /api/games/health` with valid Bearer token
5. **Expected**: 200 OK, response body contains game data

### Scenario 7: Flag Off (EA=off)
1. Set `EARLY_ACCESS_MODE=off`
2. Navigate to `/play` as anonymous user
3. **Expected**: 200 OK, page loads normally
4. Call `GET /api/games/health` without authentication
5. **Expected**: 200 OK (if endpoint allows anonymous, or appropriate auth response)

### Scenario 8: Public Routes Always Accessible
1. With EA=on, navigate to `/api/catalog/npcs` as anonymous
2. **Expected**: 200 OK, catalog data returned
3. Navigate to `/api/health` as anonymous
4. **Expected**: 200 OK, health status returned

## Role Versioning Test

### Test Role Change Immediate Effect
1. User has `role='pending'`, `role_version=1`
2. Navigate to `/play` → Redirect to `/request-access`
3. Update user: `role='early_access'`, `role_version=2`
4. Navigate to `/play` again (same session)
5. **Expected**: 200 OK, page loads (no 30s wait)

## Verification Commands

### Check Flag Status (Server)
```bash
curl https://api.stonecaster.ai/api/internal/flags \
  -H "Authorization: Bearer <admin-token>"
```

### Check User Role
```bash
curl https://api.stonecaster.ai/api/me \
  -H "Authorization: Bearer <user-token>"
```

Expected response includes:
- `data.user.role` - Current role
- `data.user.roleVersion` - Role version number
- Headers: `x-role`, `x-role-version`

### Test Protected Endpoint
```bash
# Anonymous
curl https://api.stonecaster.ai/api/games/health

# With auth
curl https://api.stonecaster.ai/api/games/health \
  -H "Authorization: Bearer <token>"
```

