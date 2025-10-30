# Entry Point Ruleset Field Fix

## Issue Summary

**Error:** `PGRST116 - Cannot coerce the result to a single JSON object` when updating entry points in the admin interface.

**Root Cause:** The `EntryPointForm` component was sending a `ruleset_id` field (singular, string) that doesn't exist in the database schema. The database uses a multi-ruleset architecture with a junction table `entry_point_rulesets`.

## Database Schema

The `entry_points` table does NOT have a `ruleset_id` column. Instead, rulesets are managed through:

1. **Main Table:** `entry_points` (no `ruleset_id` column)
2. **Junction Table:** `entry_point_rulesets` with columns:
   - `entry_point_id` (FK to entry_points)
   - `ruleset_id` (FK to rulesets)
   - `sort_order` (for ordering multiple rulesets)

## Changes Made

### 1. Updated Form Schema (`frontend/src/admin/components/EntryPointForm.tsx`)

**Before:**
```typescript
const entryPointSchema = z.object({
  // ...
  ruleset_id: z.string().min(1, 'Ruleset is required'),
  // ...
});
```

**After:**
```typescript
const entryPointSchema = z.object({
  name: z.string().min(1, 'Name is required'),  // Added missing field
  // ...
  rulesetIds: z.array(z.string()).min(1, 'At least one ruleset is required'),
  // ...
});
```

### 2. Updated Form Default Values

**Before:**
```typescript
defaultValues: {
  // ...
  ruleset_id: entryPoint?.ruleset_id || '',
  // ...
}
```

**After:**
```typescript
defaultValues: {
  name: entryPoint?.name || '',  // Added
  // ...
  rulesetIds: entryPoint?.rulesets?.map(r => r.id) || [],
  // ...
}
```

### 3. Updated Form Field

**Before:**
```typescript
<Select
  value={watch('ruleset_id')}
  onValueChange={(value) => setValue('ruleset_id', value)}
>
```

**After:**
```typescript
<Select
  value={watch('rulesetIds')?.[0] || ''}
  onValueChange={(value) => setValue('rulesetIds', [value])}
>
```

### 4. Added Internal Name Field

Added a new "Internal Name" field to the form, which is required by the `CreateEntryPointData` interface but was missing from the form.

```typescript
<div className="space-y-2">
  <Label htmlFor="name">Internal Name *</Label>
  <Input
    id="name"
    {...register('name')}
    placeholder="Internal identifier (e.g., test-entry-point-1)"
  />
  <p className="text-xs text-muted-foreground">
    Internal database identifier. Use lowercase letters, numbers, hyphens, and underscores.
  </p>
</div>
```

### 5. Updated Test Files

Updated test mocks to use the correct structure:

**`frontend/tests/services/admin.entryPoints.spec.ts`:**
```typescript
const createData = {
  name: 'test-adventure-1',  // Added
  // ...
  rulesetIds: ['ruleset-1'],  // Changed from ruleset_id
  // ...
};
```

**`frontend/tests/admin/entry_points.edit.spec.tsx`:**
```typescript
const mockEntryPoint = {
  // ...
  name: 'test-entry-point-1',  // Added
  rulesets: [{ id: 'ruleset-1', name: 'Standard Rules', sort_order: 0 }],  // Changed
  // ...
};
```

## Service Layer (No Changes Required)

The `EntryPointsService` already correctly handles the multi-ruleset architecture:

- **Create:** Extracts `rulesetIds` from data, creates entry point, then creates junction table records
- **Update:** Extracts `rulesetIds`, updates entry point, deletes old associations, creates new ones
- **Read:** Joins with `entry_point_rulesets` to populate `rulesets` array

## Testing Checklist

- [x] Form schema validation passes
- [x] No TypeScript errors
- [x] No linter errors
- [x] Test files updated
- [ ] Manual testing: Create new entry point with ruleset
- [ ] Manual testing: Update existing entry point's ruleset
- [ ] Manual testing: Verify junction table records created correctly

## Future Enhancements

Currently, the form only supports selecting a single ruleset (stored as an array with one element). To support multiple rulesets:

1. Replace the single `<Select>` with a multi-select component
2. Update the UI to show all selected rulesets
3. Allow drag-and-drop reordering (updates `sort_order`)
4. Test with multiple rulesets

## Related Files

- `frontend/src/admin/components/EntryPointForm.tsx` - Form component
- `frontend/src/services/admin.entryPoints.ts` - Service layer
- `frontend/tests/services/admin.entryPoints.spec.ts` - Service tests
- `frontend/tests/admin/entry_points.edit.spec.tsx` - Form tests
- `db/migrations/20250130000000_core_schema.sql` - Database schema
- `create-admin-tables.sql` - Admin schema

## Database Migration Notes

The database already has the correct schema. No migration is needed. The issue was purely a frontend form/API mismatch.

## Prevention

To prevent similar issues:

1. **Type Safety:** Ensure form schemas match TypeScript interfaces exactly
2. **Schema Documentation:** Keep database schema documentation up-to-date
3. **Integration Tests:** Add tests that verify form submissions against actual database schema
4. **Code Review:** Check that form fields match database columns before merging

