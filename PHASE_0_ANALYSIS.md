# Phase 0 Analysis: Site-Wide Inventory

**Date:** 2025-01-XX  
**Purpose:** Establish complete baseline of `frontend` and `backend` structure to identify "Ghost" directories, legacy leftovers, and valid integration points for the Chimera system.

---

## 1. Frontend Territory Map

### 1.1 Pages Directory Structure (`frontend/src/pages/`)

#### **Admin Pages** (`pages/admin/`)
- ✅ **`admin/chimera/`** - **VALID Chimera V3 Admin Tools**
  - `Dashboard.tsx` - Chimera admin dashboard
  - `entities/` - Entity editor/list pages
  - `rulesets/` - Ruleset editor/list pages
  - `tags/` - Tag management
  - `worlds/` - World editor/list pages
- ⚠️ **`admin/entry-points/`** - **REVIEW NEEDED**
  - `index.tsx`, `id.tsx`, `wizard/[id].tsx`
  - May be legacy AWF entry points or valid Chimera entry points
- ⚠️ **`admin/publishing/`** - **REVIEW NEEDED**
  - `audit.tsx`, `index.tsx`
  - Publishing workflow (may be valid or legacy)
- ⚠️ **`admin/publishing-wizard/`** - **REVIEW NEEDED**
  - `[entityType]/[entityId].tsx`
- ✅ **`admin/media/`** - **VALID**
  - `ApprovalsPage.tsx` - Media approval workflow
- ✅ **`admin/access-requests/`** - **VALID**
  - `index.tsx` - Access request management
- ✅ **`admin/roles/`** - **VALID**
  - `index.tsx` - Role management
- ⚠️ **`admin/TemplatesManager.tsx`** - **REVIEW NEEDED**
  - Template management (may be legacy or valid)

#### **Dashboard Pages** (`pages/dashboard/`)
- ✅ **`dashboard/creations/`** - **VALID User Dashboard**
  - `index.tsx` - Main dashboard with tabs
  - `EntitiesTab.tsx`, `LoreTab.tsx`, `PacksTab.tsx`, `StoriesTab.tsx`, `WorldsTab.tsx`
- ✅ **`dashboard/worlds/`** - **VALID**
  - `Editor.tsx`, `Manage.tsx`
- ✅ **`dashboard/entities/`** - **VALID**
  - `Editor.tsx`, `Manage.tsx`
- ✅ **`dashboard/stories/`** - **VALID**
  - `Manage.tsx`, `Studio.tsx`
- ✅ **`dashboard/packs/`** - **VALID**
  - `Editor.tsx`, `Manage.tsx`
- ✅ **`dashboard/lore/`** - **VALID**
  - `Editor.tsx`, `Manage.tsx`

#### **Public/Play Pages**
- ✅ **`play/`** - **VALID**
  - `GamePage.tsx`, `StartStoryPage.tsx`, `CharacterCreationPage.tsx`
  - `create/CharacterCreatorPage.tsx`, `PlayerGatewayPage.tsx`, `GameStatePage.tsx`
- ✅ **`stories/`** - **VALID**
  - `StoriesPage.tsx`, `StoryDetailPage.tsx`
- ✅ **`worlds/`** - **VALID**
  - `WorldsPage.tsx`, `WorldDetailPage.tsx`
- ✅ **`npcs/`** - **VALID**
  - `NPCsPage.tsx`, `NPCDetailPage.tsx`
- ✅ **`rulesets/`** - **VALID**
  - `RulesetsPage.tsx`, `RulesetDetailPage.tsx`
- ⚠️ **`publishing/wizard.tsx`** - **REVIEW NEEDED**
  - Publishing wizard (may be legacy or valid)

#### **Legacy/Dead Pages**
- ❌ **`MyAdventuresPage.test.tsx`** - **LEGACY** (test file referencing "adventures")
- ❌ **`GamePage.layer-p1.test.tsx`** - **TEST FILE** (layer test, may be outdated)

### 1.2 Components Directory Structure (`frontend/src/components/`)

#### **Valid Chimera Components**
- ✅ **`components/chimera/`** - **VALID**
  - 4 `.tsx` files (Chimera-specific components)
