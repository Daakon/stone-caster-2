# Admin Media System - Phase 1

## Purpose

Foundation for admin image uploads and media management. This phase establishes the database schema, RLS policies, and type definitions. No API routes or UI are implemented yet.

## Tables

### `media_assets`

Stores uploaded media files (images) with metadata:
- `id`: UUID primary key
- `owner_user_id`: References `auth.users(id)`
- `kind`: Type of entity this media is for (`'npc'`, `'world'`, `'story'`, `'site'`)
- `provider`: Storage provider (default: `'cloudflare_images'`)
- `provider_key`: Provider-specific identifier (e.g., Cloudflare Images ID) - UNIQUE with provider
- `visibility`: `'private'`, `'unlisted'`, or `'public'`
- `status`: `'pending'`, `'ready'`, or `'failed'`
- `image_review_status`: `'pending'`, `'approved'`, or `'rejected'`
- `width`, `height`: Image dimensions
- `sha256`: File hash for deduplication
- `created_at`, `ready_at`: Timestamps

**Note**: Assets are asset-centric (no `entity_id`). They are linked to entities via `media_links` table.

### `media_links`

Gallery links connecting entities to multiple media assets:
- `id`: UUID primary key
- `world_id`: TEXT, references `worlds.id` (nullable)
- `story_id`: TEXT, references `entry_points.id` (nullable)
- `npc_id`: UUID, references `npcs.id` (nullable)
- `media_id`: References `media_assets(id)`
- `role`: Default `'gallery'` (for future expansion)
- `sort_order`: Display order

**Constraint**: Exactly one of `world_id`, `story_id`, or `npc_id` must be non-null.

## Cover Image References

The following tables now have a nullable `cover_media_id` column that references `media_assets(id)`:
- `worlds`
- `entry_points` (stories in admin UI)
- `npcs`

## Publish Status Fields

The following tables now have publish status tracking (idempotent - only added if missing):
- `publish_status`: `'draft'`, `'in_review'`, `'published'`, or `'rejected'`
- `published_at`: Timestamp when published
- `published_by`: User who published (references `auth.users(id)`)

Applied to:
- `worlds`
- `entry_points` (stories)
- `npcs`

## Image Variants

The system supports the following image variant names (defined in config, not yet used):
- `thumb`: Thumbnail size
- `avatar`: Avatar/profile image
- `card`: Card display size
- `banner`: Banner/header image

## RLS Overview

### `media_assets` Policies

- **Owner read**: Owners can select their own media assets
- **Public read**: Anyone can select media with `visibility = 'public'`
- **Owner insert**: Owners can insert with `owner_user_id = auth.uid()`
- **Owner update**: Owners can update only their own rows
- **Admin full**: Admins (via `is_admin()` JWT claim) can perform all operations

### `media_links` Policies

- **Owner manage**: Owners can manage links only for entities they own and only when `publish_status = 'draft'`
- **Admin full**: Admins can perform all operations

## Admin Bypass

RLS policies use the `public.is_admin()` function which checks the JWT claim `is_admin = 'true'` or the `profiles.role = 'admin'` pattern already established in the codebase.

## Note on Terminology

In the admin UI, "scenarios" are called "stories". The database table is `entry_points` with `type = 'scenario'`. The `media_links.entity_type` uses `'story'` to match admin terminology.

## Feature Flag

The `FF_ADMIN_MEDIA` feature flag (default: `false`) controls access to this feature. It is defined in `backend/src/config/featureFlags.ts` but not yet wired to any routes or UI.

## Phase 1b Changes

### Asset-Centric Design

- `media_assets` no longer has `entity_id` column. Assets are standalone and linked via `media_links` only.
- This simplifies the schema and makes assets reusable across entities.

### Typed Link Columns

- `media_links` now uses typed columns instead of polymorphic `(entity_type, entity_id)`:
  - `world_id` (TEXT, matches `worlds.id`)
  - `story_id` (TEXT, matches `entry_points.id`)
  - `npc_id` (UUID, matches `npcs.id`)
