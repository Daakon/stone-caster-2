# Legacy Dependency Audit Report

**Generated:** 2024-12-19  
**Purpose:** Map all legacy/non-Chimera admin features for safe removal  
**Status:** Analysis Complete - Ready for Review

---

## Executive Summary

This audit identifies **8 legacy features** in the Admin Panel that are candidates for removal. All features are currently accessible through the Admin Navigation sidebar (`AdminNav.tsx`) and have corresponding route definitions in `AdminRoutes.tsx`.

**Key Findings:**
- **7 features** are actively routed and accessible
- **5 AWF admin pages** exist but are **NOT routed** (orphaned code)
- Most legacy features use **Supabase direct queries** (no backend API routes)
- **2 features** use backend API endpoints that may need cleanup

---

## Legacy Features Audit

### 1. Analytics Dashboard

| Property | Value |
|----------|-------|
| **Feature Name** | Analytics |
| **UI Component** | `frontend/src/admin/components/AdminNav.tsx` (lines 63-67) |
| **Route Definition** | `frontend/src/admin/AdminRoutes.tsx` (lines 155-161) |
| **Page Component** | `frontend/src/pages/admin/analytics/index.tsx` |
| **Backend Endpoint** | **None** - Uses Supabase direct queries via `AdminAnalyticsService` |
| **Service File** | `frontend/src/services/admin.analytics.ts` |
| **Database Tables** | `entry_points`, `content_reviews`, `games`, `turns`, `v_daily_submissions`, `v_daily_approvals`, `v_daily_active_public`, `v_daily_games_started`, `v_daily_tokens_used` |
| **Status** | ✅ **Candidate for Deletion** |

**Details:**
- Displays overview cards (active entries, pending reviews, review SLA, games started, tokens used)
- Shows daily trends charts
- Uses Supabase RPC function `get_review_sla_30d`
- References legacy tables: `entry_points`, `content_reviews`, `games`, `turns`

---

### 2. Reports Queue

| Property | Value |
|----------|-------|
| **Feature Name** | Reports |
| **UI Component** | `frontend/src/admin/components/AdminNav.tsx` (lines 57-61) |
| **Route Definition** | `frontend/src/admin/AdminRoutes.tsx` (lines 139-153) |
| **Page Component** | `frontend/src/pages/admin/reports/index.tsx`<br>`frontend/src/pages/admin/reports/id.tsx` |
| **Backend Endpoint** | **None** - Uses Supabase direct queries via `AdminReportsService` |
| **Service File** | `frontend/src/services/admin.reports.ts` |
| **Database Tables** | `content_reports` |
| **Status** | ✅ **Candidate for Deletion** |

**Details:**
- Lists content reports with filtering (state, target type, date range)
- Supports bulk resolve operations
- Uses legacy `content_reports` table
- References legacy target types: `entry_point`, `prompt_segment`, `npc`, `turn`

---

### 3. Content Reviews

| Property | Value |
|----------|-------|
| **Feature Name** | Reviews |
| **UI Component** | `frontend/src/admin/components/AdminNav.tsx` (lines 51-55) |
| **Route Definition** | `frontend/src/admin/AdminRoutes.tsx` (lines 130-137) |
| **Page Component** | `frontend/src/pages/admin/reviews/index.tsx`<br>`frontend/src/pages/admin/reviews/id.tsx` |
| **Backend Endpoint** | **None** - Uses Supabase direct queries via `ReviewsService` |
| **Service File** | `frontend/src/services/admin.reviews.ts` |
| **Database Tables** | `content_reviews`, `review_actions`, `entry_points`, `prompt_segments`, `npcs` |
| **Status** | ✅ **Candidate for Deletion** |

**Details:**
- Moderation queue for content reviews
- Supports review assignment, state transitions (open → approved/rejected/changes_requested)
- Uses legacy tables: `content_reviews`, `review_actions`
- References legacy target types: `entry_point`, `prompt_segment`, `npc`

---

### 4. Role Management