- ✅ **`components/casting/`** - **VALID**
  - `CastingWizard.test.tsx`, `RulesetSelector.test.tsx`, `WorldCard.test.tsx`
  - Note: No `casting-circle/` directory found - only `casting/`

#### **Legacy/Review Components**
- ⚠️ **`components/gameplay/StoneLedgerWidget.tsx`** - **LEGACY REFERENCE**
  - References "stone" wallet/ledger system
- ⚠️ **`components/gameplay/StoneCost.tsx`** - **LEGACY REFERENCE**
  - References "stone" cost system
- ⚠️ **`components/gameplay/InsufficientStonesDialog.tsx`** - **LEGACY REFERENCE**
  - References "stone" wallet system
- ⚠️ **`components/redirects/AdventureToStoryRedirect.tsx`** - **LEGACY REDIRECT**
  - Redirects "adventures" to "stories" (legacy cleanup)

#### **Admin Components**
- ✅ **`components/admin/`** - **VALID**
  - Admin-specific components (graph, media, metrics, preview, prompt-authoring, etc.)

### 1.3 Key Findings: Frontend

**✅ VALID Chimera V3 Admin Tools:**
- `pages/admin/chimera/*` - All Chimera admin pages are valid
- `pages/dashboard/*` - All user dashboard pages are valid

**⚠️ REVIEW NEEDED:**
- `pages/admin/entry-points/` - Need to verify if this is legacy AWF or valid Chimera
- `pages/admin/publishing/` - Need to verify if this is legacy or valid workflow
- `pages/admin/TemplatesManager.tsx` - Need to verify if this is legacy or valid

**❌ LEGACY REFERENCES:**
- Multiple components reference "stone" wallet/ledger system (should be removed or migrated)
- `AdventureToStoryRedirect` component exists (legacy cleanup in progress)

**🔍 MISSING:**
- No `casting-circle/` directory found (only `casting/`)
- No `adventures/` pages found (correctly removed)
- No `stones/` pages found (correctly removed)

---

## 2. Backend Service Audit

### 2.1 Services Directory (`backend/src/services/`)

#### **Valid Chimera Services**
- ✅ **`services/compile/`** - **VALID**
  - `compiler.service.ts` - 4-Step Compiler
- ✅ **`services/runtime/`** - **VALID**
  - 5 files - Runtime game loop (MAS1 → Engine → MAS2)
- ✅ **`services/authoring/`** - **VALID**
  - README.md (CRUD logic for Worlds, Lore, Rulesets, Entities)
- ✅ **`services/assets/`** - **VALID**
  - `asset.service.ts`, `asset.service.test.ts` - R2/S3 integrations
- ✅ **`services/chimera/`** - **VALID**
  - `rebuild-service.ts` - Chimera rebuild service
- ✅ **`services/worlds/`** - **VALID**
  - 3 `.ts` files - World authoring services

#### **Legacy Services (Still Present)**
- ⚠️ **`services/wallet.service.ts`** - **LEGACY**
  - References `stone_wallets` table
  - References `StoneLedgerService` (stubbed out, but still called)
  - **727 matches** for "wallet|ledger|stone" in backend/src
- ⚠️ **`services/ledger.service.ts`** - **LEGACY**
  - Stone ledger service (may be stubbed or removed)
- ⚠️ **`services/adventure-*.service.ts`** - **LEGACY**
  - `adventure-input-parser.service.ts`
  - `adventure-start.service.ts`
  - `universal-adventure.service.ts`
- ⚠️ **`services/games.service.ts`** - **REVIEW NEEDED**
  - References `WalletService` for starter stones grant
  - May need migration to Chimera game state system
- ⚠️ **`services/turns.service.ts`** - **REVIEW NEEDED**
  - References `WalletService` for stone spending
  - May need migration to Chimera runtime system

#### **Other Services (Review Needed)**
- ⚠️ **`services/compiler/`** - **DUPLICATE?**
  - `compiler.service.ts`, `compiler.service.test.ts`
  - May be duplicate of `services/compile/compiler.service.ts`
- ⚠️ **`services/player-v3.service.ts`** - **REVIEW NEEDED**
  - Player service (may be legacy or valid)

### 2.2 Routes Directory (`backend/src/routes/`)

