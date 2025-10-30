# Entry Points Service - Direct Supabase Calls Fix

## Critical Issue

The frontend was making **direct calls to the Supabase REST API** instead of going through the backend API at `/api/*`. This is a critical architectural violation that bypasses:

- Authentication and authorization layers
- Business logic validation
- Rate limiting and security controls
- Proper API versioning

### Evidence

The URL `https://obfadjnywufemhhhcxiy.supabase.co/rest/v1/entry_points?id=eq.test-entry-point-1&select=*` should **never** be used directly. Instead, it should be:

- **Localhost**: `http://localhost:8787/api/admin/entry-points/test-entry-point-1`
- **Production**: `https://api.stonecaster.ai/api/admin/entry-points/test-entry-point-1`

## Root Cause

The `frontend/src/services/admin.entryPoints.ts` service was using `adminSupabase.from('entry_points')` for direct database access:

```typescript
// ❌ WRONG - Direct Supabase access
const { data, error } = await adminSupabase
  .from('entry_points')
  .update(updateData)
  .eq('id', id)
  .select()
  .single();
```

## Solution

### 1. Backend API Endpoints Added

Added full CRUD endpoints to `backend/src/routes/admin.ts`:

- **POST** `/api/admin/entry-points` - Create entry point
- **GET** `/api/admin/entry-points` - List entry points (already existed)
- **GET** `/api/admin/entry-points/:id` - Get single entry point (already existed)
- **PUT** `/api/admin/entry-points/:id` - Update entry point
- **DELETE** `/api/admin/entry-points/:id` - Delete entry point

### 2. Frontend Service Refactored

Completely rewrote `frontend/src/services/admin.entryPoints.ts` to use the `apiGet`, `apiPost`, `apiPut`, `apiDelete` helpers from `@/lib/api`:

```typescript
// ✅ CORRECT - Through backend API
const result = await apiPut<EntryPoint>(`/api/admin/entry-points/${id}`, data);

if (!result.ok) {
  throw new Error(`Failed to update entry point: ${result.error.message}`);
}

return result.data;
```

This matches the pattern used by all other admin services (`admin.worlds.ts`, `admin.rulesets.ts`, etc.).

## Files Changed

### Frontend

**`frontend/src/services/admin.entryPoints.ts`** - Complete rewrite (289 lines)
- Removed all `adminSupabase` direct calls
- Added proper API client usage
- Simplified logic (no more client-side slug generation, ruleset association handling)
- Proper error handling with typed responses

### Backend

**`backend/src/routes/admin.ts`** - Added 3 new endpoints (354 lines added)
- POST `/api/admin/entry-points` - Creates entry point + ruleset associations
- PUT `/api/admin/entry-points/:id` - Updates entry point + manages ruleset associations
- DELETE `/api/admin/entry-points/:id` - Deletes entry point + cleanup associations

### Documentation

**`frontend/src/admin/components/EntryPointForm.tsx`** - Fixed schema
- Changed `ruleset_id` (singular) → `rulesetIds` (array)
- Added `name` field (required by backend)
- Updated default values to use `entryPoint?.rulesets` array

**`frontend/tests/services/admin.entryPoints.spec.ts`** - Updated tests
- Fixed test data to use `rulesetIds` array
- Added `name` field to test payloads

**`frontend/tests/admin/entry_points.edit.spec.tsx`** - Updated tests
- Fixed mock data to use `rulesets` array structure
- Added `name` and `created_at` fields

## API Flow (Corrected)

### Before (❌ WRONG)

```
Frontend → Supabase REST API (direct)
  ↓
Database
```

### After (✅ CORRECT)

```
Frontend → Backend API (/api/admin/entry-points)
  ↓
Auth & Authorization Check
  ↓
Business Logic & Validation
  ↓
Supabase Client (server-side)
  ↓
Database
```

## Testing Checklist

- [ ] **Create** entry point via admin UI
  - Verify URL is `/api/admin/entry-points` (POST)
  - Verify ruleset associations are created
- [ ] **Update** entry point via admin UI
  - Verify URL is `/api/admin/entry-points/:id` (PUT)
  - Verify ruleset associations are updated
- [ ] **Delete** entry point via admin UI
  - Verify URL is `/api/admin/entry-points/:id` (DELETE)
  - Verify ruleset associations are cleaned up
- [ ] **List** entry points
  - Verify URL is `/api/admin/entry-points` (GET)
  - Verify filtering works