| Property | Value |
|----------|-------|
| **Feature Name** | Roles |
| **UI Component** | `frontend/src/admin/components/AdminNav.tsx` (lines 69-73) |
| **Route Definition** | `frontend/src/admin/AdminRoutes.tsx` (lines 164-171) |
| **Page Component** | `frontend/src/pages/admin/roles/index.tsx` |
| **Backend Endpoint** | `/api/admin/user/roles` (used by route guard, not this page) |
| **Service File** | `frontend/src/services/admin.roles.ts` |
| **Database Tables** | `app_roles` |
| **Status** | ⚠️ **Review Required** - May still be needed for Chimera |

**Details:**
- Manages user roles (creator, moderator, admin)
- Assigns/removes roles from users
- Uses `app_roles` table (may be needed for Chimera access control)
- **Note:** This feature may be required for Chimera admin access, verify before deletion

---

### 5. Import/Export Tools

| Property | Value |
|----------|-------|
| **Feature Name** | Import/Export |
| **UI Component** | `frontend/src/admin/components/AdminNav.tsx` (lines 45-49) |
| **Route Definition** | `frontend/src/admin/AdminRoutes.tsx` (lines 69-75) |
| **Page Component** | `frontend/src/pages/admin/tools/import-export.tsx` |
| **Backend Endpoint** | **None** - Uses Supabase direct queries via `ExportService` and `ImportService` |
| **Service Files** | `frontend/src/services/admin.export.ts`<br>`frontend/src/services/admin.import.ts` |
| **Database Tables** | Uses admin services for `worlds`, `rulesets`, `npcs`, `npc_packs`, `entry_points` |
| **Status** | ✅ **Candidate for Deletion** |

**Details:**
- Exports entities (worlds, rulesets, NPCs, NPC packs, entries) as JSON
- Imports entities from JSON with validation
- Uses legacy admin services (`admin.worlds`, `admin.rulesets`, `admin.npcs`, `admin.entryPoints`)
- References legacy entity types

---

### 6. Early Access Requests

| Property | Value |
|----------|-------|
| **Feature Name** | Early Access Requests |
| **UI Component** | `frontend/src/admin/components/AdminNav.tsx` (lines 75-79) |
| **Route Definition** | `frontend/src/admin/AdminRoutes.tsx` (lines 173-179) |
| **Page Component** | `frontend/src/pages/admin/access-requests/index.tsx` |
| **Backend Endpoint** | `/api/admin/access-requests`<br>`/api/admin/access-requests/:id/approve`<br>`/api/admin/access-requests/:id/deny` |
| **Service File** | `frontend/src/services/admin.accessRequests.ts` |
| **Database Tables** | `early_access_requests` (inferred) |
| **Status** | ⚠️ **Review Required** - May still be needed for Early Access program |

**Details:**
- Manages early access requests from users
- Approves/denies requests with notes
- Uses backend API endpoints (not Supabase direct)
- **Note:** Verify if Early Access program is still active before deletion

---

### 7. Image Approvals (Media Approvals)

| Property | Value |
|----------|-------|
| **Feature Name** | Image Approvals |
| **UI Component** | `frontend/src/admin/components/AdminNav.tsx` (lines 81-86) |
| **Route Definition** | `frontend/src/admin/AdminRoutes.tsx` (lines 220-227) |
| **Page Component** | `frontend/src/pages/admin/media/ApprovalsPage.tsx` |
| **Backend Endpoint** | `/api/media/pending`<br>`/api/media/:id/approve`<br>`/api/media/approve-bulk` |
| **Service File** | `frontend/src/services/admin.media.ts` |
| **Database Tables** | `media_assets` (inferred) |
| **Status** | ⚠️ **Review Required** - Feature flag controlled, may be needed |

**Details:**
- Reviews and approves pending image uploads
- Supports bulk approval/rejection
- Feature flag: `VITE_FF_ADMIN_MEDIA`
- Uses backend API endpoints
- **Note:** Check if media approval workflow is still needed for Chimera

---

