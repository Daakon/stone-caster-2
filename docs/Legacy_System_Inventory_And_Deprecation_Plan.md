# Legacy System Inventory & Deprecation Plan

**Project:** Stone Caster  
**Date:** 2025-01-21  
**Status:** Post-Chimera V2 Migration Audit

## Executive Summary

This document provides a comprehensive inventory of all non-Chimera (legacy) systems, APIs, and data models still active in the Stone Caster codebase following the completion of the Chimera V2 Migration. The Chimera V2 system uses the `/api/v2/chimera` prefix and `chimera_*` table prefixes. All other systems documented here are considered legacy and subject to deprecation planning.

---

## 1. Core Legacy Entities & Usage

### Primary Legacy Database Tables

#### **`games`** (High Usage)
- **Purpose:** Legacy game session storage for pre-Chimera game flow
- **Schema:** Stores game state snapshots, turn counts, entry point references, character associations
- **Key Fields:** `id`, `entry_point_id`, `entry_point_type`, `character_id`, `user_id`, `cookie_group_id`, `world_slug`, `state_snapshot`, `turn_count`, `status`
- **Used By:** 
  - `GamesService` (backend/src/services/games.service.ts)
  - `/api/games` routes (backend/src/routes/games.ts)
  - Legacy game play flow (`GamePage.tsx`)
- **Status:** Active, but superseded by `chimera_game_states`

#### **`characters`** (High Usage)
- **Purpose:** Legacy character data storage
- **Schema:** Character attributes, world associations, active game tracking
- **Key Fields:** `id`, `user_id`, `cookie_id`, `name`, `world_slug`, `world_id` (UUID), `active_game_id`, `world_data`, legacy RPG fields (`race`, `class`, `level`, `attributes`, `skills`, `inventory`, `health`)
- **Used By:**
  - `CharactersService` (backend/src/services/characters.service.ts)
  - `/api/characters` routes (backend/src/routes/characters.ts)
  - Legacy character creation/selection flows
- **Status:** Active, but superseded by `chimera_entity_templates` for Chimera stories

#### **`turns`** (High Usage)
- **Purpose:** Turn history for legacy game sessions
- **Schema:** Stores turn-by-turn game history with narrative content
- **Key Fields:** `id`, `game_id`, `turn_number`, `role`, `content` (JSONB), `meta`
- **Used By:**
  - `TurnsService` (backend/src/services/turns.service.ts)
  - `/api/games/:id/turns` endpoints
  - Legacy game history display
- **Status:** Active, but Chimera uses in-memory state with `chimera_game_states.current_game_state`

#### **`entry_points`** (High Usage)
- **Purpose:** Legacy adventure/scenario entry point definitions
- **Schema:** Adventure metadata, world associations, type classification
- **Key Fields:** `id`, `name`, `title`, `slug`, `description`, `synopsis`, `type`, `world_id`
- **Used By:**
  - `GamesService` (spawn logic)
  - `ContentService` (adventure resolution)
  - `/api/adventures` routes
- **Status:** Active, but superseded by `chimera_stories`

#### **`user_profiles`** (High Usage - Critical Infrastructure)
- **Purpose:** User account data, roles, preferences
- **Schema:** Profile information, role management, avatar approval status
- **Key Fields:** `id`, `role`, `role_version`, `avatar_url`, `avatar_approval_status`, creator fields
- **Used By:**
  - `/api/me` endpoint
  - `/api/profile` routes
  - Authentication/authorization system
  - Admin role checks
- **Status:** **KEEP** - Critical infrastructure, not game content

#### **`cookie_groups`** & `cookie_group_members`** (Medium Usage)
- **Purpose:** Guest user cookie group management for linking guest sessions
- **Schema:** Cookie group definitions and membership tracking
- **Used By:**
  - Profile service (guest linking)
  - Games service (guest game tracking)
- **Status:** **KEEP** - Required for guest user support

#### **`stone_wallets`** & `stone_ledger`** (Low Usage - Critical Infrastructure)
- **Purpose:** Stone currency wallet and transaction ledger
- **Schema:** Wallet balances, transaction history
- **Used By:**
  - `WalletService` (backend/src/services/wallet.service.ts)
  - `/api/stones` routes (backend/src/routes/stones.ts)
  - Wallet UI (`WalletPage.tsx`)
