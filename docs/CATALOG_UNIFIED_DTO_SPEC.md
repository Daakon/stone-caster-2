# Catalog Unified DTO Specification

**Date:** 2025-10-30  
**Purpose:** Single source of truth for user-facing catalog - mirrors admin data model

---

## Phase 0: Discovery & Plan ✅

### Admin Entry Points Table Schema

Source: `create-admin-tables.sql` (lines 40-58)

```sql
CREATE TABLE entry_points (
  id text PRIMARY KEY,
  name text NOT NULL,                    -- Internal/admin name
  slug text UNIQUE,
  type text NOT NULL CHECK (type IN ('adventure', 'scenario', 'sandbox', 'quest')),
  world_id uuid REFERENCES worlds(id),
  title text NOT NULL,                   -- User-facing title
  subtitle text,                         -- User-facing subtitle/tagline
  description text NOT NULL,             -- Full description
  synopsis text,                         -- Short synopsis
  tags text[] DEFAULT '{}',
  visibility text DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'private')),
  content_rating text NOT NULL,          -- 'safe', 'mature', 'explicit'
  lifecycle text DEFAULT 'draft' CHECK (lifecycle IN ('draft', 'pending_review', 'changes_requested', 'active', 'archived', 'rejected')),
  prompt jsonb DEFAULT '{}',             -- Prompt configuration
  entry_id uuid REFERENCES entries(id),  -- Reference to entry (start point)
  created_at timestamptz,
  updated_at timestamptz
);
```

**Note:** The admin table also references `entry_point_rulesets` junction table for many-to-many ruleset relationships.

---

## Unified Catalog DTO

### User-Facing Entry Point DTO

```typescript
interface CatalogEntryPoint {
  // === IDENTITY ===
  id: string;                    // Primary key (TEXT)
  slug: string;                  // URL-friendly identifier
  type: 'adventure' | 'scenario' | 'sandbox' | 'quest';
  
  // === CONTENT (User-Facing) ===
  title: string;                 // Display title
  subtitle: string | null;       // Tagline/subtitle (nullable)
  description: string;           // Full description (HTML safe)
  synopsis: string | null;       // Short synopsis (nullable)
  tags: string[];                // Searchable/filterable tags
  
  // === CLASSIFICATION ===
  world_id: string | null;       // World UUID (nullable for now)
  world_name: string | null;     // World display name (joined)
  content_rating: 'safe' | 'mature' | 'explicit';
  
  // === COMPUTED FLAGS (UX) ===
  is_playable: boolean;          // Can user start this now?
  has_prompt: boolean;           // Has a configured prompt
  
  // === METADATA ===
  created_at: string;            // ISO 8601 timestamp
  updated_at: string;            // ISO 8601 timestamp
  
  // === OPTIONAL (For detail page only) ===
  hero_quote?: string | null;    // Hero quote for detail page
  rulesets?: Array<{             // Associated rulesets
    id: string;
    name: string;
    sort_order: number;
  }>;
}
```

### List Response DTO

```typescript
interface CatalogListResponse {
  ok: true;
  data: CatalogEntryPoint[];
  meta: {
    total: number;               // Total matching items
    limit: number;               // Items per page
    offset: number;              // Current offset
    filters: {                   // Echo applied filters
      world?: string;
      q?: string;
      tags?: string[];
      rating?: string[];
      visibility?: string[];
      activeOnly?: boolean;
      playableOnly?: boolean;
    };
    sort: string;                // Applied sort option
  };
}
```

---

## Field Mapping Rules

### 1. Identity Fields

| Admin Field | DTO Field | Mapping Rule |
|-------------|-----------|--------------|
| `id` | `id` | Direct copy |
| `slug` | `slug` | Direct copy (must exist, indexed) |
| `type` | `type` | Direct copy |

### 2. Content Fields

| Admin Field | DTO Field | Mapping Rule |
|-------------|-----------|--------------|
| `title` | `title` | Direct copy |
| `subtitle` | `subtitle` | Nullable; return `null` if empty string |
| `description` | `description` | Direct copy |
| `synopsis` | `synopsis` | Nullable; return `null` if empty string |
| `tags` | `tags` | Direct copy array |
| `prompt.hero_quote` | `hero_quote` | Extract from prompt JSONB (detail page only) |