### 8. Legacy "Stories" (Old Adventures)

| Property | Value |
|----------|-------|
| **Feature Name** | Stories (Legacy) |
| **UI Component** | `frontend/src/components/layout/AdminLayout.tsx` (line 119) - **ORPHANED LINK** |
| **Route Definition** | **NOT FOUND** - Link exists but route doesn't exist in `AdminRoutes.tsx` |
| **Page Component** | **N/A** - Route doesn't exist |
| **Backend Endpoint** | **N/A** |
| **Status** | ✅ **Broken Link - Safe to Remove** |

**Details:**
- Link in `AdminLayout.tsx` header navigation points to `/admin/stories`
- No corresponding route in `AdminRoutes.tsx`
- **Note:** This appears to be a broken link. The actual "Stories" route is `/admin/entry-points` (which is Chimera-compatible)

---

## Orphaned AWF Admin Pages (Not Routed)

The following AWF admin pages exist but are **NOT** referenced in any route configuration:

| File | Status |
|------|--------|
| `frontend/src/pages/admin/AwfAdventuresAdmin.tsx` | ✅ **Orphaned - Safe to Delete** |
| `frontend/src/pages/admin/AwfAdventureStartsAdmin.tsx` | ✅ **Orphaned - Safe to Delete** |
| `frontend/src/pages/admin/AwfCoreContractsAdmin.tsx` | ✅ **Orphaned - Safe to Delete** |
| `frontend/src/pages/admin/AwfRulesetsAdmin.tsx` | ✅ **Orphaned - Safe to Delete** |
| `frontend/src/pages/admin/AwfWorldsAdmin.tsx` | ✅ **Orphaned - Safe to Delete** |

**Note:** These files are not imported or referenced anywhere in the routing system. They can be safely deleted.

---

## Backend API Endpoints to Review

The following backend API endpoints are used by legacy features and should be reviewed for removal:

### Early Access Requests
- `GET /api/admin/access-requests`
- `POST /api/admin/access-requests/:id/approve`
- `POST /api/admin/access-requests/:id/deny`

### Media Approvals
- `GET /api/media/pending`
- `POST /api/media/:id/approve`
- `POST /api/media/approve-bulk`

### Role Management (May Still Be Needed)
- `GET /api/admin/user/roles` - **Used by AdminRouteGuard, verify if still needed**

---

## Database Tables Referenced

The following database tables are referenced by legacy features:

### Definitely Legacy (Safe to Remove)
- `content_reports` - Used by Reports feature
- `content_reviews` - Used by Reviews feature
- `review_actions` - Used by Reviews feature
- `entry_points` - Legacy table (Chimera uses `compiled_stories`)
- `prompt_segments` - Legacy table
- `games` - Legacy table (Chimera uses `chimera_game_states`)
- `turns` - Legacy table
- `v_daily_submissions` - View used by Analytics
- `v_daily_approvals` - View used by Analytics
- `v_daily_active_public` - View used by Analytics
- `v_daily_games_started` - View used by Analytics
- `v_daily_tokens_used` - View used by Analytics

### Review Required
- `app_roles` - Used by Roles feature (may be needed for Chimera access control)
- `early_access_requests` - Used by Early Access Requests (verify if program is active)
- `media_assets` - Used by Image Approvals (verify if workflow is needed)

---

## Removal Priority

### Phase 1: Safe Deletions (No Dependencies)
1. ✅ **Orphaned AWF Admin Pages** (5 files)
2. ✅ **Broken "Stories" Link** in `AdminLayout.tsx`

### Phase 2: Low-Risk Deletions (Supabase Direct Queries Only)
3. ✅ **Analytics Dashboard** - No backend API, uses legacy tables
4. ✅ **Reports Queue** - No backend API, uses legacy tables
5. ✅ **Content Reviews** - No backend API, uses legacy tables
6. ✅ **Import/Export Tools** - No backend API, uses legacy admin services