- CHECK constraint ensures exactly one of the three is non-null.
- UNIQUE constraint on `(coalesce(world_id, story_id, npc_id), media_id)` prevents duplicate links.

### Indexes and Constraints

- UNIQUE constraint on `media_assets(provider, provider_key)` prevents duplicate uploads.
- Index on `media_assets(created_at)` for approval queue queries.
- Partial indexes on `media_links` for each entity type for fast lookups.

### RLS Improvements

- RLS policies now use typed columns for efficient joins (no text casts).
- Owner policies check `publish_status = 'draft'` via direct table joins.
- Admin bypass via `public.is_admin()` function (JWT claim pattern).

## Phase 2a Changes

### Backend API

**POST `/api/media/uploads`** (Admin/Dev notes only)

Request a direct upload URL from Cloudflare Images and create a pending media asset.

**Request:**
```json
{
  "kind": "npc" | "world" | "story" | "site"
}
```

**Response:**
```json
{
  "uploadURL": "https://upload.imagedelivery.net/...",
  "media": {
    "id": "uuid",
    "owner_user_id": "uuid",
    "kind": "world",
    "provider": "cloudflare_images",
    "provider_key": "cf-image-id",
    "visibility": "private",
    "status": "pending",
    "image_review_status": "pending" | "approved",
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

**Features:**
- Requires authentication (JWT)
- Gated by `FF_ADMIN_MEDIA` feature flag (returns 404 if disabled)
- `image_review_status` is `approved` for admins, `pending` for non-admins
- Creates `media_assets` row with `status='pending'` and `visibility='private'`

### URL Builder Helper

**`buildImageUrl(deliveryUrl, imageId, variant)`**

Builds Cloudflare Images delivery URLs for variants:
- `thumb`: Thumbnail size
- `avatar`: Avatar/profile image
- `card`: Card display size
- `banner`: Banner/header image

**Example:**
```typescript
const url = buildImageUrl(
  'https://imagedelivery.net/H1wcHgsbpczAJHyB61JpRw',
  'cf-image-id-123',
  'card'
);
// Returns: https://imagedelivery.net/H1wcHgsbpczAJHyB61JpRw/cf-image-id-123/card
```

### Environment Variables

Required for Cloudflare Images integration:
- `CF_ACCOUNT_ID`: Cloudflare account ID
- `CF_API_TOKEN`: Cloudflare API token with Images permissions
- `CF_IMAGES_ACCOUNT_HASH`: Account hash for delivery URLs
- `CF_IMAGES_DELIVERY_URL`: Base delivery URL (e.g., `https://imagedelivery.net/H1wcHgsbpczAJHyB61JpRw`)

Configuration is validated at startup (non-blocking warnings if missing).

## Phase 2b Changes

### Finalize Upload Endpoint

**POST `/api/media/:id/finalize`**

Finalizes an uploaded image by fetching metadata from Cloudflare Images and updating the media asset.

**Request:**
- Path parameter: `id` (UUID of media_assets row)

**Response:**
```json
{
  "media": {
    "id": "uuid",
    "owner_user_id": "uuid",
    "kind": "world",
    "provider": "cloudflare_images",
    "provider_key": "cf-image-id",
    "visibility": "private",
    "status": "ready",
    "image_review_status": "pending",
    "width": 1920,
    "height": 1080,
    "sha256": null,
    "created_at": "2025-01-01T00:00:00Z",
    "ready_at": "2025-01-01T01:00:00Z"
  }
}
```

**Features:**
- Requires authentication (JWT)
- Gated by `FF_ADMIN_MEDIA` feature flag
- Ownership enforced: only owner or admin can finalize
- **Idempotent**: If status is already `'ready'`, returns existing row without updating
- Updates `width`, `height`, `status='ready'`, `ready_at=now()`
- Returns 404 if media not found
- Returns 502 (Bad Gateway) on Cloudflare API errors

