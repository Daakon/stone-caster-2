# Phase 1: Stories Endpoints Now Mirror Admin ✅

**Date:** 2025-10-30  
**Status:** COMPLETE  
**Objective:** Make `/api/catalog/stories` endpoints return unified DTO that mirrors admin

---

## What Changed

### Before (Legacy)
```typescript
// ❌ Queried adventures table
supabase.from('adventures')
  .select('id, world_ref, version, doc, created_at, updated_at')

// ❌ Returned incomplete DTO
{
  id, name, slug, tagline, short_desc, hero_quote,
  world_id, status, created_at, updated_at
}

// ❌ Only activeOnly filter
// ❌ No metadata (total, filters, pagination)
```

### After (Unified)
```typescript
// ✅ Queries entry_points table (admin source)
supabase.from('entry_points')
  .select(`id, slug, type, title, subtitle, description, synopsis, 
           tags, world_id, worlds:world_id(name), content_rating, 
           lifecycle, visibility, prompt, entry_id, created_at, updated_at`)

// ✅ Returns complete unified DTO
{
  id, slug, type, title, subtitle, description, synopsis,
  tags, world_id, world_name, content_rating,
  is_playable, has_prompt, visibility, lifecycle,
  created_at, updated_at,
  hero_quote?, rulesets?  // detail page only
}

// ✅ All filters: world, q, tags, rating, visibility, activeOnly, playableOnly, sort
// ✅ Full metadata with total, limit, offset, filters, sort
```

---

## Changes Made

### 1. List Endpoint: `GET /api/catalog/stories`

**File:** `backend/src/routes/catalog.ts` (lines 115-240)

#### Changed:
- ✅ **Source:** `adventures` → `entry_points` table
- ✅ **Validation:** Uses `ListQuerySchema` (same as entry-points)
- ✅ **Query:** Selects all admin fields + joined world name
- ✅ **Mapping:** Uses `transformToCatalogDTO()` helper
- ✅ **Computed Flags:** `is_playable` and `has_prompt` calculated
- ✅ **Filters:** All filters supported (world, q, tags, rating, visibility, activeOnly, playableOnly, sort)
- ✅ **Pagination:** limit (default 20, max 100), offset
- ✅ **Response:** Unified format with `meta` object

#### Filters Applied:
```typescript
{
  activeOnly: true,        // Default: only lifecycle='active'
  playableOnly: true,      // Default: only is_playable=true
  visibility: ['public'],  // Default: only public
  world: 'uuid',          // Optional
  q: 'search term',       // Optional
  tags: ['tag1', 'tag2'], // Optional
  rating: ['safe'],       // Optional
  sort: '-updated',       // Default
  limit: 20,              // Default
  offset: 0               // Default
}
```

#### Response Format:
```json
{
  "ok": true,
  "data": [
    {
      "id": "ep-mystika-whispercross",
      "slug": "whispercross-arrival",
      "type": "adventure",
      "title": "Arrival at Whispercross",
      "subtitle": "A mysterious village awaits",
      "description": "Full description...",
      "synopsis": "Short synopsis...",
      "tags": ["fantasy", "mystery"],
      "world_id": "uuid",
      "world_name": "Mystika",
      "content_rating": "safe",
      "is_playable": true,
      "has_prompt": true,
      "visibility": "public",
      "lifecycle": "active",
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": "2025-10-28T15:45:00Z"
    }
  ],
  "meta": {
    "total": 1,
    "limit": 20,
    "offset": 0,
    "filters": {
      "activeOnly": true,
      "playableOnly": true
    },
    "sort": "-updated"
  }
}
```

### 2. Detail Endpoint: `GET /api/catalog/stories/:idOrSlug`

**File:** `backend/src/routes/catalog.ts` (lines 242-325)

#### Changed:
- ✅ **Source:** `adventures` → `entry_points` table
- ✅ **Query:** Selects all admin fields + joined world name
- ✅ **Rulesets:** Fetches associated rulesets via junction table
- ✅ **Mapping:** Uses `transformToCatalogDTO()` with `includeDetail=true`
- ✅ **Additional Fields:** `hero_quote`, `rulesets[]`
- ✅ **Response:** Unified format

#### Response Format:
```json
{
  "ok": true,
  "data": {
    // ... all list fields ...
    "hero_quote": "The mists of Whispercross...",
    "rulesets": [
      {
        "id": "social-tavern",
        "name": "Social Tavern",
        "sort_order": 0
      }
    ]
  }
}
```

