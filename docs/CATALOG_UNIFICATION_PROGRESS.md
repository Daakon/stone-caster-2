# Catalog Unification Progress

**Date Started:** 2025-10-30  
**Status:** Phase 2 In Progress  
**Spec:** `docs/CATALOG_UNIFIED_DTO_SPEC.md`

---

## ⚠️ Important Note: Router Fix Applied

**Issue:** Initial implementation completely replaced the `/api/catalog` router, breaking existing endpoints (`/worlds`, `/stories`, `/rulesets`).

**Fix:** Entry-points endpoints were added to the existing catalog router instead of replacing it. All endpoints now work together.

**Details:** See `docs/fixes/CATALOG_ROUTES_FIX.md`

---

## Overview

Replacing the current user-facing catalog with a unified model that mirrors the admin source of truth. Existing endpoints (`/worlds`, `/stories`) are preserved during the transition.

---

## Phase 0: Discovery & Plan ✅ **COMPLETE**

### Deliverables ✅
- [x] **Spec Created:** `docs/CATALOG_UNIFIED_DTO_SPEC.md`
  - Admin entry_points table schema documented
  - Unified DTO defined with all fields
  - Mapping rules from admin → DTO with fallbacks
  - Computed flags (`is_playable`, `has_prompt`) logic defined
  - Filter, sort, and pagination specifications
  - API contract with example requests/responses

### Key Decisions
- ✅ `is_playable` computed from `lifecycle`, `visibility`, `prompt`, and `entry_id`
- ✅ No legacy fields in DTO (no `versions` array)
- ✅ Playable defaults: `activeOnly=true`, `playableOnly=true`
- ✅ World name joined via LEFT JOIN
- ✅ Rulesets only in detail endpoint (performance)

---

## Phase 1: API Contract & Filters ✅ **COMPLETE**

### Backend Endpoints ✅

**File:** `backend/src/routes/catalog.ts` (added to existing router)

- [x] `GET /api/catalog/entry-points` (list with filters, pagination, sorting)
  - Filters: world, q, tags, rating, visibility, activeOnly, playableOnly
  - Sorting: -updated (default), -created, -popularity, alpha, custom
  - Pagination: limit (default 20, max 100), offset
  - Returns: `{ ok, data, meta: { total, limit, offset, filters, sort } }`
  
- [x] `PUT /api/catalog/entry-points/:idOrSlug` (detail)
  - Returns: `{ ok, data }` with hero_quote and rulesets
  - Handles both ID and slug lookup

