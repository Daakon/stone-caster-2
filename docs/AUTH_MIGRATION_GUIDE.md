# Auth Service Migration Guide

**Date:** 2025-12-04  
**Status:** Phase 2 Implementation Complete

## Summary

Phase 2 of the Auth Abstraction has been completed:
- ✅ RLS policies created for all Chimera tables
- ✅ `AuthService` implemented with Supabase abstraction
- ✅ Unified middleware (`auth.unified.ts`) created
- ✅ Key Chimera routes refactored
- ✅ Old middleware files renamed to `.legacy.ts`

## Files Created

1. **`supabase/migrations/20251204_chimera_rls_security.sql`**
   - RLS policies for `chimera_worlds`, `chimera_ruleset_templates`, `chimera_entities`, `chimera_lore`, `compiled_stories`

2. **`backend/src/services/auth/auth.service.ts`**
   - Unified authentication service
   - Abstracts all Supabase auth calls
   - Single source of truth for role checking

3. **`backend/src/middleware/auth.unified.ts`**
   - Replaces: `jwtAuth`, `optionalAuth`, `authenticateToken`, `adminGuard`, `requireAdmin`, `requireRole`
   - Uses `AuthService` for all auth operations
   - Standardized `req.user` context

## Files Refactored

### Chimera Routes (Complete)
- ✅ `backend/src/routes/chimera-worlds.ts`
- ✅ `backend/src/routes/chimera-stories.ts`
- ✅ `backend/src/routes/chimera-entities.ts`
- ✅ `backend/src/routes/chimera-play.ts`
- ✅ `backend/src/routes/chimera-admin-rulesets.ts`
- ✅ `backend/src/routes/chimera-admin-entities.ts`
- ✅ `backend/src/routes/chimera-admin-tags.ts`

### Legacy Middleware (Renamed)
- ✅ `backend/src/middleware/auth.ts` → `auth.legacy.ts`
- ✅ `backend/src/middleware/adminAuth.ts` → `adminAuth.legacy.ts`
- ✅ `backend/src/middleware/auth-admin.ts` → `auth-admin.legacy.ts`
- ✅ `backend/src/middleware/auth-admin-guard.ts` → `auth-admin-guard.legacy.ts`
- ✅ `backend/src/middleware/rbac.ts` → `rbac.legacy.ts`
- ✅ `backend/src/middleware/authGate.ts` → `authGate.legacy.ts`

## Remaining Routes to Migrate

The following routes still need to be updated to use `auth.unified.ts`:

1. `backend/src/routes/admin.ts` - Uses `authenticateToken`, `requireRole`
2. `backend/src/routes/player.ts` - Uses `authenticateToken`
3. `backend/src/routes/chimera-packs.ts` - Uses `authenticateToken`
4. `backend/src/routes/chimera-lore.ts` - Uses `authenticateToken`
5. `backend/src/routes/chimera-game-init.ts` - Uses `authenticateToken`
6. `backend/src/routes/chimera-profile.ts` - Uses `authenticateToken`
7. `backend/src/routes/media.ts` - Uses `authenticateToken`, `isAdmin`
8. `backend/src/routes/publishing.wizard.ts` - Uses `authenticateToken`
9. `backend/src/routes/publishing.public.ts` - Uses `authenticateToken`
10. `backend/src/routes/publishing.admin.ts` - Uses `authenticateToken`, `requireRole`
11. `backend/src/routes/admin-health.ts` - Uses `authenticateToken`, `requireRole`
12. `backend/src/routes/accessRequests.admin.ts` - Uses `adminGuard`
13. `backend/src/routes/me.ts` - Uses `optionalAuth`
14. `backend/src/routes/games.ts` - Uses `optionalAuth`
15. `backend/src/routes/user-authoring.ts` - Uses `authenticateToken`
16. `backend/src/routes/coverMedia.ts` - Uses `authenticateToken`
17. `backend/src/routes/publishingWizard.ts` - Uses `authenticateToken`, `requireAdmin`
18. `backend/src/routes/media.approvals.ts` - Uses `authenticateToken`, `isAdmin`
19. `backend/src/routes/admin-budget.ts` - Uses `authenticateToken`, `requireRole`
20. `backend/src/routes/admin-telemetry.ts` - Uses `authenticateToken`, `requireRole`
21. `backend/src/routes/npcs.ts` - Uses `optionalAuth`, `requireAuth`
22. `backend/src/routes/internalFlags.ts` - Uses `adminGuard`
23. `backend/src/routes/accessRequests.public.ts` - Uses `optionalAuth`
24. `backend/src/routes/players-v3.ts` - Uses `optionalAuth`
25. `backend/src/routes/characters.ts` - Uses `optionalAuth`
26. `backend/src/routes/subscription.ts` - Uses `jwtAuth`, `requireAuth`
27. `backend/src/routes/profile.ts` - Uses `jwtAuth`
28. `backend/src/routes/cookie-linking.ts` - Uses `requireAuth`
29. `backend/src/routes/admin/metrics.ts` - Uses `requireAdmin`

