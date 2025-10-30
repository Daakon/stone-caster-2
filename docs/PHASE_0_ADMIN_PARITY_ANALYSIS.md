# Phase 0: Admin Model & User Endpoint Parity Analysis

**Date:** 2025-10-30  
**Objective:** Inventory admin fields and identify gaps in current user-facing Stories endpoint

---

## Admin Source of Truth: `entry_points` Table

**Location:** `create-admin-tables.sql` (lines 40-58)

### Complete Field Inventory

| Field | Type | Constraints | Purpose |
|-------|------|-------------|---------|
| `id` | text | PRIMARY KEY | Unique identifier |
| `name` | text | NOT NULL | Internal/admin name |
| `slug` | text | UNIQUE | URL-friendly identifier |
| `type` | text | NOT NULL, CHECK | Type: adventure, scenario, sandbox, quest |
| `world_id` | uuid | FK to worlds | Associated world |
| `title` | text | NOT NULL | User-facing title |
| `subtitle` | text | nullable | User-facing tagline/subtitle |
| `description` | text | NOT NULL | Full description |
| `synopsis` | text | nullable | Short synopsis |
| `tags` | text[] | DEFAULT '{}' | Searchable tags |
| `visibility` | text | DEFAULT 'public', CHECK | public, unlisted, private |
| `content_rating` | text | NOT NULL | safe, mature, explicit |
| `lifecycle` | text | DEFAULT 'draft', CHECK | draft, pending_review, changes_requested, active, archived, rejected |
| `prompt` | jsonb | DEFAULT '{}' | Prompt configuration (contains hero_quote) |
| `entry_id` | uuid | FK to entries | Reference to entry (start point) |
| `created_at` | timestamptz | DEFAULT now() | Creation timestamp |
| `updated_at` | timestamptz | DEFAULT now() | Last update timestamp |

### Additional Admin Fields (Not in Table)
- `sort_weight` - **MISSING** (needs to be added to schema)
- `popularity_score` - **MISSING** (needs to be added to schema)

### JSONB `prompt` Field Contents
```json
{
  "hero_quote": "string or null"
  // Other prompt configuration...
}
```

---

## Current User Endpoint: `/api/catalog/stories`

**Location:** `backend/src/routes/catalog.ts` (lines 115-168)

### Current Query
```typescript
supabase
  .from('adventures')  // ⚠️ Different table!
  .select('id, world_ref, version, doc, created_at, updated_at')
```

### Current Response Shape
```typescript
{
  id: string,              // from adventures.id
  name: string,            // from adventures.doc.name || id
  slug: string,            // from adventures.doc.slug || id
  tagline: string,         // from adventures.doc.tagline || ''
  short_desc: string,      // from adventures.doc.short_desc || doc.description || ''
  hero_quote: string,      // from adventures.doc.hero_quote || ''
  world_id: string,        // from adventures.world_ref
  status: string,          // from adventures.doc.status || 'draft'
  created_at: string,
  updated_at: string
}
```

---

## Parity Checklist: Admin Field → Current Stories Mapping

| Admin Field | Stories Field | Status | Notes |
|-------------|---------------|--------|-------|
| `id` | `id` | ✅ Present | Maps directly |
| `name` | `name` | ✅ Present | From JSONB `doc.name` |
| `slug` | `slug` | ⚠️ Fallback | From JSONB `doc.slug`, falls back to `id` |
| `type` | ❌ MISSING | ❌ Missing | Not in adventures table or response |
| `world_id` | `world_id` | ⚠️ Different | Uses `world_ref` instead of `world_id` |
| `title` | ❌ MISSING | ❌ Missing | Uses `name` instead |
| `subtitle` | `tagline` | ⚠️ Different name | Present but called `tagline` |
| `description` | ❌ MISSING | ❌ Missing | Not directly available |
| `synopsis` | ❌ MISSING | ❌ Missing | Not directly available |
| `tags` | ❌ MISSING | ❌ Missing | Not in adventures table |
| `visibility` | ❌ MISSING | ❌ Missing | Not in adventures table |
| `content_rating` | ❌ MISSING | ❌ Missing | Not in adventures table |
| `lifecycle` | `status` | ⚠️ Different | Uses simpler `status` from JSONB |
| `prompt` | ❌ MISSING | ❌ Missing | Not available (only hero_quote extracted) |
| `prompt.hero_quote` | `hero_quote` | ✅ Present | From JSONB `doc.hero_quote` |
| `entry_id` | ❌ MISSING | ❌ Missing | Not in adventures table |
| `created_at` | `created_at` | ✅ Present | Maps directly |
| `updated_at` | `updated_at` | ✅ Present | Maps directly |
| | `short_desc` | ➕ Extra | Not in admin; from JSONB `doc.short_desc` |
| | `version` | ➕ Extra | Adventures-specific field |

