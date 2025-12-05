# Frontend Audit: Active vs. Dead Pages

**Date:** 2025-01-XX  
**Phase:** Phase 1.5 - Frontend Dependency Analysis

---

## 1. Active Pages (Referenced in Routers)

### 1.1 Main App Router (`App.tsx`)

#### Public Routes
- ✅ `LandingPage` - `/` (line 19, 93)
- ✅ `AuthPage` - `/auth`, `/auth/signin`, `/auth/signup` (line 47, 94-96)
- ✅ `AuthSuccessPage` - `/auth/success` (line 48, 97)
- ✅ `RequestAccessPage` - `/request-access` (line 49, 98)
- ✅ `SupportPage` - `/support` (line 46, 99)
- ✅ `NotFoundPage` - `*` (catch-all, line 51, 314)

#### Protected Routes (Early Access)
- ✅ `StoriesPage` - `/stories` (line 20, 102-106)
- ✅ `StoryDetailPage` - `/stories/:id` (line 21, 107-111)
- ✅ `StartStoryPage` - `/play/start` (line 22, 112-116)
- ✅ `GamePage` - `/play/:gameStateId` (line 45, 117-121)
- ✅ `CharacterCreatorPageV2` - `/play/create/:storyId` (line 24, 122-126)
- ✅ `CharacterCreationPage` - `/create-character/:storyId` (line 23, 127-131)
- ✅ `PlayerGatewayPage` - `/player-gateway/:storyId` (line 25, 132-136)
- ✅ `WorldsPage` - `/worlds` (line 26, 137-141)
- ✅ `WorldDetailPage` - `/worlds/:slug` (line 29, 142-146)
- ✅ `NPCsPage` - `/npcs` (line 27, 147-151)
- ✅ `NPCDetailPage` - `/npcs/:id` (line 30, 152-156)
- ✅ `RulesetsPage` - `/rulesets` (line 28, 157-161)
- ✅ `RulesetDetailPage` - `/rulesets/:id` (line 31, 162-166)

#### Protected Routes (Auth + Early Access)
- ✅ `ProfilePage` - `/profile` (line 32, 169-175)
- ✅ `MyCreationsDashboard` - `/dashboard/creations/:tab` (line 33, 183-189)
- ✅ `WorldEditor` - `/dashboard/worlds/new`, `/dashboard/worlds/edit/:id` (line 34, 190-203)
- ✅ `WorldManage` - `/dashboard/worlds/:id/manage` (line 35, 204-210)
- ✅ `EntityEditor` - `/dashboard/entities/new`, `/dashboard/entities/edit/:id` (line 36, 211-224)
- ✅ `EntityManage` - `/dashboard/entities/:id/manage` (line 37, 225-231)
- ✅ `StoryStudio` - `/dashboard/stories/:id/studio` (line 39, 232-238)
- ✅ `StoryManage` - `/dashboard/stories/:id/manage` (line 38, 254-260)
- ✅ `PackEditor` - `/dashboard/packs/new`, `/dashboard/packs/edit/:id` (line 40, 261-274)
- ✅ `PackManage` - `/dashboard/packs/:id/manage` (line 41, 275-281)
- ✅ `LoreEditor` - `/dashboard/lore/new`, `/dashboard/lore/edit/:id` (line 42, 282-295)
- ✅ `LoreManage` - `/dashboard/lore/:id/manage` (line 43, 296-302)
- ✅ `CreatorProfileSettings` - `/settings/profile` (line 44, 303-309)

#### Admin Routes (Delegated)
- ✅ `AdminRouteGuard` - `/admin/*` (line 50, 312) - Delegates to `AdminRoutes.tsx`

**Total Active Pages in App.tsx: 33**

### 1.2 Admin Router (`AdminRoutes.tsx`)