#### **Valid Chimera Routes**
- ✅ **`routes/chimera-*.ts`** - **VALID**
  - `chimera-worlds-repo.ts`, `chimera-rulesets-repo.ts`, `chimera-entities-repo.ts`
  - `chimera-lore-repo.ts`, `chimera-assets-repo.ts`
  - `chimera-compile.ts`, `chimera-play.ts`, `chimera-game-init.ts`
  - `chimera-admin-*.ts` - Admin routes for Chimera
- ✅ **`routes/chimera.ts`** - **VALID**
  - Main Chimera router (mounts at `/api/v2/chimera`)

#### **Legacy Routes (Review Needed)**
- ⚠️ **`routes/catalog.ts`**, `routes/catalogNpcs.ts`** - **REVIEW NEEDED**
  - Catalog routes (may be legacy or valid)
- ⚠️ **`routes/worldbuilder.ts`** - **REVIEW NEEDED**
  - World builder route (may be legacy or valid)

#### **System Routes (Valid)**
- ✅ **`routes/auth.ts`** - **VALID**
- ✅ **`routes/me.ts`** - **VALID**
- ✅ **`routes/profile.ts`** - **VALID**
- ✅ **`routes/system.ts`** - **VALID**
- ✅ **`routes/health.ts`** - **VALID**
- ✅ **`routes/accessRequests.*.ts`** - **VALID**

### 2.3 Key Findings: Backend

**✅ VALID Chimera Services:**
- `services/compile/` - 4-Step Compiler
- `services/runtime/` - Game Loop
- `services/authoring/` - CRUD logic
- `services/assets/` - R2/S3 integrations
- `services/chimera/` - Chimera-specific services
- `services/worlds/` - World authoring

**❌ LEGACY SERVICES (Need Removal):**
- `services/wallet.service.ts` - References `stone_wallets` table (727 matches found)
- `services/ledger.service.ts` - Stone ledger (may be stubbed)
- `services/adventure-*.service.ts` - Adventure services (legacy)

**⚠️ REVIEW NEEDED:**
- `services/games.service.ts` - References `WalletService` (may need migration)
- `services/turns.service.ts` - References `WalletService` (may need migration)
- `services/compiler/` vs `services/compile/` - Potential duplicate
- `services/player-v3.service.ts` - May be legacy or valid

**🔍 GREP RESULTS:**
- **727 matches** for "wallet|ledger|stone" in `backend/src`
- Primary locations:
  - `backend/src/services/wallet.service.ts` (main wallet service)
  - `backend/src/services/wallet.service.test.ts` (tests)
  - `backend/src/services/turns.service.ts` (references wallet)
  - `backend/src/services/games.service.ts` (references wallet)

---

## 3. Database Reality Check

### 3.1 Expected Tables (From Migrations)

#### **Chimera V3 Core Tables (KEEP)**
Based on `supabase/migrations/20251204_consolidate_chimera.sql`:
- ✅ `chimera_worlds` - Hybrid Schema (SQL columns + JSONB definition)
- ✅ `chimera_ruleset_templates` - Hybrid Schema
- ✅ `chimera_entities` - Hybrid Schema
- ✅ `chimera_lore` - Vector-enabled RAG table
- ✅ `chimera_game_states` - Runtime persistence

#### **System Tables (KEEP)**
- ✅ `profiles` - User profiles
- ✅ `compiled_stories` - Artifact storage
- ✅ `access_requests` - Access request management
- ✅ `media_assets` - Media asset storage
- ✅ `media_links` - Media link relationships

#### **Legacy Tables (SHOULD BE DROPPED)**
From migration scripts, these should have been dropped:
- ❌ `awf_*` - All AWF analytics/rollup tables
- ❌ `stone_*` - All Stone wallet/ledger/pack tables
- ❌ `mod_*` - All Mod system tables
- ❌ `world_templates` - Legacy world templates
- ❌ `worlds` - Legacy worlds table
- ❌ `adventures` - Legacy adventures table
- ❌ `games` - Legacy games table
- ❌ `sessions` - Legacy sessions table
- ❌ `turns` - Legacy turns table
- ❌ `content_reviews` - Legacy moderation tables
- ❌ `content_reports` - Legacy moderation tables
- ❌ `review_actions` - Legacy moderation tables

