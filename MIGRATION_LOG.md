# Phase 1 Migration Log

**Date:** 2025-01-XX  
**Phase:** Phase 1 - Legacy Purge & Compiler Consolidation

---

## 1. Backend Legacy Purge

### Deleted Files
- ✅ `backend/src/services/wallet.service.ts` - Legacy stone wallet service
- ✅ `backend/src/services/wallet.service.test.ts` - Legacy wallet tests
- ✅ `backend/src/services/adventure-input-parser.service.ts` - Legacy adventure service
- ✅ `backend/src/services/adventure-start.service.ts` - Legacy adventure service
- ✅ `backend/src/services/universal-adventure.service.ts` - Legacy adventure service

### Commented Out (TODO: Refactor for Chimera V3)
- ⚠️ `backend/src/services/turns.service.ts` - Commented out `WalletService` imports and usages
  - Lines 1, 150-158, 643, 848-856
- ⚠️ `backend/src/services/games.service.ts` - Commented out `WalletService` imports and usages
  - Lines 6, 1668-1679
- ⚠️ `backend/src/services/turns.service.test.ts` - Commented out `WalletService` mocks
- ⚠️ `backend/src/services/games.service.test.ts` - Commented out `WalletService` mocks
- ⚠️ `backend/src/routes/webhooks.test.ts` - Commented out `WalletService` mocks
- ⚠️ `backend/src/routes/turn-engine-integration.test.ts` - Commented out `WalletService` mocks
- ⚠️ `backend/src/routes/turn-engine-e2e.test.ts` - Commented out `WalletService` mocks
- ⚠️ `backend/src/routes/layer-p0-regression.test.ts` - Commented out `WalletService` and `StoneLedgerService` mocks

### Kept (Not Legacy)
- ✅ `backend/src/services/ledger.service.ts` - **KEPT** - This is an auth ledger for guest-to-user linking, not a stone ledger

---

## 2. Frontend Legacy Purge

### Deleted Files
- ✅ `frontend/src/components/gameplay/StoneLedgerWidget.tsx` - Legacy stone wallet widget
- ✅ `frontend/src/components/gameplay/StoneCost.tsx` - Legacy stone cost component
- ✅ `frontend/src/components/gameplay/InsufficientStonesDialog.tsx` - Legacy stone dialog

### Updated Files (Removed Imports/Usages)
- ✅ `frontend/src/components/gameplay/TurnInput.tsx` - Removed `StoneCost` import and usage
- ✅ `frontend/src/pages/stories/StoryDetailPage.tsx` - Removed `StoneCost` import and usage

---

## 3. Compiler Service Consolidation

### Deleted Files (Old Compiler)
- ✅ `backend/src/services/compiler/compiler.service.ts` - Old compiler implementation
- ✅ `backend/src/services/compiler/compiler.service.test.ts` - Old compiler tests

### Kept (New Compiler)
- ✅ `backend/src/services/compile/compiler.service.ts` - **KEPT** - New 4-Step Pipeline implementation
- ✅ `backend/src/services/compile/README.md` - **KEPT** - Compiler documentation

**Decision:** The `services/compile/` directory (without 'r') is the correct one per Chimera V3 architecture. The old `services/compiler/` directory was removed.

**Import Status:** All existing imports already point to `services/compile/` (verified in `routes/chimera-compile.ts` and `db/repos/compiled-stories.repo.ts`).

---

## 4. Admin Directory Analysis

### `frontend/src/pages/admin/entry-points/`
**Status:** ✅ **KEEP** (Valid but needs migration)

**Analysis:**
- References "Story" and "Chimera V3" in comments
- Uses `entry_points` table (legacy)
- Has TODO comment: "TODO: Refactor to use `compiled_stories` table (Chimera V3)"
- Uses `entryPointsService` which calls `/api/admin/entry-points`
- **Decision:** Keep for now, but mark for future migration to Chimera Stories API

### `frontend/src/pages/admin/publishing/`
**Status:** ✅ **KEEP** (Valid)

**Analysis:**
- No references to `awf-*`, `stone-*`, or "Adventure World Forge"
- References "Chimera" and generic platform tools
- Uses feature flags for publishing workflow
- **Decision:** Valid publishing workflow, keep as-is

### `frontend/src/pages/admin/TemplatesManager.tsx`
**Status:** ✅ **KEEP** (Valid)

**Analysis:**
- No references to `awf-*`, `stone-*`, or "Adventure World Forge"
- Manages slot templates (generic platform tool)
- Uses `/api/admin/templates` endpoint
- **Decision:** Valid template management tool, keep as-is

---

## 5. Casting Circle Scaffold

### Created Files
- ✅ `frontend/src/pages/casting-circle/index.tsx` - Placeholder page created

### Existing Components
- ✅ `frontend/src/components/casting/` - **KEPT** - Contains valid CastingWizard components and tests
  - `__tests__/CastingWizard.test.tsx` - Test file for CastingWizard
  - `__tests__/RulesetSelector.test.tsx` - Test file for RulesetSelector
  - `__tests__/WorldCard.test.tsx` - Test file for WorldCard

**Decision:** The `components/casting/` directory contains reusable components (not page logic), so they remain in place. The new `pages/casting-circle/` directory is for page-level components.

---

## 6. Route Verification

### Verified Routes
- ✅ `/worlds` route in `App.tsx` (line 137-141)
  - Import: `import WorldsPage from './pages/worlds/WorldsPage';` (line 26)
  - File exists: `frontend/src/pages/worlds/WorldsPage.tsx` ✅
  - **Status:** Route is correct, file exists

---

## 7. Build Validation

### Next Steps
1. Run `npm run build` for backend to verify no broken imports
2. Run `npm run build` for frontend to verify no broken imports
3. Check for any remaining references to deleted services

### Expected Issues
- `turns.service.ts` and `games.service.ts` have commented-out WalletService code
- Test files have commented-out WalletService mocks
- These should be addressed in Phase 2 (Chimera V3 migration) when the wallet system is replaced with Chimera's game state system

---

## Summary

### Files Deleted: 8
- Backend: 5 service files
- Frontend: 3 component files

### Files Modified: 10
- Backend: 8 files (commented out WalletService in services and tests)
  - `services/turns.service.ts`
  - `services/games.service.ts`
  - `services/turns.service.test.ts`
  - `services/games.service.test.ts`
  - `routes/webhooks.test.ts`
  - `routes/turn-engine-integration.test.ts`
  - `routes/turn-engine-e2e.test.ts`
  - `routes/layer-p0-regression.test.ts`
- Frontend: 2 component files (removed StoneCost)
  - `components/gameplay/TurnInput.tsx`
  - `pages/stories/StoryDetailPage.tsx`

### Directories Created: 1
- `frontend/src/pages/casting-circle/`

### Directories Removed: 1
- `backend/src/services/compiler/` (old compiler)

### Admin Directories Status
- ✅ `entry-points/` - KEEP (valid, needs migration)
- ✅ `publishing/` - KEEP (valid)
- ✅ `TemplatesManager.tsx` - KEEP (valid)

---

**End of Phase 1 Migration Log**