#### Admin Pages
- ✅ `AdminHome` - `/admin` (line 10, 44)
- ✅ `EntryPointsAdmin` - `/entry-points` (line 11, 45)
- ✅ `EntryPointEditPage` - `/entry-points/:id` (line 12, 46)
- ✅ `EntryWizardPage` - `/entry-points/wizard/:id` (line 13, 47)
- ✅ `RolesAdmin` - `/roles` (line 17, 59-66)
- ✅ `AccessRequestsAdmin` - `/access-requests` (line 18, 67-74)
- ✅ `TemplatesManager` - `/templates` (line 19, 77-84)
- ✅ `PublishingAdmin` - `/publishing` (line 20, 87-94)
- ✅ `PublishingAudit` - `/publishing/audit` (line 21, 95-102)
- ✅ `ApprovalsPage` - `/media/approvals` (line 22, 115-122)
- ✅ `PublishingWizard` - `/publishing/wizard` (line 23, 105-112)
- ✅ `PublishingWizardPage` - `/publishing-wizard/:entityType/:entityId` (line 25, 49-56)
- ✅ `ChimeraDashboard` - `/chimera/dashboard` (line 26, 125-132)
- ✅ `RulesetTemplatesDashboard` - `/chimera/rulesets` (line 27, 133-140)
- ✅ `RulesetTemplateEditor` - `/chimera/rulesets/new`, `/chimera/rulesets/edit/:id` (line 28, 141-156)
- ✅ `ChimeraWorldsAdmin` - `/chimera/worlds` (line 29, 157-164)
- ✅ `WorldListPage` - `/chimera/worlds/list` (line 30, 165-172)
- ✅ `WorldEditorPage` - `/chimera/worlds/new`, `/chimera/worlds/edit/:id` (line 31, 173-188)
- ✅ `ChimeraEntitiesAdmin` - `/chimera/entities` (line 32, 189-196)
- ✅ `EntityListPage` - `/chimera/entities/list` (line 33, 197-204)
- ✅ `EntityEditorPage` - `/chimera/entities/new`, `/chimera/entities/edit/:id` (line 34, 205-220)
- ✅ `TagManagement` - `/chimera/tags` (line 35, 221-228)

**Total Active Pages in AdminRoutes.tsx: 22**

### 1.3 Legacy Admin Router (`components/admin/AdminRouter.tsx`)

**⚠️ STATUS: ORPHANED** - This router is **NOT** used in the main app.

The `AdminRouter.tsx` file imports pages that don't exist:
- ❌ `PromptAdmin` - `/pages/admin/PromptAdmin.tsx` (NOT FOUND)
- ✅ `TemplatesManager` - Already in `AdminRoutes.tsx`
- ❌ `PromptSnapshots` - `/pages/admin/PromptSnapshots.tsx` (NOT FOUND)
- ❌ `PromptPreview` - `/pages/admin/PromptPreview.tsx` (NOT FOUND)
- ❌ `StorySettings` - `/pages/admin/StorySettings.tsx` (NOT FOUND)
- ❌ `FieldRegistry` - `/pages/admin/FieldRegistry.tsx` (NOT FOUND)
- ❌ `ScenarioGraphEditor` - `/pages/admin/ScenarioGraphEditor.tsx` (NOT FOUND)
- ❌ `PromptBuilder` - `/pages/admin/PromptBuilder.tsx` (NOT FOUND)
- ❌ `Health` - `/pages/admin/Health.tsx` (NOT FOUND)
- ❌ `AuthorDocs` - `/pages/admin/AuthorDocs.tsx` (NOT FOUND)

**Decision:** This router is a **ghost** - it's not imported anywhere in the active routing tree.

---

## 2. Disk Inventory

### 2.1 Pages Directory Structure

```
frontend/src/pages/
├── admin/                    ✅ ACTIVE (22 pages)
│   ├── access-requests/      ✅ ACTIVE
│   ├── chimera/             ✅ ACTIVE
│   ├── entry-points/         ✅ ACTIVE
│   ├── media/               ✅ ACTIVE
│   ├── publishing/          ✅ ACTIVE
│   ├── publishing-wizard/   ✅ ACTIVE
│   ├── roles/               ✅ ACTIVE
│   └── TemplatesManager.tsx  ✅ ACTIVE
├── casting-circle/          ⚠️ NEW (placeholder, not routed)
├── chat/                    ❌ ORPHANED
│   ├── [gameId].tsx         ❌ Empty file
│   └── new.tsx              ❌ Empty file
├── dashboard/               ✅ ACTIVE (13 pages)
│   ├── creations/            ✅ ACTIVE
│   ├── entities/             ✅ ACTIVE
│   ├── lore/                ✅ ACTIVE
│   ├── packs/               ✅ ACTIVE
│   ├── stories/              ✅ ACTIVE
│   └── worlds/               ✅ ACTIVE
├── my/                      ❌ ORPHANED
│   └── __tests__/           ❌ Test file only (no page)
├── player/                   ❌ ORPHANED
│   └── ScenarioPicker.test.tsx ❌ Test file only (no page)
├── publishing/               ✅ ACTIVE (used by AdminRoutes)
│   └── wizard.tsx            ✅ ACTIVE
├── AuthPage.tsx             ✅ ACTIVE
├── AuthSuccessPage.tsx      ✅ ACTIVE
├── GamePage.layer-p1.test.tsx ❌ Test file (orphaned)
├── LandingPage.tsx          ✅ ACTIVE
├── MyAdventuresPage.test.tsx ❌ Test file (orphaned)
├── NotFoundPage.tsx         ✅ ACTIVE
├── npcs/                    ✅ ACTIVE
├── play/                    ✅ ACTIVE
├── ProfilePage.tsx          ✅ ACTIVE
├── RequestAccessPage.tsx    ✅ ACTIVE
├── rulesets/                ✅ ACTIVE
├── settings/                ✅ ACTIVE
├── stories/                 ✅ ACTIVE
├── SupportPage.tsx          ✅ ACTIVE
└── worlds/                  ✅ ACTIVE
```