#### **Review Tables (NEED VERIFICATION)**
- ⚠️ `entry_points` - May be legacy or valid
- ⚠️ `entry_point_rulesets` - May be legacy or valid
- ⚠️ `npcs` - May be legacy or valid (should be in `chimera_entities`)
- ⚠️ `rulesets` - May be legacy or valid (should be in `chimera_ruleset_templates`)
- ⚠️ `scenarios` - May be legacy or valid
- ⚠️ `templates` - May be legacy or valid
- ⚠️ `prompt_snapshots` - May be legacy or valid

### 3.2 SQL Query for Manual Execution

**To get actual table list, run:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

**To get table counts and sizes:**
```sql
SELECT 
  schemaname,
  relname as table_name,
  n_live_tup as row_count,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) as table_size
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY 
  CASE 
    WHEN relname LIKE 'chimera_%' THEN 1
    WHEN relname IN ('profiles', 'compiled_stories', 'access_requests', 'media_assets', 'media_links') THEN 2
    WHEN relname IN ('entry_points', 'entry_point_rulesets', 'worlds', 'npcs', 'rulesets', 'scenarios') THEN 3
    ELSE 4
  END,
  relname;
```

**Use the audit script:**
```bash
# Run the audit script
psql $DATABASE_URL -f backend/scripts/audit-tables.sql
# Or via Supabase CLI
supabase db execute --file backend/scripts/audit-tables.sql
```

### 3.3 Key Findings: Database

**✅ EXPECTED Chimera Tables:**
- `chimera_worlds`, `chimera_ruleset_templates`, `chimera_entities`, `chimera_lore`, `chimera_game_states`

**❌ LEGACY TABLES (Should be dropped):**
- All `awf_*`, `stone_*`, `mod_*` tables
- `world_templates`, `worlds`, `adventures`, `games`, `sessions`, `turns`
- Legacy moderation tables

**⚠️ REVIEW TABLES:**
- `entry_points`, `entry_point_rulesets`, `npcs`, `rulesets`, `scenarios`, `templates`, `prompt_snapshots`

**🔍 ACTION REQUIRED:**
- **Run the audit script** to get actual table list and row counts
- **Verify** which legacy tables still exist in the database
- **Confirm** which review tables are still in use

---

## 4. Route Integrity Check

### 4.1 Frontend Routes (`frontend/src/App.tsx`)

#### **Public Routes (Valid)**
- ✅ `/` - LandingPage
- ✅ `/auth/*` - AuthPage, AuthSuccessPage
- ✅ `/request-access` - RequestAccessPage
- ✅ `/support` - SupportPage

#### **Protected Routes (Valid)**
- ✅ `/stories`, `/stories/:id` - StoriesPage, StoryDetailPage
- ✅ `/play/*` - GamePage, StartStoryPage, CharacterCreationPage, etc.
- ✅ `/worlds`, `/worlds/:slug` - WorldsPage, WorldDetailPage
- ✅ `/npcs`, `/npcs/:id` - NPCsPage, NPCDetailPage
- ✅ `/rulesets`, `/rulesets/:id` - RulesetsPage, RulesetDetailPage
- ✅ `/profile` - ProfilePage
- ✅ `/dashboard/*` - All dashboard routes (creations, worlds, entities, stories, packs, lore)
- ✅ `/settings/profile` - CreatorProfileSettings

#### **Admin Routes (Valid)**
- ✅ `/admin/*` - AdminRouteGuard (delegates to `AdminRoutes.tsx`)

#### **Legacy Routes (Handled)**
- ✅ `/dashboard/stories/new` - Returns NotFoundPage (old wizard removed)
- ✅ `/dashboard/stories/edit/:id` - Returns NotFoundPage (old wizard removed)
- ✅ `AdventureToStoryRedirect` component - Redirects legacy "adventures" to "stories"

### 4.2 Admin Routes (`frontend/src/admin/AdminRoutes.tsx`)

#### **Valid Admin Routes**
- ✅ `/admin` - AdminHome
- ✅ `/admin/entry-points/*` - EntryPointsAdmin, EntryPointEditPage, EntryWizardPage
- ✅ `/admin/roles` - RolesAdmin
- ✅ `/admin/access-requests` - AccessRequestsAdmin
- ✅ `/admin/templates` - TemplatesManager
- ✅ `/admin/publishing/*` - PublishingAdmin, PublishingAudit
- ✅ `/admin/publishing/wizard` - PublishingWizard
- ✅ `/admin/media/approvals` - ApprovalsPage
- ✅ `/admin/chimera/*` - All Chimera admin routes (dashboard, rulesets, worlds, entities, tags)

