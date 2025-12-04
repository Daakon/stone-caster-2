# Chimera Auth Abstraction & Legacy Audit Report

**Date:** 2025-12-04  
**Purpose:** Identify conflicting authentication patterns and prepare for unified `AuthService` wrapper

---

## 1. The Conflict: Dual Authentication Patterns

### 1.1 Backend Middleware Conflicts

**Location:** `backend/src/middleware/`

#### Multiple Auth Middleware Files (6 files):
1. **`auth.ts`** - Primary auth middleware with multiple functions:
   - `jwtAuth()` - JWT verification with guest fallback
   - `optionalAuth()` - Allows both authenticated and guest users
   - `authenticateToken()` - Token auth for admin routes
   - `authMiddleware()` - New abstraction-based middleware
   - `verifyJWT()` - Enhanced JWT verification
   - Uses: `req.ctx` and `req.auth` (dual context patterns)

2. **`adminAuth.ts`** - Admin-specific auth:
   - `requireAdmin()` - Checks `user.user_metadata?.role === 'admin'`
   - Uses: `req.ctx` context

3. **`auth-admin.ts`** - Admin helper functions:
   - `isAdmin()` - Checks multiple sources: `profiles.role`, `app_roles.role`, `user_profiles.role`
   - Uses: `supabaseAdmin` client (bypasses RLS)

4. **`auth-admin-guard.ts`** - Universal admin guard:
   - `adminGuard()` - Combines auth + admin check
   - Uses: `req.ctx` context

5. **`rbac.ts`** - Role-based access control:
   - `requireRole()` - Maps legacy roles to new roles
   - Checks: `app_roles`, `profiles`, `user_profiles` (triple fallback)
   - Uses: `req.user.id` (different from `req.ctx.userId`)

6. **`authGate.ts`** - Simple auth gate:
   - `requireAuth()` - Returns `REQUIRES_AUTH` error code
   - Uses: `req.ctx` context

#### Conflict Points:

**A. Context Object Inconsistency:**
- Some middleware sets `req.ctx.userId` (legacy pattern)
- Some middleware sets `req.user.id` (newer pattern)
- Some middleware sets `req.auth.id` (newest abstraction)
- Routes must check multiple locations: `req.ctx?.userId || req.user?.id || req.auth?.id`

**B. Role Checking Inconsistency:**
- `adminAuth.ts` checks `user.user_metadata?.role` (Supabase metadata)
- `auth-admin.ts` checks `profiles.role`, `app_roles.role`, `user_profiles.role` (database tables)
- `rbac.ts` checks `app_roles`, `profiles`, `user_profiles` (triple fallback with mapping)

**C. Supabase Client Usage:**
- Most middleware creates Supabase client: `createClient(config.supabase.url, config.supabase.anonKey)`
- `auth-admin.ts` uses `supabaseAdmin` (service-level client, bypasses RLS)
- Direct calls to `supabase.auth.getUser(token)` scattered across 6 files

**D. Guest User Handling:**
- `jwtAuth()` and `optionalAuth()` support guest cookies
- `authenticateToken()` and `adminGuard()` reject guests
- Inconsistent guest ID handling (cookie vs header)

### 1.2 Frontend Client Conflicts

**Location:** `frontend/src/lib/api.ts`

#### Current Implementation:
- **Line 36-43:** Gets Supabase session token directly:
  ```typescript
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  ```
- **Line 48-51:** Also attaches guest cookie:
  ```typescript
  const guestCookieId = GuestCookieService.getGuestCookieForApi();
  if (guestCookieId) {
    headers.set('X-Guest-Cookie-Id', guestCookieId);
  }
  ```

#### Conflict:
- Frontend directly imports `supabase` from `@/lib/supabase`
- No abstraction layer - direct Supabase client usage
- Guest cookie handling mixed with auth token handling

### 1.3 Database/RLS Policy Status

**Location:** `supabase/migrations/`

#### Findings:
- **No RLS policies found** in migration files for `chimera_worlds` or `chimera_ruleset_templates`
- Tables use `owner_user_id UUID` column (not `auth.uid()`)
- No `CREATE POLICY` statements in any migration file
- **Critical Gap:** Chimera tables have no RLS protection

#### Role Storage Locations:
1. **`app_roles`** table - Multiple roles per user (Phase 5+)
2. **`profiles.role`** - Single role column (Phase 0 legacy)
3. **`user_profiles.role`** - Legacy table (backward compatibility)
4. **`auth.users.user_metadata.role`** - Supabase metadata (inconsistent)

### 1.4 Legacy Code Hunt Results

**Search Terms:** `AWF_ADMIN`, `stone_auth`, `mod_access`

