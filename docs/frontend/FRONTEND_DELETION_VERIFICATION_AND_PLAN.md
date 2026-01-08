# Frontend Deletion Verification and Plan

**Last Updated:** 2025-01-XX  
**Purpose:** Final verification of components marked SAFE TO DELETE, dynamic usage analysis, admin surface traversal, and staged deletion plan.

---

## Table of Contents

1. [Dynamic Usage Verification](#dynamic-usage-verification)
2. [Admin Surface Traversal](#admin-surface-traversal)
3. [Component Status Summary](#component-status-summary)
4. [Deletion Staging Plan](#deletion-staging-plan)

---

## Dynamic Usage Verification

### Verification Methodology

Checked for:
- ✅ React.lazy or dynamic imports (none found for components)
- ✅ Component registries or maps (none found)
- ✅ String-based component resolution (none found - only DOM element creation)
- ✅ Feature flag conditionals (used for navigation visibility, not component loading)
- ✅ Admin route composition (all directly imported in AdminRoutes.tsx)

### Findings

**No dynamic component loading detected.** All components are statically imported. The only dynamic imports found are:
- Service imports (e.g., `await import('@/services/chimera-api')`)
- Mock data imports (e.g., `await import('../mock/schemas/${worldId}.json')`)
- Test utilities (e.g., `await importOriginal`)

**Feature flags** (`isChimeraEnabled`, `isAdminMediaEnabled`, etc.) control:
- Navigation visibility (AdminNav)
- Route logic (StoryDetailPage routing)
- API selection (Chimera vs legacy)
- **NOT component loading**

---

## Dynamic Usage Verification Results

### CONFIRMED SAFE (No Dynamic Usage Found)

All components marked SAFE TO DELETE in FRONTEND_COMPONENT_USAGE_AND_CLEANUP.md have been verified:

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| GameStatePage | `frontend/src/pages/play/GameStatePage.tsx` | ✅ SAFE | Not in App.tsx routes, no imports |
| HUDManager | `frontend/src/features/play/components/HUD/HUDManager.tsx` | ✅ SAFE | No imports found |
| ActiveGameLayout | `frontend/src/features/play/layout/ActiveGameLayout.tsx` | ✅ SAFE | No imports found |
| GatedRoute | `frontend/src/components/auth/GatedRoute.tsx` | ✅ SAFE | ProtectedRoute/EarlyAccessRoute used instead |
| EntryPointCard | `frontend/src/components/catalog/EntryPointCard.tsx` | ✅ SAFE | No imports |
| StoryCard (Shared) | `frontend/src/components/cards/StoryCard.tsx` | ✅ SAFE | Dashboard version used |
| WorldCard (Shared) | `frontend/src/components/cards/WorldCard.tsx` | ✅ SAFE | Dashboard version used |
| EntityCard (Shared) | `frontend/src/components/cards/EntityCard.tsx` | ✅ SAFE | Dashboard/Inspector versions used |
| StoriesFilterBar | `frontend/src/components/filters/StoriesFilterBar.tsx` | ✅ SAFE | WorldsFilterBar used instead |
| RulesetsFilterBar | `frontend/src/components/filters/RulesetsFilterBar.tsx` | ✅ SAFE | No imports |
| All common/fields/* | `frontend/src/components/common/fields/*.tsx` | ✅ SAFE | No imports (6 files) |
| MediaUploader | `frontend/src/components/common/MediaUploader.tsx` | ✅ SAFE | No imports |
| CollapsibleSection | `frontend/src/components/common/CollapsibleSection.tsx` | ✅ SAFE | No imports |
| CoverImagePanel | `frontend/src/components/common/CoverImagePanel.tsx` | ✅ SAFE | No imports |
| ActionInput | `frontend/src/components/game/ActionInput.tsx` | ✅ SAFE | No imports |
| NarrativeFeed | `frontend/src/components/game/NarrativeFeed.tsx` | ✅ SAFE | No imports |
| GameGenesisLoader | `frontend/src/components/game/GameGenesisLoader.tsx` | ✅ SAFE | No imports |
| All play/* except PlayInput | `frontend/src/components/play/*.tsx` | ✅ SAFE | No imports (4 files) |
| All gameplay/* | `frontend/src/components/gameplay/*.tsx` | ✅ SAFE | No imports (11 files) |
| All debug/* except SchemaDebug | `frontend/src/components/debug/*.tsx` | ✅ SAFE | No imports (8 files) |
| All publishing/* | `frontend/src/components/publishing/*.tsx` | ✅ SAFE | No imports (2 files) |
| All character/* | `frontend/src/components/character/*.tsx` | ✅ SAFE | No imports (4 files) |
| All chimera/modals/* | `frontend/src/components/chimera/modals/*.tsx` | ✅ SAFE | No imports (2 files) |
| ComplexAssetSelector | `frontend/src/components/chimera/ComplexAssetSelector.tsx` | ✅ SAFE | No imports |
| TagSelect | `frontend/src/components/chimera/TagSelect.tsx` | ✅ SAFE | No imports |
| WorldForm | `frontend/src/components/editors/WorldForm.tsx` | ✅ SAFE | No imports |
| EntityForm | `frontend/src/components/editors/EntityForm.tsx` | ✅ SAFE | No imports |
| All forms/shared/* | `frontend/src/components/forms/shared/*.tsx` | ✅ SAFE | No imports (3 files) |
| AssetPickerModal | `frontend/src/features/dashboard/components/assets/AssetPickerModal.tsx` | ✅ SAFE | No imports |
| StoryListSection | `frontend/src/features/dashboard/components/StoryListSection.tsx` | ✅ SAFE | No imports |
| RecentContextFeed | `frontend/src/features/dashboard/components/RecentContextFeed.tsx` | ✅ SAFE | No imports |
| AssetDomainCard | `frontend/src/features/dashboard/components/AssetDomainCard.tsx` | ✅ SAFE | No imports |
| DynamicSchemaForm | `frontend/src/features/engine/components/DynamicSchemaForm.tsx` | ✅ SAFE | No imports |

**Total Confirmed Safe:** 60+ components

---

### MOVE TO INVESTIGATE (Routed but Usage Unclear)

| Component | File | Route | Status | Investigation Needed |
|-----------|------|-------|--------|---------------------|
| CharacterCreationPage | `frontend/src/pages/play/CharacterCreationPage.tsx` | `/create-character/:storyId` | ⚠️ INVESTIGATE | Route exists in App.tsx, may be legacy flow |
| PlayerGatewayPage | `frontend/src/pages/play/PlayerGatewayPage.tsx` | `/player-gateway/:storyId` | ⚠️ INVESTIGATE | Route exists in App.tsx, usage unclear |
| CreateStoryPage | `frontend/src/features/create-story/components/CreateStoryPage.tsx` | `/stories/compose`, `/create-story` | ⚠️ INVESTIGATE | Marked deprecated but still routed |

**Investigation Required:**
- Check if these routes are linked from UI
- Verify if they're used by legacy flows
- Confirm if they can be safely removed or need migration

---

### EXCLUDE (Actually Used)

| Component | File | Used By | Status |
|-----------|------|---------|--------|
| ExtrasForm | `frontend/src/components/admin/ExtrasForm.tsx` | PromptAuthoringSection | ❌ EXCLUDE |
| ParamsEditor | `frontend/src/components/admin/ParamsEditor.tsx` | PromptAuthoringSection | ❌ EXCLUDE |
| GuidedEditorLayout | `frontend/src/features/dashboard/components/editors/shared/GuidedEditorLayout.tsx` | WorldEditorModal, EntityEditorModal | ❌ EXCLUDE |
| ApprovalsTable | `frontend/src/components/admin/media/ApprovalsTable.tsx` | ApprovalsPage | ❌ EXCLUDE |

**Note:** These were incorrectly marked as unused. They are actively used.

---

## Admin Surface Traversal

### Admin Routes Analysis

**File:** `frontend/src/admin/AdminRoutes.tsx`

All admin pages are **directly imported** (no dynamic loading):

```typescript
import AdminHome from '@/pages/admin/index';
import RolesAdmin from '@/pages/admin/roles/index';
import AccessRequestsAdmin from '@/pages/admin/access-requests/index';
import TemplatesManager from '@/pages/admin/TemplatesManager';
import ApprovalsPage from '@/pages/admin/media/ApprovalsPage';
import PublishingWizard from '@/pages/publishing/wizard';
import PublishingWizardPage from '@/pages/admin/publishing-wizard/[entityType]/[entityId]';
import ChimeraDashboard from '@/pages/admin/chimera/Dashboard';
import RulesetTemplatesDashboard from '@/pages/admin/chimera/rulesets/index';
import RulesetTemplateEditor from '@/pages/admin/chimera/rulesets/Editor';
import ChimeraWorldsAdmin from '@/pages/admin/chimera/worlds/index';
import WorldListPage from '@/pages/admin/chimera/worlds/WorldListPage';
import WorldEditorPage from '@/pages/admin/chimera/worlds/WorldEditorPage';
import ChimeraEntitiesAdmin from '@/pages/admin/chimera/entities/index';
import EntityListPage from '@/pages/admin/chimera/entities/EntityListPage';
import EntityEditorPage from '@/pages/admin/chimera/entities/EntityEditorPage';
import TagManagement from '@/pages/admin/chimera/tags/index';
```

### Admin Component Usage Analysis

**Verified Admin Pages:**

1. **ApprovalsPage** (`frontend/src/pages/admin/media/ApprovalsPage.tsx`)
   - Uses: `ApprovalsTable` ✅ (in use)
   - Does NOT use any components from unused list

2. **TemplatesManager** (`frontend/src/pages/admin/TemplatesManager.tsx`)
   - Uses: UI primitives only (Card, Button, Table, etc.)
   - Does NOT use any components from unused list

3. **ChimeraDashboard** (`frontend/src/pages/admin/chimera/Dashboard.tsx`)
   - Placeholder page, no components used

4. **PromptAuthoringSection** (`frontend/src/components/admin/prompt-authoring/PromptAuthoringSection.tsx`)
   - Uses: `ExtrasForm`, `ParamsEditor`, `ActionsBar`, `ResultPane`, `ContextChips`
   - `ExtrasForm` and `ParamsEditor` are **IN USE** (not safe to delete)

### Admin Components Status

| Component | File | Used By | Status |
|-----------|------|---------|--------|
| AdminRoute | `frontend/src/components/admin/AdminRoute.tsx` | ❌ None | ✅ SAFE |
| ExtrasForm | `frontend/src/components/admin/ExtrasForm.tsx` | ✅ PromptAuthoringSection | ❌ EXCLUDE |
| FieldEditor | `frontend/src/components/admin/FieldEditor.tsx` | ❌ None | ✅ SAFE |
| GalleryManager | `frontend/src/components/admin/GalleryManager.tsx` | ❌ None | ✅ SAFE |
| GraphCanvas | `frontend/src/components/admin/graph/GraphCanvas.tsx` | ❌ None | ✅ SAFE |
| EdgeInspector | `frontend/src/components/admin/graph/EdgeInspector.tsx` | ❌ None | ✅ SAFE |
| LintPanel | `frontend/src/components/admin/graph/LintPanel.tsx` | ❌ None | ✅ SAFE |
| NodeInspector | `frontend/src/components/admin/graph/NodeInspector.tsx` | ❌ None | ✅ SAFE |
| TimeseriesChart | `frontend/src/components/admin/metrics/TimeseriesChart.tsx` | ❌ None | ✅ SAFE |
| TopList | `frontend/src/components/admin/metrics/TopList.tsx` | ❌ None | ✅ SAFE |
| PreviewControls | `frontend/src/components/admin/preview/PreviewControls.tsx` | ❌ None | ✅ SAFE |
| PreviewMetaBar | `frontend/src/components/admin/preview/PreviewMetaBar.tsx` | ❌ None | ✅ SAFE |
| PreviewPiecesTable | `frontend/src/components/admin/preview/PreviewPiecesTable.tsx` | ❌ None | ✅ SAFE |
| PreviewPromptPanel | `frontend/src/components/admin/preview/PreviewPromptPanel.tsx` | ❌ None | ✅ SAFE |
| PreviewQASection | `frontend/src/components/admin/preview/PreviewQASection.tsx` | ❌ None | ✅ SAFE |
| PromptPreviewForm | `frontend/src/components/admin/PromptPreviewForm.tsx` | ❌ None | ✅ SAFE |
| PromptPreviewResult | `frontend/src/components/admin/PromptPreviewResult.tsx` | ❌ None | ✅ SAFE |
| SnapshotDiff | `frontend/src/components/admin/SnapshotDiff.tsx` | ❌ None | ✅ SAFE |
| SnapshotList | `frontend/src/components/admin/SnapshotList.tsx` | ❌ None | ✅ SAFE |
| SnapshotOverrideDialog | `frontend/src/components/admin/SnapshotOverrideDialog.tsx` | ❌ None | ✅ SAFE |
| SnapshotView | `frontend/src/components/admin/SnapshotView.tsx` | ❌ None | ✅ SAFE |
| TemplatesVersionSelect | `frontend/src/components/admin/TemplatesVersionSelect.tsx` | ❌ None | ✅ SAFE |
| PromptAuthoringSection | `frontend/src/components/admin/prompt-authoring/PromptAuthoringSection.tsx` | ✅ Used (but not in routes) | ❌ EXCLUDE |
| ContextChips | `frontend/src/components/admin/prompt-authoring/ContextChips.tsx` | ✅ PromptAuthoringSection | ❌ EXCLUDE |
| ActionsBar | `frontend/src/components/admin/prompt-authoring/ActionsBar.tsx` | ✅ PromptAuthoringSection | ❌ EXCLUDE |
| ResultPane | `frontend/src/components/admin/prompt-authoring/ResultPane.tsx` | ✅ PromptAuthoringSection | ❌ EXCLUDE |
| ApprovalsTable | `frontend/src/components/admin/media/ApprovalsTable.tsx` | ✅ ApprovalsPage | ❌ EXCLUDE |

**Admin Components Safe to Delete:** 20 components

---

## Component Status Summary

### Final Counts

- **✅ CONFIRMED SAFE TO DELETE:** 60+ components
- **⚠️ INVESTIGATE (Routed):** 3 components
- **❌ EXCLUDE (Actually Used):** 7 components
- **🔒 DO NOT TOUCH (Core/Admin/Engine):** All core infrastructure

### Corrections from Original Analysis

**Components Incorrectly Marked as Unused:**
1. `ExtrasForm` - Used by PromptAuthoringSection
2. `ParamsEditor` - Used by PromptAuthoringSection
3. `GuidedEditorLayout` - Used by WorldEditorModal and EntityEditorModal
4. `ApprovalsTable` - Used by ApprovalsPage
5. `PromptAuthoringSection` - Used (but not routed directly)
6. `ContextChips` - Used by PromptAuthoringSection
7. `ActionsBar` - Used by PromptAuthoringSection
8. `ResultPane` - Used by PromptAuthoringSection

---

## Deletion Staging Plan

### Staging Strategy

Deletions are grouped into **PR-sized chunks** by risk level and category. Each stage:
- Focuses on a specific category of components
- Has clear verification steps
- Can be tested independently
- Has minimal risk of breaking existing functionality

---

### Stage 1: Truly Isolated Shared Components

**Risk Level:** 🟢 **LOW**  
**Components:** 20 files  
**Estimated PR Size:** Small

#### Components to Delete

**Shared Card Components (3 files):**
- `frontend/src/components/cards/StoryCard.tsx`
- `frontend/src/components/cards/WorldCard.tsx`
- `frontend/src/components/cards/EntityCard.tsx`

**Filter Components (2 files):**
- `frontend/src/components/filters/StoriesFilterBar.tsx`
- `frontend/src/components/filters/RulesetsFilterBar.tsx`

**Common Components (4 files):**
- `frontend/src/components/common/MediaUploader.tsx`
- `frontend/src/components/common/CollapsibleSection.tsx`
- `frontend/src/components/common/CoverImagePanel.tsx`
- `frontend/src/components/catalog/EntryPointCard.tsx`

**Common Field Components (6 files):**
- `frontend/src/components/common/fields/StringField.tsx`
- `frontend/src/components/common/fields/NumberField.tsx`
- `frontend/src/components/common/fields/BooleanField.tsx`
- `frontend/src/components/common/fields/EnumField.tsx`
- `frontend/src/components/common/fields/ArrayField.tsx`
- `frontend/src/components/common/fields/ObjectField.tsx`

**Form Components (3 files):**
- `frontend/src/components/forms/shared/TagSelector.tsx`
- `frontend/src/components/forms/shared/ImageUploader.tsx`
- `frontend/src/components/forms/shared/KeywordInput.tsx`

**Editor Components (2 files):**
- `frontend/src/components/editors/WorldForm.tsx`
- `frontend/src/components/editors/EntityForm.tsx`

#### Reason

These are duplicate or unused shared components. Dashboard versions are used instead for cards. No dynamic usage detected.

#### Verification Steps

1. **Build Test:**
   ```bash
   pnpm build
   ```
   - Should complete without errors
   - No TypeScript errors referencing deleted files

2. **Lint Test:**
   ```bash
   pnpm lint
   ```
   - No new lint errors

3. **Manual QA:**
   - Navigate to `/my-creations` - verify StoryCard, WorldCard, EntityCard render correctly
   - Navigate to `/stories` - verify WorldsFilterBar works
   - Navigate to `/worlds` - verify WorldsFilterBar works
   - Navigate to `/npcs` - verify NPCsFilterBar works
   - Create/edit world via dashboard - verify no broken imports

4. **E2E Test:**
   ```bash
   pnpm test:e2e
   ```
   - All existing tests should pass

#### Risk Assessment

- **Low Risk:** These components have no imports and are isolated
- **Rollback:** Easy (git revert)
- **Impact:** None (components not used)

---

### Stage 2: Legacy Pages Not in Routes

**Risk Level:** 🟡 **MEDIUM**  
**Components:** 1 file  
**Estimated PR Size:** Small

#### Components to Delete

**Unrouted Page (1 file):**
- `frontend/src/pages/play/GameStatePage.tsx`

#### Reason

Not defined in App.tsx routes. Alternative to GamePage + ActiveGameInterface pattern. No imports found.

#### Verification Steps

1. **Build Test:**
   ```bash
   pnpm build
   ```
   - Should complete without errors

2. **Route Verification:**
   - Verify `/play/:gameStateId` still works (uses GamePage)
   - Verify no references to GameStatePage in codebase

3. **Manual QA:**
   - Start a game session
   - Navigate to `/play/[gameStateId]`
   - Verify game interface loads correctly
   - Verify narrative stream, input deck, HUD all work

4. **E2E Test:**
   ```bash
   pnpm test:e2e
   ```
   - Game flow tests should pass

#### Risk Assessment

- **Medium Risk:** Page exists but not routed - may be used by legacy flows
- **Rollback:** Easy (git revert)
- **Impact:** None if truly not routed

---

### Stage 3: Unused Feature Components

**Risk Level:** 🟢 **LOW**  
**Components:** 4 files  
**Estimated PR Size:** Small

#### Components to Delete

**Play Feature Components (2 files):**
- `frontend/src/features/play/components/HUD/HUDManager.tsx`
- `frontend/src/features/play/layout/ActiveGameLayout.tsx`

**Dashboard Feature Components (2 files):**
- `frontend/src/features/dashboard/components/assets/AssetPickerModal.tsx`
- `frontend/src/features/dashboard/components/StoryListSection.tsx`
- `frontend/src/features/dashboard/components/RecentContextFeed.tsx`
- `frontend/src/features/dashboard/components/AssetDomainCard.tsx`

**Engine Feature Components (1 file):**
- `frontend/src/features/engine/components/DynamicSchemaForm.tsx`

#### Reason

No imports found. These appear to be abandoned feature components.

#### Verification Steps

1. **Build Test:**
   ```bash
   pnpm build
   ```
   - Should complete without errors

2. **Manual QA:**
   - Navigate to `/play/[gameStateId]` - verify game works
   - Navigate to `/my-creations` - verify dashboard works
   - Create/edit entities - verify no broken imports

3. **E2E Test:**
   ```bash
   pnpm test:e2e
   ```
   - All existing tests should pass

#### Risk Assessment

- **Low Risk:** No imports found
- **Rollback:** Easy (git revert)
- **Impact:** None (components not used)

---

### Stage 4: Game Components Cleanup

**Risk Level:** 🟢 **LOW**  
**Components:** 3 files  
**Estimated PR Size:** Small

#### Components to Delete

**Game Components (3 files):**
- `frontend/src/components/game/ActionInput.tsx`
- `frontend/src/components/game/NarrativeFeed.tsx`
- `frontend/src/components/game/GameGenesisLoader.tsx`

#### Reason

No imports found. ActiveGameInterface uses different components (InputDeck, NarrativeStream).

#### Verification Steps

1. **Build Test:**
   ```bash
   pnpm build
   ```
   - Should complete without errors

2. **Manual QA:**
   - Navigate to `/play/[gameStateId]`
   - Verify narrative stream displays correctly
   - Verify input deck works
   - Submit a turn - verify it processes correctly

3. **E2E Test:**
   ```bash
   pnpm test:e2e
   ```
   - Game flow tests should pass

#### Risk Assessment

- **Low Risk:** No imports found, ActiveGameInterface uses different components
- **Rollback:** Easy (git revert)
- **Impact:** None (components not used)

---

### Stage 5: Play Components Cleanup

**Risk Level:** 🟢 **LOW**  
**Components:** 4 files  
**Estimated PR Size:** Small

#### Components to Delete

**Play Components (4 files):**
- `frontend/src/components/play/CharacterCard.tsx`
- `frontend/src/components/play/CharacterModal.tsx`
- `frontend/src/components/play/MessageLog.tsx`
- `frontend/src/components/play/StoryStartSummary.tsx`

**Note:** `PlayInput.tsx` and `DebugPanel.tsx` are **KEPT** (used by GameStatePage, which may be investigated separately)

#### Reason

No imports found. Character selection uses CharacterSelector from features/play/start.

#### Verification Steps

1. **Build Test:**
   ```bash
   pnpm build
   ```
   - Should complete without errors

2. **Manual QA:**
   - Navigate to `/play/start/[storyId]`
   - Verify character selection works
   - Create new character - verify flow works
   - Start game - verify no broken imports

3. **E2E Test:**
   ```bash
   pnpm test:e2e
   ```
   - Character creation tests should pass

#### Risk Assessment

- **Low Risk:** No imports found
- **Rollback:** Easy (git revert)
- **Impact:** None (components not used)

---

### Stage 6: Gameplay Components Cleanup

**Risk Level:** 🟢 **LOW**  
**Components:** 11 files  
**Estimated PR Size:** Medium

#### Components to Delete

**Gameplay Components (11 files):**
- `frontend/src/components/gameplay/TurnInput.tsx`
- `frontend/src/components/gameplay/ChoiceButtons.tsx`
- `frontend/src/components/gameplay/CreateGameForm.tsx`
- `frontend/src/components/gameplay/DebugMiniPanel.tsx`
- `frontend/src/components/gameplay/EmptyTurnsState.tsx`
- `frontend/src/components/gameplay/HistoryFeed.tsx`
- `frontend/src/components/gameplay/PromptApprovalModal.tsx`
- `frontend/src/components/gameplay/PromptMetaBar.tsx`
- `frontend/src/components/gameplay/SkeletonTurnsList.tsx`
- `frontend/src/components/gameplay/TurnErrorHandler.tsx`
- `frontend/src/components/gameplay/TurnsList.tsx`

#### Reason

No imports found. Game uses ActiveGameInterface with InputDeck and NarrativeStream.

#### Verification Steps

1. **Build Test:**
   ```bash
   pnpm build
   ```
   - Should complete without errors

2. **Manual QA:**
   - Navigate to `/play/[gameStateId]`
   - Verify game interface works
   - Submit turns - verify processing
   - Verify narrative stream updates

3. **E2E Test:**
   ```bash
   pnpm test:e2e
   ```
   - Game flow tests should pass

#### Risk Assessment

- **Low Risk:** No imports found
- **Rollback:** Easy (git revert)
- **Impact:** None (components not used)

---

### Stage 7: Debug Components Cleanup

**Risk Level:** 🟡 **MEDIUM**  
**Components:** 8 files  
**Estimated PR Size:** Small

#### Components to Delete

**Debug Components (8 files):**
- `frontend/src/components/debug/DebugPanel.tsx` (different from play/DebugPanel)
- `frontend/src/components/debug/AIDebugPanel.tsx`
- `frontend/src/components/debug/CodeBlock.tsx`
- `frontend/src/components/debug/ComparePromptView.tsx`
- `frontend/src/components/debug/CompareView.tsx`
- `frontend/src/components/debug/DebugDrawer.tsx`
- `frontend/src/components/debug/DebugTabs.tsx`
- `frontend/src/components/debug/TurnPicker.tsx`

**Note:** `SchemaDebug.tsx` is **KEPT** (used conditionally in StartGatewayPage)

#### Reason

No imports found. Debug functionality may be used via play/DebugPanel or other mechanisms.

#### Verification Steps

1. **Build Test:**
   ```bash
   pnpm build
   ```
   - Should complete without errors

2. **Manual QA:**
   - Navigate to `/play/[gameStateId]?debug=true`
   - Verify debug panel works (uses play/DebugPanel)
   - Navigate to `/play/start/[storyId]`
   - Verify SchemaDebug works if DEBUG_SCHEMA_ENGINE is enabled

3. **E2E Test:**
   ```bash
   pnpm test:e2e
   ```
   - Debug-related tests should pass

#### Risk Assessment

- **Medium Risk:** Debug components may be used in development/testing
- **Rollback:** Easy (git revert)
- **Impact:** Low (only affects debug tools)

---

### Stage 8: Character Components Cleanup

**Risk Level:** 🟢 **LOW**  
**Components:** 4 files  
**Estimated PR Size:** Small

#### Components to Delete

**Character Components (4 files):**
- `frontend/src/components/character/CharacterCreator.tsx`
- `frontend/src/components/character/CharacterSkills.tsx`
- `frontend/src/components/character/PlayerV3Wizard.tsx`
- `frontend/src/components/character/WorldFieldRenderer.tsx`

#### Reason

No imports found. Character creation uses CharacterCreatorWizard from features/play/create.

#### Verification Steps

1. **Build Test:**
   ```bash
   pnpm build
   ```
   - Should complete without errors

2. **Manual QA:**
   - Navigate to `/play/create/[storyId]`
   - Verify character creation wizard works
   - Complete character creation flow
   - Verify character is created successfully

3. **E2E Test:**
   ```bash
   pnpm test:e2e
   ```
   - Character creation tests should pass

#### Risk Assessment

- **Low Risk:** No imports found
- **Rollback:** Easy (git revert)
- **Impact:** None (components not used)

---

### Stage 9: Chimera Components Cleanup

**Risk Level:** 🟢 **LOW**  
**Components:** 4 files  
**Estimated PR Size:** Small

#### Components to Delete

**Chimera Components (4 files):**
- `frontend/src/components/chimera/ComplexAssetSelector.tsx`
- `frontend/src/components/chimera/TagSelect.tsx`
- `frontend/src/components/chimera/modals/CreateEntityModal.tsx`
- `frontend/src/components/chimera/modals/CreateLoreModal.tsx`

#### Reason

No imports found. Entity creation uses EntityEditorModal from dashboard.

#### Verification Steps

1. **Build Test:**
   ```bash
   pnpm build
   ```
   - Should complete without errors

2. **Manual QA:**
   - Navigate to `/my-creations`
   - Create new entity - verify modal works
   - Create new world - verify modal works
   - Edit entities - verify no broken imports

3. **E2E Test:**
   ```bash
   pnpm test:e2e
   ```
   - Entity creation tests should pass

#### Risk Assessment

- **Low Risk:** No imports found
- **Rollback:** Easy (git revert)
- **Impact:** None (components not used)

---

### Stage 10: Publishing Components Cleanup

**Risk Level:** 🟢 **LOW**  
**Components:** 2 files  
**Estimated PR Size:** Small

#### Components to Delete

**Publishing Components (2 files):**
- `frontend/src/components/publishing/PreflightPanel.tsx`
- `frontend/src/components/publishing/PublishButton.tsx`

#### Reason

No imports found. Publishing uses PublishingWizard page.

#### Verification Steps

1. **Build Test:**
   ```bash
   pnpm build
   ```
   - Should complete without errors

2. **Manual QA:**
   - Navigate to `/admin/publishing/wizard`
   - Verify publishing wizard works
   - Complete publishing flow

3. **E2E Test:**
   ```bash
   pnpm test:e2e
   ```
   - Publishing tests should pass

#### Risk Assessment

- **Low Risk:** No imports found
- **Rollback:** Easy (git revert)
- **Impact:** None (components not used)

---

### Stage 11: Admin Components Cleanup

**Risk Level:** 🟡 **MEDIUM**  
**Components:** 20 files  
**Estimated PR Size:** Medium

#### Components to Delete

**Admin Components (20 files):**
- `frontend/src/components/admin/AdminRoute.tsx`
- `frontend/src/components/admin/FieldEditor.tsx`
- `frontend/src/components/admin/GalleryManager.tsx`
- `frontend/src/components/admin/graph/GraphCanvas.tsx`
- `frontend/src/components/admin/graph/EdgeInspector.tsx`
- `frontend/src/components/admin/graph/LintPanel.tsx`
- `frontend/src/components/admin/graph/NodeInspector.tsx`
- `frontend/src/components/admin/metrics/TimeseriesChart.tsx`
- `frontend/src/components/admin/metrics/TopList.tsx`
- `frontend/src/components/admin/preview/PreviewControls.tsx`
- `frontend/src/components/admin/preview/PreviewMetaBar.tsx`
- `frontend/src/components/admin/preview/PreviewPiecesTable.tsx`
- `frontend/src/components/admin/preview/PreviewPromptPanel.tsx`
- `frontend/src/components/admin/preview/PreviewQASection.tsx`
- `frontend/src/components/admin/PromptPreviewForm.tsx`
- `frontend/src/components/admin/PromptPreviewResult.tsx`
- `frontend/src/components/admin/SnapshotDiff.tsx`
- `frontend/src/components/admin/SnapshotList.tsx`
- `frontend/src/components/admin/SnapshotOverrideDialog.tsx`
- `frontend/src/components/admin/SnapshotView.tsx`
- `frontend/src/components/admin/TemplatesVersionSelect.tsx`

**Note:** The following are **KEPT** (actually used):
- `ExtrasForm.tsx` - Used by PromptAuthoringSection
- `ParamsEditor.tsx` - Used by PromptAuthoringSection
- `ApprovalsTable.tsx` - Used by ApprovalsPage
- `prompt-authoring/*` - Used by PromptAuthoringSection

#### Reason

No imports found. Admin pages use UI primitives directly or other components.

#### Verification Steps

1. **Build Test:**
   ```bash
   pnpm build
   ```
   - Should complete without errors

2. **Manual QA:**
   - Navigate to `/admin` - verify admin home loads
   - Navigate to `/admin/templates` - verify templates manager works
   - Navigate to `/admin/media/approvals` - verify approvals page works
   - Navigate to `/admin/chimera/dashboard` - verify dashboard loads
   - Test all admin routes - verify no broken imports

3. **E2E Test:**
   ```bash
   pnpm test:e2e
   ```
   - Admin tests should pass

#### Risk Assessment

- **Medium Risk:** Admin components may be used in development/testing
- **Rollback:** Easy (git revert)
- **Impact:** Low (only affects admin tools)

---

### Stage 12: Auth Component Cleanup

**Risk Level:** 🟢 **LOW**  
**Components:** 1 file  
**Estimated PR Size:** Small

#### Components to Delete

**Auth Components (1 file):**
- `frontend/src/components/auth/GatedRoute.tsx`

#### Reason

No imports found. ProtectedRoute and EarlyAccessRoute are used instead.

#### Verification Steps

1. **Build Test:**
   ```bash
   pnpm build
   ```
   - Should complete without errors

2. **Manual QA:**
   - Navigate to protected routes - verify guards work
   - Test early access routes - verify guards work
   - Test admin routes - verify guards work

3. **E2E Test:**
   ```bash
   pnpm test:e2e
   ```
   - Auth tests should pass

#### Risk Assessment

- **Low Risk:** No imports found, other route guards used
- **Rollback:** Easy (git revert)
- **Impact:** None (component not used)

---

## Post-Deletion Verification

After all stages are complete:

1. **Final Build:**
   ```bash
   pnpm build
   ```

2. **Final Lint:**
   ```bash
   pnpm lint
   ```

3. **Final Tests:**
   ```bash
   pnpm test
   pnpm test:e2e
   ```

4. **Bundle Size Check:**
   - Compare bundle size before/after
   - Verify reduction in bundle size

5. **Type Check:**
   ```bash
   pnpm type-check
   ```

---

## Summary

### Total Components to Delete

- **Stage 1:** 20 components
- **Stage 2:** 1 component
- **Stage 3:** 6 components
- **Stage 4:** 3 components
- **Stage 5:** 4 components
- **Stage 6:** 11 components
- **Stage 7:** 8 components
- **Stage 8:** 4 components
- **Stage 9:** 4 components
- **Stage 10:** 2 components
- **Stage 11:** 20 components
- **Stage 12:** 1 component

**Total: 84 components across 12 stages**

### Components to Investigate (Not in Deletion Plan)

- `CharacterCreationPage` - Routed but may be legacy
- `PlayerGatewayPage` - Routed but usage unclear
- `CreateStoryPage` - Marked deprecated but still routed

### Components Excluded from Deletion

- `ExtrasForm` - Used by PromptAuthoringSection
- `ParamsEditor` - Used by PromptAuthoringSection
- `GuidedEditorLayout` - Used by WorldEditorModal and EntityEditorModal
- `ApprovalsTable` - Used by ApprovalsPage
- `PromptAuthoringSection` - Used (but not routed directly)
- `ContextChips` - Used by PromptAuthoringSection
- `ActionsBar` - Used by PromptAuthoringSection
- `ResultPane` - Used by PromptAuthoringSection

---

**Document Status:** Ready for execution. All components verified for static imports only. No dynamic usage detected.
