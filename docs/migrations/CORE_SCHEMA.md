# Core Schema Documentation

## Overview

The core schema defines the foundational data structures for the Stone Caster system. This is a greenfield implementation with no legacy dependencies, designed to support the prompt layering pipeline and game state management.

## Schema Architecture

The schema consists of six core tables that form a hierarchical structure:

```
worlds (foundation)
├── rulesets (foundation)
├── entry_points (content)
│   ├── games (instances)
│   │   └── turns (interactions)
└── prompt_segments (system)
```

## Table Specifications

### 1. worlds

**Purpose**: Defines game worlds and their metadata.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | text | PRIMARY KEY | Unique world identifier |
| `version` | text | NOT NULL, DEFAULT '1.0.0' | Semantic version of the world |
| `status` | text | NOT NULL, CHECK | World lifecycle status: 'draft', 'active', 'archived' |
| `doc` | jsonb | NOT NULL, DEFAULT '{}' | World configuration and metadata |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() | Last modification timestamp |

**Rationale**: Worlds serve as the top-level organizational unit. The `doc` field allows flexible storage of world-specific configuration, while the `status` field enables lifecycle management.

### 2. rulesets

**Purpose**: Defines game rules and mechanics.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | text | PRIMARY KEY | Unique ruleset identifier |
| `version` | text | NOT NULL, DEFAULT '1.0.0' | Semantic version of the ruleset |
| `status` | text | NOT NULL, CHECK | Ruleset lifecycle status: 'draft', 'active', 'archived' |
| `doc` | jsonb | NOT NULL, DEFAULT '{}' | Ruleset configuration and metadata |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() | Last modification timestamp |

**Rationale**: Rulesets are independent of worlds, allowing the same rules to be applied across different worlds. The `doc` field stores rule definitions and mechanics.

### 3. entry_points

**Purpose**: Defines playable content entry points (adventures, scenarios, etc.).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | text | PRIMARY KEY | Unique entry point identifier |
| `slug` | text | UNIQUE, NOT NULL | URL-friendly identifier |
| `type` | text | NOT NULL, CHECK | Content type: 'adventure', 'scenario', 'sandbox', 'quest' |
| `world_id` | text | NOT NULL, FK → worlds(id) | Associated world |
| `ruleset_id` | text | NOT NULL, FK → rulesets(id) | Associated ruleset |
| `title` | text | NOT NULL | Display title |
| `subtitle` | text | | Optional subtitle |
| `description` | text | NOT NULL | Detailed description |
| `synopsis` | text | | Brief summary |
| `status` | text | NOT NULL, DEFAULT 'draft', CHECK | Lifecycle status: 'draft', 'active', 'archived' |
| `visibility` | text | NOT NULL, DEFAULT 'public', CHECK | Visibility: 'public', 'unlisted', 'private' |
| `content_rating` | text | NOT NULL, DEFAULT 'safe', CHECK | Content rating: 'safe', 'mature', 'explicit' |
| `owner_user_id` | uuid | | Creator user ID; null for system-owned content |
| `lifecycle` | text | NOT NULL, DEFAULT 'draft', CHECK | Moderation lifecycle: 'draft', 'pending_review', 'changes_requested', 'active', 'archived', 'rejected' |
| `tags` | text[] | NOT NULL, DEFAULT '{}' | Searchable tags |
| `content` | jsonb | NOT NULL, DEFAULT '{}' | Entry point content and configuration |
| `i18n` | jsonb | NOT NULL, DEFAULT '{}' | Internationalization data |
| `search_text` | tsvector | GENERATED | Full-text search vector |
| `sort_weight` | int | NOT NULL, DEFAULT 0 | Sort order weight |
| `popularity_score` | int | NOT NULL, DEFAULT 0 | Popularity metric |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() | Last modification timestamp |

**Rationale**: Entry points are the primary content discovery mechanism. The generated `search_text` column enables efficient full-text search across titles, descriptions, and tags. The denormalized `type` field allows for quick filtering without joins. The `owner_user_id` and `lifecycle` fields support user-generated content with moderation workflow.

### 4. prompt_segments