### Summary
- **✅ Present & Correct:** 3 fields (id, created_at, updated_at)
- **⚠️ Present but Different:** 4 fields (slug, world_id, subtitle/tagline, lifecycle/status)
- **❌ Missing:** 10 critical fields (type, title, description, synopsis, tags, visibility, content_rating, prompt, entry_id, world_name)
- **➕ Extra fields:** 2 (short_desc, version)

---

## Critical Issues Identified

### 1. **Wrong Source Table**
- **Current:** Queries `adventures` table
- **Should:** Query `entry_points` table (admin source of truth)
- **Impact:** Missing most admin fields

### 2. **JSONB Data Buried in `doc` Field**
```json
adventures.doc = {
  name: "...",
  slug: "...",
  tagline: "...",
  short_desc: "...",
  description: "...",
  hero_quote: "...",
  status: "..."
}
```
**Problem:** All user-facing data is in unstructured JSONB, not normalized columns.

### 3. **No Computed Flags**
- `has_prompt` - Not computed
- `is_playable` - Not computed
- These are essential for UX

### 4. **No Filter Support**
- Current: Only `activeOnly` (boolean)
- **Missing:**
  - `world` filter
  - `q` (search) filter
  - `tags` filter
  - `rating` filter
  - `visibility` filter
  - `playableOnly` filter
  - `sort` options
  - `limit`/`offset` pagination

### 5. **No Metadata Response**
- Current: Returns flat array `{ ok, data: [] }`
- **Should return:**
  ```json
  {
    "ok": true,
    "data": [...],
    "meta": {
      "total": 100,
      "limit": 20,
      "offset": 0,
      "filters": { ... },
      "sort": "-updated"
    }
  }
  ```

---

## Unified DTO Specification

**This is the contract the UI will consume after migration**

### TypeScript Interface

```typescript
interface CatalogEntryPoint {
  // === IDENTITY ===
  id: string;                    // PRIMARY KEY
  slug: string;                  // URL-friendly, unique
  type: 'adventure' | 'scenario' | 'sandbox' | 'quest';
  
  // === USER-FACING CONTENT ===
  title: string;                 // Display title (NOT name)
  subtitle: string | null;       // Tagline/subtitle (nullable)
  description: string;           // Full description
  synopsis: string | null;       // Short synopsis (nullable)
  tags: string[];                // Searchable tags
  
  // === CLASSIFICATION ===
  world_id: string | null;       // World UUID (nullable)
  world_name: string | null;     // World display name (joined)
  content_rating: 'safe' | 'mature' | 'explicit';
  
  // === COMPUTED FLAGS (for UX) ===
  is_playable: boolean;          // Can user start this now?
  has_prompt: boolean;           // Has configured prompt
  
  // === METADATA ===
  visibility: 'public' | 'unlisted' | 'private';
  lifecycle: 'draft' | 'pending_review' | 'changes_requested' | 'active' | 'archived' | 'rejected';
  created_at: string;            // ISO 8601
  updated_at: string;            // ISO 8601
  
  // === DETAIL PAGE ONLY (optional) ===
  hero_quote?: string | null;    // Hero quote from prompt
  rulesets?: Array<{             // Associated rulesets
    id: string;
    name: string;
    sort_order: number;
  }>;
}
```