- **Status:** **KEEP** - Critical infrastructure for economy

#### **`world_id_mapping`** (High Usage - Migration Bridge)
- **Purpose:** Maps legacy world slugs to UUID world identifiers
- **Schema:** Slug-to-UUID resolution table
- **Used By:**
  - `CharactersService` (world identity resolution)
  - `GamesService` (world identity normalization)
  - Adventure identity resolver
- **Status:** **KEEP** - Required for backward compatibility during migration

#### **`players_v3`** (Medium Usage)
- **Purpose:** Player V3 character data (intermediate migration format)
- **Schema:** V3 character schema
- **Used By:**
  - `/api/players-v3` routes
  - Legacy character creation flows
- **Status:** **DEPRECATE** - Superseded by Chimera entity templates

#### **`npcs`** (Medium Usage)
- **Purpose:** Legacy NPC definitions (non-Chimera)
- **Schema:** NPC metadata, world associations
- **Key Fields:** `id`, `world_id` (now UUID, migrated from slug), NPC attributes
- **Used By:**
  - `/api/npcs` routes
  - `/api/catalog/npcs` routes
  - Legacy NPC management UI
- **Status:** **DEPRECATE** - Superseded by `chimera_entity_templates` (entity_type='NPC')

#### **`premade_characters`** (Medium Usage - Migration Bridge)
- **Purpose:** Premade character templates for quick character creation
- **Schema:** Character templates linked to worlds (now via UUID `world_id`)
- **Key Fields:** `id`, `world_id` (UUID FK to `chimera_worlds`), `archetype_key`, `display_name`, `base_traits`
- **Used By:**
  - `/api/premades` routes
  - Quick start character creation
- **Status:** **DEPRECATE/ABSORB** - Should migrate to `chimera_entity_templates` with `is_quick_start_template=true`

#### **`rulesets`** (Medium Usage)
- **Purpose:** Legacy ruleset definitions
- **Schema:** Ruleset metadata and definitions
- **Used By:**
  - Legacy game assembly
  - Entry point ruleset linking
- **Status:** **DEPRECATE** - Superseded by `chimera_ruleset_templates`

#### **`worlds`** / `world_templates`** (Medium Usage)
- **Purpose:** Legacy world definitions
- **Schema:** World metadata, themes, rules
- **Used By:**
  - `/api/worlds` routes (legacy)
  - `ContentService` (world resolution)
- **Status:** **DEPRECATE** - Superseded by `chimera_worlds`

#### **`entry_point_rulesets`** (Medium Usage)
- **Purpose:** Links entry points to legacy rulesets
- **Schema:** Junction table
- **Status:** **DEPRECATE** - Superseded by Chimera story/ruleset linking

#### **Analytics & Save Tables** (Low Usage)
- **`awf_saves`**, **`awf_save_blobs`**, **`awf_save_diffs`**: Legacy save game storage
- **`awf_cloud_sync_config`**, **`awf_sync_audit`**: Cloud sync configuration and audit
- **Status:** **DEPRECATE** - Chimera uses `chimera_game_states` for state persistence

#### **Prompt System Tables** (Low Usage)
- **`prompts`**, **`prompt_segments`**: Legacy prompt template system
- **`prompt_snapshots`**: Frozen prompt snapshots for game sessions
- **Status:** **DEPRECATE** - Chimera uses compiled ruleset JSON

#### **Infrastructure Tables** (Keep)
- **`idempotency_keys`**: Idempotency tracking (used by both systems)
- **`feature_flags`**: Feature flag definitions
- **`config_meta`**: Configuration metadata
- **Status:** **KEEP** - Critical infrastructure

---

## 2. Frontend Screens/Areas to Decouple

### Legacy Game Play Screens

#### **`GamePage.tsx`** (`/game/:id`, `/play/:gameId`, `/unified-game/:id`)
- **Purpose:** Legacy game play interface
- **APIs Used:** 
  - `/api/games/:id` (GET, POST turns)
  - `/api/games/:id/turns` (GET)
  - `/api/story/:id` (legacy)
  - `/api/characters/:id`
- **Status:** **DEPRECATE** - Replace with Chimera play flow (`/play/:gameStateId` via `chimera-play.ts`)