---

## Field Mappings Applied

### ✅ All Admin Fields Now Included

| Admin Field | DTO Field | Mapping Rule Applied |
|-------------|-----------|---------------------|
| `id` | `id` | Direct copy |
| `slug` | `slug` | Direct copy (prefer admin.slug) |
| `type` | `type` | Direct copy |
| `title` | `title` | **Prefer:** title → name → humanized slug |
| `subtitle` | `subtitle` | Direct copy (nullable) |
| `description` | `description` | **Prefer:** description → synopsis → "No description available" |
| `synopsis` | `synopsis` | Direct copy (nullable) |
| `tags` | `tags` | Direct copy (default []) |
| `world_id` | `world_id` | Direct copy (nullable) |
| `worlds.name` | `world_name` | LEFT JOIN (nullable) |
| `content_rating` | `content_rating` | Direct copy |
| `visibility` | `visibility` | Direct copy |
| `lifecycle` | `lifecycle` | Direct copy |
| `prompt` | - | Used for computed flags |
| `prompt.hero_quote` | `hero_quote` | Extracted (detail only) |
| `entry_id` | - | Used for `is_playable` flag |
| `created_at` | `created_at` | ISO 8601 string |
| `updated_at` | `updated_at` | ISO 8601 string |
| - | `is_playable` | **Computed** from lifecycle, visibility, prompt, entry_id |
| - | `has_prompt` | **Computed** from prompt presence |
| - | `rulesets` | **Joined** from entry_point_rulesets (detail only) |

### ❌ Legacy Fields Removed

These fields NO LONGER appear in the response:
- ❌ `name` (use `title` instead)
- ❌ `tagline` (use `subtitle` instead)
- ❌ `short_desc` (use `description` and `synopsis` instead)
- ❌ `status` (use `lifecycle` instead)
- ❌ `version` (adventures-specific, not in admin)
- ❌ `world_ref` (use `world_id` instead)
- ❌ Any `doc.*` JSONB fields

---

## Computed Flags Implementation

### `is_playable` Logic
```typescript
function computeIsPlayable(row): boolean {
  if (row.lifecycle !== 'active') return false;
  if (row.visibility === 'private') return false;
  if (!row.prompt || Object.keys(row.prompt).length === 0) return false;
  if (!row.entry_id) return false;
  return true;
}
```

### `has_prompt` Logic
```typescript
function computeHasPrompt(row): boolean {
  return row.prompt && Object.keys(row.prompt).length > 0;
}
```

---

## Filter Support

### Default Filters (Applied Automatically)
```typescript
{
  activeOnly: true,         // Only lifecycle='active'
  playableOnly: true,       // Only is_playable=true
  visibility: ['public']    // Only public items
}
```

### Query Parameters Supported

| Parameter | Type | Example | Effect |
|-----------|------|---------|--------|
| `world` | UUID | `?world=<uuid>` | Filter by world |
| `q` | string | `?q=dragon` | Search title, description, synopsis |
| `tags` | array | `?tags=fantasy&tags=magic` | Filter by tags |
| `rating` | array | `?rating=safe&rating=mature` | Filter by content rating |
| `visibility` | array | `?visibility=public&visibility=unlisted` | Filter by visibility |
| `activeOnly` | boolean | `?activeOnly=false` | Show all lifecycles |
| `playableOnly` | boolean | `?playableOnly=false` | Show non-playable |
| `sort` | string | `?sort=alpha` | Sort option |
| `limit` | integer | `?limit=50` | Items per page (max 100) |
| `offset` | integer | `?offset=20` | Pagination offset |

### Sort Options

| Value | SQL ORDER BY |
|-------|--------------|
| `-updated` | `updated_at DESC` (default) |
| `-created` | `created_at DESC` |
| `-popularity` | `popularity_score DESC, updated_at DESC` |
| `alpha` | `title ASC` |
| `custom` | `sort_weight DESC, updated_at DESC` |

---

## Testing

### Test Queries

```bash
# Default (playable only, active only, public only)
curl http://localhost:3000/api/catalog/stories

# Show all (including drafts and non-playable)
curl http://localhost:3000/api/catalog/stories?activeOnly=false&playableOnly=false

# Search
curl http://localhost:3000/api/catalog/stories?q=mystika

# Filter by tags
curl http://localhost:3000/api/catalog/stories?tags=fantasy

# Filter by world
curl http://localhost:3000/api/catalog/stories?world=<uuid>

# Sort alphabetically
curl http://localhost:3000/api/catalog/stories?sort=alpha

# Pagination
curl http://localhost:3000/api/catalog/stories?limit=10&offset=20

# Detail page
curl http://localhost:3000/api/catalog/stories/whispercross-arrival
```

