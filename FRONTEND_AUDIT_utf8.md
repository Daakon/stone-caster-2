# Frontend Audit: Active vs. Dead Pages

**Date:** 2025-01-XX  
**Phase:** Phase 1.5 - Frontend Dependency Analysis

---

## 1. Active Pages (Referenced in Routers)

### 1.1 Main App Router (`App.tsx`)

#### Public Routes
- Γ£à `LandingPage` - `/` (line 19, 93)
- Γ£à `AuthPage` - `/auth`, `/auth/signin`, `/auth/signup` (line 47, 94-96)
- Γ£à `AuthSuccessPage` - `/auth/success` (line 48, 97)
- Γ£à `RequestAccessPage` - `/request-access` (line 49, 98)
- Γ£à `SupportPage` - `/support` (line 46, 99)
- Γ£à `NotFoundPage` - `*` (catch-all, line 51, 314)

#### Protected Routes (Early Access)
- Γ£à `StoriesPage` - `/stories` (line 20, 102-106)
- Γ£à `StoryDetailPage` - `/stories/:id` (line 21, 107-111)
- Γ£à `StartStoryPage` - `/play/start` (line 22, 112-116)
- Γ£à `GamePage` - `/play/:gameStateId` (line 45, 117-121)
- Γ£à `CharacterCreatorPageV2` - `/play/create/:storyId` (line 24, 122-126)
- Γ£à `CharacterCreationPage` - `/create-character/:storyId` (line 23, 127-131)
- Γ£à `PlayerGatewayPage` - `/player-gateway/:storyId` (line 25, 132-136)
- Γ£à `WorldsPage` - `/worlds` (line 26, 137-141)
- Γ£à `WorldDetailPage` - `/worlds/:slug` (line 29, 142-146)
- Γ£à `NPCsPage` - `/npcs` (line 27, 147-151)
- Γ£à `NPCDetailPage` - `/npcs/:id` (line 30, 152-156)
- Γ£à `RulesetsPage` - `/rulesets` (line 28, 157-161)
- Γ£à `RulesetDetailPage` - `/rulesets/:id` (line 31, 162-166)

#### Protected Routes (Auth + Early Access)
- Γ£à `ProfilePage` - `/profile` (line 32, 169-175)
- Γ£à `MyCreationsDashboard` - `/dashboard/creations/:tab` (line 33, 183-189)
- Γ£à `WorldEditor` - `/dashboard/worlds/new`, `/dashboard/worlds/edit/:id` (line 34, 190-203)
- Γ£à `WorldManage` - `/dashboard/worlds/:id/manage` (line 35, 204-210)
- Γ£à `EntityEditor` - `/dashboard/entities/new`, `/dashboard/entities/edit/:id` (line 36, 211-224)
- Γ£à `EntityManage` - `/dashboard/entities/:id/manage` (line 37, 225-231)
- Γ£à `StoryStudio` - `/dashboard/stories/:id/studio` (line 39, 232-238)
- Γ£à `StoryManage` - `/dashboard/stories/:id/manage` (line 38, 254-260)
- Γ£à `PackEditor` - `/dashboard/packs/new`, `/dashboard/packs/edit/:id` (line 40, 261-274)
- Γ£à `PackManage` - `/dashboard/packs/:id/manage` (line 41, 275-281)
- Γ£à `LoreEditor` - `/dashboard/lore/new`, `/dashboard/lore/edit/:id` (line 42, 282-295)
- Γ£à `LoreManage` - `/dashboard/lore/:id/manage` (line 43, 296-302)
- Γ£à `CreatorProfileSettings` - `/settings/profile` (line 44, 303-309)

#### Admin Routes (Delegated)
- Γ£à `AdminRouteGuard` - `/admin/*` (line 50, 312) - Delegates to `AdminRoutes.tsx`

**Total Active Pages in App.tsx: 33**

### 1.2 Admin Router (`AdminRoutes.tsx`)