#### **`CharacterSelectionPage.tsx`** (`/stories/:id/characters`)
- **Purpose:** Legacy character selection before starting game
- **APIs Used:**
  - `/api/characters?world=...`
  - `/api/games` (POST to spawn)
- **Status:** **DEPRECATE** - Replaced by `PlayerGatewayPage.tsx` for Chimera stories

#### **`CharacterCreatorPage.tsx`** (`/create-character`)
- **Purpose:** Legacy character creation form
- **APIs Used:**
  - `/api/characters` (POST)
  - `/api/worlds` (GET for world data)
- **Status:** **DEPRECATE** - Replaced by Chimera character creation flow (`/api/v2/play/:storyId/character/*`)

#### **`PlayerV3CreationPage.tsx`**
- **Purpose:** Player V3 character creation
- **APIs Used:**
  - `/api/players-v3` (POST)
- **Status:** **DEPRECATE** - Superseded by Chimera entity creation

### Legacy Content Browsing Screens

#### **`StoriesPage.tsx`** (`/stories`)
- **Current State:** Dual-mode (Chimera + Legacy)
- **Legacy APIs Used:**
  - `/api/catalog` (legacy stories)
  - `/api/adventures`
- **Status:** **MIGRATING** - Currently supports both, should fully migrate to Chimera

#### **`StoryDetailPage.tsx`** (`/stories/:id`)
- **Current State:** Dual-mode (Chimera + Legacy)
- **Legacy APIs Used:**
  - `/api/catalog/stories/:id` (legacy)
  - `/api/adventures/:id`
- **Status:** **MIGRATING** - Should fully migrate to Chimera story detail

### Legacy Dashboard/Management Screens

#### **`MyCreationsDashboard`** (`/dashboard/creations/*`)
- **Current State:** Fully migrated to Chimera
- **Status:** ✅ **MIGRATED** - Uses Chimera APIs only

#### Legacy NPC Management (`/my/npcs`, `/my/worlds`)
- **APIs Used:**
  - `/api/npcs` (legacy)
  - `/api/worlds` (legacy)
- **Status:** **DEPRECATE** - Should use Chimera entity/world APIs

### Infrastructure Screens (Keep)

#### **`WalletPage.tsx`** (`/wallet`)
- **Purpose:** Stone wallet and transaction history
- **APIs Used:**
  - `/api/stones/wallet` (GET)
  - `/api/stones/packs` (GET)
  - `/api/stones/purchase` (POST)
  - `/api/stones/convert` (POST)
- **Status:** **KEEP** - Critical infrastructure, not game content

#### **`ProfilePage.tsx`** (`/profile`)
- **Purpose:** User profile management
- **APIs Used:**
  - `/api/profile` (GET, PUT)
  - `/api/profile/access` (GET)
- **Status:** **KEEP** - Critical infrastructure

#### **`PaymentsPage.tsx`** (`/payments`)
- **Purpose:** Payment and subscription management
- **APIs Used:**
  - `/api/subscription` (various)
  - `/api/stones/purchase`
- **Status:** **KEEP** - Critical infrastructure

---

## 3. Active Legacy API Endpoints (Non-Chimera)

### Authentication & Identity (KEEP)

#### **`/api/me`** (GET)
- **Purpose:** Current user identity and role information
- **Tables:** `user_profiles`
- **Status:** **KEEP** - Critical infrastructure

#### **`/api/auth/*`**
- **Purpose:** Authentication endpoints (OAuth, login, logout)
- **Status:** **KEEP** - Critical infrastructure

### Profile Management (KEEP)

#### **`/api/profile`** (GET, PUT)
- **Purpose:** User profile CRUD
- **Tables:** `user_profiles`
- **Status:** **KEEP** - Critical infrastructure

#### **`/api/profile/access`** (GET)
- **Purpose:** Check profile access permissions
- **Status:** **KEEP** - Critical infrastructure

#### **`/api/profile/guest/*`**
- **Purpose:** Guest profile management
- **Tables:** `cookie_groups`, `cookie_group_members`
- **Status:** **KEEP** - Required for guest support

### Wallet & Economy (KEEP)

#### **`/api/stones/wallet`** (GET)
- **Purpose:** Get stone wallet balance
- **Tables:** `stone_wallets`, `stone_ledger`
- **Status:** **KEEP** - Critical infrastructure