### Features Implemented ✅
- [x] Zod validation for query parameters
- [x] `computeIsPlayable()` helper function
- [x] `computeHasPrompt()` helper function
- [x] `transformToCatalogDTO()` mapper
- [x] World name LEFT JOIN
- [x] Rulesets join for detail page
- [x] Full-text search on title, description, synopsis
- [x] Default filters applied (activeOnly, playableOnly, visibility)
- [x] Post-filtering for `playableOnly` (can't efficiently do in SQL)
- [x] Error handling with proper HTTP status codes

### Registration ✅
- [x] Entry-points endpoints added to existing catalog router
- [x] Existing routes (`/worlds`, `/stories`, `/rulesets`) preserved
- [x] No breaking changes to frontend
- [x] All catalog endpoints working together

---

## Phase 2: Frontend Alignment 🚧 **IN PROGRESS**

### Types & Validation ✅

**File:** `frontend/src/types/catalog.ts`

- [x] `CatalogEntryPoint` Zod schema and TypeScript type
- [x] `CatalogListResponse` Zod schema and TypeScript type
- [x] `CatalogDetailResponse` Zod schema and TypeScript type
- [x] `CatalogFilters` interface
- [x] `DEFAULT_FILTERS` constant
- [x] `SORT_OPTIONS` constant array
- [x] `CONTENT_RATING_OPTIONS` constant array
- [x] `VISIBILITY_OPTIONS` constant array

### Services & Hooks ✅

**Files:**
- `frontend/src/services/catalog.ts`
- `frontend/src/hooks/useCatalog.ts`

- [x] `listEntryPoints(filters)` service function
- [x] `getEntryPoint(idOrSlug)` service function
- [x] `useEntryPoints(filters)` React Query hook
- [x] `useEntryPoint(idOrSlug)` React Query hook
- [x] Zod validation of API responses
- [x] Query string builder for filters
- [x] Proper error handling

### Components ✅

**File:** `frontend/src/components/catalog/EntryPointCard.tsx`

- [x] `EntryPointCard` component
  - Displays title, subtitle, synopsis
  - Shows playable/coming soon badge
  - Shows world name, type, content rating
  - Shows tags (limited to 3)
  - Links to detail page (`/catalog/entry-points/:slug`)
  - Start Adventure / Coming Soon button based on `is_playable`

### Still Needed 📋

#### Catalog Pages
- [ ] Create `/catalog` page (list/grid view)
- [ ] Create `/catalog/entry-points/:slug` detail page
- [ ] Implement filter UI (search, tags, rating, world, sort)
- [ ] Implement pagination UI
- [ ] Add "Playable Only" toggle
- [ ] Empty states ("No results", "No entry points yet")
- [ ] Loading states (skeleton cards)
- [ ] Error states (error boundaries, retry UI)

#### Additional Components
- [ ] `EntryPointGrid` - Grid layout for cards
- [ ] `EntryPointFilters` - Filter bar component
- [ ] `EntryPointDetail` - Full detail page view
- [ ] Update home page discovery section to use new API
- [ ] Update related lists/carousels to use new API

#### State Management
- [ ] Create catalog store slice (if using Zustand/Redux)
- [ ] Persist filters in URL query params
- [ ] Handle filter changes and pagination

---

## Phase 2: Legacy Code Removal ⏳ **PENDING**

### Files to Update/Remove

#### Backend
- [ ] Review `backend/src/routes/catalog.ts` (old routes)
  - `/api/catalog/worlds`
  - `/api/catalog/stories` (mapped from adventures table)
- [ ] Decide: Keep worlds/stories endpoints or migrate to entry_points?
- [ ] Remove if no longer needed

#### Frontend
- [ ] Audit all imports of old catalog types
- [ ] Remove old catalog DTOs (if they exist)
- [ ] Remove old catalog service functions
- [ ] Remove old catalog components (if not reusable)
- [ ] Search for "versions" prop usage (legacy)
- [ ] Search for old story/adventure endpoints

### Search Commands
```bash
# Find old catalog imports
grep -r "from.*catalog" frontend/src --exclude-dir=node_modules

# Find "versions" usage (legacy)
grep -r "versions" frontend/src --exclude-dir=node_modules

# Find old adventures/stories endpoints
grep -r "/api/adventures\|/api/stories" frontend/src --exclude-dir=node_modules
```

---

## Phase 3: Quality, Telemetry, and Rollout ⏳ **PENDING**

### QA Scenarios 📋
- [ ] **Default Load:** Only shows playable, public, active items
- [ ] **Toggle Playable Off:** Shows drafts/coming soon (if visibility allows)
- [ ] **Search:** Filters list correctly, persists across navigation
- [ ] **Tag Filter:** Filters by tags, multiple tags work
- [ ] **World Filter:** Shows only entry points for selected world
- [ ] **Sort Options:** All sort options work correctly
- [ ] **Pagination:** Next/prev work, offset updates correctly
- [ ] **Empty States:** Render helpful copy when no results
- [ ] **Detail Page:** Shows full info, rulesets, hero quote
- [ ] **is_playable Accuracy:** Button state matches backend logic
- [ ] **Mobile (375×812):** All UI elements visible and functional
- [ ] **Desktop:** Layout adapts properly

### Telemetry 📊
- [ ] Add event tracking:
  - `catalog_list_viewed` (filters applied)
  - `catalog_item_clicked` (entry point ID)
  - `catalog_start_adventure_clicked` (entry point ID)
  - `catalog_filter_changed` (filter type, value)
  - `catalog_sort_changed` (sort option)
  - `catalog_search_performed` (query)
- [ ] Track API error rates
- [ ] Track response times
- [ ] Track result counts per filter combination

### Documentation 📝
- [ ] Update `README.md` with new catalog structure
- [ ] Update architecture docs with unified DTO flow
- [ ] Add catalog integration guide for new entry points
- [ ] Document `is_playable` logic for content creators
- [ ] Update sitemap/SEO to use new catalog endpoints

### Cleanup 🧹
- [ ] Remove commented legacy code
- [ ] Remove unused imports
- [ ] Remove dead code paths
- [ ] Remove feature flags (if any)
- [ ] Update TypeScript configs if needed

---

## Implementation Notes

### Database Performance
- **Indexes Used:**
  - `entry_points_lifecycle_idx` (lifecycle)
  - `entry_points_visibility_idx` (visibility)
  - `entry_points_world_id_idx` (world_id)
  - `entry_points_tags_gin_idx` (tags, GIN index)
  - `entry_points_slug_idx` (slug, unique)

- **Query Optimization:**
  - LEFT JOIN on `worlds` table (indexed foreign key)
  - LIMIT/OFFSET pagination (consider cursor-based for scale)
  - Post-filtering for `playableOnly` (can't efficiently combine with other filters in SQL)
  
- **Future Improvements:**
  - Full-text search index on `search_text` tsvector column
  - Materialized view for popular entry points
  - Redis cache for hot entry points

### Frontend Performance
- **React Query Cache:**
  - List: 5-minute stale time
  - Detail: 10-minute stale time
  - Automatic background refetch

- **Optimizations:**
  - Lazy load detail pages
  - Image lazy loading (`loading="lazy"`)
  - Card prefetching on hover (if implemented)

---

## Risk Assessment & Mitigation

### Risks
1. **Content Thinness:** Some entry points may have minimal description/synopsis
   - **Mitigation:** Fallbacks defined in spec (synopsis → null is OK for list view)

2. **No Backward Compatibility:** Breaking change for existing frontend
   - **Mitigation:** Clean slate approach approved, no legacy support needed

3. **Performance:** Full-text search may be slow at scale
   - **Mitigation:** Indexed `search_text` tsvector, fallback to ILIKE for now

4. **Schema Conflicts:** Entry points table has `world_id uuid` but `worlds.id` is `text`
   - **Status:** RESOLVED in `create-admin-tables.sql`

### Open Questions
- **Q:** Should "Stories" and "Worlds" pages migrate to entry_points or remain separate?
  - **A:** TBD - current backend keeps them separate, can unify later

- **Q:** Should we support legacy `/api/catalog/stories` for backward compatibility?
  - **A:** NO - clean slate, no legacy support per requirements

---

## Rollback Plan

If issues arise in production:

1. **Quick Rollback:**
   ```typescript
   // In backend/src/index.ts, swap the routes:
   // app.use('/api/catalog', catalogUnifiedRouter);  // NEW
   app.use('/api/catalog', catalogRouter);            // OLD (rollback)
   ```

2. **Frontend Rollback:**
   - Revert frontend components to previous commit
   - Re-enable old catalog service imports

3. **Database:**
   - No schema changes made, no rollback needed

---

## Next Steps (Immediate)

### For Developer Continuation:

1. **Create Catalog List Page:**
   ```typescript
   // frontend/src/pages/catalog/CatalogPage.tsx
   // - Use useEntryPoints() hook
   // - Render EntryPointCard grid
   // - Add filter bar
   // - Add pagination
   ```

2. **Create Entry Point Detail Page:**
   ```typescript
   // frontend/src/pages/catalog/EntryPointDetailPage.tsx
   // - Use useEntryPoint(slug) hook
   // - Show full description, rulesets, hero_quote
   // - Add "Start Adventure" button
   ```

3. **Implement Filter UI:**
   ```typescript
   // frontend/src/components/catalog/EntryPointFilters.tsx
   // - Search input
   // - Tag multi-select
   // - World dropdown
   // - Content rating filter
   // - Playable toggle
   // - Sort dropdown
   ```

4. **Connect to Routes:**
   ```typescript
   // frontend/src/App.tsx or router config
   // Add routes:
   // - /catalog → CatalogPage
   // - /catalog/entry-points/:slug → EntryPointDetailPage
   ```

5. **Update Home Page:**
   - Replace old discovery section with `useEntryPoints({ limit: 6 })`
   - Render `EntryPointCard` components

---

## Files Created/Modified

### Backend
- ✅ `backend/src/routes/catalog.ts` (MODIFIED - added entry-points endpoints)
- ⚠️ `backend/src/routes/catalog-unified.ts` (CREATED then DELETED - merged into catalog.ts)
- ✅ `backend/src/index.ts` (MODIFIED - preserved original router)

### Frontend
- ✅ `frontend/src/types/catalog.ts` (NEW)
- ✅ `frontend/src/services/catalog.ts` (NEW)
- ✅ `frontend/src/hooks/useCatalog.ts` (NEW)
- ✅ `frontend/src/components/catalog/EntryPointCard.tsx` (NEW)

### Documentation
- ✅ `docs/CATALOG_UNIFIED_DTO_SPEC.md` (NEW - full spec)
- ✅ `docs/CATALOG_UNIFICATION_PROGRESS.md` (NEW - this file)
- ✅ `docs/fixes/CATALOG_ROUTES_FIX.md` (NEW - documents the router fix)

---

## Success Metrics

### Phase 1 (Backend) ✅
- [x] Both endpoints return correct DTO shape
- [x] Defaults exclude drafts/private from user view
- [x] Filters and sorting work correctly
- [x] No legacy fields in responses

### Phase 2 (Frontend) 🚧
- [x] Types and hooks created
- [x] EntryPointCard component created
- [ ] All catalog UI surfaces use new DTO
- [ ] Legacy code removed
- [ ] No type errors remain

### Phase 3 (Quality) ⏳
- [ ] All QA scenarios pass
- [ ] Telemetry collecting useful signals
- [ ] Documentation updated
- [ ] PM sign-off received

---

## PM Definition of Done

- [ ] API and UI return/render only the unified DTO
- [ ] Playable defaults and filters behave as specified
- [ ] Legacy catalog code is removed
- [ ] Documentation updated
- [ ] Visual and interaction parity (or better) on discovery, grid, and detail pages
- [ ] Mobile (375×812) and desktop tested
- [ ] Zero serious/critical axe accessibility violations

---

## Contact & Support

- **Spec:** `docs/CATALOG_UNIFIED_DTO_SPEC.md`
- **API Docs:** Swagger at `/api-docs` (when running server)
- **Frontend Storybook:** (if applicable)