---

## Field Mapping Rules & Fallbacks

### 1. **Identity Fields**

| Admin Field | DTO Field | Mapping Rule |
|-------------|-----------|--------------|
| `id` | `id` | Direct copy |
| `slug` | `slug` | **Prefer:** admin.slug<br>**Fallback:** If null, generate from title (kebab-case)<br>**Never:** Use `id` as slug |
| `type` | `type` | Direct copy (default: 'adventure') |

### 2. **Content Fields**

| Admin Field | DTO Field | Mapping Rule |
|-------------|-----------|--------------|
| `title` | `title` | **Prefer:** admin.title<br>**Fallback 1:** admin.name<br>**Fallback 2:** Humanize slug<br>**Never null** |
| `subtitle` | `subtitle` | **Prefer:** admin.subtitle<br>**Fallback:** `null` (optional) |
| `description` | `description` | **Prefer:** admin.description<br>**Fallback 1:** admin.synopsis<br>**Fallback 2:** "No description available"<br>**Never null** |
| `synopsis` | `synopsis` | **Prefer:** admin.synopsis<br>**Fallback:** `null` (optional) |
| `tags` | `tags` | **Prefer:** admin.tags<br>**Fallback:** `[]` (empty array) |
| `prompt.hero_quote` | `hero_quote` | **Prefer:** admin.prompt.hero_quote<br>**Fallback:** `null` (detail page only) |

### 3. **Classification Fields**

| Admin Field | DTO Field | Mapping Rule |
|-------------|-----------|--------------|
| `world_id` | `world_id` | Direct copy (nullable UUID as string) |
| `worlds.name` | `world_name` | LEFT JOIN on worlds.id = entry_points.world_id<br>**Fallback:** `null` or "Unknown World" |
| `content_rating` | `content_rating` | Direct copy (default: 'safe') |
| `visibility` | `visibility` | Direct copy (default: 'public') |
| `lifecycle` | `lifecycle` | Direct copy (default: 'draft') |

### 4. **Computed Flags**

#### `is_playable` Logic
```typescript
function computeIsPlayable(row): boolean {
  // Must be active lifecycle
  if (row.lifecycle !== 'active') return false;
  
  // Must be public or unlisted (NOT private)
  if (row.visibility === 'private') return false;
  
  // Must have a prompt configured (non-empty JSONB)
  if (!row.prompt || Object.keys(row.prompt).length === 0) return false;
  
  // Must have an entry_id (start point reference)
  if (!row.entry_id) return false;
  
  return true;
}
```

#### `has_prompt` Logic
```typescript
function computeHasPrompt(row): boolean {
  return row.prompt && Object.keys(row.prompt).length > 0;
}
```

### 5. **Metadata Fields**

| Admin Field | DTO Field | Mapping Rule |
|-------------|-----------|--------------|
| `created_at` | `created_at` | Convert to ISO 8601 string |
| `updated_at` | `updated_at` | Convert to ISO 8601 string |

---

## Filter Specifications

### Default Filters (Applied Automatically)

```typescript
{
  activeOnly: true,        // Only lifecycle='active'
  playableOnly: true,      // Only is_playable=true
  visibility: ['public']   // Only public items
}
```

### Available Query Parameters

| Param | Type | Example | SQL Filter |
|-------|------|---------|------------|
| `world` | UUID | `?world=<uuid>` | `world_id = :world` |
| `q` | string | `?q=dragon` | `title ILIKE '%dragon%' OR description ILIKE '%dragon%' OR synopsis ILIKE '%dragon%'` |
| `tags` | string[] | `?tags=fantasy&tags=magic` | `tags && ARRAY['fantasy', 'magic']` |
| `rating` | string[] | `?rating=safe&rating=mature` | `content_rating IN ('safe', 'mature')` |
| `visibility` | string[] | `?visibility=public&visibility=unlisted` | `visibility IN ('public', 'unlisted')` |
| `activeOnly` | boolean | `?activeOnly=false` | If false, include all lifecycles |
| `playableOnly` | boolean | `?playableOnly=false` | If false, include non-playable |
| `sort` | string | `?sort=-updated` | See sort options below |
| `limit` | integer | `?limit=50` | LIMIT clause (max 100) |
| `offset` | integer | `?offset=20` | OFFSET clause |