#### **`/api/stones/convert`** (POST)
- **Purpose:** Convert stone types
- **Tables:** `stone_wallets`, `stone_ledger`
- **Status:** **KEEP** - Critical infrastructure

#### **`/api/stones/packs`** (GET)
- **Purpose:** Get available stone packs
- **Tables:** Stone packs service (separate system)
- **Status:** **KEEP** - Critical infrastructure

#### **`/api/stones/purchase`** (POST)
- **Purpose:** Purchase stone packs
- **Tables:** `stone_wallets`, `stone_ledger`, payment system
- **Status:** **KEEP** - Critical infrastructure

### Configuration (KEEP)

#### **`/api/config`** (GET)
- **Purpose:** Public application configuration
- **Tables:** `config_meta`, `feature_flags`
- **Status:** **KEEP** - Critical infrastructure

### Legacy Game Play (DEPRECATE)

#### **`/api/games`** (POST)
- **Purpose:** Spawn new legacy game session
- **Tables:** `games`, `entry_points`, `characters`
- **Status:** **DEPRECATE** - Replace with `/api/v2/play/:storyId/start`

#### **`/api/games/:id`** (GET, PUT, DELETE)
- **Purpose:** Get/update/delete legacy game session
- **Tables:** `games`
- **Status:** **DEPRECATE** - Replace with `/api/v2/play/:gameStateId`

#### **`/api/games/:id/turns`** (GET, POST)
- **Purpose:** Get/submit turns for legacy game
- **Tables:** `games`, `turns`
- **Status:** **DEPRECATE** - Replace with `/api/v2/play/:gameStateId/cast-stone`

#### **`/api/games/:id/session-turns`** (GET)
- **Purpose:** Get session turn history
- **Tables:** `turns`
- **Status:** **DEPRECATE** - Chimera uses in-memory state

#### **`/api/games/:id/end`** (POST)
- **Purpose:** End legacy game session
- **Tables:** `games`, `characters`
- **Status:** **DEPRECATE** - Chimera handles state transitions internally

### Legacy Characters (DEPRECATE)

#### **`/api/characters`** (GET, POST)
- **Purpose:** List/create legacy characters
- **Tables:** `characters`, `world_id_mapping`
- **Status:** **DEPRECATE** - Replace with Chimera entity templates for new characters

#### **`/api/characters/:id`** (GET, PUT, DELETE)
- **Purpose:** Get/update/delete legacy character
- **Tables:** `characters`
- **Status:** **DEPRECATE** - For new characters, use Chimera entity APIs

#### **`/api/characters/world/:worldId`** (GET)
- **Purpose:** Get characters for a world
- **Tables:** `characters`, `world_id_mapping`
- **Status:** **DEPRECATE** - Use `/api/v2/play/:storyId/player-entities` for Chimera

### Legacy Content (DEPRECATE)

#### **`/api/worlds`** (GET)
- **Purpose:** Get legacy world list
- **Tables:** `worlds` / `world_templates`, `ContentService`
- **Status:** **DEPRECATE** - Replace with `/api/v2/chimera/worlds/selectable`

#### **`/api/worlds/:id`** (GET)
- **Purpose:** Get legacy world detail
- **Tables:** `worlds` / `world_templates`
- **Status:** **DEPRECATE** - Replace with `/api/v2/chimera/worlds/:id`

#### **`/api/adventures`** (GET)
- **Purpose:** Get legacy adventure list
- **Tables:** `entry_points`, `ContentService`
- **Status:** **DEPRECATE** - Replace with `/api/v2/chimera/stories` (filtered)

#### **`/api/adventures/:id`** (GET)
- **Purpose:** Get legacy adventure detail
- **Tables:** `entry_points`
- **Status:** **DEPRECATE** - Replace with `/api/v2/chimera/stories/:id`

#### **`/api/adventures/slug/:slug`** (GET)
- **Purpose:** Get adventure by slug
- **Tables:** `entry_points`
- **Status:** **DEPRECATE** - Chimera uses UUIDs

#### **`/api/story`** (POST)
- **Purpose:** Legacy story action processing
- **Tables:** `game_saves`, `characters`
- **Status:** **DEPRECATE** - Replace with Chimera play engine

#### **`/api/catalog`** (GET)
- **Purpose:** Legacy catalog browsing (stories, adventures)
- **Tables:** `entry_points`, `ContentService`
- **Status:** **DEPRECATE** - Replace with Chimera story APIs