**Typical Flow:**
1. Client calls `POST /api/media/uploads` → receives `uploadURL` and `media` row
2. Client uploads image directly to Cloudflare using `uploadURL`
3. Client calls `POST /api/media/:id/finalize` → updates metadata and sets status to `ready`

### Phase 2a Refinements

**Conflict Handling:**
- If `(provider, provider_key)` unique constraint is violated (retries, double-click), the service fetches and returns the existing row instead of failing with 409.

**Audit Logging:**
- `media_direct_upload_issued` event logged with `media_id`, `owner_user_id`, `kind`, `provider_key`

**Telemetry:**
- `media_finalize_started`: Logged when finalize begins (media_id, owner_user_id)
- `media_finalize_succeeded`: Logged on success (media_id, width, height, duration_ms)

## Phase 2c Changes

### Cover Media Endpoints

**PATCH `/api/media/worlds/:id/cover-media`**
**PATCH `/api/media/stories/:id/cover-media`**
**PATCH `/api/media/npcs/:id/cover-media`**

Set or clear the cover image for a world, story (entry_point), or NPC.

**Request:**
```json
{
  "mediaId": "uuid-or-null"
}
```

**Response:**
```json
{
  "world": {
    "id": "world-id",
    "owner_user_id": "uuid",
    "publish_status": "draft",
    "cover_media_id": "uuid-or-null"
  }
}
```

**Permissions:**
- If `publish_status='published'` and user is not admin → 403
- If user is not admin: must own the entity (`owner_user_id`)
- If `mediaId` provided: must own the media asset (or be admin)

**Behavior:**
- Setting `mediaId` to `null` clears the cover image
- Media asset must exist (any status allowed for drafts; publish preflight will enforce `ready` + `approved` later)

### Gallery Link Endpoints

**POST `/api/media/links`**

Create a gallery link between a media asset and an entity.

**Request:**
```json
{
  "target": {
    "kind": "world|story|npc",
    "id": "entity-id"
  },
  "mediaId": "uuid",
  "role": "gallery",
  "sortOrder": 0
}
```

**Response:**
```json
{
  "link": {
    "id": "uuid",
    "role": "gallery",
    "sort_order": 0,
    "media_id": "uuid",
    "target": {
      "kind": "world",
      "id": "entity-id"
    }
  }
}
```

**DELETE `/api/media/links/:linkId`**

Delete a gallery link. Returns 204 on success.

**PATCH `/api/media/links/reorder`**

Bulk update `sort_order` for links under a single target entity.

**Request:**
```json
{
  "target": {
    "kind": "world|story|npc",
    "id": "entity-id"
  },
  "orders": [
    { "linkId": "uuid", "sortOrder": 0 },
    { "linkId": "uuid", "sortOrder": 1 }
  ]
}
```

**Response:**
```json
{
  "ok": true
}
```

**Permissions (all gallery endpoints):**
- Same as cover media: publish lock + ownership rules
- Reorder: all `linkId`s must belong to the specified target (rejects cross-target mutations)

### Permissions Matrix

| Entity Status | User Role | Can Modify? |
|--------------|-----------|-------------|
| `draft` | Owner | ✅ Yes |
| `draft` | Non-owner | ❌ No (403) |
| `draft` | Admin | ✅ Yes |
| `published` | Owner | ❌ No (403) |
| `published` | Non-owner | ❌ No (403) |
| `published` | Admin | ✅ Yes |

**Note:** Publish preflight (future phase) will enforce that cover images and gallery media have `status='ready'` and `image_review_status='approved'` before allowing publish.

## Phase 2d Changes

### Admin Approval Endpoints

**GET `/api/media/pending`**

List pending images awaiting approval. Admin-only.

