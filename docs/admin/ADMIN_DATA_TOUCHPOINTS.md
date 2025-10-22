# Admin Data Touchpoints

## Entry Points (Target System)

### Table: `entry_points`
**Purpose**: Unified entry point management replacing adventures, adventure-starts, and scenarios

**Fields**:
- `id` (uuid) — Primary key
- `slug` (text) — URL-friendly identifier
- `type` (text) — 'adventure', 'start', 'scenario', 'sandbox'
- `world_id` (uuid) — Reference to worlds table
- `ruleset_id` (uuid) — Reference to active ruleset
- `title` (text) — Display name
- `description` (text) — Short description
- `synopsis` (text) — Detailed synopsis
- `tags` (jsonb) — Array of tags for filtering
- `visibility` (text) — 'public', 'private', 'draft'
- `lifecycle` (text) — 'draft', 'pending_review', 'active', 'archived'
- `metadata` (jsonb) — Flexible metadata storage
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

**Related Tables**:
- `prompt_segments` (scope: 'entry', ref_id: entry_points.id)
- `entry_point_npcs` (many-to-many relationship)
- `content_reviews` (submission/approval workflow)

## Prompt Segments (Target System)

### Table: `prompt_segments`
**Purpose**: Replaces legacy prompts with structured, versioned prompt management

**Fields**:
- `id` (uuid) — Primary key
- `scope` (text) — 'entry', 'npc', 'world', 'core'
- `ref_id` (uuid) — Reference to parent entity
- `content` (text) — Prompt text content
- `metadata` (jsonb) — `{tier, locale, kind, version}`
- `version` (text) — Semantic version
- `active` (boolean) — Whether this version is active
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

**Usage**:
- Entry Points: `scope='entry'`, `ref_id=entry_points.id`
- NPCs: `scope='npc'`, `ref_id=npcs.id`
- Worlds: `scope='world'`, `ref_id=worlds.id`
- Core: `scope='core'`, `ref_id=null`

## NPCs (Keep/Update)

### Table: `npcs`
**Purpose**: Reusable character pool for Entry Points

**Fields**:
- `id` (text) — NPC identifier
- `version` (text) — Version string
- `doc` (jsonb) — NPC document content
- `hash` (text) — Document hash
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

**Related Tables**:
- `entry_point_npcs` — Many-to-many with Entry Points
- `prompt_segments` (scope: 'npc', ref_id: npcs.id)

## Content Reviews (New System)

### Table: `content_reviews`
**Purpose**: Moderation workflow for Entry Points and other content

**Fields**:
- `id` (uuid) — Primary key
- `target_type` (text) — 'entry_point', 'npc', 'prompt_segment'
- `target_id` (uuid) — Reference to target entity
- `state` (text) — 'pending', 'approved', 'rejected', 'changes_requested'
- `notes` (text) — Reviewer notes
- `reviewer_id` (uuid) — User who reviewed
- `submitted_by` (uuid) — User who submitted for review
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

## App Roles (New System)

### Table: `app_roles`
**Purpose**: Replaces user_metadata.role with proper role management

**Fields**:
- `user_id` (uuid) — Reference to auth.users
- `role` (text) — 'moderator', 'admin'
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

**Usage**:
- Replaces `user_metadata.role` checks
- Enables multiple roles per user
- Proper RLS policy integration

## Legacy Tables (To Be Removed)

### `adventures` (Legacy)
**Migration**: `adventures` → `entry_points` (type: 'adventure')
- `id` (uuid) → `entry_points.id`
- `slug` (text) → `entry_points.slug`
- `title` (text) → `entry_points.title`
- `description` (text) → `entry_points.description`
- `world_slug` (text) → `entry_points.world_id` (via lookup)
- `tags` (jsonb) → `entry_points.tags`
- `is_active` (boolean) → `entry_points.lifecycle`

### `adventure_starts` (Legacy)
**Migration**: `adventure_starts` → `entry_points` (type: 'start')
- `adventure_ref` (text) → `entry_points.metadata.adventure_ref`
- `doc` (jsonb) → `entry_points.metadata.start_doc`
- `use_once` (boolean) → `entry_points.metadata.use_once`

### `scenarios` (Legacy)
**Migration**: `scenarios` → `entry_points` (type: 'scenario')
- `id` (text) → `entry_points.slug`
- `doc` (jsonb) → `entry_points.metadata.scenario_doc`
- `world_ref` (text) → `entry_points.world_id` (via lookup)

### `prompts` (Legacy)
**Migration**: `prompts` → `prompt_segments`
- `id` (uuid) → `prompt_segments.id`
- `content` (text) → `prompt_segments.content`
- `metadata` (jsonb) → `prompt_segments.metadata`
- `layer` (text) → `prompt_segments.metadata.tier`
- `world` (text) → `prompt_segments.ref_id` (via world lookup)

## API Endpoint Mapping

### Current → Target
- `/api/admin/awf/adventures/*` → `/api/admin/entry-points/*`
- `/api/admin/awf/adventure-starts/*` → `/api/admin/entry-points/*`
- `/api/admin/awf/scenarios/*` → `/api/admin/entry-points/*`
- `/api/admin/prompts/*` → `/api/admin/prompt-segments/*`

### New Endpoints Needed
- `/api/admin/entry-points/*` — CRUD for Entry Points
- `/api/admin/prompt-segments/*` — CRUD for Prompt Segments
- `/api/admin/content-reviews/*` — Moderation workflow
- `/api/admin/app-roles/*` — Role management

## RLS Policy Updates

### Current Policies (To Update)
- `awf_adventures_admin_select` → `entry_points_admin_select`
- `awf_adventures_admin_write` → `entry_points_admin_write`
- `awf_scenarios_admin_select` → `entry_points_admin_select`
- `awf_scenarios_admin_write` → `entry_points_admin_write`

### New Policies Needed
- `entry_points_creator_select` — Creators can see their own
- `entry_points_creator_write` — Creators can edit their own
- `entry_points_moderator_select` — Moderators can see all
- `entry_points_moderator_write` — Moderators can approve/reject
- `content_reviews_moderator_all` — Moderators can manage reviews
- `app_roles_admin_all` — Admins can manage roles

## Migration Strategy

### Phase 1: Schema Creation
1. Create `entry_points` table
2. Create `prompt_segments` table
3. Create `content_reviews` table
4. Create `app_roles` table
5. Create `entry_point_npcs` junction table

### Phase 2: Data Migration
1. Migrate `adventures` → `entry_points`
2. Migrate `adventure_starts` → `entry_points`
3. Migrate `scenarios` → `entry_points`
4. Migrate `prompts` → `prompt_segments`
5. Migrate user roles → `app_roles`

### Phase 3: API Updates
1. Create new API endpoints
2. Update frontend to use new endpoints
3. Remove old API endpoints
4. Update RLS policies

### Phase 4: Cleanup
1. Remove old tables
2. Remove old API routes
3. Remove old frontend components
4. Update documentation