#### **`/api/catalog/stories/:id`** (GET)
- **Purpose:** Get legacy story from catalog
- **Tables:** `entry_points`
- **Status:** **DEPRECATE** - Replace with `/api/v2/chimera/stories/:id`

#### **`/api/catalog/npcs`** (GET)
- **Purpose:** Get public NPCs from catalog
- **Tables:** `npcs`
- **Status:** **DEPRECATE** - Replace with `/api/v2/chimera/entities` (filtered by visibility)

### Legacy NPCs (DEPRECATE)

#### **`/api/npcs`** (GET, POST)
- **Purpose:** List/create user NPCs
- **Tables:** `npcs`
- **Status:** **DEPRECATE** - Replace with `/api/v2/chimera/entities` (entity_type='NPC')

#### **`/api/npcs/:id`** (GET, PUT, DELETE)
- **Purpose:** Get/update/delete NPC
- **Tables:** `npcs`
- **Status:** **DEPRECATE** - Replace with `/api/v2/chimera/entities/:id`

#### **`/api/catalogNpcs`** (GET)
- **Purpose:** Get public NPCs
- **Tables:** `npcs`
- **Status:** **DEPRECATE** - Replace with Chimera entity APIs

### Legacy Premade Characters (DEPRECATE/ABSORB)

#### **`/api/premades`** (GET, POST)
- **Purpose:** List/create premade character templates
- **Tables:** `premade_characters`
- **Status:** **DEPRECATE/ABSORB** - Migrate to `chimera_entity_templates` with `is_quick_start_template=true`

#### **`/api/premades/:id`** (GET, PUT, DELETE)
- **Purpose:** Get/update/delete premade character
- **Tables:** `premade_characters`
- **Status:** **DEPRECATE/ABSORB** - Migrate to Chimera entity APIs

### Legacy Players V3 (DEPRECATE)

#### **`/api/players-v3`** (GET, POST)
- **Purpose:** Player V3 character management
- **Tables:** `players_v3`
- **Status:** **DEPRECATE** - Superseded by Chimera entity templates

### Legacy Search (DEPRECATE)

#### **`/api/search`** (GET)
- **Purpose:** Legacy search across content
- **Tables:** Various legacy tables
- **Status:** **DEPRECATE** - Should use Chimera-specific search or migrate to unified search

### Infrastructure Endpoints (KEEP)

#### **`/api/health`** (GET)
- **Purpose:** Health check
- **Status:** **KEEP** - Critical infrastructure

#### **`/api/telemetry`** (POST)
- **Purpose:** Telemetry/analytics events
- **Tables:** Analytics system
- **Status:** **KEEP** - Critical infrastructure

#### **`/api/webhooks`** (POST)
- **Purpose:** Webhook handling
- **Status:** **KEEP** - Critical infrastructure

#### **`/api/subscription`** (various)
- **Purpose:** Subscription management
- **Status:** **KEEP** - Critical infrastructure

#### **`/api/dice`** (POST)
- **Purpose:** Dice rolling service
- **Status:** **KEEP** - Shared utility, not game content

#### **`/api/media`**, **`/api/media/approvals`**, **`/api/coverMedia`**
- **Purpose:** Media upload and approval
- **Status:** **KEEP** - Shared infrastructure

#### **`/api/content`** (GET)
- **Purpose:** Content service (worlds, adventures resolution)
- **Tables:** `entry_points`, `worlds`
- **Status:** **DEPRECATE** - Should migrate to Chimera content APIs

#### **`/api/cookie-linking`** (POST)
- **Purpose:** Link guest cookies to authenticated accounts
- **Tables:** `cookie_groups`
- **Status:** **KEEP** - Required for guest support

### Admin Endpoints (Mixed)

#### **`/api/admin/*`**
- **Purpose:** Admin operations (various)
- **Status:** **REVIEW** - Some may be legacy, some may be infrastructure

#### **`/api/admin/publishing/*`**
- **Purpose:** Publishing workflow management
- **Status:** **REVIEW** - May need migration to Chimera publishing

#### **`/api/publish/*`**, **`/api/publishing/*`**
- **Purpose:** Public publishing endpoints
- **Status:** **REVIEW** - May need migration