### 2.2 Mock Directory Structure

```
frontend/src/mock/
├── adventures.json          ⚠️ USED (by mockData.ts)
├── characters.json          ⚠️ USED (by mockData.ts)
├── invite.json              ⚠️ USED (by mockData.ts)
├── limits.json              ⚠️ USED (by mockData.ts)
├── schemas/                 ⚠️ USED (dynamic imports)
│   ├── aetherium.json       ⚠️ USED
│   ├── mystika.json         ⚠️ USED
│   ├── voidreach.json       ⚠️ USED
│   └── whispercross.json    ⚠️ USED
├── wallet.json              ⚠️ USED (by mockData.ts)
└── worlds.json              ⚠️ USED (by mockData.ts)
```

---

## 3. Orphaned Pages (Kill Candidates)

### 3.1 Definitely Orphaned (No Routes, No Imports)

#### `pages/chat/`
- ❌ `chat/[gameId].tsx` - **EMPTY FILE** (0 bytes)
- ❌ `chat/new.tsx` - **EMPTY FILE** (0 bytes)
- **Status:** Not imported anywhere, files are empty
- **Decision:** ✅ **DELETE** - Empty files with no purpose

#### `pages/my/`
- ❌ `my/__tests__/MyStoriesPage.test.tsx` - Test file only
  - Test imports `../stories` which doesn't exist in `pages/my/`
  - **Status:** Test file for non-existent page
- **Decision:** ✅ **DELETE** - Test file for non-existent page

#### `pages/player/`
- ❌ `player/ScenarioPicker.test.tsx` - Test file only
  - Test imports `./ScenarioPicker` which doesn't exist
  - **Status:** Test file for non-existent component
- **Decision:** ✅ **DELETE** - Test file for non-existent component

#### Root-Level Test Files
- ❌ `GamePage.layer-p1.test.tsx` - Layer test file
- ❌ `MyAdventuresPage.test.tsx` - Test for non-existent page
- **Decision:** ⚠️ **REVIEW** - May be used for regression testing

### 3.2 Potentially Orphaned (Check Dependencies)

#### `components/admin/AdminRouter.tsx`
- **Status:** Not imported in `App.tsx` or `AdminRoutes.tsx`
- **Imports:** 10 pages that don't exist on disk
- **Decision:** ✅ **DELETE** - Ghost router, not used

---

## 4. Mock Data Audit

### 4.1 Mock Files Usage

All mock files are imported by `services/mockData.ts`:

```typescript
// services/mockData.ts imports:
import worldsData from '../mock/worlds.json';
import adventuresData from '../mock/adventures.json';
import charactersData from '../mock/characters.json';
import walletData from '../mock/wallet.json';
import limitsData from '../mock/limits.json';
import inviteData from '../mock/invite.json';
// Dynamic imports for schemas:
await import(`../mock/schemas/${worldId}.json`);
```

### 4.2 Mock Data Usage Analysis

- ✅ `worlds.json` - Used by `mockData.ts`
- ✅ `adventures.json` - Used by `mockData.ts` (legacy, but still imported)
- ✅ `characters.json` - Used by `mockData.ts`
- ✅ `wallet.json` - Used by `mockData.ts` (legacy stone system)
- ✅ `limits.json` - Used by `mockData.ts`
- ✅ `invite.json` - Used by `mockData.ts`
- ✅ `schemas/*.json` - Used by dynamic imports in `mockData.ts` and `CharacterCreator.tsx`

**Decision:** All mock files are actively used. However:
- ⚠️ `adventures.json` - Legacy (should be migrated to stories)
- ⚠️ `wallet.json` - Legacy (stone system removed in Phase 1)

---

## 5. UUID/"Mystika" Error Diagnosis

### 5.1 Error Analysis

**Error:** `invalid input syntax for type uuid: "mystika"`

**Root Cause:** Route parameter mismatch between frontend and backend.

### 5.2 Code Flow