#### **Legacy Routes (Removed)**
- ❌ `/admin/npcs` - Removed (PHASE 1.7 comment)
- ❌ `/admin/worlds` - Removed (PHASE 1.7 comment)
- ❌ `/admin/rulesets` - Removed (PHASE 1.7 comment)

### 4.3 Backend Routes (`backend/src/index.ts`)

#### **Valid API Routes**
- ✅ `/api/me` - meRouter
- ✅ `/api/profile` - profileRouter
- ✅ `/api/catalog` - catalogRouter, catalogNpcsRouter
- ✅ `/api/auth` - authRouter
- ✅ `/api/system` - systemRouter
- ✅ `/api/health` - healthRouter
- ✅ `/api/request-access` - accessRequestsPublicRouter
- ✅ `/api/admin/access-requests` - accessRequestsAdminRouter
- ✅ `/api/v2/chimera` - chimeraRouter (main Chimera router)
- ✅ `/api/chimera/*` - All Chimera repo routes (worlds, rulesets, entities, lore, assets, compile, play, game)

#### **Debug Routes (Conditional)**
- ⚠️ `/api/debug` - debugRouter (always enabled)
- ⚠️ `/api/dev/debug` - devDebugRouter (requires DEBUG_ROUTES_ENABLED)
- ⚠️ `/api/dev/test` - devTestRouter (requires DEBUG_ROUTES_ENABLED)
- ⚠️ `/api/admin/preview` - adminPreviewRouter (requires DEBUG_ROUTES_ENABLED)

#### **Removed Routes (Comments)**
- ❌ Publishing Routes - Removed (not in approved functionality)
- ❌ User authoring routes - Removed (replaced by Chimera routes)

### 4.4 Key Findings: Routes

**✅ VALID Routes:**
- All frontend routes in `App.tsx` are valid and point to existing pages
- All admin routes in `AdminRoutes.tsx` are valid
- All backend Chimera routes are valid and properly mounted

**⚠️ REVIEW NEEDED:**
- `/admin/entry-points/*` - Need to verify if this is legacy AWF or valid Chimera
- `/admin/publishing/*` - Need to verify if this is legacy or valid workflow
- `/api/catalog` - Need to verify if this is legacy or valid

**❌ LEGACY Routes (Handled):**
- Old story wizard routes return NotFoundPage (correctly handled)
- Adventure routes redirect to stories (correctly handled)

**🔍 NO ZOMBIE ROUTES FOUND:**
- All routes in `App.tsx` point to existing page files
- All routes in `AdminRoutes.tsx` point to existing page files
- All routes in `backend/src/index.ts` point to existing route files

---

## 5. Summary & Action Items

### 5.1 Clear List of What Should Be Deleted

#### **Frontend Files to Delete:**
1. ❌ `components/gameplay/StoneLedgerWidget.tsx` - Legacy stone wallet reference
2. ❌ `components/gameplay/StoneCost.tsx` - Legacy stone cost reference
3. ❌ `components/gameplay/InsufficientStonesDialog.tsx` - Legacy stone wallet reference
4. ⚠️ `components/redirects/AdventureToStoryRedirect.tsx` - Keep for now (handles legacy redirects)
5. ⚠️ `pages/admin/entry-points/*` - **REVIEW FIRST** (may be valid Chimera entry points)
6. ⚠️ `pages/admin/publishing/*` - **REVIEW FIRST** (may be valid workflow)
7. ⚠️ `pages/admin/TemplatesManager.tsx` - **REVIEW FIRST** (may be valid)

#### **Backend Files to Delete:**
1. ❌ `services/wallet.service.ts` - Legacy stone wallet service (727 matches found)
2. ❌ `services/wallet.service.test.ts` - Legacy wallet tests
3. ❌ `services/ledger.service.ts` - Legacy stone ledger service (if exists)
4. ❌ `services/adventure-input-parser.service.ts` - Legacy adventure service
5. ❌ `services/adventure-start.service.ts` - Legacy adventure service
6. ❌ `services/universal-adventure.service.ts` - Legacy adventure service
7. ⚠️ `services/games.service.ts` - **REVIEW FIRST** (references WalletService, may need migration)
8. ⚠️ `services/turns.service.ts` - **REVIEW FIRST** (references WalletService, may need migration)
9. ⚠️ `services/compiler/` vs `services/compile/` - **REVIEW FIRST** (potential duplicate)

