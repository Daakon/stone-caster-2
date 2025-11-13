# World-First Publishing: Phase 0/1 Bootstrap + Phase 2 Persistence + Phase 3 Admin Review + Phase 4 Dependency Monitor + Phase 5 Unified Messaging & Telemetry + Phase 8 User Authoring

This document summarizes the "World-First Publishing" feature, implemented in phases with an additive-only approach.

## User Authoring (Phase 8)

**Phase 8** introduces user-facing content creation with quotas and submit-for-publish flow.

Regular users can create worlds, stories, and NPCs with strict per-user limits (1 world, 3 stories, 6 NPCs). Content starts as private drafts and can be submitted for admin review via the submit-for-publish endpoints.

**Key points:**
- User drafts use the same media and publish pipelines once submitted for review
- Quotas are enforced server-side (published items don't count toward quota - Option A)
- RLS policies lock edits when content is `in_review` or `published`
- Admins use the Publishing Wizard to finalize user submissions

See [User Authoring Guide](../user-authoring.md) for complete documentation on quotas, lifecycle, and user workflows.

## Overview

The World-First Publishing system enforces that Stories and NPCs can only be published if their parent World is already public. This bootstrap phase adds the foundational infrastructure without breaking existing functionality.

## Goals

- **Additive-only**: No existing columns, tables, routes, or UI are removed or renamed
- **Feature-flagged**: All new functionality is behind feature flags (default: disabled)
- **Private play preserved**: Owners can always play their own private content
- **Admin panels preserved**: Existing admin flows remain unchanged

## Feature Flags

All flags default to `false` and must be explicitly enabled:

- `FF_PUBLISH_GATES_OWNER` / `VITE_FF_PUBLISH_GATES_OWNER`: Enable publish request flow for owners
- `FF_ADMIN_REVIEW_QUEUE` / `VITE_FF_ADMIN_REVIEW_QUEUE`: Enable admin review queue
- `FF_DEPENDENCY_MONITOR` / `VITE_FF_DEPENDENCY_MONITOR`: Enable dependency monitoring
- `FF_PUBLISHING_WIZARD_ENTRY` / `VITE_FF_PUBLISHING_WIZARD_ENTRY`: Show publishing entry in admin nav

## Database Schema

### Migration: `20251109_world_first_publish_phase0.sql`

Adds the following columns to `worlds`, `entry_points` (stories), and `npcs`:

**All tables:**
- `visibility` text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public'))
- `review_state` text NOT NULL DEFAULT 'draft' CHECK (review_state IN ('draft', 'pending_review', 'approved', 'rejected'))
- `owner_user_id` uuid NOT NULL (only if missing)
- `version` integer NOT NULL DEFAULT 1 (only if missing)
- `parent_id` uuid NULL
- `review_reason` text NULL
- `reviewed_by` uuid NULL
- `reviewed_at` timestamptz NULL

**Stories and NPCs only:**
- `dependency_invalid` boolean NOT NULL DEFAULT false
- `blocked_reason` text NULL

**Indexes:**
- `idx_<table>_visibility`
- `idx_<table>_review_state`
- `idx_<table>_dependency_invalid` (stories/npcs only)

**Backfill:**
- Sets `review_state = 'approved'` for any row with `visibility = 'public'` and `review_state = 'draft'`

**Note:** `entry_points` already has a `visibility` column with different values (`'public'`, `'unlisted'`, `'private'`). This migration adds `publish_visibility` to avoid conflicts. Application logic will need to map between the two systems.

## API Endpoints

### Public Routes (`/api/publish`)

- `POST /api/publish/:type/:id/request`
  - Validates `type` in `['world', 'story', 'npc']`
  - For story/npc, checks if parent world is public (stub in Phase 0/1)
  - Returns 422 `WORLD_NOT_PUBLIC` if world is not public
  - Returns 501 if `FF_PUBLISH_GATES_OWNER=false`
  - Sets `review_state = 'pending_review'` (stub - no persistence yet)

### Admin Routes (`/api/admin/publishing`)

- `GET /api/admin/publishing/flags` - Returns current feature flag values
- `GET /api/admin/review/queue` - Returns empty array (stub) unless `FF_ADMIN_REVIEW_QUEUE=true`
- `POST /api/admin/review/:type/:id/approve` - 501 unless flags enabled (stub)
- `POST /api/admin/review/:type/:id/reject` - 501 unless flags enabled (stub)

## Frontend UI

### Creator Flow

**World/Story/NPC Builder Pages:**
- Added `PublishButton` component (only visible when `FF_PUBLISH_GATES_OWNER=true`)
- Worlds: "Request Publish" button
- Stories/NPCs: "Request Publish" button (disabled when world is not public)
- Shows tooltip/info toast when disabled: "Publishing requires world {{WorldName}} to be public."

### Admin Entry Point

**Navigation:**
- Added "Publishing (beta)" nav item (only visible when `FF_PUBLISHING_WIZARD_ENTRY=true`)
- Routes to `/admin/publishing`

**Page:**
- Shows feature flag states
- Shows review queue (if `FF_ADMIN_REVIEW_QUEUE=true`)
- "Coming soon" placeholder card

## Shared Types

### `shared/src/types/publishing.ts`

- `Visibility`: `'private' | 'public'`
- `ReviewState`: `'draft' | 'pending_review' | 'approved' | 'rejected'`
- `PublishableType`: `'world' | 'story' | 'npc'`
- Error codes and messages
- Telemetry event names
- Request/response schemas

### Error Codes (added to `shared/src/types/api.ts`)

- `WORLD_NOT_PUBLIC`
- `APPROVAL_BLOCKED_WORLD_NOT_PUBLIC`
- `PUBLISH_REQUEST_DISABLED`

## Telemetry Events (No-op in Phase 0/1)

- `publish.requested`
- `publish.blocked`
- `admin.review.approved`
- `admin.review.rejected`
- `dependency.invalid.set`
- `dependency.invalid.cleared`

## Phase 2: Persistence + Quotas + Private-Play Bypass

Phase 2 adds real persistence, quota enforcement, and public listability filters while preserving owner play access.

### Database Changes

**Migration: `20251109_world_first_publish_phase2.sql`**

Creates `publishing_audit` table for traceability:
- `id` uuid PRIMARY KEY
- `entity_type` text ('world', 'story', 'npc')
- `entity_id` uuid
- `action` text ('request', 'approve', 'reject', 'auto-reject', 'auto-clear')
- `requested_by` uuid NULL
- `reviewed_by` uuid NULL
- `reason` text NULL
- `created_at` timestamptz

Indexes:
- `idx_publishing_audit_entity` on (entity_type, entity_id, created_at DESC)
- `idx_publishing_audit_requested_by` on (requested_by, created_at DESC)
- `idx_publishing_audit_reviewed_by` on (reviewed_by, created_at DESC)

### Quotas

**Default limits for non-admin users:**
- Worlds: 1
- Stories: 3
- NPCs: 6
- Publish requests per day: 5

**Override mechanism:**
- Reads from `user_limits` table if it exists (keys: `worlds_max`, `stories_max`, `npcs_max`, `publish_requests_daily_max`)
- Admins are exempt from all quotas
- Returns 429 `QUOTA_EXCEEDED` when limits are reached

### Data Access Layer

**`backend/src/dal/publishing.ts`:**

- `recordPublishRequest({ type, id, userId })`: Validates ownership, checks parent world for story/npc, sets `review_state='pending_review'`, writes audit row
- `getPublicListability({ type, id })`: Returns true if entity is public+approved+valid dependencies (and parent world is public+approved for story/npc)
- `countUserContent({ userId, type })`: Returns count of user's content by type
- `countDailyPublishRequests({ userId, dayUtc })`: Returns count of publish requests for a user on a given day

### API Changes

**`POST /api/publish/:type/:id/request` (Phase 2):**
- Checks quotas (exempts admins)
- Validates parent world visibility for story/npc
- Persists `review_state='pending_review'` to database
- Writes audit row to `publishing_audit`
- Returns 200 with entity snapshot on success
- Returns 422 `WORLD_NOT_PUBLIC` if parent world is not public+approved
- Returns 429 `QUOTA_EXCEEDED` if user exceeds limits

**`GET /api/admin/review/queue` (Phase 2):**
- Returns real list of pending submissions from database
- Includes: type, id, name, owner_user_id, world_id, world_name, submitted_at
- Read-only in Phase 2 (no approve/reject yet)

### Public Catalog Filters

**Phase 2 adds strict filtering to public catalog endpoints:**

- `/api/catalog/worlds`: Only shows `visibility='public'` AND `review_state='approved'`
- `/api/catalog/entry-points`: Only shows `visibility='public'` AND `review_state='approved'` AND `dependency_invalid=false` AND parent world is public+approved
- `/api/catalog/npcs`: Only shows `visibility='public'` AND `review_state='approved'` AND `dependency_invalid=false` AND parent world is public+approved

**Owner bypass:**
- Owner read/play paths (e.g., `/api/games`, `/api/npcs/my`) are NOT filtered by review_state or visibility
- Owners can always play their own content regardless of publishing status

### Frontend Changes

**`PublishButton` component (Phase 2):**
- Handles real API responses
- Shows info toast with deep link for `WORLD_NOT_PUBLIC` errors
- Shows warning toast with quota details for `QUOTA_EXCEEDED` errors
- Links to documentation for quota information

**Admin Publishing Page (Phase 2):**
- Displays review queue in a table (read-only)
- Shows: Type, Name, Owner, World, Submitted date
- Only visible when `FF_ADMIN_REVIEW_QUEUE=true`

### Testing

**Unit Tests:**
- `backend/tests/dal/publishing.test.ts`: Tests for DAL functions
- Covers: recordPublishRequest (ownership, world checks), getPublicListability, countUserContent, countDailyPublishRequests

**Example curl commands:**

```bash
# Request publish for a world
curl -X POST http://localhost:3000/api/publish/world/{world-id}/request \
  -H "Authorization: Bearer {token}"

# Request publish for a story (requires world to be public+approved)
curl -X POST http://localhost:3000/api/publish/story/{story-id}/request \
  -H "Authorization: Bearer {token}"

# Get review queue (admin only)
curl http://localhost:3000/api/admin/publishing/review/queue \
  -H "Authorization: Bearer {admin-token}"
```

## Phase Checklists

### Phase 2: Owner-Facing Submission Flow ✅
- [x] Wire real persistence for `setReviewState`
- [x] Implement `getWorldVisibility` with actual DB queries
- [x] Get actual `world_id` from story/npc records
- [x] Enforce quotas (1 World, 3 Stories, 6 NPCs)
- [x] Ensure private play bypass at launch service
- [x] Add client + API integration tests

## Phase 3: Admin Approve/Reject + Revalidation

Phase 3 adds full admin approval/rejection workflows with comprehensive revalidation before approval.

### Backend Changes

**DAL Functions (`backend/src/dal/publishing.ts`):**

- `revalidateForApproval({ type, id })`: Validates entity state, parent world, dependencies, and version
  - Returns `{ ok: boolean, reasons: string[] }`
  - Checks: entity exists, `review_state='pending_review'`, parent world is public+approved (for story/npc), `dependency_invalid=false`, version consistency
- `approveSubmission({ type, id, reviewerUserId })`: Revalidates, sets `review_state='approved'`, writes audit
  - Throws `APPROVAL_BLOCKED` with reasons if validation fails
- `rejectSubmission({ type, id, reviewerUserId, reason })`: Sets `review_state='rejected'`, writes audit with reason

**Admin Routes (`backend/src/routes/publishing.admin.ts`):**

- `POST /api/admin/publishing/review/:type/:id/approve`:
  - Returns 200 `{ code: 'APPROVED', entity }` on success
  - Returns 409 `{ code: 'APPROVAL_BLOCKED', reasons: [...] }` when blocked
  - Returns 501 when `FF_ADMIN_REVIEW_QUEUE=false`
- `POST /api/admin/publishing/review/:type/:id/reject`:
  - Requires body `{ reason: string }` (1-500 characters)
  - Returns 200 `{ code: 'REJECTED', entity }` on success
  - Returns 400 `REJECT_REASON_REQUIRED` if reason is missing

**Error Codes:**
- `APPROVAL_BLOCKED`: Approval blocked by validation checks (409)
- `REJECT_REASON_REQUIRED`: Rejection reason is required (400)

**Approval Block Reasons:**
- `entity_not_found`: Entity does not exist
- `not_pending_review`: Item is not in pending review state
- `parent_world_missing`: Parent world is missing (story/npc)
- `parent_world_not_found`: Parent world not found
- `parent_world_not_public`: Parent world is not public
- `parent_world_not_approved`: Parent world is not approved
- `dependency_invalid`: Dependencies are invalid (story/npc)
- `version_mismatch`: Version has changed since request (if version tracking available)

### Frontend Changes

**Admin Publishing Page (`frontend/src/pages/admin/publishing/index.tsx`):**

- Added Approve/Reject buttons to each queue row
- Reject modal with required textarea (1-500 characters)
- Blocked approval modal showing validation reasons
- World status badge showing parent world state (Public & Approved / Not Public / Not Approved)
- Success toasts and automatic queue refresh after actions

### Testing

**Unit Tests (`backend/tests/dal/publishing.test.ts`):**

- `revalidateForApproval`: Valid submission, blocked by parent world, blocked by dependency_invalid
- `approveSubmission`: Happy path, blocked approval
- `rejectSubmission`: Happy path with reason, empty reason validation

**Example curl commands:**

```bash
# Approve a world
curl -X POST http://localhost:3000/api/admin/publishing/review/world/{world-id}/approve \
  -H "Authorization: Bearer {admin-token}"

# Approve a story (will be blocked if parent world is not public+approved)
curl -X POST http://localhost:3000/api/admin/publishing/review/story/{story-id}/approve \
  -H "Authorization: Bearer {admin-token}"

# Reject a submission
curl -X POST http://localhost:3000/api/admin/publishing/review/world/{world-id}/reject \
  -H "Authorization: Bearer {admin-token}" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Content does not meet quality standards"}'
```

### Phase Checklists

### Phase 3: Admin Review Experience ✅
- [x] Implement `listPendingSubmissions` with real DB queries
- [x] Build review queue UI with actions
- [x] Implement approve/reject with persistence
- [x] Re-validate world visibility at approval time
- [x] Add unit tests for approval/rejection

### Phase 4: Dependency Monitoring & Launch Guards ✅
- [x] Implement background job for world visibility changes
- [x] Set/clear `dependency_invalid` flags
- [x] Event-driven hooks for world approval/rejection
- [x] Periodic cron job for dependency monitoring
- [x] Manual admin recompute endpoints
- [x] Admin UI for dependency management
- [ ] Add launch-time guards (future)
- [ ] Instrument telemetry events (future)

### Phase 5: Messaging, Notifications, and Telemetry ✅
- [x] Implement centralized telemetry emitters
- [x] Add admin activity feed
- [x] Add audit viewer with filters and pagination
- [x] Surface error strings consistently via shared messages
- [x] Wire telemetry events into all publishing actions
- [ ] Add owner notification pipeline (future)
- [ ] Add dashboards/alerting (future)

## Testing

### Local Testing with Flags

1. **Enable publish gates:**
   ```bash
   # Backend
   export FF_PUBLISH_GATES_OWNER=true
   
   # Frontend
   export VITE_FF_PUBLISH_GATES_OWNER=true
   ```

2. **Enable admin review queue:**
   ```bash
   # Backend
   export FF_ADMIN_REVIEW_QUEUE=true
   
   # Frontend
   export VITE_FF_ADMIN_REVIEW_QUEUE=true
   ```

3. **Enable publishing wizard entry:**
   ```bash
   # Frontend
   export VITE_FF_PUBLISHING_WIZARD_ENTRY=true
   ```

4. **Verify:**
   - Publish buttons appear in World/Story/NPC edit pages
   - Admin nav shows "Publishing (beta)" item
   - `/admin/publishing` page loads and shows flags
   - API endpoints return 501 when flags are disabled

## Files Created/Modified

### Phase 0/1 Created
- `db/migrations/20251109_world_first_publish_phase0.sql`
- `backend/src/routes/publishing.public.ts`
- `backend/src/routes/publishing.admin.ts`
- `shared/src/types/publishing.ts`
- `frontend/src/components/publishing/PublishButton.tsx`
- `frontend/src/pages/admin/publishing/index.tsx`
- `docs/publishing/README.md`

### Phase 2 Created
- `db/migrations/20251109_world_first_publish_phase2.sql`
- `backend/src/config/quotas.ts`
- `backend/src/dal/publishing.ts`
- `backend/src/utils/publishing.ts`
- `backend/tests/dal/publishing.test.ts`

### Phase 0/1 Modified
- `backend/src/config/featureFlags.ts`
- `backend/src/index.ts`
- `frontend/src/lib/feature-flags.ts`
- `shared/src/types/api.ts`
- `frontend/src/pages/admin/worlds/edit.tsx`
- `frontend/src/pages/admin/entry-points/id.tsx`
- `frontend/src/pages/admin/npcs/edit.tsx`
- `frontend/src/admin/AdminRoutes.tsx`
- `frontend/src/admin/components/AdminNav.tsx`

### Phase 2 Modified
- `backend/src/routes/publishing.public.ts` (real persistence + quotas)
- `backend/src/routes/publishing.admin.ts` (real queue)
- `backend/src/routes/catalog.ts` (public listability filters)
- `frontend/src/components/publishing/PublishButton.tsx` (real error handling)
- `frontend/src/pages/admin/publishing/index.tsx` (queue table)
- `shared/src/types/publishing.ts` (PendingSubmission schema)
- `shared/src/types/api.ts` (QUOTA_EXCEEDED error code)

### Phase 3 Created
- (No new files - all changes are additive to existing files)

### Phase 3 Modified
- `backend/src/dal/publishing.ts` (revalidateForApproval, approveSubmission, rejectSubmission)
- `backend/src/routes/publishing.admin.ts` (real approve/reject endpoints)
- `backend/src/utils/publishing.ts` (normalizeApprovalReasons)
- `backend/tests/dal/publishing.test.ts` (approval/rejection tests)
- `frontend/src/pages/admin/publishing/index.tsx` (Approve/Reject buttons and modals)
- `shared/src/types/publishing.ts` (PendingSubmission with parent_world)
- `shared/src/types/api.ts` (APPROVAL_BLOCKED, REJECT_REASON_REQUIRED)

### Phase 4 Created
- `db/migrations/20251109_world_first_publish_phase4.sql` (job_locks table and indexes)
- `backend/src/dal/dependencyMonitor.ts` (dependency monitoring logic)
- `backend/src/jobs/dependencyMonitor.job.ts` (periodic cron job)
- `backend/src/config/jobs.ts` (job configuration and lock helpers)
- `backend/tests/dal/dependencyMonitor.test.ts` (unit tests)

### Phase 4 Modified
- `backend/src/dal/publishing.ts` (event hook for world approval)
- `backend/src/utils/publishing.ts` (isWorldApprovedPublic, deriveDependencyInvalidFromWorld)
- `backend/src/routes/publishing.admin.ts` (manual recompute endpoints)
- `backend/src/index.ts` (starts dependency monitor cron)
- `frontend/src/pages/admin/publishing/index.tsx` (Dependencies card with recompute UI)

### Phase 5 Created
- `backend/src/telemetry/publishingTelemetry.ts` (centralized telemetry emitter)
- `backend/src/dal/publishingAudit.ts` (audit read queries)
- `backend/tests/routes/publishing.admin.audit.test.ts` (audit endpoint tests)
- `backend/tests/routes/publishing.admin.activity.test.ts` (activity endpoint tests)
- `frontend/src/pages/admin/publishing/audit.tsx` (audit viewer page)
- `frontend/src/lib/publishing-messages.ts` (centralized message map)
- `frontend/src/pages/admin/publishing/__tests__/index.activity.test.tsx` (activity tab tests)
- `frontend/src/pages/admin/publishing/__tests__/audit.test.tsx` (audit page tests)

### Phase 5 Modified
- `backend/src/config/featureFlags.ts` (Phase 5 flags)
- `backend/src/routes/publishing.admin.ts` (audit/activity endpoints)
- `backend/src/routes/publishing.public.ts` (telemetry wiring)
- `backend/src/dal/publishing.ts` (telemetry events)
- `backend/src/dal/dependencyMonitor.ts` (telemetry events)
- `frontend/src/pages/admin/publishing/index.tsx` (Tabs with Activity feed)
- `frontend/src/components/publishing/PublishButton.tsx` (improved messaging)
- `frontend/src/lib/feature-flags.ts` (Phase 5 flags)
- `frontend/src/admin/AdminRoutes.tsx` (audit route)
- `frontend/src/admin/components/AdminNav.tsx` (audit nav item)
- `shared/src/types/publishing.ts` (audit row types)

### Phase 6 Created
- `db/migrations/20251109_world_first_publish_phase6.sql` (checklists and quality findings tables)
- `backend/src/config/publishingQuality.ts` (quality thresholds and weights)
- `backend/src/services/publishingQuality.ts` (quality evaluation service)
- `backend/src/dal/publishingQuality.ts` (quality findings and checklist DAL)
- `backend/tests/services/publishingQuality.test.ts` (quality service tests)
- `backend/tests/routes/publishing.public.preflight.test.ts` (preflight endpoint tests)
- `backend/tests/routes/publishing.admin.checklist.test.ts` (checklist endpoint tests)
- `frontend/src/components/publishing/PreflightPanel.tsx` (creator preflight panel)
- `frontend/src/components/publishing/__tests__/PreflightPanel.test.tsx` (preflight panel tests)
- `frontend/src/pages/admin/publishing/__tests__/queue.checklist.test.tsx` (checklist modal tests)

### Phase 6 Modified
- `backend/src/config/featureFlags.ts` (Phase 6 flags)
- `backend/src/routes/publishing.public.ts` (preflight endpoint)
- `backend/src/routes/publishing.admin.ts` (checklist and findings endpoints)
- `backend/src/dal/publishing.ts` (approval path with quality checks)
- `frontend/src/pages/admin/worlds/edit.tsx` (PreflightPanel integration)
- `frontend/src/pages/admin/entry-points/id.tsx` (PreflightPanel integration)
- `frontend/src/pages/admin/npcs/edit.tsx` (PreflightPanel integration)
- `frontend/src/pages/admin/publishing/index.tsx` (checklist modal)
- `frontend/src/lib/feature-flags.ts` (Phase 6 flags)
- `frontend/src/lib/publishing-messages.ts` (quality labels and tips)
- `shared/src/types/publishing.ts` (quality types and Phase 6 events)

### Phase 7 Created
- `backend/src/routes/publishing.wizard.ts` (wizard status endpoint)
- `backend/tests/routes/publishing.wizard.status.test.ts` (wizard status endpoint tests)
- `frontend/src/pages/publishing/wizard.tsx` (wizard page)
- `frontend/src/pages/publishing/__tests__/wizard.test.tsx` (wizard page tests)

### Phase 7 Modified
- `backend/src/config/featureFlags.ts` (Phase 7 flag)
- `backend/src/dal/publishing.ts` (added isWizard parameter to recordPublishRequest)
- `backend/src/routes/publishing.public.ts` (wizard query parameter support)
- `backend/src/index.ts` (registered wizard router)
- `frontend/src/pages/admin/worlds/edit.tsx` (Open Wizard button)
- `frontend/src/pages/admin/entry-points/id.tsx` (Open Wizard button)
- `frontend/src/pages/admin/npcs/edit.tsx` (Open Wizard button)
- `frontend/src/admin/AdminRoutes.tsx` (wizard route)
- `frontend/src/lib/feature-flags.ts` (Phase 7 flag)
- `shared/src/types/publishing.ts` (Phase 7 telemetry events)

### Phase 8 Created
- `db/migrations/20251109_world_first_publish_phase8.sql` (wizard sessions table)
- `backend/src/config/publishingWizard.ts` (rollout config and utility)
- `backend/tests/routes/publishing.wizard.sessions.test.ts` (session endpoint tests)
- `backend/tests/routes/publishing.wizard.rollout.test.ts` (rollout logic tests)
- `frontend/src/lib/i18n/publishing.ts` (i18n hooks and centralized copy)
- `frontend/src/pages/publishing/__tests__/wizard.save-resume.test.tsx` (save/resume tests)
- `frontend/src/pages/publishing/__tests__/wizard.rollout.test.tsx` (rollout gate tests)
- `frontend/src/pages/publishing/__tests__/wizard.a11y.test.tsx` (a11y tests)
- `frontend/src/pages/publishing/__tests__/wizard.timing.test.tsx` (timing tests)

### Phase 8 Modified
- `backend/src/config/featureFlags.ts` (Phase 8 flags)
- `backend/src/routes/publishing.wizard.ts` (session endpoints, rollout gating)
- `frontend/src/pages/publishing/wizard.tsx` (save/resume, rollout, a11y, i18n, timing)
- `frontend/src/lib/feature-flags.ts` (Phase 8 flags)
- `shared/src/types/publishing.ts` (Phase 8 telemetry events)

## Phase 7: Publishing Wizard MVP

Phase 7 introduces a unified step-by-step wizard that guides creators through the publishing process, integrating all previous phases into a single guided flow.

### Feature Flags

**New Flags:**
- `FF_PUBLISHING_WIZARD` - Enables the publishing wizard MVP (default: false)
- `VITE_FF_PUBLISHING_WIZARD` - Frontend flag for wizard UI (default: false)

### Backend Changes

**New Files:**
- `backend/src/routes/publishing.wizard.ts` - Wizard status endpoint

**Modified Files:**
- `backend/src/config/featureFlags.ts` - Added Phase 7 flag
- `backend/src/dal/publishing.ts` - Updated `recordPublishRequest` to accept `isWizard` parameter
- `backend/src/routes/publishing.public.ts` - Added wizard query parameter support for telemetry
- `backend/src/index.ts` - Registered wizard router

**New Endpoints:**
- `GET /api/publishing/wizard/status/:type/:id` - Get combined status (dependency_invalid, preflight_score, review_state, visibility, parent_world)

**Telemetry Events:**
- `wizard.opened` - Emitted when wizard page is opened (via status endpoint)
- `wizard.step.completed` - Emitted when a step is completed (payload includes `step: 'dependencies' | 'preflight' | 'submit'`)
- `wizard.submitted` - Emitted when publish request is submitted via wizard

### Frontend Changes

**New Files:**
- `frontend/src/pages/publishing/wizard.tsx` - Main wizard page with 3-step flow

**Modified Files:**
- `frontend/src/pages/admin/worlds/edit.tsx` - Added "Open Wizard" button
- `frontend/src/pages/admin/entry-points/id.tsx` - Added "Open Wizard" button
- `frontend/src/pages/admin/npcs/edit.tsx` - Added "Open Wizard" button
- `frontend/src/admin/AdminRoutes.tsx` - Added wizard route
- `frontend/src/lib/feature-flags.ts` - Added Phase 7 flag
- `shared/src/types/publishing.ts` - Added Phase 7 telemetry events

**Wizard Flow:**
1. **Step 1: Dependencies** - Verifies parent world is public and approved (for stories/NPCs). Worlds auto-pass.
2. **Step 2: Preflight Check** - Runs quality checks and displays score + issues. Requires score ≥ 60 to proceed.
3. **Step 3: Submit for Review** - Submits publish request and shows confirmation.

**UI Features:**
- Progress bar showing current step (33%, 66%, 100%)
- Pass/fail indicators for each step
- Disabled "Next" until prerequisites are met
- Disabled "Submit" until both dependency and preflight steps pass
- Summary view before final submission
- Automatic navigation to publishing page on success

### Shared Types

**Modified:**
- `shared/src/types/publishing.ts` - Added `wizard.opened`, `wizard.step.completed`, `wizard.submitted` to `PublishingEvent` union

### Testing

**Backend Tests:**
- `backend/tests/routes/publishing.wizard.status.test.ts` - Wizard status endpoint tests

**Frontend Tests:**
- `frontend/src/pages/publishing/__tests__/wizard.test.tsx` - Wizard page component tests

### Sample API Calls

```bash
# Get wizard status
curl -X GET "http://localhost:3000/api/publishing/wizard/status/world/:id" \
  -H "Authorization: Bearer {token}"

# Run preflight via wizard (adds wizard=true query param)
curl -X GET "http://localhost:3000/api/publish/world/:id/preflight?persist=true&wizard=true" \
  -H "Authorization: Bearer {token}"

# Submit via wizard (adds wizard=true query param)
curl -X POST "http://localhost:3000/api/publish/world/:id/request?wizard=true" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json"
```

### Operational Notes

- Wizard is fully client-side; no persistence of wizard state yet
- All network calls use existing endpoints with optional `wizard=true` query parameter
- Telemetry events are emitted to distinguish wizard usage from direct publish button usage
- Wizard validates prerequisites before allowing progression
- Submit button is disabled until both dependency check and preflight pass (score ≥ 60)
- Worlds automatically pass dependency check (no parent)

## Local Verification Guide (Phase 7)

### 1. Enable Feature Flags

**Backend (.env or environment):**
```bash
FF_PUBLISHING_WIZARD=true
```

**Frontend (.env or environment):**
```bash
VITE_FF_PUBLISHING_WIZARD=true
```

### 2. Access Wizard

1. Navigate to a world/story/NPC edit page
2. Click "Open Wizard" button (visible when flag is enabled)
3. Wizard opens at `/publishing/wizard?type={type}&id={id}`

### 3. Complete Wizard Flow

**Step 1: Dependencies**
1. For worlds: automatically passes (no parent)
2. For stories/NPCs: click "Check Dependencies"
3. Verify parent world status is shown
4. Click "Next" when dependencies are valid

**Step 2: Preflight**
1. Click "Run Preflight" (or auto-runs when entering step)
2. Review quality score and issues
3. Address issues if score < 60
4. Click "Next" when score ≥ 60

**Step 3: Submit**
1. Review summary
2. Click "Submit for Review"
3. See success toast
4. Automatically redirects to `/admin/publishing` after 2 seconds

### 4. Verify Telemetry

Check console logs for:
- `[publishing-telemetry] Event: wizard.opened`
- `[publishing-telemetry] Event: wizard.step.completed`
- `[publishing-telemetry] Event: wizard.submitted`

### 5. Run Tests

```bash
# Backend tests
pnpm test backend/tests/routes/publishing.wizard.status.test.ts

# Frontend tests
pnpm test frontend/src/pages/publishing/__tests__/wizard.test.tsx

## Phase 5: Prompt Snapshots on Publish

### Overview

When a Story or World is published (approved), a **prompt snapshot** is automatically created. This snapshot freezes the prompt configuration at publish time, ensuring that games created from published content remain stable even if the source entities are later edited.

### What is Captured

The snapshot includes:

- **Prompts**: Core, ruleset, world, and story prompt text (as resolved by the assembler)
- **Config**: Mechanics and relationship settings from world/ruleset
- **Media**: Cover media ID and gallery media IDs (only approved + ready assets)

**Note**: The snapshot does NOT include:
- Dynamic data (weather, time, player counts)
- NPC data (NPCs can change and are loaded live)
- Entry start slug (dynamic per game)

### When Snapshots are Created

- **Trigger**: Automatically during `approveSubmission()` for Stories and Worlds
- **Timing**: Created BEFORE cover media visibility update, ensuring snapshot captures publish-time state
- **Failure Handling**: Snapshot creation failure blocks approval (ensures game stability)

### Versioning

- Each publish creates a new snapshot version
- Versions are monotonic per `(entity_type, entity_id)`
- First snapshot: version 1
- Subsequent snapshots: `previousMax + 1`
- Old snapshots remain untouched (historical record)

### How Games Use Snapshots

1. **Game Creation**: When a game is created from a published Story/World:
   - System looks up the latest snapshot for that entity
   - Sets `games.prompt_snapshot_id` to the snapshot ID
   - If no snapshot exists, game continues using live data (backward compatible)

2. **Prompt Assembly**: When assembling prompts for a game:
   - If `prompt_snapshot_id` is set, assembler uses frozen snapshot prompts
   - World/ruleset metadata is still loaded (for pieces array), but prompt text comes from snapshot
   - NPCs are always loaded live (not frozen in snapshot)

3. **Stability**: Once a game is created with a snapshot, it will always use that snapshot's prompts, even if:
   - The source Story/World is edited
   - A new version of the Story/World is published
   - The ruleset or world description changes

### Database Schema

**Table**: `prompt_snapshots`
- `id`: UUID primary key
- `entity_type`: `'world'` or `'story'`
- `entity_id`: TEXT (matches `worlds.id` or `entry_points.id`)
- `version`: INTEGER (monotonic per entity)
- `created_by`: UUID (references `auth.users(id)`)
- `source_publish_request_id`: UUID (references `publishing_audit.id` for correlation)
- `data`: JSONB containing frozen prompt configuration

**Table**: `games`
- `prompt_snapshot_id`: UUID (nullable, references `prompt_snapshots.id`)

### Indexes

- `idx_prompt_snapshots_entity_created`: `(entity_type, entity_id, created_at DESC)`
- `idx_prompt_snapshots_entity_version`: `(entity_type, entity_id, version DESC)`
- `idx_games_prompt_snapshot_id`: `(prompt_snapshot_id)` (partial, where not null)

### RLS Policies

- **Admin-only**: Full access for admins
- **Backend services**: Use `supabaseAdmin` (service role) to read snapshots for games
- No owner read access (snapshots are internal to game stability)

### Telemetry

Events emitted:
- `publish.snapshot_created`: When snapshot is created (includes `prompt_snapshot_id`, `source_publish_request_id`)
- `game.created_from_snapshot`: When a game is created using a snapshot (includes `game_id`, `prompt_snapshot_id`)

### Error Handling

- Snapshot creation failure blocks approval (throws `INTERNAL_ERROR`)
- Error logs use consistent format: `[snapshot.create_failed] entityType=..., entityId=..., error=...`
- Game creation gracefully falls back to live data if snapshot lookup fails (logs warning)

### Testing

See `backend/tests/services/promptSnapshotService.test.ts` and `backend/tests/dal/publishing.test.ts` for:
- Snapshot creation and versioning
- Media capture (cover + gallery)
- Publish flow integration
- Error handling

### Migration Files

- `supabase/migrations/20251112_prompt_snapshots.sql`: Creates `prompt_snapshots` table
- `supabase/migrations/20251112_games_prompt_snapshot_id.sql`: Adds `prompt_snapshot_id` to `games` table
```

---

## Phase 7: Publishing Wizard (Admin Only) - Unified Preflight

### Overview

Phase 7 introduces a unified publishing wizard that guides admins through all preflight checks before submitting an entity for publishing. It combines media checks, dependency validation, field validation, and snapshot preview into a single guided workflow.

### Implementation

**Backend:**
- `backend/src/services/publishingWizardService.ts`: Unified preflight service
- `backend/src/routes/publishingWizard.ts`: Admin-only wizard endpoints
- `GET /api/publishing-wizard/:entityType/:entityId/preflight`: Run all checks
- `POST /api/publishing-wizard/:entityType/:entityId/submit`: Submit for publishing

**Frontend:**
- `frontend/src/pages/admin/publishing-wizard/[entityType]/[entityId].tsx`: Wizard UI
- Integrated into admin edit pages with "Publishing Wizard" button
- Feature-flag gated: `VITE_FF_PUBLISHING_WIZARD`

**Wizard Steps:**
1. **Media**: Cover and gallery checks
2. **Dependencies**: World, ruleset, entity references
3. **Validation**: Required fields
4. **Snapshot Preview**: Preview of what will be frozen
5. **Submit**: Final submission

### What Gets Checked

- **Media**: Cover must be approved + ready; gallery warnings
- **Dependencies**: World published, ruleset present (stories), valid refs
- **Validation**: Required fields (name, description, title)
- **Snapshot Preview**: Shows prompts and media that will be frozen

### Blocker vs Warning

- **Blockers**: Must fix before submitting (red X, blocks submit)
- **Warnings**: Informational only (yellow warning, doesn't block)

### Snapshot Preview

The wizard shows a preview of what will be captured in the prompt snapshot:
- Schema version
- Core, world, ruleset, story prompts
- Cover media ID
- Gallery media IDs (approved + ready only)

This is a preview only. The actual snapshot is created when the publish request is approved (Phase 5).

### Integration

- Wizard button added to:
  - `frontend/src/pages/admin/worlds/edit.tsx`
  - `frontend/src/pages/admin/entry-points/id.tsx`
  - `frontend/src/pages/admin/npcs/edit.tsx`
- Button is disabled when entity is already published
- Feature-flag gated for safe rollout

### Testing

- E2E: Open wizard, verify blockers block submit, fix issues, successful submit
- Unit: Preflight transform logic, snapshot preview generation

### Documentation

See `docs/publishing/wizard.md` for full wizard documentation.

## Phase 4: Dependency Monitor (Auto Set/Clear)

Phase 4 adds automatic dependency monitoring that maintains `dependency_invalid` flags for stories and NPCs based on their parent world's status.

### Dependency Rule

For stories and NPCs:
- `dependency_invalid = true` if parent world is NOT (`visibility='public'` AND `review_state='approved'`)
- `dependency_invalid = false` otherwise

This ensures that stories/NPCs can only be approved and listed publicly when their parent world is public and approved.

### Architecture

**Event-Driven (Real-Time):**
- When a world is approved/rejected or visibility changes, the system automatically triggers dependency recompute for that world
- Implemented as an async hook in `approveSubmission` (non-blocking)

**Periodic Cron (Background):**
- Runs every 5 minutes (configurable via `MONITOR_CRON_MS`)
- Uses distributed locking (`job_locks` table) to ensure only one instance runs at a time
- Processes all worlds in batches with concurrency control

**Manual Admin Tools:**
- Admins can manually recompute dependencies for a specific world
- Admins can trigger a full recompute for all worlds

### Backend Changes

**New Files:**
- `backend/src/dal/dependencyMonitor.ts` - Core dependency monitoring logic
- `backend/src/jobs/dependencyMonitor.job.ts` - Periodic cron job runner
- `backend/src/config/jobs.ts` - Job configuration and lock helpers
- `backend/tests/dal/dependencyMonitor.test.ts` - Unit tests

**Modified Files:**
- `backend/src/dal/publishing.ts` - Added event hook for world approval
- `backend/src/utils/publishing.ts` - Added `isWorldApprovedPublic()` and `deriveDependencyInvalidFromWorld()`
- `backend/src/routes/publishing.admin.ts` - Added manual recompute endpoints
- `backend/src/index.ts` - Starts dependency monitor cron on server startup

**New Endpoints:**
- `POST /api/admin/publishing/deps/recompute/world/:worldId` - Recompute for one world
- `POST /api/admin/publishing/deps/recompute/all` - Recompute for all worlds

### Frontend Changes

**Modified Files:**
- `frontend/src/pages/admin/publishing/index.tsx` - Added "Dependencies" card with recompute UI

**New UI:**
- World ID input field for single-world recompute
- "Recompute All Worlds" button
- Results display showing counts of updated stories/NPCs

### Database Changes

**Migration:** `db/migrations/20251109_world_first_publish_phase4.sql`
- Creates `job_locks` table for distributed locking
- Adds indexes on `entry_points(world_id)` and `npcs(world_id)` for efficient queries

### Configuration

**Environment Variables:**
- `FF_DEPENDENCY_MONITOR` - Enable/disable dependency monitoring (default: false)
- `MONITOR_CRON_MS` - Cron interval in milliseconds (default: 300000 = 5 minutes)
- `JOB_LOCK_TTL_MS` - Lock TTL in milliseconds (default: 600000 = 10 minutes)

### Testing

**Unit Tests:**
- `markDependenciesForWorld` - Updates stories/NPCs when flag differs
- `recomputeDependenciesForWorld` - Sets correct flag based on world status
- `recomputeDependenciesForAllWorlds` - Processes all worlds correctly

**API Tests:**
- Manual recompute endpoints respect feature flag
- Returns correct counts for updated entities

### Operational Notes

- The cron job uses distributed locking to prevent concurrent execution across multiple server instances
- Event-driven recompute is non-blocking (async) to avoid slowing down approval/rejection operations
- Audit rows are written when dependencies are cleared (invalid → valid) with action `auto-clear`
- The monitor only updates flags; catalog filtering continues to use `isPubliclyListable` (Phase 2/3)

### Sample cURL Commands

```bash
# Recompute dependencies for a specific world
curl -X POST http://localhost:3000/api/admin/publishing/deps/recompute/world/{world-id} \
  -H "Authorization: Bearer {admin-token}" \
  -H "Content-Type: application/json"

# Recompute dependencies for all worlds
curl -X POST http://localhost:3000/api/admin/publishing/deps/recompute/all \
  -H "Authorization: Bearer {admin-token}" \
  -H "Content-Type: application/json"
```

## Phase 8: Wizard Polish, Save/Resume, Rollout

Phase 8 adds polish, save/resume functionality, rollout controls, accessibility improvements, i18n hooks, and analytics to the Publishing Wizard.

### Feature Flags

**New Flags:**
- `FF_PUBLISHING_WIZARD_SESSIONS` - Enable server-side save/resume (default: false)
- `FF_PUBLISHING_WIZARD_ROLLOUT` - Enable rollout gating (default: false)
- `VITE_FF_PUBLISHING_WIZARD_SESSIONS` - Frontend flag for sessions (default: false)
- `VITE_FF_PUBLISHING_WIZARD_ROLLOUT` - Frontend flag for rollout UI (default: false)

### Database Changes

**Migration:** `db/migrations/20251109_world_first_publish_phase8.sql`
- Creates `publishing_wizard_sessions` table for server-side persistence
- Indexes for efficient lookups and cleanup

### Backend Changes

**New Files:**
- `backend/src/config/publishingWizard.ts` - Rollout configuration and `isWizardAllowed` utility

**Modified Files:**
- `backend/src/config/featureFlags.ts` - Added Phase 8 flags
- `backend/src/routes/publishing.wizard.ts` - Added session endpoints and rollout gating

**New Endpoints:**
- `POST /api/publishing/wizard/session/:type/:id` - Save wizard session state
- `DELETE /api/publishing/wizard/session/:type/:id` - Clear wizard session

**Environment Variables:**
- `WIZARD_ROLLOUT_ALLOWLIST` - Comma-separated user IDs or emails (e.g., "user-id-1,admin@example.com")
- `WIZARD_ROLLOUT_PERCENT` - Percentage rollout (0-100, e.g., "10" for 10%)

**Rollout Logic:**
- If rollout disabled → allow all users (when wizard enabled)
- If allowlist set → allow users in list (by userId or email)
- If percent set → hash userId to 0-99, allow if < percent
- If rollout enabled but no allowlist/percent → deny by default

**Telemetry Events:**
- `wizard.session.saved` - Emitted when session is saved
- `wizard.session.cleared` - Emitted when session is deleted
- `wizard.rollout.blocked` - Emitted when user is blocked by rollout
- `wizard.step.timing` - Emitted on step transitions (payload: `{step, duration}`)

### Frontend Changes

**New Files:**
- `frontend/src/lib/i18n/publishing.ts` - Centralized i18n hooks and copy

**Modified Files:**
- `frontend/src/pages/publishing/wizard.tsx` - Added save/resume, rollout gate, a11y, i18n, timing
- `frontend/src/lib/feature-flags.ts` - Added Phase 8 flags

**Save/Resume Features:**
- **LocalStorage persistence**: Keyed by `wizard:{userId}:{type}:{id}`
- **Server session sync**: When `VITE_FF_PUBLISHING_WIZARD_SESSIONS` is enabled
- **Resume banner**: Shows when saved progress is detected
- **Reset wizard**: Clears both local and server sessions

**Rollout Gate UI:**
- Shows "Coming Soon" panel when user is not allowed
- Includes fallback link to standard publish flow

**A11y Improvements:**
- Keyboard navigation: Enter to advance, Esc to cancel
- Focus management: Focus moves to step heading on step change
- ARIA attributes: `aria-current="step"`, `role="status"`, `aria-live="polite"`
- Error summary: Consolidated list at top with anchors to each section

**i18n Integration:**
- All wizard strings centralized in `frontend/src/lib/i18n/publishing.ts`
- `usePublishingI18n()` hook for easy translation access
- Ready for future i18n library swap

**Analytics:**
- Step timing: Tracks time-in-step using `performance.now()`
- Emits `wizard.step.timing` event on step transitions

**UX Polish:**
- Preflight button shows spinner and last result timestamp
- Submit step shows summarized status
- After submit: CTAs to "View status in Publishing" and entity page
- Reset wizard dialog with confirmation

### Shared Types

**Modified:**
- `shared/src/types/publishing.ts` - Added Phase 8 telemetry events

### Testing

**Backend Tests:**
- `backend/tests/routes/publishing.wizard.sessions.test.ts` - Session save/delete tests
- `backend/tests/routes/publishing.wizard.rollout.test.ts` - Rollout logic tests

**Frontend Tests:**
- `frontend/src/pages/publishing/__tests__/wizard.save-resume.test.tsx` - Save/resume tests
- `frontend/src/pages/publishing/__tests__/wizard.rollout.test.tsx` - Rollout gate tests
- `frontend/src/pages/publishing/__tests__/wizard.a11y.test.tsx` - A11y tests
- `frontend/src/pages/publishing/__tests__/wizard.timing.test.tsx` - Timing tests

### Sample API Calls

```bash
# Save wizard session
curl -X POST "http://localhost:3000/api/publishing/wizard/session/story/:id" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"step":"preflight","data":{"score":80,"issues":2}}'

# Delete wizard session
curl -X DELETE "http://localhost:3000/api/publishing/wizard/session/story/:id" \
  -H "Authorization: Bearer {token}"
```

### Rollout Cookbook

**Step 1: Enable for Staff**
```bash
# Backend
WIZARD_ROLLOUT_ALLOWLIST="staff-user-id-1,staff-user-id-2,admin@example.com"
FF_PUBLISHING_WIZARD_ROLLOUT=true

# Frontend
VITE_FF_PUBLISHING_WIZARD_ROLLOUT=true
```

**Step 2: Gradual Percentage Rollout**
```bash
# Start with 10%
WIZARD_ROLLOUT_PERCENT=10

# Monitor usage, then increase
WIZARD_ROLLOUT_PERCENT=25
WIZARD_ROLLOUT_PERCENT=50
WIZARD_ROLLOUT_PERCENT=100
```

**Step 3: Full Rollout**
```bash
# Disable rollout gating (allows everyone)
FF_PUBLISHING_WIZARD_ROLLOUT=false
VITE_FF_PUBLISHING_WIZARD_ROLLOUT=false
```

### Operational Notes

- Sessions are automatically cleared after successful submit
- LocalStorage is used as primary persistence; server sessions are optional
- Rollout uses consistent hashing for stable user assignment
- Step timing is logged to console (can be wired to telemetry service)
- All a11y features work with screen readers and keyboard navigation

## Local Verification Guide (Phase 8)

### 1. Enable Feature Flags

**Backend (.env or environment):**
```bash
FF_PUBLISHING_WIZARD=true
FF_PUBLISHING_WIZARD_SESSIONS=true
FF_PUBLISHING_WIZARD_ROLLOUT=true
WIZARD_ROLLOUT_ALLOWLIST=<yourUserIdOrEmail>
WIZARD_ROLLOUT_PERCENT=0
```

**Frontend (.env or environment):**
```bash
VITE_FF_PUBLISHING_WIZARD=true
VITE_FF_PUBLISHING_WIZARD_SESSIONS=true
VITE_FF_PUBLISHING_WIZARD_ROLLOUT=true
```

### 2. Test Save/Resume

1. Open wizard for a world/story/NPC
2. Complete step 1 (dependencies)
3. Refresh the page
4. Verify resume banner appears
5. Click "Resume" → should restore to step 1
6. Click "Start Over" → should clear and restart

### 3. Test Server Sessions

1. Enable `FF_PUBLISHING_WIZARD_SESSIONS=true`
2. Complete step 1, move to step 2
3. Open wizard on a different device (same user)
4. Verify session is synced and resume banner shows

### 4. Test Rollout Gate

1. Remove yourself from allowlist, set percent to 0
2. Open wizard
3. Should see "Coming Soon" panel
4. Add yourself back to allowlist
5. Refresh → wizard should appear

### 5. Test A11y

1. Navigate wizard using only keyboard (Tab, Enter, Esc)
2. Verify focus moves to step heading on step change
3. Run screen reader → verify ARIA announcements
4. Check error summary appears at top with anchors

### 6. Test Timing

1. Open browser console
2. Navigate through wizard steps
3. Verify timing logs: `[wizard] Step timing: dependencies 1234 ms`

### 7. Run Tests

```bash
# Backend tests
pnpm test backend/tests/routes/publishing.wizard.sessions.test.ts
pnpm test backend/tests/routes/publishing.wizard.rollout.test.ts

# Frontend tests
pnpm test frontend/src/pages/publishing/__tests__/wizard.save-resume.test.tsx
pnpm test frontend/src/pages/publishing/__tests__/wizard.rollout.test.tsx
pnpm test frontend/src/pages/publishing/__tests__/wizard.a11y.test.tsx
pnpm test frontend/src/pages/publishing/__tests__/wizard.timing.test.tsx
```

## Local Verification Guide (Phase 4)

### 1. Enable Feature Flags

**Backend (.env or environment):**
```bash
FF_PUBLISH_GATES_OWNER=true
FF_ADMIN_REVIEW_QUEUE=true
FF_DEPENDENCY_MONITOR=true
FF_PUBLISHING_WIZARD_ENTRY=true
```

**Frontend (.env or environment):**
```bash
VITE_FF_PUBLISH_GATES_OWNER=true
VITE_FF_ADMIN_REVIEW_QUEUE=true
VITE_FF_DEPENDENCY_MONITOR=true
VITE_FF_PUBLISHING_WIZARD_ENTRY=true
```

### 2. Test Event-Driven Recompute

1. Create a world and request publish
2. Create a story linked to that world
3. Approve the world via admin API
4. Check that the story's `dependency_invalid` flag is automatically cleared (set to false)

### 3. Test Manual Recompute

```bash
# Recompute for a specific world
curl -X POST http://localhost:3000/api/admin/publishing/deps/recompute/world/{world-id} \
  -H "Authorization: Bearer {admin-token}" \
  -H "Content-Type: application/json"

# Recompute for all worlds
curl -X POST http://localhost:3000/api/admin/publishing/deps/recompute/all \
  -H "Authorization: Bearer {admin-token}" \
  -H "Content-Type: application/json"
```

### 4. Verify UI

1. Navigate to `/admin/publishing`
2. When `FF_DEPENDENCY_MONITOR` is enabled, you should see a "Dependencies" card
3. Enter a world ID and click "Recompute World" - should see results
4. Click "Recompute All Worlds" - should see aggregate results

### 5. Verify Cron Job

1. Check server logs for `[dependencyMonitor] Starting cron job` message
2. Wait 5 minutes (or adjust `MONITOR_CRON_MS`) and check logs for periodic runs
3. Verify that only one instance acquires the lock (if running multiple instances)

### 6. Verify Dependency Flags

- Stories/NPCs linked to public+approved worlds should have `dependency_invalid=false`
- Stories/NPCs linked to private or non-approved worlds should have `dependency_invalid=true`
- Catalog should only show items where `dependency_invalid=false` (via `isPubliclyListable`)

## Local Verification Guide (Phase 3)

### 1. Enable Feature Flags

**Backend (.env or environment):**
```bash
FF_PUBLISH_GATES_OWNER=true
FF_ADMIN_REVIEW_QUEUE=true
FF_PUBLISHING_WIZARD_ENTRY=true
```

**Frontend (.env or environment):**
```bash
VITE_FF_PUBLISH_GATES_OWNER=true
VITE_FF_ADMIN_REVIEW_QUEUE=true
VITE_FF_PUBLISHING_WIZARD_ENTRY=true
```

### 2. Create Test Data

1. Create a world and request publish (should be pending_review)
2. Create a story linked to that world and request publish (should be pending_review)
3. Create another story linked to a private world and request publish (should be pending_review)

### 3. Test Approval Flow

```bash
# Approve a world (should succeed)
curl -X POST http://localhost:3000/api/admin/publishing/review/world/{world-id}/approve \
  -H "Authorization: Bearer {admin-token}" \
  -H "Content-Type: application/json"

# Approve a story with approved world (should succeed)
curl -X POST http://localhost:3000/api/admin/publishing/review/story/{story-id}/approve \
  -H "Authorization: Bearer {admin-token}" \
  -H "Content-Type: application/json"

# Approve a story with private world (should return 409 with reasons)
curl -X POST http://localhost:3000/api/admin/publishing/review/story/{story-id}/approve \
  -H "Authorization: Bearer {admin-token}" \
  -H "Content-Type: application/json"
# Expected: 409 { code: 'APPROVAL_BLOCKED', reasons: ['parent_world_not_public', 'parent_world_not_approved'] }
```

### 4. Test Rejection Flow

```bash
# Reject a submission
curl -X POST http://localhost:3000/api/admin/publishing/review/world/{world-id}/reject \
  -H "Authorization: Bearer {admin-token}" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Content does not meet quality standards"}'

# Try to reject without reason (should return 400)
curl -X POST http://localhost:3000/api/admin/publishing/review/world/{world-id}/reject \
  -H "Authorization: Bearer {admin-token}" \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: 400 { code: 'REJECT_REASON_REQUIRED' }
```

### 5. Verify UI

1. Navigate to `/admin/publishing` - should see review queue with Approve/Reject buttons
2. Click "Approve" on a valid submission - should see success toast and item removed from queue
3. Click "Approve" on a story with private world - should see blocked modal with reasons
4. Click "Reject" - should open modal with textarea
5. Submit rejection with reason - should see success toast and item removed
6. Try to submit rejection without reason - should see validation error

### 6. Verify Catalog Behavior

- Approved items should appear in public catalog (`/api/catalog/worlds`, `/api/catalog/entry-points`, `/api/catalog/npcs`)
- Rejected items should NOT appear in public catalog
- Owner can still play their own rejected/private content (bypass intact)

## References

- `docs/content/world_first_publish_rules.md` - Policy rules
- `docs/content/world_first_publish_implementation_plan.md` - Implementation plan

## Next Steps

See Phase 4 checklist above. The next phase will add dependency monitoring and automated dependency checks.