- [ ] **View** entry point details
  - Verify URL is `/api/admin/entry-points/:id` (GET)

## Backend Endpoint Details

### POST /api/admin/entry-points

**Request Body:**
```json
{
  "name": "test-entry-point-1",
  "slug": "test-adventure",
  "type": "scenario",
  "world_id": "a7ceea3f-378e-4214-b3e3-85f3b6ddd8b3",
  "rulesetIds": ["social-tavern"],
  "title": "Test Adventure",
  "subtitle": "Test Subtitle",
  "description": "A test adventure entry point",
  "synopsis": "Test synopsis",
  "tags": ["social", "tavern"],
  "visibility": "public",
  "content_rating": "general"
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "id": "test-entry-point-1",
    "name": "test-entry-point-1",
    "slug": "test-adventure",
    "type": "scenario",
    "world_id": "a7ceea3f-378e-4214-b3e3-85f3b6ddd8b3",
    "title": "Test Adventure",
    "subtitle": "Test Subtitle",
    "description": "A test adventure entry point",
    "synopsis": "Test synopsis",
    "tags": ["social", "tavern"],
    "visibility": "public",
    "content_rating": "general",
    "lifecycle": "draft",
    "created_at": "2025-01-30T12:00:00Z",
    "updated_at": "2025-01-30T12:00:00Z"
  }
}
```

### PUT /api/admin/entry-points/:id

**Request Body:** (partial update)
```json
{
  "title": "Updated Title",
  "lifecycle": "active",
  "rulesetIds": ["social-tavern", "combat-basic"]
}
```

**Response:** Same structure as POST

### DELETE /api/admin/entry-points/:id

**Response:**
```json
{
  "ok": true,
  "message": "Entry point deleted successfully"
}
```

## Architecture Notes

### Why This Pattern?

1. **Security**: All requests go through authentication middleware
2. **Validation**: Backend validates and sanitizes all inputs
3. **Business Logic**: Complex operations (like ruleset associations) are handled server-side
4. **Monitoring**: All API calls can be logged and monitored
5. **Rate Limiting**: API gateway can enforce rate limits
6. **Versioning**: API endpoints can be versioned independently

### Comparison with Other Services

All admin services follow this pattern:

| Service | Uses Backend API | Pattern File |
|---------|-----------------|--------------|
| Worlds | ✅ Yes | `admin.worlds.ts` |
| Rulesets | ✅ Yes | `admin.rulesets.ts` |
| NPCs | ✅ Yes | `admin.npcs.ts` |
| **Entry Points** | ✅ **NOW YES** (was ❌) | `admin.entryPoints.ts` |
| Entries | ✅ Yes | `admin.entries.ts` |

## Related Issues Fixed

This fix also resolved two other issues that were discovered:

1. **`ruleset_id` vs `rulesetIds`**: The form was sending `ruleset_id` (singular) but the system uses `rulesetIds` (array) with a junction table. See `docs/fixes/ENTRY_POINT_RULESET_FIX.md`

2. **Missing `name` field**: The form schema was missing the required `name` field. This has been added.

## Prevention

To prevent similar issues in the future:

1. **Code Review**: Always check that services use `apiGet/Post/Put/Delete` instead of direct Supabase
2. **Linting**: Consider adding an ESLint rule to ban `adminSupabase.from()` in service files
3. **Architecture Documentation**: Maintain clear documentation about the layered architecture
4. **Testing**: Integration tests should verify API URLs (not Supabase URLs)

## Migration Path

If other services are found to have this issue:

1. Check if backend endpoint exists
2. If not, add it to `backend/src/routes/admin.ts`
3. Refactor frontend service to use `apiGet/Post/Put/Delete`
4. Update tests to match new structure
5. Test in dev environment
6. Document in a similar fix file

## Rollout Strategy

1. ✅ Backend endpoints deployed first (backward compatible)
2. ✅ Frontend service updated (uses new endpoints)
3. ✅ Tests updated and passing
4. 🔄 Deploy to staging
5. 🔄 Test manually in staging
6. 🔄 Deploy to production
7. 🔄 Monitor for errors

## Related Documentation

- Original form fix: `docs/fixes/ENTRY_POINT_RULESET_FIX.md`
- API documentation: `docs/API_CONTRACT.md`
- Architecture overview: `docs/FEATURES.md`