**Result:** No matches found - Legacy AWF auth patterns have been removed.

---

## 2. Proposed AuthService Interface

### 2.1 Service Location
`backend/src/services/auth/auth.service.ts`

### 2.2 TypeScript Interface

```typescript
/**
 * Unified Authentication Service
 * Abstracts Supabase provider behind generic interface
 * 
 * Reference: CHIMERA_ARCHITECTURE_SPEC.md Section 3.1 (Routes -> Service -> Repo)
 */

export interface AuthUser {
  id: string;
  email?: string;
  displayName?: string;
  isGuest: boolean;
  roles: string[];
}

export interface AuthContext {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isGuest: boolean;
}

export interface TokenValidationResult {
  valid: boolean;
  user?: AuthUser;
  error?: string;
}

export interface RoleCheckResult {
  hasRole: boolean;
  roles: string[];
}

export class AuthService {
  /**
   * Validate JWT token from Authorization header
   * @param token - Bearer token (without "Bearer " prefix)
   * @returns Validation result with user data if valid
   */
  async validateToken(token: string): Promise<TokenValidationResult>;

  /**
   * Get user profile by ID
   * @param userId - User UUID
   * @returns User profile with roles
   */
  async getUserProfile(userId: string): Promise<AuthUser | null>;

  /**
   * Check if user has specific permission/role
   * @param userId - User UUID
   * @param requiredRole - Role to check (e.g., 'admin', 'moderator', 'creator')
   * @returns Role check result
   */
  async checkPermission(userId: string, requiredRole: string): Promise<RoleCheckResult>;

  /**
   * Get all roles for a user
   * @param userId - User UUID
   * @returns Array of role names
   */
  async getUserRoles(userId: string): Promise<string[]>;

  /**
   * Check if user is admin (convenience method)
   * @param userId - User UUID
   * @returns true if user has admin role
   */
  async isAdmin(userId: string): Promise<boolean>;

  /**
   * Bootstrap user profile (idempotent)
   * Ensures profile row exists in database
   * @param userId - User UUID
   */
  async bootstrapProfile(userId: string): Promise<void>;

  /**
   * Validate guest cookie
   * @param guestCookieId - Guest cookie UUID
   * @returns User ID if cookie is linked to authenticated user, null if pure guest
   */
  async validateGuestCookie(guestCookieId: string): Promise<string | null>;

  /**
   * Create auth context from request
   * Handles both Bearer tokens and guest cookies
   * @param req - Express request object
   * @returns Auth context
   */
  async getAuthContext(req: Request): Promise<AuthContext>;
}

// Singleton instance
export const authService = new AuthService();
```

### 2.3 Middleware Wrapper Functions

```typescript
/**
 * Unified auth middleware using AuthService
 * Replaces: jwtAuth, optionalAuth, authenticateToken, adminGuard
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void>;

/**
 * Optional auth middleware (allows guests)
 * Replaces: optionalAuth
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void>;

/**
 * Require admin role
 * Replaces: requireAdmin, adminGuard
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void>;

/**
 * Require specific role(s)
 * Replaces: requireRole from rbac.ts
 */
export function requireRole(roles: string | string[]): (req: Request, res: Response, next: NextFunction) => Promise<void>;
```

---

## 3. Migration List

### 3.1 Backend Middleware Files (High Priority)

**Files to Refactor:**
1. `backend/src/middleware/auth.ts` - **DELETE** (replace with unified middleware)
2. `backend/src/middleware/adminAuth.ts` - **DELETE** (replace with `requireAdmin`)
3. `backend/src/middleware/auth-admin.ts` - **REFACTOR** (move `isAdmin` logic to `AuthService`)
4. `backend/src/middleware/auth-admin-guard.ts` - **DELETE** (replace with unified `requireAdmin`)
5. `backend/src/middleware/rbac.ts` - **REFACTOR** (use `AuthService.checkPermission`)
6. `backend/src/middleware/authGate.ts` - **DELETE** (merge into unified middleware)

**New Files to Create:**
1. `backend/src/services/auth/auth.service.ts` - **CREATE** (unified AuthService)
2. `backend/src/middleware/auth.unified.ts` - **CREATE** (unified middleware using AuthService)

### 3.2 Backend Route Files (Medium Priority)

**Files Using Auth Middleware (need import updates):**
1. `backend/src/routes/admin.ts` - Uses `authenticateToken`, `requireAdminRole`, `requireRole`
2. `backend/src/routes/chimera.ts` - Uses various auth middleware
3. `backend/src/routes/games.ts` - Uses `jwtAuth`, `optionalAuth`
4. `backend/src/routes/worlds.ts` - Uses `jwtAuth`, `optionalAuth`
5. `backend/src/routes/characters.ts` - Uses `jwtAuth`, `optionalAuth`
6. All other route files importing from `../middleware/auth`