#### **`/api/request-access`**, **`/api/admin/access-requests`**
- **Purpose:** Early access request management
- **Status:** **KEEP** - Critical infrastructure

#### **`/api/user-authoring`**
- **Purpose:** User authoring tools
- **Status:** **REVIEW** - May need migration to Chimera

### AWF System Endpoints (Legacy - DEPRECATE)

All `/api/awf-*` endpoints:
- **`/api/awf-autoplay`**
- **`/api/awf-cloud-sync`**
- **`/api/awf-economy-admin`**
- **`/api/awf-experiments-admin`**
- **`/api/awf-liveops`**
- **`/api/awf-localization-admin`**
- **`/api/awf-marketplace`**
- **`/api/awf-mechanics-admin`**
- **`/api/awf-metrics-admin`**
- **`/api/awf-mods-admin`**
- **`/api/awf-npc-personality-admin`**
- **`/api/awf-ops-admin`**
- **`/api/awf-party-admin`**
- **`/api/awf-quest-graph-admin`**
- **`/api/awf-session-ops`**
- **`/api/awf-sim-admin`**

**Status:** **DEPRECATE** - Legacy AWF system, superseded by Chimera

---

## 4. Deprecation/Absorption Plan

### Phase 1: Critical Infrastructure (KEEP - No Action)

These endpoints and tables are critical infrastructure and should remain active:

- ✅ `/api/me` - User identity
- ✅ `/api/auth/*` - Authentication
- ✅ `/api/profile/*` - Profile management
- ✅ `/api/stones/*` - Wallet and economy
- ✅ `/api/config` - Configuration
- ✅ `/api/health` - Health checks
- ✅ `/api/telemetry` - Analytics
- ✅ `/api/webhooks` - Webhooks
- ✅ `/api/subscription` - Subscriptions
- ✅ `/api/dice` - Dice service
- ✅ `/api/media/*` - Media management
- ✅ `/api/cookie-linking` - Guest linking
- ✅ `/api/request-access` - Early access
- ✅ `user_profiles` - User accounts
- ✅ `cookie_groups` - Guest management
- ✅ `stone_wallets`, `stone_ledger` - Economy
- ✅ `idempotency_keys` - Idempotency
- ✅ `feature_flags`, `config_meta` - Configuration

### Phase 2: Migration Bridge (KEEP - Temporary)

These systems are required for backward compatibility during migration:

- ⏳ `world_id_mapping` - Slug-to-UUID resolution (remove after full migration)
- ⏳ Legacy character read access (for existing games)
- ⏳ Legacy game read access (for existing saves)

### Phase 3: Content Migration (DEPRECATE - Migrate to Chimera)

#### **Stories & Adventures**
- **Action:** Migrate all `entry_points` data to `chimera_stories`
- **Timeline:** After all users migrated to Chimera stories
- **Endpoints to Deprecate:**
  - `/api/adventures/*`
  - `/api/catalog/stories/*`
  - `/api/story` (POST)

#### **Worlds**
- **Action:** Migrate all `worlds`/`world_templates` to `chimera_worlds`
- **Timeline:** After all stories migrated
- **Endpoints to Deprecate:**
  - `/api/worlds/*`

#### **NPCs**
- **Action:** Migrate all `npcs` to `chimera_entity_templates` (entity_type='NPC')
- **Timeline:** After entity system stabilized
- **Endpoints to Deprecate:**
  - `/api/npcs/*`
  - `/api/catalog/npcs`

#### **Premade Characters**
- **Action:** Migrate `premade_characters` to `chimera_entity_templates` with `is_quick_start_template=true`
- **Timeline:** After character creation flow migrated
- **Endpoints to Deprecate:**
  - `/api/premades/*`

#### **Rulesets**
- **Action:** Migrate `rulesets` to `chimera_ruleset_templates`
- **Timeline:** After story migration complete
- **Note:** Already largely superseded

### Phase 4: Game Play Migration (DEPRECATE - Replace with Chimera)

#### **Game Sessions**
- **Action:** Migrate active `games` to `chimera_game_states` (or archive)
- **Timeline:** After all new games use Chimera
- **Endpoints to Deprecate:**
  - `/api/games` (POST - spawn)
  - `/api/games/:id` (GET, PUT, DELETE)
  - `/api/games/:id/turns` (GET, POST)
  - `/api/games/:id/session-turns` (GET)
  - `/api/games/:id/end` (POST)