1. **Route Definition** (`App.tsx` line 142):
   ```tsx
   <Route path="/worlds/:slug" element={<WorldDetailPage />} />
   ```
   ✅ Route correctly uses `:slug` parameter

2. **Page Component** (`WorldDetailPage.tsx` line 19):
   ```tsx
   const { slug } = useParams<{ slug: string }>();
   ```
   ✅ Correctly extracts `slug` from route

3. **Query Hook** (`WorldDetailPage.tsx` line 23):
   ```tsx
   const { data: world, isLoading: worldLoading, error: worldError } = useWorld(slug || '');
   ```
   ✅ Passes `slug` to `useWorld` hook

4. **API Call** (`lib/queries/index.ts` line 249):
   ```tsx
   const result = await getWorld(idOrSlug);
   ```
   ✅ Hook calls `getWorld` with slug

5. **API Function** (`lib/api.ts` line 673):
   ```tsx
   export const getWorld = (idOrSlug: ID | string) => httpGet<World>(`/api/catalog/worlds/${idOrSlug}`);
   ```
   ✅ API function constructs URL with slug: `/api/catalog/worlds/mystika`

### 5.3 Backend Issue

**Problem:** The backend endpoint `/api/catalog/worlds/:idOrSlug` is querying by `id` first, which expects a UUID.

**Current Implementation** (`backend/src/routes/catalog.ts` line 179):
```typescript
.or(`id.eq.${idOrSlug},key.eq.${idOrSlug},slug.eq.${idOrSlug}`)
```

**Problem:** The `.or()` clause tries to evaluate ALL conditions, including `id.eq.mystika`. When PostgreSQL tries to compare the UUID `id` column with the string `"mystika"`, it attempts to cast `"mystika"` to UUID, which fails with: `invalid input syntax for type uuid: "mystika"`.

**Expected Behavior:** Backend should:
1. First check if the parameter is a valid UUID format
2. If UUID, query by `id` column only
3. If not a UUID, query by `key` and `slug` columns only (skip `id`)

**File Causing Error:** `backend/src/routes/catalog.ts` line 179

**Fix Required:** Add UUID validation and conditional OR clause:
```typescript
const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
const orClause = isUUID
  ? `id.eq.${idOrSlug}`  // UUID: only check id
  : `key.eq.${idOrSlug},slug.eq.${idOrSlug}`;  // Slug: check key and slug, skip id

const { data, error } = await supabaseAdmin
  .from('chimera_worlds')
  .select('...')
  .or(orClause)
  .or('visibility.eq.public,is_official.eq.true')
  .limit(1)
  .single();
```

### 5.4 Frontend Status

✅ **Frontend is correct** - It's using slugs as intended. The error is in the backend route handler.

---

## 6. Summary & Recommendations

### 6.1 Active Pages: 55 Total
- Main App Router: 33 pages
- Admin Router: 22 pages

### 6.2 Orphaned Pages (Delete Candidates)

#### High Confidence (Safe to Delete)
1. ✅ `pages/chat/[gameId].tsx` - Empty file
2. ✅ `pages/chat/new.tsx` - Empty file
3. ✅ `pages/my/__tests__/MyStoriesPage.test.tsx` - Test for non-existent page
4. ✅ `pages/player/ScenarioPicker.test.tsx` - Test for non-existent component
5. ✅ `components/admin/AdminRouter.tsx` - Ghost router, not used

#### Medium Confidence (Review First)
1. ⚠️ `pages/GamePage.layer-p1.test.tsx` - May be used for regression testing
2. ⚠️ `pages/MyAdventuresPage.test.tsx` - May be used for regression testing

### 6.3 Mock Data Status
- ✅ All mock files are actively used
- ⚠️ `adventures.json` and `wallet.json` are legacy but still imported
- **Action:** Review `mockData.ts` usage in Phase 2

### 6.4 UUID Error Fix
- ✅ Frontend is correct (uses slugs)
- ❌ Backend route needs to handle both UUID and slug formats
- **Action:** Fix backend `/api/catalog/worlds/:idOrSlug` route handler

---

## 7. Action Items

### Immediate (Phase 1.5)
1. ✅ Delete `pages/chat/` directory (empty files)
2. ✅ Delete `pages/my/` directory (test only, no page)
3. ✅ Delete `pages/player/` directory (test only, no component)
4. ✅ Delete `components/admin/AdminRouter.tsx` (ghost router)
5. ⚠️ Review and decide on root-level test files

### Phase 2 (Future)
1. Fix backend `/api/catalog/worlds/:idOrSlug` to handle slugs
2. Review `mockData.ts` usage and remove legacy mock files
3. Migrate `adventures.json` references to stories

---

**End of Frontend Audit**