#### **Database Tables to Drop:**
1. ❌ All `awf_*` tables (analytics, rollups, dashboards)
2. ❌ All `stone_*` tables (wallets, ledgers, packs)
3. ❌ All `mod_*` tables (packs, registry, hooks)
4. ❌ `world_templates`, `worlds` (legacy world tables)
5. ❌ `adventures`, `games`, `sessions`, `turns` (legacy runtime tables)
6. ❌ `content_reviews`, `content_reports`, `review_actions` (legacy moderation tables)
7. ⚠️ `entry_points`, `entry_point_rulesets` - **REVIEW FIRST**
8. ⚠️ `npcs`, `rulesets`, `scenarios`, `templates`, `prompt_snapshots` - **REVIEW FIRST**

### 5.2 Which Admin Tools Are Actually Chimera V3

#### **✅ VALID Chimera V3 Admin Tools:**
- `pages/admin/chimera/Dashboard.tsx` - Chimera admin dashboard
- `pages/admin/chimera/entities/*` - Entity editor/list pages
- `pages/admin/chimera/rulesets/*` - Ruleset editor/list pages
- `pages/admin/chimera/tags/*` - Tag management
- `pages/admin/chimera/worlds/*` - World editor/list pages

#### **⚠️ REVIEW NEEDED (May Be Valid or Legacy):**
- `pages/admin/entry-points/*` - Need to verify if this is legacy AWF or valid Chimera entry points
- `pages/admin/publishing/*` - Need to verify if this is legacy or valid publishing workflow
- `pages/admin/TemplatesManager.tsx` - Need to verify if this is legacy or valid template management

#### **✅ VALID System Admin Tools (Not Chimera-Specific):**
- `pages/admin/access-requests/*` - Access request management
- `pages/admin/roles/*` - Role management
- `pages/admin/media/ApprovalsPage.tsx` - Media approval workflow

### 5.3 Validation Checklist

- ✅ **Frontend Territory Map:** Complete
- ✅ **Backend Service Audit:** Complete
- ⚠️ **Database Reality Check:** **ACTION REQUIRED** - Run audit script to get actual table list
- ✅ **Route Integrity Check:** Complete (no zombie routes found)

### 5.4 Next Steps

1. **Run Database Audit:**
   ```bash
   psql $DATABASE_URL -f backend/scripts/audit-tables.sql
   ```
   Or via Supabase CLI:
   ```bash
   supabase db execute --file backend/scripts/audit-tables.sql
   ```

2. **Review Admin Tools:**
   - Verify if `pages/admin/entry-points/*` is legacy AWF or valid Chimera
   - Verify if `pages/admin/publishing/*` is legacy or valid workflow
   - Verify if `pages/admin/TemplatesManager.tsx` is legacy or valid

3. **Remove Legacy Services:**
   - Delete `services/wallet.service.ts` and related files
   - Delete `services/adventure-*.service.ts` files
   - Review and migrate `services/games.service.ts` and `services/turns.service.ts` if needed

4. **Remove Legacy Components:**
   - Delete stone wallet/ledger components after verifying no active usage
   - Review adventure redirect component (may be needed for legacy URLs)

5. **Drop Legacy Database Tables:**
   - After confirming with audit script, drop all legacy tables
   - Verify no active references to legacy tables in codebase

---

## 6. Appendix: File Counts

### Frontend
- **Pages:** ~50+ page files
- **Components:** ~100+ component files
- **Admin Pages:** 15+ admin page files
- **Dashboard Pages:** 10+ dashboard page files

### Backend
- **Services:** ~80+ service files
- **Routes:** ~50+ route files
- **Repos:** 6 repo files (worlds, rulesets, entities, lore, stories, compiled-stories)

### Database
- **Expected Chimera Tables:** 5 core tables
- **Expected System Tables:** 5 system tables
- **Legacy Tables (Should be dropped):** ~20+ tables (per migration scripts)
- **Review Tables:** ~7 tables (need verification)

---

**End of Phase 0 Analysis**