#### **Characters (New)**
- **Action:** Stop creating new characters in `characters` table
- **Timeline:** After character creation fully migrated to Chimera
- **Endpoints to Deprecate:**
  - `/api/characters` (POST - new characters only)
  - `/api/characters/world/:worldId` (for new games)

#### **Turns**
- **Action:** Archive `turns` table (read-only access for legacy games)
- **Timeline:** After all active games migrated
- **Note:** Chimera uses in-memory state, no separate turns table needed

### Phase 5: Legacy Systems Cleanup (DEPRECATE - Remove)

#### **AWF System**
- **Action:** Remove all `/api/awf-*` endpoints
- **Timeline:** After confirming no dependencies
- **Tables:** `awf_saves`, `awf_save_blobs`, `awf_save_diffs`, `awf_cloud_sync_config`, `awf_sync_audit`

#### **Prompt System**
- **Action:** Archive `prompts`, `prompt_segments`, `prompt_snapshots`
- **Timeline:** After Chimera rebuild service stable
- **Note:** Chimera uses compiled JSON, not prompt assembly

#### **Players V3**
- **Action:** Remove `players_v3` table and endpoints
- **Timeline:** After character migration complete
- **Endpoints to Deprecate:**
  - `/api/players-v3/*`

#### **Legacy Search**
- **Action:** Migrate to Chimera-specific search or unified search
- **Timeline:** After content migration
- **Endpoints to Deprecate:**
  - `/api/search` (if not unified)

### Phase 6: Frontend Migration

#### **Game Play Screens**
- **Action:** Remove `GamePage.tsx`, migrate to Chimera play flow
- **Routes:** `/game/:id`, `/play/:gameId` (legacy), `/unified-game/:id`
- **Timeline:** After backend migration complete

#### **Character Screens**
- **Action:** Remove `CharacterSelectionPage.tsx`, `CharacterCreatorPage.tsx`, `PlayerV3CreationPage.tsx`
- **Timeline:** After character creation migrated
- **Note:** `PlayerGatewayPage.tsx` already handles Chimera flow

#### **Content Browsing**
- **Action:** Complete migration of `StoriesPage.tsx`, `StoryDetailPage.tsx` to Chimera-only
- **Timeline:** After backend content APIs migrated

### Final Toggle Switch

The final toggle to enforce Chimera-only mode should:

1. **Disable Legacy Game Creation:**
   - Block `/api/games` (POST) for new games
   - Redirect to Chimera story selection

2. **Disable Legacy Character Creation:**
   - Block `/api/characters` (POST) for new characters
   - Redirect to Chimera character creation

3. **Disable Legacy Content Browsing:**
   - Block `/api/adventures`, `/api/catalog/stories`
   - Redirect to Chimera story APIs

4. **Archive Legacy Data:**
   - Mark `games`, `characters`, `turns` tables as read-only
   - Provide migration tools for users with legacy saves

5. **Remove Legacy Endpoints:**
   - Remove all deprecated endpoints after grace period
   - Update frontend to remove legacy route handlers

---

## Summary Statistics

### Endpoints by Status

- **KEEP (Critical Infrastructure):** ~25 endpoints
- **DEPRECATE (Game Content):** ~40 endpoints
- **REVIEW (Admin/Infrastructure):** ~10 endpoints

### Tables by Status

- **KEEP (Critical Infrastructure):** ~8 tables
- **DEPRECATE (Game Content):** ~15 tables
- **MIGRATION BRIDGE (Temporary):** ~3 tables

### Frontend Screens by Status

- **KEEP (Infrastructure):** 3 screens (Wallet, Profile, Payments)
- **DEPRECATE (Game Play):** 5 screens
- **MIGRATING (Content):** 2 screens (partially migrated)

---

## Next Steps

1. **Immediate:** Document all legacy endpoints in API documentation with deprecation notices
2. **Short-term:** Implement feature flag to toggle Chimera-only mode
3. **Medium-term:** Complete frontend migration for content browsing screens
4. **Long-term:** Archive legacy game data and remove deprecated endpoints
5. **Final:** Remove legacy tables and clean up migration bridge code

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-21  
**Maintained By:** Development Team

