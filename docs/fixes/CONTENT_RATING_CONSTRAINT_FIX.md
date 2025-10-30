# Entry Points Content Rating Constraint Fix

## Issue

Database constraint violation when creating or updating entry points:

```
Error: new row for relation "entry_points" violates check constraint "entry_points_content_rating_check"
```

## Root Cause

The form was offering content rating values that don't match the database CHECK constraint.

**Form Values (WRONG):**
- `'general'` ❌
- `'teen'` ❌
- `'mature'` ✅

**Database CHECK Constraint:**
```sql
content_rating text NOT NULL DEFAULT 'safe' 
CHECK (content_rating IN ('safe', 'mature', 'explicit'))
```

**Allowed Values:**
- `'safe'` ✅
- `'mature'` ✅
- `'explicit'` ✅

## Fix

### Files Changed

**`frontend/src/admin/components/EntryPointForm.tsx`**

Changed the dropdown options:

```tsx
// Before (WRONG)
<SelectContent>
  <SelectItem value="general">General</SelectItem>
  <SelectItem value="teen">Teen</SelectItem>
  <SelectItem value="mature">Mature</SelectItem>
</SelectContent>

// After (CORRECT)
<SelectContent>
  <SelectItem value="safe">Safe</SelectItem>
  <SelectItem value="mature">Mature</SelectItem>
  <SelectItem value="explicit">Explicit</SelectItem>
</SelectContent>
```

Changed the default value:

```tsx
// Before
content_rating: entryPoint?.content_rating || 'general',

// After
content_rating: entryPoint?.content_rating || 'safe',
```

### Test Files Updated

**`frontend/tests/services/admin.entryPoints.spec.ts`**
- Changed `content_rating: 'general'` → `content_rating: 'safe'`

**`frontend/tests/admin/entry_points.edit.spec.tsx`**
- Changed `content_rating: 'general'` → `content_rating: 'safe'`

## Database Schema Reference

From `db/migrations/20250130000000_core_schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS entry_points (
    -- ... other columns ...
    content_rating text NOT NULL DEFAULT 'safe' 
        CHECK (content_rating IN ('safe', 'mature', 'explicit')),
    -- ... other columns ...
);
```

## Content Rating Definitions

- **safe**: Content suitable for all ages. No adult themes, violence, or explicit content.
- **mature**: Content may contain moderate violence, suggestive themes, or mild language. Suitable for ages 13+.
- **explicit**: Content contains graphic violence, sexual content, or strong language. Adults only (18+).

## Related Files

- Database schema: `db/migrations/20250130000000_core_schema.sql`
- Form component: `frontend/src/admin/components/EntryPointForm.tsx`
- Service interface: `frontend/src/services/admin.entryPoints.ts`

## Verification

After this fix, creating an entry point with:
```json
{
  "content_rating": "safe"  // ✅ Valid
}
```

Will succeed, whereas before:
```json
{
  "content_rating": "general"  // ❌ Invalid
}
```

Would fail with a CHECK constraint violation.

## Prevention

When adding dropdown fields that correspond to database columns with CHECK constraints:

1. **Always check the database schema first** for the allowed values
2. **Copy the exact constraint values** into the form options
3. **Update TypeScript types** to match the database constraint
4. **Add tests** that verify valid values are accepted

## Related Fixes

This is the third issue found and fixed in the entry points admin flow:

1. `ruleset_id` vs `rulesetIds` field mismatch
2. Direct Supabase calls instead of backend API
3. **Content rating constraint mismatch** (this fix)

All three issues are now resolved.