**Purpose**: Stores prompt templates and system instructions for the AI pipeline.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigserial | PRIMARY KEY | Auto-incrementing identifier |
| `scope` | text | NOT NULL, CHECK | Prompt scope: 'core', 'ruleset', 'world', 'entry', 'entry_start', 'npc', 'game_state', 'player', 'rng', 'input' |
| `ref_id` | text | | Reference to target object (nullable) |
| `version` | text | NOT NULL, DEFAULT '1.0.0' | Semantic version |
| `active` | boolean | NOT NULL, DEFAULT true | Whether this segment is active |
| `content` | text | NOT NULL | Prompt template content |
| `metadata` | jsonb | NOT NULL, DEFAULT '{}' | Additional metadata |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() | Last modification timestamp |

**Rationale**: Prompt segments enable the layered prompt system. The `scope` field determines when and how prompts are applied, while `ref_id` allows targeting specific objects (worlds, entries, NPCs).

### 5. games

**Purpose**: Represents active game instances.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique game identifier |
| `entry_point_id` | text | NOT NULL, FK → entry_points(id) | Associated entry point |
| `entry_point_type` | text | NOT NULL | Denormalized type for quick filtering |
| `world_id` | text | NOT NULL, FK → worlds(id) | Associated world |
| `ruleset_id` | text | NOT NULL, FK → rulesets(id) | Associated ruleset |
| `owner_user_id` | uuid | | Game owner (nullable for guest games) |
| `state` | jsonb | NOT NULL, DEFAULT '{"hot":{},"warm":{},"cold":{}}' | Game state with hot/warm/cold data |
| `turn_count` | int | NOT NULL, DEFAULT 0 | Number of turns taken |
| `status` | text | NOT NULL, DEFAULT 'active', CHECK | Game status: 'active', 'ended', 'abandoned' |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() | Last modification timestamp |

**Rationale**: Games represent active play sessions. The `state` field uses a hot/warm/cold pattern for efficient state management. Denormalized fields enable quick filtering without complex joins.

### 6. turns

**Purpose**: Records individual game interactions and AI responses.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigserial | PRIMARY KEY | Auto-incrementing identifier |
| `game_id` | uuid | NOT NULL, FK → games(id) | Associated game |
| `idx` | int | NOT NULL | Turn sequence number |
| `role` | text | NOT NULL, CHECK | Turn role: 'system', 'narrator', 'player' |
| `prompt_meta` | jsonb | NOT NULL, DEFAULT '{}' | Prompt metadata and context |
| `content` | jsonb | NOT NULL | Turn content and response |
| `costs` | jsonb | NOT NULL, DEFAULT '{}' | AI usage costs and metrics |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | Creation timestamp |

**Rationale**: Turns provide a complete audit trail of game interactions. The `role` field distinguishes between system prompts, AI responses, and player inputs. The `costs` field tracks AI usage for billing and optimization.

### 7. content_reviews

**Purpose**: Review queue for user-generated content moderation.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigserial | PRIMARY KEY | Auto-incrementing identifier |
| `target_type` | text | NOT NULL, CHECK | Type of content: 'entry_point', 'prompt_segment', 'npc' |
| `target_id` | text | NOT NULL | ID of the content being reviewed |
| `submitted_by` | uuid | NOT NULL | User ID of the content creator |
| `state` | text | NOT NULL, DEFAULT 'open', CHECK | Review state: 'open', 'approved', 'rejected', 'changes_requested' |
| `notes` | text | | Reviewer notes and feedback |
| `reviewer_id` | uuid | | Moderator/admin who performed the review action |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() | Last modification timestamp |

**Rationale**: Content reviews enable a moderation workflow for user-generated content. The `state` field tracks the review process, while `reviewer_id` provides accountability for moderation decisions.

### 8. content_reports

**Purpose**: Community flags for content moderation.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | bigserial | PRIMARY KEY | Auto-incrementing identifier |
| `target_type` | text | NOT NULL, CHECK | Type of content: 'entry_point', 'prompt_segment', 'npc', 'turn' |
| `target_id` | text | NOT NULL | ID of the content being reported |
| `reporter_id` | uuid | NOT NULL | User ID of the reporter |
| `reason` | text | NOT NULL | Reason for the report |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | Creation timestamp |