#### Admin Pages
- Γ£à `AdminHome` - `/admin` (line 10, 44)
- Γ£à `EntryPointsAdmin` - `/entry-points` (line 11, 45)
- Γ£à `EntryPointEditPage` - `/entry-points/:id` (line 12, 46)
- Γ£à `EntryWizardPage` - `/entry-points/wizard/:id` (line 13, 47)
- Γ£à `RolesAdmin` - `/roles` (line 17, 59-66)
- Γ£à `AccessRequestsAdmin` - `/access-requests` (line 18, 67-74)
- Γ£à `TemplatesManager` - `/templates` (line 19, 77-84)
- Γ£à `PublishingAdmin` - `/publishing` (line 20, 87-94)
- Γ£à `PublishingAudit` - `/publishing/audit` (line 21, 95-102)
- Γ£à `ApprovalsPage` - `/media/approvals` (line 22, 115-122)
- Γ£à `PublishingWizard` - `/publishing/wizard` (line 23, 105-112)
- Γ£à `PublishingWizardPage` - `/publishing-wizard/:entityType/:entityId` (line 25, 49-56)
- Γ£à `ChimeraDashboard` - `/chimera/dashboard` (line 26, 125-132)
- Γ£à `RulesetTemplatesDashboard` - `/chimera/rulesets` (line 27, 133-140)
- Γ£à `RulesetTemplateEditor` - `/chimera/rulesets/new`, `/chimera/rulesets/edit/:id` (line 28, 141-156)
- Γ£à `ChimeraWorldsAdmin` - `/chimera/worlds` (line 29, 157-164)
- Γ£à `WorldListPage` - `/chimera/worlds/list` (line 30, 165-172)
- Γ£à `WorldEditorPage` - `/chimera/worlds/new`, `/chimera/worlds/edit/:id` (line 31, 173-188)
- Γ£à `ChimeraEntitiesAdmin` - `/chimera/entities` (line 32, 189-196)
- Γ£à `EntityListPage` - `/chimera/entities/list` (line 33, 197-204)
- Γ£à `EntityEditorPage` - `/chimera/entities/new`, `/chimera/entities/edit/:id` (line 34, 205-220)
- Γ£à `TagManagement` - `/chimera/tags` (line 35, 221-228)

**Total Active Pages in AdminRoutes.tsx: 22**

### 1.3 Legacy Admin Router (`components/admin/AdminRouter.tsx`)

**ΓÜá∩╕Å STATUS: ORPHANED** - This router is **NOT** used in the main app.

The `AdminRouter.tsx` file imports pages that don't exist:
- Γ¥î `PromptAdmin` - `/pages/admin/PromptAdmin.tsx` (NOT FOUND)
- Γ£à `TemplatesManager` - Already in `AdminRoutes.tsx`
- Γ¥î `PromptSnapshots` - `/pages/admin/PromptSnapshots.tsx` (NOT FOUND)
- Γ¥î `PromptPreview` - `/pages/admin/PromptPreview.tsx` (NOT FOUND)
- Γ¥î `StorySettings` - `/pages/admin/StorySettings.tsx` (NOT FOUND)
- Γ¥î `FieldRegistry` - `/pages/admin/FieldRegistry.tsx` (NOT FOUND)
- Γ¥î `ScenarioGraphEditor` - `/pages/admin/ScenarioGraphEditor.tsx` (NOT FOUND)
- Γ¥î `PromptBuilder` - `/pages/admin/PromptBuilder.tsx` (NOT FOUND)
- Γ¥î `Health` - `/pages/admin/Health.tsx` (NOT FOUND)
- Γ¥î `AuthorDocs` - `/pages/admin/AuthorDocs.tsx` (NOT FOUND)

**Decision:** This router is a **ghost** - it's not imported anywhere in the active routing tree.

---

## 2. Disk Inventory

### 2.1 Pages Directory Structure