**Query Parameters:**
- `limit` (default 25, max 100): Number of items per page
- `cursor` (optional): Opaque string for keyset pagination
- `kind` (optional): Filter by `npc|world|story|site`
- `owner` (optional): Filter by uploader UUID

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "owner_user_id": "uuid",
      "kind": "world",
      "provider": "cloudflare_images",
      "provider_key": "cf-id",
      "visibility": "private",
      "status": "ready",
      "image_review_status": "pending",
      "width": 1920,
      "height": 1080,
      "sha256": null,
      "created_at": "2025-01-01T00:00:00Z",
      "ready_at": "2025-01-01T01:00:00Z"
    }
  ],
  "nextCursor": "base64-encoded-cursor"
}
```

**POST `/api/media/:id/approve`**

Approve or reject a single image. Admin-only.

**Request:**
```json
{
  "review": "approved|rejected",
  "reason": "optional reason string"
}
```

**Response:**
```json
{
  "media": {
    "id": "uuid",
    "image_review_status": "approved",
    ...
  }
}
```

**POST `/api/media/approve-bulk`**

Bulk approve or reject multiple images. Admin-only.

**Request:**
```json
{
  "ids": ["uuid1", "uuid2"],
  "review": "approved|rejected"
}
```

**Response:**
```json
{
  "updated": ["uuid1", "uuid2"],
  "skipped": ["uuid3"]
}
```

**Features:**
- All endpoints require admin authentication
- Gated by `FF_ADMIN_MEDIA` feature flag
- Keyset pagination for stable, efficient paging
- Bulk review skips invalid IDs (does not fail entire batch)
- Rejection only affects `image_review_status`; visibility unchanged

**Pagination:**
- Uses keyset pagination with `(created_at DESC, id DESC)` for stable ordering
- Cursor is base64-encoded JSON: `{ createdAt: string, id: string }`
- Pass `cursor` from previous response's `nextCursor` to get next page

## Phase 2e Changes

### Publish Preflight Media Requirements

When `FF_ADMIN_MEDIA=true`, entities cannot be published unless they have a cover image that is:
- **Present**: `cover_media_id` must be set
- **Ready**: `status='ready'` (finalized with dimensions)
- **Approved**: `image_review_status='approved'` (admin-reviewed)

**Error Codes:**
- `MISSING_COVER_MEDIA`: Entity has no cover image assigned
- `COVER_NOT_READY`: Cover image exists but `status !== 'ready'`
- `COVER_NOT_APPROVED`: Cover image is ready but `image_review_status !== 'approved'`

**Warnings (Non-blocking):**
- `GALLERY_ITEMS_NOT_APPROVED`: Gallery images that are not ready or approved (does not block publish)

**Remediation:**
1. Upload and finalize a cover image (`POST /api/media/uploads` → upload → `POST /api/media/:id/finalize`)
2. Wait for admin approval (or if admin, approve via `POST /api/media/:id/approve`)
3. Retry publish

**Integration:**
- Media checks run automatically in `recordPublishRequest()` before setting `review_state='pending_review'`
- Gallery warnings are included in preflight response but do not block publishing

## Phase 3a: Admin UI Uploader

### Overview

A minimal admin-only UI component for uploading images via Cloudflare Direct Upload, with automatic finalization and preview. This phase covers the upload flow only; cover and gallery assignment come in later phases.

### Component: `MediaUploader`

**Location:** `frontend/src/components/admin/MediaUploader.tsx`

**Props:**
- `kind: 'world' | 'story' | 'npc' | 'site'` - Entity type for the upload
- `onUploaded?: (media: MediaAssetDTO) => void` - Callback after successful upload
- `buttonLabel?: string` - Custom button text (default: "Upload image")
- `className?: string` - Additional CSS classes

**Flow:**
1. User selects image file
2. Component calls `POST /api/media/uploads` with `{ kind }`
3. Receives `{ uploadURL, media }` from backend
4. Uploads file directly to Cloudflare using `uploadURL` (multipart/form-data)
5. Calls `POST /api/media/:id/finalize` to fetch dimensions and set status='ready'
6. Displays preview using `buildImageUrl(provider_key, 'card')`
7. Calls `onUploaded(media)` callback

**States:**
- `idle` - Ready for file selection
- `uploading` - File is being uploaded to Cloudflare
- `finalizing` - Backend is fetching metadata and updating status
- `error` - Upload or finalize failed (shows error message with retry)
- `success` - Upload complete, preview displayed

**Accessibility:**
- File input has `aria-label` and `aria-busy` during upload
- Error messages are announced via Alert component
- Loading states are visually indicated

### Integration Points

**Story Edit Page** (`frontend/src/pages/admin/entry-points/id.tsx`):
- New "Images" tab (only visible when `FF_ADMIN_MEDIA=true`)
- Contains `MediaUploader` with `kind="story"`

**World Edit Page** (`frontend/src/pages/admin/worlds/edit.tsx`):
- New "Images (Admin)" card section (only visible when `FF_ADMIN_MEDIA=true`)
- Contains `MediaUploader` with `kind="world"`

**NPC Edit Page** (`frontend/src/pages/admin/npcs/edit.tsx`):
- New "Images (Admin)" card section (only visible when `FF_ADMIN_MEDIA=true`)
- Contains `MediaUploader` with `kind="npc"`

### Feature Flag

**Frontend:** `VITE_FF_ADMIN_MEDIA` (default: `false`)
- Checked via `isAdminMediaEnabled()` from `@/lib/feature-flags`
- When `false`, Images sections are completely hidden

**Backend:** `FF_ADMIN_MEDIA` (default: `false`)
- Endpoints return 404/501 when disabled

### Known Limitations

- **No cover assignment:** Uploaded images are not automatically set as cover images
- **No gallery management:** Gallery link creation/ordering not yet available
- **No approval UI:** Image approval happens separately via admin approval endpoints
- **No image list:** Recent uploads list not yet implemented (optional enhancement)

### Error Handling

- **Upload request failure:** Shows inline error, allows retry
- **Cloudflare upload failure:** Shows CF error message, allows retry
- **Finalize failure:** Shows error with suggestion to retry (re-select file)
- **Missing delivery URL:** Shows success message but no preview (graceful degradation)

### Preview

- Uses `card` variant (16:9 aspect ratio)
- Displays dimensions and status after finalization
- Falls back to success message if delivery URL not configured

## Phase 3c: Admin Approvals UI

### Overview

Admin-only UI for reviewing and approving pending image uploads. Provides a paginated table with filters, bulk actions, and optimistic updates.

### Route

**Path:** `/admin/media/approvals`

**Access:** Admin-only (gated by `Guarded` component and `FF_ADMIN_MEDIA` feature flag)

### Features

- **Paginated Table:** Keyset pagination using `nextCursor` from API
- **Filters:**
  - Kind: `all` | `world` | `story` | `npc` | `site`
  - Owner: UUID text input (client-side filtering for MVP)
- **Bulk Actions:** Select multiple images and approve/reject in batch
- **Optimistic Updates:** Items are removed from list immediately on approve/reject, with rollback on error
- **Empty State:** Positive message when no pending images

### Components

**ApprovalsPage** (`frontend/src/pages/admin/media/ApprovalsPage.tsx`):
- Main page component with filters, pagination controls, and bulk action bar
- Manages URL state for filters and cursor
- Handles optimistic updates and error recovery

**ApprovalsTable** (`frontend/src/components/admin/media/ApprovalsTable.tsx`):
- Table component displaying pending images
- Columns: Thumbnail, Kind, Owner, Created (relative time), Status, Actions
- Row selection checkboxes with header checkbox for "select all"
- Inline Approve/Reject buttons per row

**usePendingMedia Hook** (`frontend/src/hooks/usePendingMedia.ts`):
- React Query hook for fetching pending media
- Supports filters (kind, owner) and keyset pagination
- Returns `{ items, nextCursor, loading, error, refetch }`

### User Flow

1. Admin navigates to `/admin/media/approvals` (visible in nav when `FF_ADMIN_MEDIA=true`)
2. Page loads pending images (default: 25 per page)
3. Admin can:
   - Filter by kind or owner
   - Select individual rows or use "select all"
   - Approve/reject single images (with optional rejection reason)
   - Bulk approve/reject selected images
4. On approve/reject:
   - Item(s) are optimistically removed from list
   - API call is made
   - On success: toast notification, list refetches
   - On error: items restored, error toast shown

### Navigation

**AdminNav** (`frontend/src/admin/components/AdminNav.tsx`):
- New nav item: "Image Approvals" (🖼️ icon)
- Admin-only, feature-flag gated
- Links to `/admin/media/approvals`

### API Integration

Uses Phase 2d endpoints:
- `GET /api/media/pending` - List pending images with filters and pagination
- `POST /api/media/:id/approve` - Approve/reject single image
- `POST /api/media/approve-bulk` - Bulk approve/reject

### Error Handling

- **API errors:** Toast notification, optimistic updates rolled back
- **Network errors:** Error message displayed, items restored
- **Feature flag disabled:** Page shows message that feature is disabled

### Testing

**E2E Tests** (`frontend/e2e/admin-media-approvals.spec.ts`):
- Happy path: navigate, view table, approve single image
- Bulk actions: select multiple, bulk approve/reject
- Error handling: API failures trigger rollback and error toasts
- Permissions: non-admin users are redirected, feature flag hides nav item

**Unit Tests**:
- `frontend/tests/hooks/usePendingMedia.test.tsx`: Hook handles filters, pagination, errors correctly
- `frontend/tests/components/admin/media/ApprovalsTable.test.tsx`: Table renders, selection works, actions call callbacks

### Behavior Notes

- **Selection reset:** When kind/owner filter or cursor (page) changes, all selected row IDs are cleared to prevent bulk actions across different pages/filters
- **Owner filter:** Expects UUID input (labeled as "Owner ID (UUID)"). Email lookup can be added as a future enhancement
- **Thumbnail fallback:** If `VITE_CF_IMAGES_DELIVERY_URL` is not set, shows a placeholder icon instead of broken image

### Known Limitations

- **Owner filter:** Currently requires UUID input; no email lookup (MVP)
- **Entity links:** Not yet implemented (would require join query to resolve entity from media)
- **Previous page:** Keyset pagination only supports forward navigation (no "previous" cursor tracking)
- **Rejection reason:** Prompt-based (not persisted in UI; sent to API if provided)

---

## Phase 4: Public Cover Images on Cards + Publish-Time Visibility

**Branch:** `feat/admin-media-p4-cards`

### Overview

Phase 4 makes cover images visible on public-facing catalog cards and ensures that when an entity is published, its cover image becomes publicly accessible.

### Part 1: Publish-Time Cover Visibility

When an entity (world, story, or NPC) is approved for publishing, its cover image is automatically set to `visibility='public'` so that non-authenticated users can view it on public catalog pages.

**Implementation:**
- Added cover visibility update in `backend/src/dal/publishing.ts` → `approveSubmission()`
- After entity approval, if `cover_media_id` is present and `FF_ADMIN_MEDIA` is enabled:
  - Updates `media_assets.visibility = 'public'` for the cover image
  - Emits telemetry event `media.cover_made_public` with `entity_type`, `entity_id`, `media_id`
- Non-fatal: if media update fails, logs error but doesn't block approval
- Idempotent: re-approving an already-approved entity is safe

**Tests:**
- `backend/tests/dal/publishing.test.ts`: Covers visibility update, idempotency, and no-cover cases

### Part 2: Cover Images on Public Cards

Public-facing catalog cards (worlds, stories) now display cover images when available.

**Backend Changes:**
- Updated catalog routes (`backend/src/routes/catalog.ts`):
  - Added `cover_media_id` to select statements
  - Joined with `media_assets` to fetch cover info (`id`, `provider_key`, `status`, `image_review_status`, `visibility`)
  - Only includes cover in response if: `status='ready'`, `image_review_status='approved'`, `visibility='public'`
  - Updated `transformToCatalogDTO()` to include `cover_media: { id, provider_key } | null`

**Frontend Changes:**
- Updated `CatalogCard` component:
  - Added `coverMedia` prop (optional)
  - Uses `buildImageUrl(provider_key, 'card')` when `coverMedia` is present and `VITE_CF_IMAGES_DELIVERY_URL` is set
  - Falls back to `imageUrl` prop if `coverMedia` is missing
  - Shows placeholder icon if no cover and no `imageUrl`
  - Includes `onError` handler to swap to placeholder on image load failure
- Updated `EntryPointCard` component:
  - Reads `cover_media` from `CatalogEntryPoint` DTO
  - Same image rendering logic as `CatalogCard`
- Updated `CatalogEntryPointSchema` to include optional `cover_media` field

**Fallback Behavior:**
- If `VITE_CF_IMAGES_DELIVERY_URL` is not set (local dev), shows placeholder icon
- If image fails to load, swaps to placeholder via `onError` handler
- If `cover_media` is `null` or missing, shows placeholder (existing behavior)

**Performance:**
- Images use `loading="lazy"` for below-the-fold cards
- Images include explicit `width` and `height` to prevent layout shifts
- CSS constrains image sizes with `object-cover` and aspect ratio containers

### API Response Shape

Catalog endpoints now include `cover_media` in responses:

```typescript
{
  // ... other fields ...
  cover_media: {
    id: string;
    provider_key: string;
  } | null
}
```

`cover_media` is `null` if:
- Entity has no `cover_media_id`
- Cover image is not `ready`
- Cover image is not `approved`
- Cover image is not `public`

### Cards Updated

- **World cards** (`/api/catalog/worlds`, `/api/catalog/worlds/:idOrSlug`, WorldsPage, WorldDetailPage)
- **Story/Entry Point cards** (`/api/catalog/stories`, `/api/catalog/entry-points`, StoriesPage, detail routes, My Stories page)
- **NPC cards** (`/api/catalog/npcs`, NPCsPage, WorldDetailPage, StoryDetailPage)

Cover images are now displayed consistently across:
- Public catalog/browse pages (worlds, stories, NPCs)
- Admin catalog views
- "My Stories" page (user's own stories)
- Detail pages showing related entities (e.g., NPCs in a world, featured NPCs in a story)

### Acceptance Criteria

✅ Publishing an entity with a valid cover sets that cover's visibility to `public` (idempotent)  
✅ Worlds and stories show cover images on their main public-facing cards when available  
✅ Cards gracefully fall back to placeholder when no cover is available or config is missing  
✅ Tests cover both publish-visibility behavior and card rendering  
✅ No UI change for admin-only tools; this is strictly player-facing

### Known Limitations

- **Gallery images:** Remain private/unlisted by default (only covers become public on publish)
- **My Adventures page:** Active games list does not yet show story cover images (requires games API update to include cover_media in GameListDTO)
- **Image variants:** Currently uses `'card'` variant; other variants (thumb, banner) can be added per card size needs
- **NPC cover images:** NPC catalog endpoints may need updates to include cover_media joins (cards are ready to display covers when API provides them)

---

## Phase 5: Prompt Snapshots and Media Stability

### Overview

When a Story or World is published, a **prompt snapshot** is created that includes media references (cover and gallery). These references are frozen at publish time and remain stable for games created from that published content.

### Media References in Snapshots

The snapshot captures:
- **`coverMediaId`**: The cover image ID at publish time (from `entry_points.cover_media_id` or `worlds.cover_media_id`)
- **`galleryMediaIds`**: Array of approved + ready gallery media IDs (from `media_links` where `status='ready'` and `image_review_status='approved'`)

### Stability Guarantee

**Important**: Published media references (cover, gallery) are part of the snapshot and **do not change** if you later edit the story's images. A new publish is required to update the media references in the snapshot.

**Why**: This ensures that games created from published content continue to use the same media assets throughout their lifecycle, even if:
- The story's cover image is changed
- Gallery images are added/removed/reordered
- Media assets are updated or replaced

### How It Works

1. **At Publish Time**: 
   - Snapshot captures current `cover_media_id` and all approved+ready gallery links
   - Snapshot is created BEFORE cover visibility update (ensures atomicity)

2. **Game Creation**: 
   - Games created from published content reference the snapshot's media IDs via `games.prompt_snapshot_id`
   - Assembler uses snapshot's media references when building prompts

3. **Ongoing Games**: 
   - Even if you change the story's cover or gallery after publish, existing games continue using the snapshot's media references
   - New games created after a re-publish will use the new snapshot's media references

### Cross-Reference

See `docs/publishing/README.md` Phase 5 section for full details on:
- Prompt snapshot creation and versioning
- Game binding behavior
- Assembler integration
- Database schema and indexes

---

## Phase 6: Admin Edit Page Integration

### Overview

Phase 6 integrates cover image and gallery management directly into the World, Story, and NPC edit pages, allowing admins to manage media without leaving the entity edit context.

### Implementation

**Backend Changes:**
- Extended `GET /api/admin/worlds/:id`, `GET /api/admin/entry-points/:id`, and `GET /api/admin/npcs/:id` to include:
  - `coverMedia`: Cover media asset with status/review info (if `FF_ADMIN_MEDIA` enabled)
  - `galleryMedia`: Array of gallery links with media assets (if `FF_ADMIN_MEDIA` enabled)
- Only includes approved + ready assets in responses (for clarity in admin UI)
- Pending items can still be shown with "Pending review" chip

**Frontend Components:**
- `CoverImagePanel`: Component for setting/clearing cover images
  - Shows current cover preview with status chips
  - "Set as Cover" button for selected media
  - "Clear Cover" button when cover is set
  - Disabled when entity is published
- `GalleryManager`: Component for managing gallery images
  - Add/remove/reorder gallery items
  - Drag-drop reordering (draft only)
  - Read-only display when published
  - Status chips for each item

**Integration:**
- Integrated into:
  - `frontend/src/pages/admin/worlds/edit.tsx`
  - `frontend/src/pages/admin/entry-points/id.tsx`
  - `frontend/src/pages/admin/npcs/edit.tsx`
- Feature-flag gated: Only visible when `FF_ADMIN_MEDIA=true`
- Uses React Query for data fetching and caching

### Behavior Rules

**Cover Image:**
- Must be approved AND ready to be used
- When `publish_status='draft'`: Admin can set/clear/replace cover
- When published: UI shows cover but blocks edits (disabled with tooltip "Cannot modify published items")

**Gallery:**
- Only available in draft
- Supports: Add, Remove, Reorder (drag-drop)
- When published: Items displayed read-only (no delete/drag)

**Media State Chips:**
- Ready + approved: "Approved" (green)
- Ready + pending: "Pending review" (yellow)
- Failed: "Failed" (red)

### API Endpoints Used

- `GET /api/admin/worlds/:id` - Includes `coverMedia` and `galleryMedia` in response
- `GET /api/admin/entry-points/:id` - Includes `coverMedia` and `galleryMedia` in response
- `GET /api/admin/npcs/:id` - Includes `coverMedia` and `galleryMedia` in response
- `PATCH /api/worlds/:id/cover-media` - Set/clear cover
- `PATCH /api/stories/:id/cover-media` - Set/clear cover
- `PATCH /api/npcs/:id/cover-media` - Set/clear cover
- `POST /api/media/links` - Create gallery link
- `DELETE /api/media/links/:linkId` - Delete gallery link
- `PATCH /api/media/links/reorder` - Reorder gallery links

### Notes

- **Snapshot Capture**: When an entity is published, the snapshot captures the current `cover_media_id` and `galleryMediaIds` at publish time. These references are frozen and do not change even if you later edit the entity's images.
- **Publish Immutability**: Once published, media editing is locked to ensure snapshot stability. A new publish is required to update media references in the snapshot.

### Cross-Reference

See `docs/publishing/wizard.md` for the publishing wizard that includes media checks as part of the unified preflight workflow.