**Fallback Rules:**
- If `title` is empty → fallback to `name` (should never happen due to NOT NULL)
- If `description` is empty → fallback to `synopsis` or "No description available"
- If `synopsis` is null → OK (not required for list view)

### 3. Classification Fields

| Admin Field | DTO Field | Mapping Rule |
|-------------|-----------|--------------|
| `world_id` | `world_id` | Direct copy (nullable UUID as string) |
| `worlds.name` | `world_name` | LEFT JOIN on `worlds.id = entry_points.world_id` |
| `content_rating` | `content_rating` | Direct copy |

### 4. Computed Flags

#### `is_playable` Logic

```typescript
function computeIsPlayable(row: AdminRow): boolean {
  // Must be active lifecycle
  if (row.lifecycle !== 'active') return false;
  
  // Must be public or unlisted (private excluded)
  if (row.visibility === 'private') return false;
  
  // Must have a prompt configured
  if (!row.prompt || Object.keys(row.prompt).length === 0) return false;
  
  // Must have an entry_id (start point)
  if (!row.entry_id) return false;
  
  return true;
}
```

#### `has_prompt` Logic

```typescript
function computeHasPrompt(row: AdminRow): boolean {
  return row.prompt && Object.keys(row.prompt).length > 0;
}
```

### 5. Metadata Fields

| Admin Field | DTO Field | Mapping Rule |
|-------------|-----------|--------------|
| `created_at` | `created_at` | Convert to ISO 8601 string |
| `updated_at` | `updated_at` | Convert to ISO 8601 string |

### 6. Rulesets (Detail Page Only)

**Query:**
```sql
SELECT 
  r.id, 
  r.name, 
  epr.sort_order
FROM entry_point_rulesets epr
JOIN rulesets r ON r.id = epr.ruleset_id
WHERE epr.entry_point_id = :entryPointId
ORDER BY epr.sort_order;
```

**Mapping:** Return as `rulesets` array in DTO

---

## Filter & Sort Specifications

### Default Filters (Applied Automatically)

| Filter | Default Value | Purpose |
|--------|---------------|---------|
| `activeOnly` | `true` | Only show `lifecycle = 'active'` |
| `playableOnly` | `true` | Only show `is_playable = true` |
| `visibility` | `['public']` | Only show public items by default |

### Available Filters (Query Params)

| Param | Type | Example | SQL Filter |
|-------|------|---------|------------|
| `world` | string | `?world=uuid` | `world_id = :world` |
| `q` | string | `?q=dragon` | `search_text @@ plainto_tsquery('english', :q)` OR `title ILIKE '%:q%'` |
| `tags` | string[] | `?tags=fantasy&tags=magic` | `tags && :tagsArray` |
| `rating` | string[] | `?rating=safe&rating=mature` | `content_rating IN (:ratings)` |
| `visibility` | string[] | `?visibility=public&visibility=unlisted` | `visibility IN (:visibility)` |
| `activeOnly` | boolean | `?activeOnly=false` | If false, include drafts/archived |
| `playableOnly` | boolean | `?playableOnly=false` | If false, include non-playable |

### Sort Options

| Sort Key | SQL ORDER BY | Default |
|----------|--------------|---------|
| `-updated` | `updated_at DESC` | ✅ |
| `-created` | `created_at DESC` | |
| `-popularity` | `popularity_score DESC, updated_at DESC` | |
| `alpha` | `title ASC` | |
| `custom` | `sort_weight DESC, updated_at DESC` | |

### Pagination

| Param | Type | Default | Max |
|-------|------|---------|-----|
| `limit` | integer | 20 | 100 |
| `offset` | integer | 0 | - |

---

## API Contract

### Endpoint 1: List Entry Points

**Request:**
```http
GET /api/catalog/entry-points?world=uuid&q=dragon&tags=fantasy&limit=20&offset=0
```

**Response:**
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

### Endpoint 2: Get Entry Point Detail

