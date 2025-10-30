# Catalog Routes Fix

**Date:** 2025-10-30  
**Issue:** Unified catalog implementation broke existing `/api/catalog/worlds`, `/api/catalog/stories`, `/api/catalog/rulesets` endpoints  
**Root Cause:** New unified router completely replaced the existing catalog router

---

## Problem

During the catalog unification effort, I created a new unified catalog router (`catalog-unified.ts`) with entry-points endpoints and **completely replaced** the existing `/api/catalog` route in `backend/src/index.ts`.

This broke all existing catalog endpoints:
- ❌ `/api/catalog/worlds`
- ❌ `/api/catalog/stories`
- ❌ `/api/catalog/rulesets`

The frontend was still using these endpoints, causing errors.

---

## Solution

Instead of replacing the catalog router, I **added the new entry-points endpoints to the existing catalog router**.

### Changes Made

1. **Restored original catalog router** in `backend/src/index.ts`
   - Changed from: `app.use('/api/catalog', catalogUnifiedRouter);`
   - Changed to: `app.use('/api/catalog', catalogRouter);`
   - Removed unused `catalogUnifiedRouter` import

2. **Added entry-points endpoints to `backend/src/routes/catalog.ts`**
   - Added `GET /api/catalog/entry-points` (list)
   - Added `GET /api/catalog/entry-points/:idOrSlug` (detail)
   - Added helper functions:
     - `computeIsPlayable()`
     - `computeHasPrompt()`
     - `transformToCatalogDTO()`
     - `buildSortClause()`
   - Added Zod schemas for query validation

3. **Deleted unused file**
   - Removed `backend/src/routes/catalog-unified.ts`

---

## Result

All catalog endpoints now work:
- ✅ `/api/catalog/worlds` (existing)
- ✅ `/api/catalog/stories` (existing)
- ✅ `/api/catalog/rulesets` (existing - placeholder)
- ✅ `/api/catalog/npcs` (existing - placeholder)
- ✅ `/api/catalog/entry-points` (NEW)
- ✅ `/api/catalog/entry-points/:idOrSlug` (NEW)

---

## Files Modified

- `backend/src/index.ts` - Restored original catalog router
- `backend/src/routes/catalog.ts` - Added entry-points endpoints (lines 233-531)
- `backend/src/routes/catalog-unified.ts` - DELETED (merged into catalog.ts)

---

## Lesson Learned

When adding new endpoints to an existing API:
- ✅ **ADD** to existing router
- ❌ **DON'T REPLACE** existing router (unless explicitly migrating everything)
- ✅ **Test existing endpoints** after changes
- ✅ **Communicate breaking changes** to frontend team

---

## Related Documentation

- `docs/CATALOG_UNIFIED_DTO_SPEC.md` - Full specification
- `docs/CATALOG_UNIFICATION_PROGRESS.md` - Progress tracker