### Sort Options

| Value | SQL ORDER BY | Default |
|-------|--------------|---------|
| `-updated` | `updated_at DESC` | ✅ |
| `-created` | `created_at DESC` | |
| `-popularity` | `popularity_score DESC, updated_at DESC` | |
| `alpha` | `title ASC` | |
| `custom` | `sort_weight DESC, updated_at DESC` | |

---

## Response Format

### List Response

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
      "description": "You arrive in the remote village of Whispercross...",
      "synopsis": "Investigate strange occurrences in a remote village",
      "tags": ["fantasy", "mystery", "village"],
      "world_id": "a7ceea3f-378e-4214-b3e3-85f3b6ddd8b3",
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
      "world": "a7ceea3f-378e-4214-b3e3-85f3b6ddd8b3",
      "q": "dragon",
      "tags": ["fantasy"],
      "activeOnly": true,
      "playableOnly": true
    },
    "sort": "-updated"
  }
}
```

### Detail Response

```json
{
  "ok": true,
  "data": {
    // ... all list fields ...
    "hero_quote": "The mists of Whispercross conceal secrets long forgotten...",
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

## Decision Log

### ✅ Confirmed Decisions

1. **Source Table:** Query `entry_points` (admin table), NOT `adventures`
2. **Computed Flags:** `is_playable` and `has_prompt` computed at query time
3. **No Legacy Fields:** Remove `version`, rename `tagline` → `subtitle`
4. **Slug Fallback:** Generate from title (kebab-case), never use `id`
5. **Title Fallback:** Prefer title → name → humanized slug
6. **Description Fallback:** Prefer description → synopsis → "No description available"
7. **Default Filters:** activeOnly=true, playableOnly=true, visibility=['public']
8. **World Name:** LEFT JOIN on `worlds` table for display name

### ❌ Fields to Remove from Response

- `version` (adventures-specific, not in admin)
- `short_desc` (use `description` and `synopsis` instead)
- Any JSONB `doc.*` references

### ➕ New Fields to Add

- `type` (adventure/scenario/sandbox/quest)
- `content_rating` (safe/mature/explicit)
- `visibility` (public/unlisted/private)
- `lifecycle` (full enum, not just status)
- `is_playable` (computed)
- `has_prompt` (computed)
- `world_name` (joined)

---

## Acceptance Criteria ✅

- [x] All admin entry_points fields documented with types and constraints
- [x] Current Stories endpoint response shape documented
- [x] Parity checklist created with exact field mapping
- [x] 10 critical missing fields identified
- [x] Computed flags defined (`is_playable`, `has_prompt`)
- [x] Mapping rules with fallbacks specified for each field
- [x] Filter specifications documented
- [x] Response format examples provided
- [x] Decision log records key architectural choices
- [x] Agreement: No legacy fields (`version`, `short_desc`, JSONB `doc.*`) in UI after migration

---

## Next Steps → Phase 1

1. **Update `/api/catalog/stories` endpoint** to query `entry_points` instead of `adventures`
2. **Implement all mapping rules and fallbacks**
3. **Add computed flags** (`is_playable`, `has_prompt`)
4. **Add filter support** (world, q, tags, rating, visibility, activeOnly, playableOnly, sort)
5. **Add pagination** (limit, offset)
6. **Return meta object** with total, filters, sort
7. **Test with sample data** (including Mystika)
8. **Add similar fix to `/api/catalog/stories/:idOrSlug` detail endpoint**

**Critical:** The `/api/catalog/entry-points` endpoints I already created are correct. Now we need to update `/api/catalog/stories` to match the same pattern.