**Search Pattern:** `import.*from.*middleware/(auth|adminAuth|rbac)`

### 3.3 Frontend Files (Low Priority - Future Phase)

**Files to Refactor:**
1. `frontend/src/lib/api.ts` - **REFACTOR** (extract auth token logic to service)
2. `frontend/src/lib/supabase.ts` - **REVIEW** (ensure proper client initialization)

**New Files to Create:**
1. `frontend/src/services/auth/api-auth.service.ts` - **CREATE** (frontend auth service wrapper)

### 3.4 Database/RLS (Critical - Immediate Action Required)

**Missing RLS Policies:**
1. `chimera_worlds` - **CREATE RLS POLICIES** (no policies found)
2. `chimera_ruleset_templates` - **CREATE RLS POLICIES** (no policies found)
3. `chimera_entities` - **CREATE RLS POLICIES** (verify if missing)

**Migration File to Create:**
1. `supabase/migrations/YYYYMMDD_add_chimera_rls_policies.sql` - **CREATE**

**Proposed RLS Policies:**
```sql
-- Enable RLS on Chimera tables
ALTER TABLE chimera_worlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE chimera_ruleset_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE chimera_entities ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read public worlds
CREATE POLICY "chimera_worlds_select_public"
  ON chimera_worlds FOR SELECT
  USING (visibility = 'public');

-- Policy: Users can read their own worlds
CREATE POLICY "chimera_worlds_select_own"
  ON chimera_worlds FOR SELECT
  USING (owner_user_id = auth.uid());

-- Policy: Users can insert their own worlds
CREATE POLICY "chimera_worlds_insert_own"
  ON chimera_worlds FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

-- Policy: Users can update their own worlds
CREATE POLICY "chimera_worlds_update_own"
  ON chimera_worlds FOR UPDATE
  USING (owner_user_id = auth.uid());

-- Similar policies for chimera_ruleset_templates and chimera_entities
```

### 3.5 Service Files (Medium Priority)

**Files Using Direct Supabase Auth:**
1. `backend/src/services/profileBootstrap.ts` - Uses Supabase client directly
2. `backend/src/services/cookie-user-linking.service.ts` - Uses Supabase client directly
3. Any service file calling `supabase.auth.getUser()` or `supabaseAdmin.from('app_roles')`

**Search Pattern:** `supabase\.auth\.|supabaseAdmin\.from\(`

---

## 4. Implementation Priority

### Phase 1: Critical Security (Immediate)
1. ✅ Create RLS policies for Chimera tables
2. ✅ Create `AuthService` interface and implementation
3. ✅ Create unified middleware

### Phase 2: Backend Consolidation (High Priority)
1. ✅ Refactor all middleware files to use `AuthService`
2. ✅ Update all route files to use unified middleware
3. ✅ Remove duplicate auth logic

### Phase 3: Service Layer (Medium Priority)
1. ✅ Refactor services to use `AuthService` instead of direct Supabase calls
2. ✅ Update `profileBootstrap` and `cookie-user-linking` services

### Phase 4: Frontend Abstraction (Low Priority - Future)
1. ⏳ Create frontend auth service wrapper
2. ⏳ Refactor `api.ts` to use auth service
3. ⏳ Remove direct Supabase client usage from frontend

---

## 5. Key Findings Summary

### 5.1 Critical Issues
1. **No RLS policies** on Chimera tables - **SECURITY RISK**
2. **6 different auth middleware files** with conflicting patterns
3. **3 different context objects** (`req.ctx`, `req.user`, `req.auth`)
4. **4 different role storage locations** (app_roles, profiles, user_profiles, user_metadata)

### 5.2 Architecture Violations
1. Direct Supabase client usage in middleware (should be in service layer)
2. Auth logic in middleware (should be in service layer per Route -> Service -> Repo pattern)
3. Inconsistent error handling across middleware files

### 5.3 Positive Findings
1. ✅ No legacy AWF auth patterns found (clean slate)
2. ✅ Frontend uses centralized `api.ts` for requests
3. ✅ Guest cookie handling is consistent

---

## 6. Next Steps

1. **Create RLS policies** for Chimera tables (immediate security fix)
2. **Implement AuthService** with unified interface
3. **Create unified middleware** using AuthService
4. **Migrate routes** one by one to new middleware
5. **Remove old middleware files** after migration complete
6. **Add tests** for AuthService and unified middleware

---

**Report Generated:** 2025-12-04  
**Next Review:** After AuthService implementation