### Phase 3: Review Required (Backend APIs or Active Features)
7. ⚠️ **Early Access Requests** - Verify if program is still active
8. ⚠️ **Image Approvals** - Feature flag controlled, verify if needed
9. ⚠️ **Role Management** - May be needed for Chimera access control

---

## Files to Delete (After Review)

### Frontend Components
- `frontend/src/pages/admin/analytics/index.tsx`
- `frontend/src/pages/admin/reports/index.tsx`
- `frontend/src/pages/admin/reports/id.tsx`
- `frontend/src/pages/admin/reviews/index.tsx`
- `frontend/src/pages/admin/reviews/id.tsx`
- `frontend/src/pages/admin/roles/index.tsx` (⚠️ Review first)
- `frontend/src/pages/admin/tools/import-export.tsx`
- `frontend/src/pages/admin/access-requests/index.tsx` (⚠️ Review first)
- `frontend/src/pages/admin/media/ApprovalsPage.tsx` (⚠️ Review first)
- `frontend/src/pages/admin/AwfAdventuresAdmin.tsx`
- `frontend/src/pages/admin/AwfAdventureStartsAdmin.tsx`
- `frontend/src/pages/admin/AwfCoreContractsAdmin.tsx`
- `frontend/src/pages/admin/AwfRulesetsAdmin.tsx`
- `frontend/src/pages/admin/AwfWorldsAdmin.tsx`

### Frontend Services
- `frontend/src/services/admin.analytics.ts`
- `frontend/src/services/admin.reports.ts`
- `frontend/src/services/admin.reviews.ts`
- `frontend/src/services/admin.roles.ts` (⚠️ Review first)
- `frontend/src/services/admin.import.ts`
- `frontend/src/services/admin.export.ts`
- `frontend/src/services/admin.accessRequests.ts` (⚠️ Review first)

### Frontend Components (Media)
- `frontend/src/components/admin/media/ApprovalsTable.tsx` (⚠️ Review first)
- `frontend/src/hooks/usePendingMedia.ts` (⚠️ Review first)

### Route Definitions to Remove
- `frontend/src/admin/AdminRoutes.tsx` - Remove routes for:
  - `/analytics` (lines 155-161)
  - `/reports` (lines 139-153)
  - `/reviews` (lines 130-137)
  - `/roles` (lines 164-171) (⚠️ Review first)
  - `/tools/import-export` (lines 69-75)
  - `/access-requests` (lines 173-179) (⚠️ Review first)
  - `/media/approvals` (lines 220-227) (⚠️ Review first)

### Navigation Items to Remove
- `frontend/src/admin/components/AdminNav.tsx` - Remove nav items:
  - Analytics (lines 63-67)
  - Reports (lines 57-61)
  - Reviews (lines 51-55)
  - Roles (lines 69-73) (⚠️ Review first)
  - Import/Export (lines 45-49)
  - Early Access Requests (lines 75-79) (⚠️ Review first)
  - Image Approvals (lines 81-86) (⚠️ Review first)

### Layout Links to Remove
- `frontend/src/components/layout/AdminLayout.tsx` - Remove broken link:
  - `/admin/stories` link (line 119)

---

## Next Steps

1. **Review Phase 3 items** (Early Access, Image Approvals, Roles) to confirm if they're still needed
2. **Create backup branch** before deletion
3. **Remove Phase 1 items** (orphaned files and broken links)
4. **Remove Phase 2 items** (low-risk deletions)
5. **Update backend** to remove unused API endpoints (after frontend cleanup)
6. **Update database** to drop unused tables/views (after backend cleanup)
7. **Test admin panel** to ensure no broken links or missing features

---

## Notes

- All legacy features use **Supabase direct queries** except Early Access Requests and Image Approvals (which use backend APIs)
- The `AdminRouter.tsx` component appears to be **unused** - routes are actually defined in `AdminRoutes.tsx` and rendered by `AppAdminShell.tsx`
- The `AdminLayout.tsx` component has **broken navigation links** that don't match actual routes
- Most legacy features reference **legacy database tables** that may not exist in Chimera schema

---

**End of Report**

