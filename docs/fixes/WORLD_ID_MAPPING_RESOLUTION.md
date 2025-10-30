# World ID Mapping Resolution Fix

## Issue

Foreign key constraint violation when creating/updating entry points:

```
insert or update on table "entry_points" violates foreign key constraint "entry_points_world_id_fkey"
Key (world_id)=(a7ceea3f-378e-4214-b3e3-85f3b6ddd8b3) is not present in table "worlds".
```

**But the world DOES exist in the API response!**

## Root Cause Analysis

The system uses a **dual ID system** for worlds:

1. **`worlds` table**: Stores TEXT IDs (e.g., `"mystika"`, `"fantasy-realm"`)
2. **`world_id_mapping` table**: Maps UUIDs to TEXT IDs
3. **`worlds_admin` view**: Shows UUIDs (from mapping table) to the frontend

### The Problem

```
Frontend → calls GET /api/admin/worlds
         ↓
Backend → queries worlds_admin view
         ↓
Returns: { id: "a7ceea3f-378e-4214-b3e3-85f3b6ddd8b3" }  ← UUID
         ↓
Frontend → sends this UUID in entry point form
         ↓
Backend → tries to insert UUID directly into entry_points.world_id
         ↓
Database → checks FK constraint against worlds.id (TEXT)
         ↓
FAILS: UUID doesn't match any TEXT ID in worlds table!
```

### The Mapping

```sql
-- worlds table
id (TEXT PRIMARY KEY) | name     | ...
---------------------|----------|----
"mystika"            | "Mystika"| ...

-- world_id_mapping table
uuid_id (UUID)                            | text_id
------------------------------------------|----------
"a7ceea3f-378e-4214-b3e3-85f3b6ddd8b3"   | "mystika"

-- worlds_admin view (what API returns)
Shows the UUID, but entry_points needs the TEXT ID!
```

## Solution

The backend now **resolves UUIDs to TEXT IDs** before inserting/updating:

### POST /api/admin/entry-points

```typescript
// Resolve world_id: if it's a UUID, get the text_id from mapping
let resolvedWorldId = world_id;
if (world_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
  const { data: mapping, error: mappingError } = await supabase
    .from('world_id_mapping')
    .select('text_id')
    .eq('uuid_id', world_id)
    .single();

  if (mappingError || !mapping) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid world_id: World not found in mapping'
    });
  }
  
  resolvedWorldId = mapping.text_id;
}

// Insert with resolved TEXT ID
const { data, error } = await supabase
  .from('entry_points')
  .insert({
    // ...
    world_id: resolvedWorldId, // TEXT ID like "mystika"
    // ...
  });
```

### PUT /api/admin/entry-points/:id

Same UUID resolution logic applied to updates.

## Flow After Fix

```
Frontend → sends UUID: "a7ceea3f-378e-4214-b3e3-85f3b6ddd8b3"
         ↓
Backend → detects UUID pattern
         ↓
Backend → queries world_id_mapping
         ↓
Backend → resolves to TEXT ID: "mystika"
         ↓
Backend → inserts/updates with TEXT ID
         ↓
Database → FK constraint checks worlds.id
         ↓
SUCCESS: "mystika" exists in worlds table!
```

## Files Changed

**`backend/src/routes/admin.ts`**

- Updated `POST /api/admin/entry-points` (lines 3553-3570)
  - Added UUID detection and resolution
  - Inserts resolved TEXT ID

- Updated `PUT /api/admin/entry-points/:id` (lines 3700-3720)
  - Added UUID detection and resolution for updates
  - Updates with resolved TEXT ID

## Testing

### Test Case 1: Create Entry Point with UUID

**Request:**
```json
POST /api/admin/entry-points
{
  "name": "test-entry-point-1",
  "world_id": "a7ceea3f-378e-4214-b3e3-85f3b6ddd8b3",
  // ... other fields
}
```

**Backend Process:**
1. Detects UUID format
2. Queries `world_id_mapping` for `uuid_id = "a7ceea3f..."`
3. Gets `text_id = "mystika"`
4. Inserts with `world_id = "mystika"`

**Result:** ✅ Success

### Test Case 2: Create Entry Point with TEXT ID

**Request:**
```json
POST /api/admin/entry-points
{
  "name": "test-entry-point-2",
  "world_id": "mystika",
  // ... other fields
}
```

**Backend Process:**
1. Detects TEXT format (not UUID)
2. Uses "mystika" directly
3. Inserts with `world_id = "mystika"`

**Result:** ✅ Success (backward compatible)

### Test Case 3: Invalid UUID

**Request:**
```json
POST /api/admin/entry-points
{
  "name": "test-entry-point-3",
  "world_id": "00000000-0000-0000-0000-000000000000",
  // ... other fields
}
```

**Backend Process:**
1. Detects UUID format
2. Queries `world_id_mapping`
3. No mapping found

**Response:**
```json
{
  "ok": false,
  "error": "Invalid world_id: World not found in mapping"
}
```

**Result:** ✅ Proper error handling

## Why This Architecture Exists

The dual ID system allows:

1. **Human-readable IDs** in the database (`"mystika"` instead of UUID)
2. **UUID exposure** to frontend (more standard, prevents collisions)
3. **Backward compatibility** with existing TEXT ID references

However, it requires careful resolution at API boundaries.

## Alternative Solutions Considered

### Option A: Change Frontend to Use TEXT IDs

❌ **Rejected**: Would require changing the `worlds_admin` view and potentially breaking other code

### Option B: Change Database to Use UUIDs

❌ **Rejected**: Would require massive migration, lose human-readable IDs

### Option C: Resolve at API Boundary ✅ **CHOSEN**

✅ **Advantages**:
- No frontend changes needed
- No database migration needed
- Maintains human-readable IDs
- Backward compatible with TEXT IDs

## Related Issues

This is the **fifth and final issue** in the entry points admin flow:

1. ✅ `ruleset_id` → `rulesetIds` field mismatch
2. ✅ Direct Supabase calls → Backend API
3. ✅ Content rating `"general"` → `"safe"`
4. ✅ World foreign key understanding
5. ✅ **World ID UUID → TEXT resolution** (this fix)

## Verification

After this fix, the entry point form should work end-to-end:

```
1. Load form → GET /api/admin/worlds
   Returns: [{ id: "uuid...", name: "Mystika" }]

2. Select world → World UUID stored in form state

3. Submit form → POST /api/admin/entry-points
   Sends: { world_id: "uuid..." }
   
4. Backend resolves → "uuid..." → "mystika"

5. Database insert → entry_points.world_id = "mystika"

6. FK check passes → "mystika" exists in worlds.id

7. Success! ✅
```

## Documentation Updates

- Original schema conflict: `docs/fixes/WORLD_ID_SCHEMA_MISMATCH.md`
- Resolution implementation: `docs/fixes/WORLD_ID_MAPPING_RESOLUTION.md` (this file)
- Complete summary: `docs/fixes/ENTRY_POINTS_COMPLETE_FIX_SUMMARY.md`

## Status

🎉 **FIXED AND DEPLOYED**

The entry points admin interface now correctly handles the world ID dual-system architecture.