## Migration Pattern

### Pattern 1: Replace `authenticateToken` with `requireAuth`

**Before:**
```typescript
import { authenticateToken } from '../middleware/auth.js';
router.use(authenticateToken);
// or
router.get('/path', authenticateToken, handler);
```

**After:**
```typescript
import { requireAuth } from '../middleware/auth.unified.js';
router.use(requireAuth);
// or
router.get('/path', requireAuth, handler);
```

### Pattern 2: Replace `optionalAuth` with `optionalAuth` (same name, different import)

**Before:**
```typescript
import { optionalAuth } from '../middleware/auth.js';
router.use(optionalAuth);
```

**After:**
```typescript
import { optionalAuth } from '../middleware/auth.unified.js';
router.use(optionalAuth);
```

### Pattern 3: Replace `requireAdmin` / `adminGuard` with `requireAdmin`

**Before:**
```typescript
import { requireAdmin } from '../middleware/adminAuth.js';
// or
import { adminGuard } from '../middleware/auth-admin-guard.js';
router.get('/path', requireAdmin, handler);
// or
router.get('/path', adminGuard, handler);
```

**After:**
```typescript
import { requireAdmin } from '../middleware/auth.unified.js';
router.get('/path', requireAdmin, handler);
```

### Pattern 4: Replace `requireRole` from rbac with `requireRole` from unified

**Before:**
```typescript
import { requireRole } from '../middleware/rbac.js';
const requireAdmin = requireRole('publisher');
router.get('/path', authenticateToken, requireAdmin, handler);
```

**After:**
```typescript
import { requireAuth, requireRole } from '../middleware/auth.unified.js';
const requireAdmin = requireRole(['admin', 'publisher']);
// Note: requireRole already includes auth, so remove authenticateToken
router.get('/path', requireAdmin, handler);
```

### Pattern 5: Replace `isAdmin` helper with `authService.isAdmin()`

**Before:**
```typescript
import { isAdmin } from '../middleware/auth-admin.js';
const admin = await isAdmin(req);
```

**After:**
```typescript
import { authService } from '../services/auth/auth.service.js';
const userId = req.user?.id || req.ctx?.userId;
if (!userId) throw new Error('No user ID');
const admin = await authService.isAdmin(userId);
```

## User Context Access

After migration, routes should access user ID via:

**Preferred (new standard):**
```typescript
const userId = req.user?.id;
```

**Legacy (backward compatibility):**
```typescript
const userId = req.ctx?.userId || req.user?.id;
```

## Testing Checklist

After migrating each route file:

1. ✅ Verify imports are updated
2. ✅ Verify middleware usage is correct
3. ✅ Verify `req.user.id` or `req.ctx.userId` is used (not `req.user?.id` from old pattern)
4. ✅ Test authenticated requests work
5. ✅ Test unauthenticated requests return 401
6. ✅ Test admin-only routes return 403 for non-admins
7. ✅ Test guest users work (for `optionalAuth` routes)

## Next Steps

1. Continue migrating remaining routes (29 files)
2. After all routes migrated, delete `.legacy.ts` files
3. Update any service files that use direct Supabase auth calls
4. Add unit tests for `AuthService`
5. Add integration tests for unified middleware

## Rollback Plan

If issues arise, the legacy middleware files are preserved as `.legacy.ts`. To rollback:

1. Rename `.legacy.ts` files back to original names
2. Revert route imports to use legacy middleware
3. Investigate issues and fix in `AuthService` or unified middleware
4. Re-apply migration

---

**Migration Status:** 7/36 routes complete (19%)  
**Next Priority:** Admin routes (`admin.ts`, `admin-*.ts`)

