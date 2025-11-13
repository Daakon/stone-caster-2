# User Authoring Guide

**Phase 8:** User-facing content creation with quotas and publish requests

## Overview

Regular users can create worlds, stories, and NPCs with strict per-user quotas. Content starts as private drafts and can be submitted for admin review. Once published, content becomes public and immutable for the user.

## Quotas

Per-user limits (enforced server-side):

- **Worlds:** 1
- **Stories:** 3
- **NPCs:** 6

### Quota Semantics (Option A)

**Published items do NOT count toward quota.**

Only items with `publish_status` in `('draft', 'in_review', 'rejected')` count against your quota. This means:

- You can have unlimited published content
- You're limited in active work-in-progress items
- Once published, a slot is freed up for new drafts

**Example:**
- User has 1 published world → quota shows "0 / 1" (published doesn't count)
- User creates 1 draft world → quota shows "1 / 1" (at limit)
- User publishes the draft → quota shows "0 / 1" again (published slot freed)

## Lifecycle

Content follows this lifecycle:

```
Draft → In Review → Published
                ↓
            Rejected (can resubmit)
```

### States

#### Draft
- **Editability:** Fully editable by owner
- **Visibility:** Private (only owner can see)
- **Actions:** Can edit, delete, submit for publish

#### In Review
- **Editability:** Read-only for owner (locked by RLS)
- **Visibility:** Private (only owner and admins can see)
- **Actions:** None for owner (admins can approve/reject via publishing wizard)
- **Note:** Once submitted, user cannot modify until admin acts

#### Published
- **Editability:** Immutable for owner (locked by RLS)
- **Visibility:** Public (if visibility='public' and review_state='approved')
- **Actions:** View link to public catalog/game creation

#### Rejected
- **Editability:** Fully editable by owner (can fix issues)
- **Visibility:** Private
- **Actions:** Can edit, delete, resubmit for publish
- **Note:** Rejection reason should be provided by admin (future enhancement)

## Submit for Publish

### How It Works

1. User clicks "Submit for Publish" on a draft or rejected item
2. Backend runs light preflight checks:
   - Required fields present (name, description, etc.)
   - Dependencies valid (stories need published world, etc.)
   - Media requirements (stories require approved cover)
3. If checks pass, `publish_status` changes to `'in_review'`
4. Admin uses Publishing Wizard to finalize and approve
5. On approval, content becomes published

### Preflight Checks

**Worlds:**
- Name and description required
- Cover image optional (but recommended)

**Stories:**
- Title and description required
- Must be assigned to a published world
- Cover image required and must be approved

**NPCs:**
- Name required
- If assigned to world, world must be published
- Cover image optional

### Error Codes

The submit-for-publish endpoint returns standardized error codes:

- `QUOTA_EXCEEDED` - User has reached their limit
- `ALREADY_IN_REVIEW` - Item is already under review
- `ALREADY_PUBLISHED` - Item is already published
- `VALIDATION_FAILED` - Preflight checks failed (missing fields, dependencies, etc.)

## Media Behavior

### Draft Content

- Users can upload images via `/api/media/uploads`
- Images start as `visibility='private'` and `image_review_status='pending'`
- Images are visible to the user in draft content
- Images do NOT appear publicly until approved and content is published

### Publishing Flow

When admin approves content via Publishing Wizard:

1. Cover media visibility is updated to `'public'` (if approved)
2. Gallery media remains private until explicitly approved
3. All media references are frozen in the prompt snapshot

### User Expectations

- **Draft images:** Private, visible only to you
- **After approval:** Cover becomes public automatically
- **Gallery images:** Require separate admin approval

## Edit Rules

### Draft
- ✅ Full edit access (name, description, content, media)
- ✅ Can delete
- ✅ Can submit for publish

### In Review
- ❌ No edits allowed (RLS blocks updates)
- ❌ Cannot delete
- ✅ Can view (read-only)

### Published
- ❌ No edits allowed (RLS blocks updates)
- ❌ Cannot delete
- ✅ Can view public version

### Rejected
- ✅ Full edit access (same as draft)
- ✅ Can delete
- ✅ Can resubmit for publish

## API Endpoints

### User-Facing Endpoints

**List:**
- `GET /api/worlds` - Returns `{ items: World[], total: number, quotas: { limit, used, remaining } }`
- `GET /api/stories` - Returns `{ items: Story[], total: number, quotas: { limit, used, remaining } }`
- `GET /api/npcs` - Returns `{ items: NPC[], total: number, quotas: { limit, used, remaining } }`

**Create:**
- `POST /api/worlds` - Creates new world (enforces quota)
- `POST /api/stories` - Creates new story (enforces quota)
- `POST /api/npcs` - Creates new NPC (enforces quota)

**Submit for Publish:**
- `POST /api/worlds/:id/submit-for-publish`
- `POST /api/stories/:id/submit-for-publish`
- `POST /api/npcs/:id/submit-for-publish`

### Admin Endpoints

Admin endpoints (`/api/admin/worlds`, `/api/admin/entry-points`, `/api/admin/npcs`) bypass quota checks and are intended for internal content management.

## RLS Policies

Row-Level Security policies enforce edit restrictions:

- **Non-admin users:** Can only UPDATE/DELETE when `publish_status = 'draft'`
- **Admins:** Full access regardless of `publish_status`
- **SELECT:** Users can read their own content in any status

See `supabase/migrations/20250213_phase8_rls_lock_in_review.sql` for full policy definitions.

## Integration with Publishing Pipeline

User drafts flow into the same publishing pipeline once submitted:

1. **User submits** → `publish_status = 'in_review'`
2. **Admin reviews** → Uses Publishing Wizard (Phase 7)
3. **Admin approves** → Creates prompt snapshot, updates visibility, sets `publish_status = 'published'`
4. **Content goes live** → Public visibility, immutable for user

The Publishing Wizard handles:
- Full preflight checks (media, dependencies, validation)
- Prompt snapshot creation
- Media visibility updates
- Final approval/rejection

## Constants

Quota limits are defined in `backend/src/services/quotaService.ts`:

```typescript
export const USER_QUOTAS = {
  worlds: 1,
  stories: 3,
  npcs: 6,
} as const;
```

Frontend can import from `@/lib/constants` (matches backend values).

## Status Labels

Status-to-label mapping in `shared/src/types/publishing.ts`:

```typescript
export const PUBLISH_STATUS_LABELS: Record<PublishStatus, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  published: 'Published',
  rejected: 'Rejected',
};
```

Use this mapping in UI to avoid magic strings.

## Future Enhancements

- Rejection reasons displayed to users
- Bulk operations (delete multiple drafts)
- Quota increase requests
- Draft templates
- Collaboration features (shared drafts)