**Request:**
```http
GET /api/catalog/entry-points/whispercross-arrival
```

**Response:**
```json
{
  "ok": true,
  "data": {
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
    "created_at": "2025-01-15T10:30:00Z",
    "updated_at": "2025-10-28T15:45:00Z",
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

1. **`is_playable` is computed** from `lifecycle`, `visibility`, `prompt`, and `entry_id`
   - Not stored in database
   - Computed at query time for consistency

2. **No legacy fields in new DTO**
   - No `versions` array
   - No `v1` compatibility props
   - Clean slate for frontend

3. **Sensible defaults for thin content**
   - `subtitle` → `null` (not required)
   - `synopsis` → `null` (not required)
   - `description` → fallback to synopsis or placeholder

4. **Playable defaults**
   - User catalog defaults to `playableOnly=true`
   - Admin can toggle to see drafts/archived

5. **World name is joined**
   - LEFT JOIN on `worlds` table
   - Returns `null` if world not found or not set

6. **Rulesets in detail page only**
   - Too expensive to join for list view
   - Only fetched for detail endpoint

---

## Implementation Notes

### Database Query Strategy

**List Query (Optimized):**
```sql
SELECT 
  ep.id,
  ep.slug,
  ep.type,
  ep.title,
  ep.subtitle,
  ep.description,
  ep.synopsis,
  ep.tags,
  ep.world_id,
  w.name as world_name,
  ep.content_rating,
  ep.lifecycle,
  ep.visibility,
  ep.prompt,
  ep.entry_id,
  ep.created_at,
  ep.updated_at
FROM entry_points ep
LEFT JOIN worlds w ON w.id = ep.world_id
WHERE ep.lifecycle = 'active'
  AND ep.visibility IN ('public', 'unlisted')
  AND (ep.prompt IS NOT NULL AND ep.prompt::text != '{}')
  AND ep.entry_id IS NOT NULL
ORDER BY ep.updated_at DESC
LIMIT :limit OFFSET :offset;
```

**Performance Considerations:**
- Use existing indexes on `lifecycle`, `visibility`, `world_id`, `tags`
- Full-text search on `search_text` tsvector column
- Pagination via `LIMIT`/`OFFSET` (consider cursor-based for scale)

---

## Nullability & Fallbacks

| Field | Nullable? | Fallback |
|-------|-----------|----------|
| `id` | No | - |
| `slug` | No | - |
| `type` | No | - |
| `title` | No | - |
| `subtitle` | Yes | `null` |
| `description` | No | `synopsis` or "No description available" |
| `synopsis` | Yes | `null` |
| `tags` | No | `[]` (empty array) |
| `world_id` | Yes | `null` |
| `world_name` | Yes | `null` or "Unknown World" |
| `content_rating` | No | - |
| `is_playable` | No | Computed |
| `has_prompt` | No | Computed |
| `created_at` | No | - |
| `updated_at` | No | - |
| `hero_quote` | Yes | `null` (detail only) |
| `rulesets` | Yes | `[]` (detail only) |

---

## Acceptance Criteria ✅

- [x] Every field of the DTO is documented with type and nullability
- [x] Mapping rules from admin → DTO defined with fallbacks
- [x] `is_playable` computed from `lifecycle`, `visibility`, `prompt`, and `entry_id`
- [x] `has_prompt` computed from `prompt` JSONB content
- [x] No legacy fields (`versions`, v1 compat) in the DTO
- [x] Default filters: `activeOnly=true`, `playableOnly=true`, `visibility=['public']`
- [x] Sort options defined: `-updated` (default), `-created`, `-popularity`, `alpha`, `custom`
- [x] Pagination: `limit` (default 20, max 100), `offset` (default 0)

---

## Next Steps → Phase 1

1. Implement `GET /api/catalog/entry-points` (list) in `backend/src/routes/catalog.ts`
2. Implement `GET /api/catalog/entry-points/:idOrSlug` (detail) in `backend/src/routes/catalog.ts`
3. Add Zod validation for query parameters and response DTOs
4. Write unit tests for `is_playable` and `has_prompt` computation
5. Test pagination, filtering, and sorting logic