**Rationale**: Content reports enable community-driven moderation by allowing users to flag inappropriate content. The `reason` field provides context for the report.

## Indexes

### Entry Points Indexes
- `idx_entry_points_type`: Filter by content type
- `idx_entry_points_world`: Filter by world
- `idx_entry_points_ruleset`: Filter by ruleset
- `idx_entry_points_status_vis`: Filter by status and visibility
- `idx_entry_points_owner`: Filter by content owner
- `idx_entry_points_tags`: GIN index for tag searches
- `idx_entry_points_search`: GIN index for full-text search

### Prompt Segments Indexes
- `idx_prompt_segments_scope`: Filter by scope
- `idx_prompt_segments_ref`: Filter by reference ID

### Games Indexes
- `idx_games_owner`: Filter by owner
- `idx_games_entry_point`: Filter by entry point
- `idx_games_world`: Filter by world

### Turns Indexes
- `idx_turns_game_idx`: Unique constraint on (game_id, idx)

### Content Reviews Indexes
- `idx_cr_target`: Filter by target type and ID
- `idx_cr_state`: Filter by review state
- `idx_cr_submitted_by`: Filter by content creator

### Content Reports Indexes
- `idx_crep_target`: Filter by target type and ID
- `idx_crep_reporter`: Filter by reporter

## Prompt Layering Pipeline Support

The schema supports the prompt layering pipeline through:

1. **Hierarchical References**: Entry points reference worlds and rulesets, enabling layered prompt application
2. **Scope-based Segments**: Prompt segments use scopes to determine application order
3. **Game State Management**: The hot/warm/cold state pattern in games enables efficient state transitions
4. **Turn Tracking**: Complete audit trail of all interactions for debugging and optimization

## Search and Discovery

The schema enables efficient content discovery through:

1. **Full-text Search**: Generated `search_text` column with weighted search across titles, descriptions, and tags
2. **Tag-based Filtering**: Array-based tags with GIN indexing
3. **Status and Visibility**: Multi-dimensional filtering for content management
4. **Popularity Scoring**: Built-in popularity metrics for recommendation systems

## Data Integrity

The schema ensures data integrity through:

1. **Foreign Key Constraints**: Proper referential integrity between related tables
2. **Check Constraints**: Domain validation for status fields and content types
3. **Unique Constraints**: Prevents duplicate slugs and turn sequences
4. **Generated Columns**: Computed search vectors ensure consistency

## Performance Considerations

The schema is optimized for performance through:

1. **Strategic Indexing**: Indexes on commonly queried columns and search vectors
2. **Denormalization**: Critical fields duplicated for query efficiency
3. **JSONB Usage**: Flexible schema with efficient JSON operations
4. **Generated Columns**: Pre-computed search vectors avoid runtime computation

## Ownership & Moderation

The schema supports user-generated content (UGC) with a comprehensive moderation workflow:

### Content Ownership
- `entry_points.owner_user_id` — Creator user ID (null for system-owned content)
- `entry_points.lifecycle` — Moderation lifecycle: `draft` → `pending_review` → `changes_requested` → `active` → `archived`/`rejected`
- Public catalog shows only `lifecycle='active'` AND `visibility='public'`

### Moderation Workflow
- `content_reviews` — Review queue for UGC; states: `open` → `approved`/`rejected`/`changes_requested`
- `content_reports` — Community flags for moderation (user reports)
- Review process: Creator submits → Moderator reviews → Approve/Reject/Request Changes

### Access Control
- RLS policies enforcing these rules arrive in Task 2
- Content visibility controlled by `visibility` (public/unlisted/private) and `lifecycle` (active/archived/rejected)
- Owner-based access for content management and editing

## Migration Notes

- This is a greenfield implementation with no legacy dependencies
- All tables use consistent naming conventions (lower_snake_case)
- Timestamps use `timestamptz` for timezone-aware operations
- JSONB fields provide flexibility while maintaining query performance
- The schema is designed to be idempotent and safe for repeated execution
- UGC features are additive and don't affect existing core functionality