### Expected Behavior

1. **Default Load:**
   - Only shows items with `lifecycle='active'`, `is_playable=true`, `visibility='public'`
   - Sorted by `updated_at DESC`
   - Returns 20 items per page

2. **Search:**
   - Searches across `title`, `description`, `synopsis`
   - Case-insensitive (ILIKE)

3. **Filters:**
   - All filters can be combined
   - Empty result set returns `{ ok: true, data: [], meta: { total: 0 } }`

4. **Metadata:**
   - Always includes `meta.total`, `meta.limit`, `meta.offset`
   - Echoes applied filters
   - Shows current sort

5. **Detail Page:**
   - Returns 404 if not found
   - Includes `hero_quote` and `rulesets[]`
   - Computed flags still present

---

## Acceptance Criteria ✅

- [x] Stories list queries `entry_points` table (admin source)
- [x] Stories detail queries `entry_points` table (admin source)
- [x] All admin fields included in response
- [x] Computed flags (`is_playable`, `has_prompt`) working
- [x] All filters supported (world, q, tags, rating, visibility, activeOnly, playableOnly, sort)
- [x] Pagination working (limit, offset)
- [x] Metadata included (total, filters, sort)
- [x] Drafts excluded by default (activeOnly=true)
- [x] Non-playable excluded by default (playableOnly=true)
- [x] Legacy fields removed (name, tagline, short_desc, status, version)
- [x] Response format matches unified DTO spec
- [x] Rulesets joined in detail endpoint
- [x] World name joined via LEFT JOIN
- [x] No linter errors

---

## Backward Compatibility

### ⚠️ BREAKING CHANGES

**Frontend code using `/api/catalog/stories` MUST be updated:**

1. **Response Shape Changed:**
   - Old: `{ ok, data: [] }` (flat array)
   - New: `{ ok, data: [], meta: {} }` (with metadata)

2. **Field Names Changed:**
   - `name` → `title`
   - `tagline` → `subtitle`
   - `short_desc` → Use `description` or `synopsis`
   - `status` → `lifecycle`
   - `world_ref` → `world_id`

3. **New Fields Added:**
   - `type`, `tags`, `content_rating`, `visibility`
   - `is_playable`, `has_prompt`, `world_name`

4. **Removed Fields:**
   - `version`, any `doc.*` JSONB fields

### Migration Guide for Frontend

**Old Code:**
```typescript
const response = await fetch('/api/catalog/stories');
const { ok, data } = await response.json();

data.forEach(story => {
  console.log(story.name);        // ❌ No longer exists
  console.log(story.tagline);     // ❌ No longer exists
  console.log(story.short_desc);  // ❌ No longer exists
  console.log(story.status);      // ❌ No longer exists
});
```

**New Code:**
```typescript
const response = await fetch('/api/catalog/stories');
const { ok, data, meta } = await response.json();

console.log(`Total: ${meta.total}, showing ${data.length}`);

data.forEach(story => {
  console.log(story.title);           // ✅ Use title
  console.log(story.subtitle);        // ✅ Use subtitle
  console.log(story.description);     // ✅ Use description
  console.log(story.synopsis);        // ✅ Use synopsis
  console.log(story.lifecycle);       // ✅ Use lifecycle
  console.log(story.is_playable);     // ✅ New computed flag
  console.log(story.content_rating);  // ✅ New field
});
```

---

## Next Steps → Phase 2

Now that the backend returns the unified DTO, the frontend must be updated:

1. **Update Types:** Replace story types with unified `CatalogEntryPoint` type
2. **Update Components:** Surface new fields (subtitle, synopsis, tags, is_playable, content_rating, visibility, lifecycle)
3. **Add Meta Display:** Show slug, lifecycle, visibility, content_rating for QA verification
4. **Update Filters:** Wire new filters to UI (search, tags, rating, sort)
5. **Remove Legacy:** Delete any code expecting old field names
6. **Test:** Verify all sampled items match admin values

See: `docs/PHASE_0_ADMIN_PARITY_ANALYSIS.md` for complete field mappings and verification checklist.