```
frontend/src/pages/
Γö£ΓöÇΓöÇ admin/                    Γ£à ACTIVE (22 pages)
Γöé   Γö£ΓöÇΓöÇ access-requests/      Γ£à ACTIVE
Γöé   Γö£ΓöÇΓöÇ chimera/             Γ£à ACTIVE
Γöé   Γö£ΓöÇΓöÇ entry-points/         Γ£à ACTIVE
Γöé   Γö£ΓöÇΓöÇ media/               Γ£à ACTIVE
Γöé   Γö£ΓöÇΓöÇ publishing/          Γ£à ACTIVE
Γöé   Γö£ΓöÇΓöÇ publishing-wizard/   Γ£à ACTIVE
Γöé   Γö£ΓöÇΓöÇ roles/               Γ£à ACTIVE
Γöé   ΓööΓöÇΓöÇ TemplatesManager.tsx  Γ£à ACTIVE
Γö£ΓöÇΓöÇ casting-circle/          ΓÜá∩╕Å NEW (placeholder, not routed)
Γö£ΓöÇΓöÇ chat/                    Γ¥î ORPHANED
Γöé   Γö£ΓöÇΓöÇ [gameId].tsx         Γ¥î Empty file
Γöé   ΓööΓöÇΓöÇ new.tsx              Γ¥î Empty file
Γö£ΓöÇΓöÇ dashboard/               Γ£à ACTIVE (13 pages)
Γöé   Γö£ΓöÇΓöÇ creations/            Γ£à ACTIVE
Γöé   Γö£ΓöÇΓöÇ entities/             Γ£à ACTIVE
Γöé   Γö£ΓöÇΓöÇ lore/                Γ£à ACTIVE
Γöé   Γö£ΓöÇΓöÇ packs/               Γ£à ACTIVE
Γöé   Γö£ΓöÇΓöÇ stories/              Γ£à ACTIVE
Γöé   ΓööΓöÇΓöÇ worlds/               Γ£à ACTIVE
Γö£ΓöÇΓöÇ my/                      Γ¥î ORPHANED
Γöé   ΓööΓöÇΓöÇ __tests__/           Γ¥î Test file only (no page)
Γö£ΓöÇΓöÇ player/                   Γ¥î ORPHANED
Γöé   ΓööΓöÇΓöÇ ScenarioPicker.test.tsx Γ¥î Test file only (no page)
Γö£ΓöÇΓöÇ publishing/               Γ£à ACTIVE (used by AdminRoutes)
Γöé   ΓööΓöÇΓöÇ wizard.tsx            Γ£à ACTIVE
Γö£ΓöÇΓöÇ AuthPage.tsx             Γ£à ACTIVE
Γö£ΓöÇΓöÇ AuthSuccessPage.tsx      Γ£à ACTIVE
Γö£ΓöÇΓöÇ GamePage.layer-p1.test.tsx Γ¥î Test file (orphaned)
Γö£ΓöÇΓöÇ LandingPage.tsx          Γ£à ACTIVE
Γö£ΓöÇΓöÇ MyAdventuresPage.test.tsx Γ¥î Test file (orphaned)
Γö£ΓöÇΓöÇ NotFoundPage.tsx         Γ£à ACTIVE
Γö£ΓöÇΓöÇ npcs/                    Γ£à ACTIVE
Γö£ΓöÇΓöÇ play/                    Γ£à ACTIVE
Γö£ΓöÇΓöÇ ProfilePage.tsx          Γ£à ACTIVE
Γö£ΓöÇΓöÇ RequestAccessPage.tsx    Γ£à ACTIVE
Γö£ΓöÇΓöÇ rulesets/                Γ£à ACTIVE
Γö£ΓöÇΓöÇ settings/                Γ£à ACTIVE
Γö£ΓöÇΓöÇ stories/                 Γ£à ACTIVE
Γö£ΓöÇΓöÇ SupportPage.tsx          Γ£à ACTIVE
ΓööΓöÇΓöÇ worlds/                  Γ£à ACTIVE
```

### 2.2 Mock Directory Structure

```
frontend/src/mock/
Γö£ΓöÇΓöÇ adventures.json          ΓÜá∩╕Å USED (by mockData.ts)
Γö£ΓöÇΓöÇ characters.json          ΓÜá∩╕Å USED (by mockData.ts)
Γö£ΓöÇΓöÇ invite.json              ΓÜá∩╕Å USED (by mockData.ts)
Γö£ΓöÇΓöÇ limits.json              ΓÜá∩╕Å USED (by mockData.ts)
Γö£ΓöÇΓöÇ schemas/                 ΓÜá∩╕Å USED (dynamic imports)
Γöé   Γö£ΓöÇΓöÇ aetherium.json       ΓÜá∩╕Å USED
Γöé   Γö£ΓöÇΓöÇ mystika.json         ΓÜá∩╕Å USED
Γöé   Γö£ΓöÇΓöÇ voidreach.json       ΓÜá∩╕Å USED
Γöé   ΓööΓöÇΓöÇ whispercross.json    ΓÜá∩╕Å USED
Γö£ΓöÇΓöÇ wallet.json              ΓÜá∩╕Å USED (by mockData.ts)
ΓööΓöÇΓöÇ worlds.json              ΓÜá∩╕Å USED (by mockData.ts)
```

---

## 3. Orphaned Pages (Kill Candidates)

### 3.1 Definitely Orphaned (No Routes, No Imports)

#### `pages/chat/`
- Γ¥î `chat/[gameId].tsx` - **EMPTY FILE** (0 bytes)
- Γ¥î `chat/new.tsx` - **EMPTY FILE** (0 bytes)
- **Status:** Not imported anywhere, files are empty
- **Decision:** Γ£à **DELETE** - Empty files with no purpose

#### `pages/my/`
- Γ¥î `my/__tests__/MyStoriesPage.test.tsx` - Test file only
  - Test imports `../stories` which doesn't exist in `pages/my/`
  - **Status:** Test file for non-existent page
- **Decision:** Γ£à **DELETE** - Test file for non-existent page

#### `pages/player/`
- Γ¥î `player/ScenarioPicker.test.tsx` - Test file only
  - Test imports `./ScenarioPicker` which doesn't exist
  - **Status:** Test file for non-existent component
