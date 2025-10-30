# NPC Bindings Backend API Fix

**Date:** 2025-10-30
**Issue:** "No NPCs available" message in entry point NPC bindings tab, despite having NPCs in the system
**Root Cause:** Frontend was calling non-existent service method and making direct Supabase calls

## Problems Identified

### 1. Missing Backend API Endpoints
- **Issue**: No backend API endpoints existed for NPC bindings (`entry_point_npcs` table)
- **Impact**: Frontend was forced to make direct Supabase calls, violating architecture rules

### 2. Non-Existent Service Method
- **Issue**: `EntryPointNpcsTab.tsx` was calling `npcBindingsService.getNPCsForWorld(worldId)` which didn't exist
- **Impact**: Method call would fail, returning empty array, showing "No NPCs available" message

### 3. Direct Supabase Calls
- **Issue**: `admin.npcBindings.ts` was making direct calls to Supabase REST API
- **Impact**: Violated architecture (user explicitly stated: "This should never use the supabase url")

### 4. World ID Filtering Issue
- **Issue**: NPCs table schema mismatch between `create-admin-tables.sql` (no `world_id`) and `db/migrations/20250101_npc_system.sql` (has `world_id`)
- **Impact**: World-based filtering would fail if NPCs don't have `world_id` set
- **Resolution**: Backend now fetches all active NPCs without world filtering (for now)

## Solution Implemented

### 1. Backend API Endpoints Created
**Location:** `backend/src/routes/admin.ts`

Added the following endpoints:

```typescript
GET    /api/admin/entry-points/:entryPointId/npcs
       → Get NPC bindings for an entry point

GET    /api/admin/entry-points/:entryPointId/npcs/available
       → Get available NPCs (excluding already bound)

POST   /api/admin/entry-points/:entryPointId/npcs
       → Create NPC binding

PUT    /api/admin/entry-points/:entryPointId/npcs/:bindingId
       → Update NPC binding

DELETE /api/admin/entry-points/:entryPointId/npcs/:bindingId
       → Delete NPC binding
```

**Key Features:**
- Fetches all **active** NPCs (status = 'active')
- Excludes already-bound NPCs from available list
- Returns NPC name with binding for display
- No world filtering (avoids schema mismatch issues)

### 2. Frontend Service Refactored
**Location:** `frontend/src/services/admin.npcBindings.ts`

**Changes:**
- Removed all direct Supabase calls
- Simplified to only essential methods
- Uses `apiGet`, `apiPost`, `apiPut`, `apiDelete` from `@/lib/api`

**New Interface:**
```typescript
class NPCBindingsService {
  getEntryBindings(entryPointId: string)
  getAvailableNPCs(entryPointId: string)
  createBinding(data: CreateBindingData)
  updateBinding(bindingId: string, entryPointId: string, data: UpdateBindingData)
  deleteBinding(bindingId: string, entryPointId: string)
}
```

### 3. Frontend Component Fixed
**Location:** `frontend/src/admin/components/EntryPointNpcsTab.tsx`

**Changes:**
- Changed `loadNPCs()` to call `getAvailableNPCs(entryPointId)` instead of non-existent `getNPCsForWorld(worldId)`
- Updated `handleUpdateBinding` to pass `entryPointId` parameter
- Updated `handleDeleteBinding` to pass `entryPointId` parameter
- Added auto-reload of available NPCs list after create/update/delete operations

## Testing Instructions

### 1. Verify NPCs Display
1. Navigate to Admin → NPCs
2. Confirm you have at least one NPC with `status = 'active'`
3. Navigate to Admin → Entry Points → [Your Entry Point]
4. Click on "NPC Bindings" tab
5. **Expected**: NPCs should now be visible in the "Available NPCs" section (no longer shows "No NPCs available")

### 2. Test NPC Binding Creation
1. In the NPC Bindings tab, click "Add NPC Binding"
2. Select an NPC from the dropdown
3. Enter a role hint (e.g., "guide", "merchant")
4. Set weight (optional, defaults to 1)
5. Save
6. **Expected**: 
   - Binding appears in "NPC Bindings (X)" list
   - The NPC is removed from "Available NPCs" dropdown
   - Success toast appears

### 3. Test NPC Binding Update
1. Find an existing binding in the list
2. Click Edit icon
3. Change role hint or weight
4. Save
5. **Expected**:
   - Changes are reflected in the list
   - Success toast appears

### 4. Test NPC Binding Deletion
1. Find an existing binding in the list
2. Click Delete icon
3. Confirm deletion
4. **Expected**:
   - Binding is removed from list
   - NPC becomes available again in the dropdown
   - Success toast appears

## Architecture Improvements

### ✅ Proper Separation of Concerns
- Frontend only communicates with backend API
- No direct database access from frontend
- Backend handles all data validation and business logic

### ✅ Consistent Error Handling
- Backend returns typed JSON errors
- Frontend displays user-friendly error messages via toast
- All errors are logged to console for debugging

### ✅ RESTful API Design
- Resource-based URLs (`/entry-points/:id/npcs`)
- Proper HTTP verbs (GET, POST, PUT, DELETE)
- Consistent response format (`{ ok, data }` or `{ ok, error }`)

## Future Improvements

### 1. World Filtering (Schema Fix Required)
**Issue**: NPCs table schema mismatch prevents reliable world filtering

**Options:**
- **Option A**: Add `world_id` column to admin NPCs table (align with core migration)
- **Option B**: Remove world constraint (allow NPCs to be used across worlds)
- **Option C**: Create a worlds_admin view that resolves the ID type mismatch

**Recommendation**: Choose based on game design requirements

### 2. NPC Relationship Validation
- Validate that NPC and entry point are compatible
- Check NPC availability/status before binding
- Consider role hint validation (enum or suggestions)

### 3. Bulk Operations
- Add endpoint to bind multiple NPCs at once
- Add endpoint to reorder bindings (change weights)
- Add endpoint to copy bindings from another entry point

## Related Files

### Modified:
- `backend/src/routes/admin.ts` (lines 3320-3688)
- `frontend/src/services/admin.npcBindings.ts` (complete rewrite)
- `frontend/src/admin/components/EntryPointNpcsTab.tsx` (lines 49-115)

### Related:
- `docs/fixes/DIRECT_SUPABASE_CALLS_FIX.md` (similar architectural issue)
- `docs/fixes/ENTRY_POINTS_COMPLETE_FIX_SUMMARY.md` (entry points API refactor)
- `db/migrations/20250101_npc_system.sql` (NPC schema with world_id)
- `create-admin-tables.sql` (NPCs table without world_id)

## Verification Checklist

- [x] Backend API endpoints created and tested
- [x] Frontend service refactored to use backend API
- [x] Frontend component updated to use correct methods
- [x] No linter errors
- [ ] Manual testing completed (pending user verification)
- [ ] Schema mismatch documented for future resolution

## Notes

- Schema mismatch for `world_id` in NPCs table is **documented but not resolved**
- Backend currently fetches all active NPCs **without world filtering**
- This is a **pragmatic solution** that works with current schema inconsistency
- Future implementation should resolve schema and add proper world filtering if needed