- **Decision:** Γ£à **DELETE** - Test file for non-existent component

#### Root-Level Test Files
- Γ¥î `GamePage.layer-p1.test.tsx` - Layer test file
- Γ¥î `MyAdventuresPage.test.tsx` - Test for non-existent page
- **Decision:** ΓÜá∩╕Å **REVIEW** - May be used for regression testing

### 3.2 Potentially Orphaned (Check Dependencies)

#### `components/admin/AdminRouter.tsx`
- **Status:** Not imported in `App.tsx` or `AdminRoutes.tsx`
- **Imports:** 10 pages that don't exist on disk
- **Decision:** Γ£à **DELETE** - Ghost router, not used

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

- Γ£à `worlds.json` - Used by `mockData.ts`
- Γ£à `adventures.json` - Used by `mockData.ts` (legacy, but still imported)
- Γ£à `characters.json` - Used by `mockData.ts`
- Γ£à `wallet.json` - Used by `mockData.ts` (legacy stone system)
- Γ£à `limits.json` - Used by `mockData.ts`
- Γ£à `invite.json` - Used by `mockData.ts`
- Γ£à `schemas/*.json` - Used by dynamic imports in `mockData.ts` and `CharacterCreator.tsx`

**Decision:** All mock files are actively used. However:
- ΓÜá∩╕Å `adventures.json` - Legacy (should be migrated to stories)
- ΓÜá∩╕Å `wallet.json` - Legacy (stone system removed in Phase 1)

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
   Γ£à Route correctly uses `:slug` parameter

2. **Page Component** (`WorldDetailPage.tsx` line 19):
   ```tsx
   const { slug } = useParams<{ slug: string }>();
   ```
   Γ£à Correctly extracts `slug` from route

3. **Query Hook** (`WorldDetailPage.tsx` line 23):
   ```tsx
   const { data: world, isLoading: worldLoading, error: worldError } = useWorld(slug || '');
   ```
   Γ£à Passes `slug` to `useWorld` hook

4. **API Call** (`lib/queries/index.ts` line 249):
   ```tsx
   const result = await getWorld(idOrSlug);
   ```
   Γ£à Hook calls `getWorld` with slug

5. **API Function** (`lib/api.ts` line 673):
   ```tsx
   export const getWorld = (idOrSlug: ID | string) => httpGet<World>(`/api/catalog/worlds/${idOrSlug}`);
   ```
   Γ£à API function constructs URL with slug: `/api/catalog/worlds/mystika`

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

Γ£à **Frontend is correct** - It's using slugs as intended. The error is in the backend route handler.

---

## 6. Summary & Recommendations

### 6.1 Active Pages: 55 Total
- Main App Router: 33 pages
- Admin Router: 22 pages

### 6.2 Orphaned Pages (Delete Candidates)

#### High Confidence (Safe to Delete)
1. Γ£à `pages/chat/[gameId].tsx` - Empty file
2. Γ£à `pages/chat/new.tsx` - Empty file
3. Γ£à `pages/my/__tests__/MyStoriesPage.test.tsx` - Test for non-existent page
4. Γ£à `pages/player/ScenarioPicker.test.tsx` - Test for non-existent component
5. Γ£à `components/admin/AdminRouter.tsx` - Ghost router, not used

#### Medium Confidence (Review First)
1. ΓÜá∩╕Å `pages/GamePage.layer-p1.test.tsx` - May be used for regression testing
2. ΓÜá∩╕Å `pages/MyAdventuresPage.test.tsx` - May be used for regression testing

### 6.3 Mock Data Status
- Γ£à All mock files are actively used
- ΓÜá∩╕Å `adventures.json` and `wallet.json` are legacy but still imported
- **Action:** Review `mockData.ts` usage in Phase 2

### 6.4 UUID Error Fix
- Γ£à Frontend is correct (uses slugs)
- Γ¥î Backend route needs to handle both UUID and slug formats
- **Action:** Fix backend `/api/catalog/worlds/:idOrSlug` route handler

---

## 7. Action Items

### Immediate (Phase 1.5)
1. Γ£à Delete `pages/chat/` directory (empty files)
2. Γ£à Delete `pages/my/` directory (test only, no page)
3. Γ£à Delete `pages/player/` directory (test only, no component)
4. Γ£à Delete `components/admin/AdminRouter.tsx` (ghost router)
5. ΓÜá∩╕Å Review and decide on root-level test files

### Phase 2 (Future)
1. Fix backend `/api/catalog/worlds/:idOrSlug` to handle slugs
2. Review `mockData.ts` usage and remove legacy mock files
3. Migrate `adventures.json` references to stories

---

**End of Frontend Audit**
