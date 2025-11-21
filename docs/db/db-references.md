# Database Query References

This document catalogs all Supabase queries used throughout the Stone Caster codebase, organized by table.

## Table Summary

### Core Chimera V2 Tables (High Usage)

| Table | Description | Usage Frequency | Used By |
|-------|-------------|-----------------|---------|
| `chimera_stories` | Story definitions and metadata | **Very High** | Play engine, story CRUD, rebuild service |
| `chimera_game_states` | Active game session states | **Very High** | Play engine, game initialization, turn processing |
| `chimera_entity_templates` | Entity templates (NPCs, items, factions) | **High** | Entity CRUD, play engine, story linking |
| `chimera_worlds` | World definitions and metadata | **High** | World CRUD, story creation, character schema |
| `chimera_story_compiled_ruleset` | Compiled story JSON for runtime | **High** | Play engine, story rebuild |
| `chimera_ruleset_templates` | Ruleset template definitions | **High** | Story rebuild, world linking, admin CRUD |
| `chimera_story_links` | Links stories to ruleset templates | **High** | Story CRUD, rebuild service |
| `chimera_story_entity_links` | Links stories to entity templates | **High** | Story CRUD, play engine, rebuild service |
| `chimera_world_ruleset_link` | Links worlds to ruleset templates | **Medium** | World CRUD, story rebuild |
| `chimera_content_packs` | Content pack definitions | **Medium** | Pack CRUD, story linking |
| `chimera_story_content_pack_links` | Links stories to content packs | **Medium** | Story CRUD, rebuild service |
| `chimera_content_pack_entity_links` | Links packs to entities | **Medium** | Pack CRUD |
| `chimera_content_pack_ruleset_links` | Links packs to rulesets | **Medium** | Pack CRUD, rebuild service |
| `chimera_content_pack_lore_links` | Links packs to lore entries | **Low** | Pack CRUD |
| `chimera_pack_dependencies` | Pack dependency relationships | **Medium** | Pack CRUD, rebuild service (dependency resolution) |
| `chimera_lore_entries` | Lore entry definitions (RAG system) | **Medium** | Lore CRUD, rebuild service |
| `chimera_tags` | Tag definitions | **Medium** | Tag CRUD, asset tagging |
| `chimera_asset_tags` | Links assets (worlds, entities, etc.) to tags | **Medium** | World/Entity CRUD, tag management |
| `chimera_exclusion_groups` | Exclusion groups for ruleset templates | **Low** | Ruleset admin CRUD |

### Legacy/Other Tables (Medium to Low Usage)

| Table | Description | Usage Frequency | Used By |
|-------|-------------|-----------------|---------|
| `games` | Legacy game sessions | **High** | Games service, spawn, turns |
| `characters` | Legacy character data | **High** | Characters service, games service |
| `turns` | Turn history | **High** | Turns service, games service |
| `entry_points` | Entry point definitions | **High** | Games service, spawn, assembler |
| `entry_point_rulesets` | Links entry points to rulesets | **Medium** | Games service, assembler |
| `rulesets` | Legacy ruleset definitions | **Medium** | Games service, assembler |
| `worlds` | Legacy world definitions | **Medium** | Content service, games service |
| `world_id_mapping` | Maps world slugs to UUIDs | **High** | Characters service, games service |
| `user_profiles` | User profile data | **High** | Profile service, auth, admin |
| `cookie_groups` | Guest user cookie groups | **Medium** | Profile service, games service |
| `cookie_group_members` | Cookie group membership | **Low** | Profile service |
| `players_v3` | Player V3 character data | **Medium** | Player V3 service |
| `npcs` | NPC definitions | **Medium** | NPC routes, content service |
| `prompts` | Prompt templates | **Low** | Prompts service |
| `prompt_segments` | Prompt building blocks | **Low** | Prompts service, assembler |
| `prompt_snapshots` | Frozen prompt snapshots | **Medium** | Prompt snapshot service, games service |
| `idempotency_keys` | Idempotency tracking | **Medium** | Idempotency service, games service |
| `stone_ledger` | Stone transaction ledger | **Low** | Wallet service |
| `stone_wallets` | User stone wallets | **Low** | Wallet service |
| `awf_saves` | Save game records | **Low** | Save service |
| `awf_save_blobs` | Save game blob storage | **Low** | Save service |
| `awf_save_diffs` | Save game diffs | **Low** | Save service |
| `awf_cloud_sync_config` | Cloud sync configuration | **Low** | Save service |
| `awf_sync_audit` | Sync audit log | **Low** | Save service |
| `feature_flags` | Feature flag definitions | **Low** | Config service |
| `config_meta` | Configuration metadata | **Low** | Config service |

---

## Detailed Query Documentation

### `chimera_stories`

**Purpose**: Story definitions and metadata for the Chimera V2 system.

**Usage**: Core table for story management. Used extensively in play engine, story CRUD operations, and rebuild service.

**Queries**:

1. **GET /api/v2/chimera/stories/my-creations**
   - Select all stories owned by user
   - Location: `backend/src/routes/chimera-stories.ts:70`
   - Query: `.from('chimera_stories').select('*').eq('owner_user_id', userId).order('created_at', { ascending: false })`
   - Joins: `world`, `ruleset_links`, `entity_links`

2. **POST /api/v2/chimera/stories**
   - Create new story
   - Location: `backend/src/routes/chimera-stories.ts:228`
   - Query: `.from('chimera_stories').insert({...}).select().single()`
   - Validates: world_id, ruleset_template_ids, pack_ids

3. **GET /api/v2/chimera/stories/:id**
   - Get single story with relations
   - Location: `backend/src/routes/chimera-stories.ts:393`
   - Query: `.from('chimera_stories').select('*, world:chimera_worlds(...), ruleset_links:chimera_story_links(...), pack_links:chimera_story_content_pack_links(...)').eq('id', id).single()`
   - Access control: owner or public visibility

4. **PUT /api/v2/chimera/stories/:id**
   - Update story
   - Location: `backend/src/routes/chimera-stories.ts:566`
   - Query: `.from('chimera_stories').update({...}).eq('id', id)`
   - Handles: ruleset links diffing, pack links diffing, entity links diffing

5. **DELETE /api/v2/chimera/stories/:id**
   - Delete story
   - Location: `backend/src/routes/chimera-stories.ts:1063`
   - Query: `.from('chimera_stories').delete().eq('id', id)`
   - Cascade: deletes related links

6. **POST /api/v2/chimera/stories/:id/rebuild**
   - Rebuild/compile story
   - Location: `backend/src/services/chimera/rebuild-service.ts:159`
   - Query: `.from('chimera_stories').select('id, owner_user_id, world_id').eq('id', storyId).single()`
   - Used by: rebuild service to fetch story metadata

7. **Play Engine - Story Verification**
   - Location: `backend/src/routes/chimera-play.ts:156, 732, 896, 1248, 1397`
   - Query: `.from('chimera_stories').select('id, visibility, owner_user_id, world_id').eq('id', storyId).single()`
   - Purpose: Verify story exists and user has access before starting game

**Dependencies**: Referenced by `chimera_story_links`, `chimera_story_entity_links`, `chimera_story_content_pack_links`, `chimera_story_compiled_ruleset`, `chimera_lore_entries`, `chimera_game_states`

---

### `chimera_game_states`

**Purpose**: Active game session states for Chimera V2 play engine.

**Usage**: Very high - core table for game state management. Every game session creates/updates records here.

**Queries**:

1. **GET /api/v2/play/:gameStateId**
   - Get game state by ID
   - Location: `backend/src/routes/chimera-play.ts:80`
   - Query: `.from('chimera_game_states').select('*').eq('id', gameStateId).single()`
   - Access control: user_id must match

2. **POST /api/v2/play/:storyId/start**
   - Start new game session
   - Location: `backend/src/routes/chimera-play.ts:323, 401`
   - Query: `.from('chimera_game_states').select('id').eq('story_id', storyId).eq('user_id', userId).single()`
   - Creates: new game state if doesn't exist via `createInitialState()`

3. **POST /api/v2/play/:gameStateId/cast-stone**
   - Execute player action
   - Location: `backend/src/routes/chimera-play.ts:546, 591, 654`
   - Queries:
     - Fetch: `.from('chimera_game_states').select('*').eq('id', gameStateId).single()`
     - Update: `.from('chimera_game_states').update({ current_game_state, turn_count, updated_at }).eq('id', gameStateId)`

4. **State Factory - Create Initial State**
   - Location: `backend/src/services/play/state-factory.ts:45`
   - Query: `.from('chimera_game_states').insert({ story_id, user_id, current_game_state, turn_count: 0, status: 'active' }).select().single()`
   - Purpose: Initialize new game state from compiled story schema

**Dependencies**: References `chimera_stories` (via story_id)

---

### `chimera_entity_templates`

**Purpose**: Entity templates (NPCs, items, factions) that can be linked to stories and used in gameplay.

**Usage**: High - used for entity CRUD, story linking, and play engine character selection.

**Queries**:

1. **GET /api/v2/chimera/entities**
   - Get all user entities
   - Location: `backend/src/routes/chimera-entities.ts:118`
   - Query: `.from('chimera_entity_templates').select('*').eq('owner_user_id', userId).order('created_at', { ascending: false })`

2. **POST /api/v2/chimera/entities**
   - Create entity template
   - Location: `backend/src/routes/chimera-entities.ts:230`
   - Query: `.from('chimera_entity_templates').insert({...}).select().single()`
   - Handles: tag creation and linking

3. **GET /api/v2/chimera/entities/:id**
   - Get single entity
   - Location: `backend/src/routes/chimera-entities.ts:358`
   - Query: `.from('chimera_entity_templates').select('*').eq('id', id).single()`
   - Access control: owner or public visibility

4. **PUT /api/v2/chimera/entities/:id**
   - Update entity
   - Location: `backend/src/routes/chimera-entities.ts:500`
   - Query: `.from('chimera_entity_templates').update({...}).eq('id', id).select().single()`

5. **DELETE /api/v2/chimera/entities/:id**
   - Delete entity
   - Location: `backend/src/routes/chimera-entities.ts:594`
   - Query: `.from('chimera_entity_templates').delete().eq('id', id)`

6. **GET /api/v2/play/:storyId/player-entities**
   - Get player entities for selection
   - Location: `backend/src/routes/chimera-play.ts:783, 811, 828`
   - Queries:
     - User-owned: `.from('chimera_entity_templates').select('...').eq('owner_user_id', userId).eq('entity_type', 'NPC').eq('is_system_asset', false)`
     - System assets: `.from('chimera_entity_templates').select('...').eq('is_system_asset', true).eq('is_quick_start_template', true).eq('entity_type', 'NPC').or('world_id.eq.${worldId},world_id.is.null')`

7. **POST /api/v2/play/:storyId/quick-start**
   - Create quick start character
   - Location: `backend/src/routes/chimera-play.ts:939`
   - Query: `.from('chimera_entity_templates').insert({...}).select().single()`

8. **POST /api/v2/play/:storyId/character/finalize**
   - Finalize character creation
   - Location: `backend/src/routes/chimera-play.ts:1434`
   - Query: `.from('chimera_entity_templates').insert({...}).select().single()`

9. **Admin - System Entity CRUD**
   - Location: `backend/src/routes/chimera-admin-entities.ts`
   - Queries: Similar to user entities but with `is_system_asset = true` filter

**Dependencies**: Referenced by `chimera_story_entity_links`, `chimera_content_pack_entity_links`, `chimera_asset_tags`

---

### `chimera_worlds`

**Purpose**: World definitions that provide character schema contributions and can link to ruleset templates.

**Usage**: High - used for world CRUD, story creation, and character schema resolution.

**Queries**:

1. **POST /api/v2/chimera/worlds**
   - Create new world
   - Location: `backend/src/routes/chimera-worlds.ts:117`
   - Query: `.from('chimera_worlds').insert({...}).select().single()`
   - Validates: ruleset_template_ids (must be MODIFIER type)

2. **GET /api/v2/chimera/worlds/selectable**
   - Get selectable worlds
   - Location: `backend/src/routes/chimera-worlds.ts:268`
   - Query: `.from('chimera_worlds').select('id, display_name, version, visibility').or('visibility.eq.public,owner_user_id.eq.${userId}').order('display_name', { ascending: true })`

3. **GET /api/v2/chimera/worlds/my-creations**
   - Get user's worlds
   - Location: `backend/src/routes/chimera-worlds.ts:315`
   - Query: `.from('chimera_worlds').select('*, ruleset_links:chimera_world_ruleset_link(...)').eq('owner_user_id', userId).order('created_at', { ascending: false })`

4. **GET /api/v2/chimera/worlds/:id**
   - Get single world
   - Location: `backend/src/routes/chimera-worlds.ts:466`
   - Query: `.from('chimera_worlds').select('*, ruleset_links:chimera_world_ruleset_link(...)').eq('id', id).single()`
   - Also fetches: tags via `chimera_asset_tags` join

5. **PUT /api/v2/chimera/worlds/:id**
   - Update world
   - Location: `backend/src/routes/chimera-worlds.ts:632`
   - Query: `.from('chimera_worlds').update({...}).eq('id', id)`
   - Handles: ruleset links diffing, tag updates

6. **DELETE /api/v2/chimera/worlds/:id**
   - Delete world
   - Location: `backend/src/routes/chimera-worlds.ts:879`
   - Query: `.from('chimera_worlds').delete().eq('id', id)`

7. **Play Engine - Character Schema**
   - Location: `backend/src/routes/chimera-play.ts:1315, 1337`
   - Query: `.from('chimera_worlds').select('character_schema_contributions').eq('id', story.world_id).single()`
   - Purpose: Get character creation schema from world

**Dependencies**: Referenced by `chimera_stories`, `chimera_world_ruleset_link`, `chimera_entity_templates` (via world_id), `chimera_asset_tags`

---

### `chimera_story_compiled_ruleset`

**Purpose**: Stores compiled story JSON for runtime use. Created by rebuild service.

**Usage**: High - required for starting games. Fetched on every game start and turn.

**Queries**:

1. **POST /api/v2/play/:storyId/start**
   - Fetch compiled ruleset
   - Location: `backend/src/routes/chimera-play.ts:181`
   - Query: `.from('chimera_story_compiled_ruleset').select('compiled_json').eq('story_id', storyId).single()`
   - Error: Returns validation error if not compiled

2. **POST /api/v2/play/:gameStateId/cast-stone**
   - Fetch compiled ruleset for turn
   - Location: `backend/src/routes/chimera-play.ts:591`
   - Query: `.from('chimera_story_compiled_ruleset').select('compiled_json').eq('story_id', gameState.story_id).single()`

3. **POST /api/v2/chimera/stories/:id/rebuild**
   - Save compiled ruleset
   - Location: `backend/src/services/chimera/rebuild-service.ts:376`
   - Query: `.from('chimera_story_compiled_ruleset').upsert({ story_id, compiled_json, source_manifest, last_compiled_at }, { onConflict: 'story_id' }).select().single()`

4. **GET /api/v2/play/:storyId/character/schema**
   - Get character schema
   - Location: `backend/src/routes/chimera-play.ts:1295`
   - Query: `.from('chimera_story_compiled_ruleset').select('compiled_json').eq('story_id', storyId).single()`

**Dependencies**: References `chimera_stories` (via story_id, unique constraint)

---

### `chimera_ruleset_templates`

**Purpose**: Ruleset template definitions (MAIN_SYSTEM, SUBSYSTEM, MODIFIER) used to compile stories.

**Usage**: High - used in story rebuild, world linking, and admin CRUD.

**Queries**:

1. **GET /api/v2/chimera/admin/rulesets**
   - Get all ruleset templates
   - Location: `backend/src/routes/chimera-admin-rulesets.ts:74`
   - Query: `.from('chimera_ruleset_templates').select('*, exclusion_group:chimera_exclusion_groups(...)').order('created_at', { ascending: false })`

2. **POST /api/v2/chimera/admin/rulesets**
   - Create ruleset template
   - Location: `backend/src/routes/chimera-admin-rulesets.ts:309`
   - Query: `.from('chimera_ruleset_templates').insert({...}).select().single()`
   - Validates: main_system_dependency, exclusion_group_id

3. **PUT /api/v2/chimera/admin/rulesets/:id**
   - Update ruleset template
   - Location: `backend/src/routes/chimera-admin-rulesets.ts:514`
   - Query: `.from('chimera_ruleset_templates').update({...}).eq('id', id).select().single()`
   - Increments: version number

4. **Story Rebuild - Fetch Templates**
   - Location: `backend/src/services/chimera/rebuild-service.ts:265`
   - Query: `.from('chimera_ruleset_templates').select('id, rule_type, main_system_dependency, definition, version').in('id', allRulesetIds)`
   - Purpose: Fetch all templates needed for compilation

5. **World/Story Validation**
   - Location: `backend/src/routes/chimera-worlds.ts:81, 591` and `backend/src/routes/chimera-stories.ts:162`
   - Query: `.from('chimera_ruleset_templates').select('id, rule_type').in('id', templateIds)`
   - Validates: Template exists and has correct rule_type

**Dependencies**: Referenced by `chimera_story_links`, `chimera_world_ruleset_link`, `chimera_content_pack_ruleset_links`, `chimera_exclusion_groups`

---

### `chimera_story_links`

**Purpose**: Junction table linking stories to ruleset templates.

**Usage**: High - used in story CRUD and rebuild service.

**Queries**:

1. **POST /api/v2/chimera/stories**
   - Create ruleset links
   - Location: `backend/src/routes/chimera-stories.ts:269`
   - Query: `.from('chimera_story_links').insert(rulesetLinks)`

2. **PUT /api/v2/chimera/stories/:id**
   - Update ruleset links (diffing)
   - Location: `backend/src/routes/chimera-stories.ts:592, 617, 641`
   - Queries:
     - Fetch current: `.from('chimera_story_links').select('ruleset_template_id').eq('story_id', id)`
     - Delete removed: `.from('chimera_story_links').delete().eq('story_id', id).in('ruleset_template_id', toRemove)`
     - Insert added: `.from('chimera_story_links').insert(newLinks)`

3. **Story Rebuild - Fetch Links**
   - Location: `backend/src/services/chimera/rebuild-service.ts:177`
   - Query: `.from('chimera_story_links').select('ruleset_template_id').eq('story_id', storyId)`

**Dependencies**: References `chimera_stories` and `chimera_ruleset_templates`

---

### `chimera_story_entity_links`

**Purpose**: Junction table linking stories to entity templates (player characters, NPCs, etc.).

**Usage**: High - used in story CRUD, play engine, and rebuild service.

**Queries**:

1. **POST /api/v2/chimera/stories**
   - Create entity links
   - Location: `backend/src/routes/chimera-stories.ts:318`
   - Query: `.from('chimera_story_entity_links').insert(entityLinks)`

2. **PUT /api/v2/chimera/stories/:id**
   - Update entity links (diffing)
   - Location: `backend/src/routes/chimera-stories.ts:728, 753, 777`
   - Queries: Similar pattern to ruleset links (fetch, delete removed, insert added)

3. **POST /api/v2/chimera/stories/:id/links/entities**
   - Link entity to story
   - Location: `backend/src/routes/chimera-stories.ts:1185`
   - Query: `.from('chimera_story_entity_links').insert({ story_id, entity_template_id }).select().single()`

4. **DELETE /api/v2/chimera/stories/:id/links/entities/:entity_id**
   - Remove entity link
   - Location: `backend/src/routes/chimera-stories.ts:1272`
   - Query: `.from('chimera_story_entity_links').delete().eq('story_id', story_id).eq('entity_template_id', entity_template_id)`

5. **Play Engine - Player Entity Check**
   - Location: `backend/src/routes/chimera-play.ts:224`
   - Query: `.from('chimera_story_entity_links').select('entity_template_id, entity:chimera_entity_templates!entity_template_id(...)').eq('story_id', storyId)`
   - Purpose: Security gate - verify player character exists before starting game

6. **Play Engine - Link Player Entity**
   - Location: `backend/src/routes/chimera-play.ts:966, 1122, 1461`
   - Query: `.from('chimera_story_entity_links').insert({ story_id, entity_template_id })`

7. **Story Rebuild - Fetch Entity Links**
   - Location: `backend/src/services/chimera/rebuild-service.ts:307`
   - Query: `.from('chimera_story_entity_links').select('entity_template_id').eq('story_id', storyId)`

**Dependencies**: References `chimera_stories` and `chimera_entity_templates`

---

### `chimera_world_ruleset_link`

**Purpose**: Junction table linking worlds to ruleset templates (MODIFIER type only).

**Usage**: Medium - used in world CRUD and story rebuild.

**Queries**:

1. **POST /api/v2/chimera/worlds**
   - Create ruleset links
   - Location: `backend/src/routes/chimera-worlds.ts:151`
   - Query: `.from('chimera_world_ruleset_link').insert(links)`

2. **GET /api/v2/chimera/worlds/:id/rulesets**
   - Get linked rulesets
   - Location: `backend/src/routes/chimera-worlds.ts:404`
   - Query: `.from('chimera_world_ruleset_link').select('ruleset_template_id').eq('world_id', id)`

3. **PUT /api/v2/chimera/worlds/:id**
   - Update ruleset links (diffing)
   - Location: `backend/src/routes/chimera-worlds.ts:654, 675, 701`
   - Queries: Similar diffing pattern (fetch current, delete removed, insert added)

4. **Story Rebuild - Fetch World Rulesets**
   - Location: `backend/src/services/chimera/rebuild-service.ts:191`
   - Query: `.from('chimera_world_ruleset_link').select('ruleset_template_id').eq('world_id', story.world_id)`

**Dependencies**: References `chimera_worlds` and `chimera_ruleset_templates`

---

### `chimera_content_packs`

**Purpose**: Content pack definitions that bundle entities, rulesets, and lore.

**Usage**: Medium - used in pack CRUD and story linking.

**Queries**:

1. **GET /api/v2/chimera/packs/selectable**
   - Get selectable packs
   - Location: `backend/src/routes/chimera-packs.ts:69`
   - Query: `.from('chimera_content_packs').select('id, display_name, version, pack_type, visibility').or('visibility.eq.public,owner_user_id.eq.${userId}').order('display_name', { ascending: true })`

2. **GET /api/v2/chimera/packs/my-creations**
   - Get user's packs
   - Location: `backend/src/routes/chimera-packs.ts:120`
   - Query: `.from('chimera_content_packs').select('*, entity_links:..., ruleset_links:..., lore_links:..., dependencies:...').eq('owner_user_id', userId).order('created_at', { ascending: false })`

3. **POST /api/v2/chimera/packs**
   - Create pack
   - Location: `backend/src/routes/chimera-packs.ts:177`
   - Query: `.from('chimera_content_packs').insert({...})`
   - Creates: entity links, ruleset links, lore links, dependencies

4. **GET /api/v2/chimera/packs/:id**
   - Get single pack
   - Location: `backend/src/routes/chimera-packs.ts:457`
   - Query: `.from('chimera_content_packs').select('*, entity_links:..., ruleset_links:..., lore_links:..., dependencies:...').eq('id', id).single()`

5. **PUT /api/v2/chimera/packs/:id**
   - Update pack
   - Location: `backend/src/routes/chimera-packs.ts:590`
   - Query: `.from('chimera_content_packs').update({...}).eq('id', id)`
   - Handles: entity links diffing, ruleset links diffing, lore links diffing, dependencies diffing
   - Increments: version number

6. **DELETE /api/v2/chimera/packs/:id**
   - Delete pack
   - Location: `backend/src/routes/chimera-packs.ts:808`
   - Query: `.from('chimera_content_packs').delete().eq('id', id)`

**Dependencies**: Referenced by `chimera_story_content_pack_links`, `chimera_content_pack_entity_links`, `chimera_content_pack_ruleset_links`, `chimera_content_pack_lore_links`, `chimera_pack_dependencies`

---

### `chimera_story_content_pack_links`

**Purpose**: Junction table linking stories to content packs.

**Usage**: Medium - used in story CRUD and rebuild service.

**Queries**:

1. **POST /api/v2/chimera/stories**
   - Create pack links
   - Location: `backend/src/routes/chimera-stories.ts:293`
   - Query: `.from('chimera_story_content_pack_links').insert(packLinks)`

2. **PUT /api/v2/chimera/stories/:id**
   - Update pack links (diffing)
   - Location: `backend/src/routes/chimera-stories.ts:660, 685, 709`
   - Queries: Similar diffing pattern

3. **Story Rebuild - Fetch Pack Links**
   - Location: `backend/src/services/chimera/rebuild-service.ts:204`
   - Query: `.from('chimera_story_content_pack_links').select('pack_id').eq('story_id', storyId)`

**Dependencies**: References `chimera_stories` and `chimera_content_packs`

---

### `chimera_content_pack_ruleset_links`

**Purpose**: Junction table linking content packs to ruleset templates.

**Usage**: Medium - used in pack CRUD and story rebuild.

**Queries**:

1. **POST /api/v2/chimera/packs**
   - Create ruleset links
   - Location: `backend/src/routes/chimera-packs.ts:231`
   - Query: `.from('chimera_content_pack_ruleset_links').insert(rulesetLinks)`

2. **PUT /api/v2/chimera/packs/:id**
   - Update ruleset links (diffing)
   - Location: `backend/src/routes/chimera-packs.ts:666`
   - Query: Similar diffing pattern

3. **Story Rebuild - Fetch Pack Rulesets**
   - Location: `backend/src/services/chimera/rebuild-service.ts:245`
   - Query: `.from('chimera_content_pack_ruleset_links').select('ruleset_template_id').in('pack_id', allPackIds)`

**Dependencies**: References `chimera_content_packs` and `chimera_ruleset_templates`

---

### `chimera_pack_dependencies`

**Purpose**: Tracks dependency relationships between content packs.

**Usage**: Medium - used in pack CRUD and rebuild service (dependency resolution).

**Queries**:

1. **POST /api/v2/chimera/packs**
   - Create dependencies
   - Location: `backend/src/routes/chimera-packs.ts:282`
   - Query: `.from('chimera_pack_dependencies').insert(dependencies)`

2. **PUT /api/v2/chimera/packs/:id**
   - Update dependencies (diffing)
   - Location: `backend/src/routes/chimera-packs.ts:700`
   - Query: Similar diffing pattern

3. **Story Rebuild - Resolve Dependencies**
   - Location: `backend/src/services/chimera/rebuild-service.ts:226`
   - Query: `.from('chimera_pack_dependencies').select('depends_on_pack_id').eq('pack_id', currentPackId)`
   - Purpose: Recursively resolve all pack dependencies

**Dependencies**: References `chimera_content_packs` (self-referential)

---

### `chimera_lore_entries`

**Purpose**: Lore entry definitions for the RAG (Retrieval-Augmented Generation) system.

**Usage**: Medium - used in lore CRUD and story rebuild.

**Queries**:

1. **POST /api/v2/chimera/lore**
   - Create lore entry
   - Location: `backend/src/routes/chimera-lore.ts:91`
   - Query: `.from('chimera_lore_entries').insert({ story_id, display_name, entry_text, ... }).select().single()`

2. **GET /api/v2/chimera/lore/my-creations**
   - Get user's lore entries
   - Location: `backend/src/routes/chimera-lore.ts:166`
   - Query: `.from('chimera_lore_entries').select('*, story:chimera_stories!story_id(...)').in('story_id', storyIds).order('created_at', { ascending: false })`

3. **GET /api/v2/chimera/lore**
   - Get lore entries for story
   - Location: `backend/src/routes/chimera-lore.ts:310`
   - Query: `.from('chimera_lore_entries').select('*').eq('story_id', story_id).order('created_at', { ascending: false })`

4. **PUT /api/v2/chimera/lore/:id**
   - Update lore entry
   - Location: `backend/src/routes/chimera-lore.ts:415`
   - Query: `.from('chimera_lore_entries').update({...}).eq('id', id).select().single()`

5. **DELETE /api/v2/chimera/lore/:id**
   - Delete lore entry
   - Location: `backend/src/routes/chimera-lore.ts:507`
   - Query: `.from('chimera_lore_entries').delete().eq('id', id)`

6. **Story Rebuild - Fetch Lore**
   - Location: `backend/src/services/chimera/rebuild-service.ts:333`
   - Query: `.from('chimera_lore_entries').select('id, entry_text, display_name').eq('story_id', storyId)`
   - Purpose: Vectorize lore entries for RAG index

**Dependencies**: References `chimera_stories` (via story_id)

---

### `chimera_tags`

**Purpose**: Tag definitions for categorizing assets (worlds, entities, etc.).

**Usage**: Medium - used in tag CRUD and asset tagging.

**Queries**:

1. **GET /api/v2/chimera/admin/tags**
   - Get all tags
   - Location: `backend/src/routes/chimera-admin-tags.ts:48`
   - Query: `.from('chimera_tags').select('id, tag_name, is_approved, created_at, updated_at').order('tag_name', { ascending: true })`

2. **POST /api/v2/chimera/admin/tags**
   - Create tag
   - Location: `backend/src/routes/chimera-admin-tags.ts:116`
   - Query: `.from('chimera_tags').insert({ tag_name, is_approved }).select().single()`

3. **PUT /api/v2/chimera/admin/tags/:id**
   - Update tag
   - Location: `backend/src/routes/chimera-admin-tags.ts:207`
   - Query: `.from('chimera_tags').update({...}).eq('id', id).select().single()`

4. **DELETE /api/v2/chimera/admin/tags/:id**
   - Delete tag
   - Location: `backend/src/routes/chimera-admin-tags.ts:270`
   - Query: `.from('chimera_tags').delete().eq('id', id)`

5. **GET /api/v2/chimera/lore/tags**
   - Get approved tags
   - Location: `backend/src/routes/chimera-lore.ts:226`
   - Query: `.from('chimera_tags').select('id, tag_name, is_approved').eq('is_approved', true).order('tag_name', { ascending: true })`

6. **Entity/World CRUD - Tag Lookup**
   - Location: `backend/src/routes/chimera-entities.ts:274, 286` and `backend/src/routes/chimera-worlds.ts:177, 189, 735, 747`
   - Query: `.from('chimera_tags').select('id').eq('tag_name', normalized).single()`
   - Purpose: Check if tag exists, create if not

**Dependencies**: Referenced by `chimera_asset_tags`

---

### `chimera_asset_tags`

**Purpose**: Junction table linking assets (worlds, entities, etc.) to tags.

**Usage**: Medium - used in asset CRUD operations.

**Queries**:

1. **Entity/World CRUD - Create Tag Links**
   - Location: `backend/src/routes/chimera-entities.ts:313` and `backend/src/routes/chimera-worlds.ts:216, 774`
   - Query: `.from('chimera_asset_tags').insert(assetTagLinks)`

2. **Entity/World CRUD - Delete Tag Links**
   - Location: `backend/src/routes/chimera-admin-entities.ts:302` and `backend/src/routes/chimera-worlds.ts:720`
   - Query: `.from('chimera_asset_tags').delete().eq('asset_id', id).eq('asset_type', 'world|entity')`

3. **GET /api/v2/chimera/worlds/:id**
   - Fetch tags for world
   - Location: `backend/src/routes/chimera-worlds.ts:476, 797`
   - Query: `.from('chimera_asset_tags').select('tag:chimera_tags!tag_id(id, tag_name)').eq('asset_id', id).eq('asset_type', 'world')`

**Dependencies**: References `chimera_tags` and various asset tables (via asset_id + asset_type)

---

### `chimera_exclusion_groups`

**Purpose**: Exclusion groups for ruleset templates (prevents conflicting rulesets from being used together).

**Usage**: Low - used only in ruleset admin CRUD.

**Queries**:

1. **GET /api/v2/chimera/admin/rulesets/exclusion-groups**
   - Get all exclusion groups
   - Location: `backend/src/routes/chimera-admin-rulesets.ts:115`
   - Query: `.from('chimera_exclusion_groups').select('*').order('group_name', { ascending: true })`

2. **POST /api/v2/chimera/admin/rulesets**
   - Create exclusion group (if new)
   - Location: `backend/src/routes/chimera-admin-rulesets.ts:286`
   - Query: `.from('chimera_exclusion_groups').insert({ group_name: normalizedName }).select('id').single()`

3. **PUT /api/v2/chimera/admin/rulesets/:id**
   - Create/validate exclusion group
   - Location: `backend/src/routes/chimera-admin-rulesets.ts:447`
   - Query: Similar to POST

**Dependencies**: Referenced by `chimera_ruleset_templates` (via exclusion_group_id)

---

### `games`

**Purpose**: Legacy game sessions (pre-Chimera V2). Still used for V3 spawn system.

**Usage**: High - used extensively in games service for spawn, turns, and state management.

**Queries**:

1. **POST /api/games (spawn)**
   - Create game
   - Location: `backend/src/services/games.service.ts:268`
   - Query: `.from('games').insert({...}).select('*').single()`

2. **GET /api/games/:id**
   - Get game by ID
   - Location: `backend/src/services/games.service.ts:1089`
   - Query: `.from('games').select('*, characters:characters!games_character_id_fkey(...)').eq('id', gameId).single()`

3. **GET /api/games**
   - Get games list
   - Location: `backend/src/services/games.service.ts:1187`
   - Query: `.from('games').select('id, turn_count, status, last_played_at, world_slug, state_snapshot, characters:characters!games_character_id_fkey(name)').order('last_played_at', { ascending: false }).range(offset, offset + limit - 1)`

4. **POST /api/games/:id/turn**
   - Update game state
   - Location: `backend/src/services/games.service.ts:1429`
   - Query: `.from('games').update({ state_snapshot, turn_count, updated_at }).eq('id', gameId)`

5. **POST /api/games/start (spawnV3)**
   - Atomic game creation via stored procedure
   - Location: `backend/src/services/games.service.ts:700`
   - Query: `.rpc('spawn_game_v3_atomic', {...})`
   - Purpose: Atomic transaction for game + first turn creation

**Dependencies**: References `entry_points`, `characters`, `turns`, `world_id_mapping`

---

### `characters`

**Purpose**: Legacy character data. Supports both user_id and cookie_id for guest users.

**Usage**: High - used in characters service and games service.

**Queries**:

1. **POST /api/characters**
   - Create character
   - Location: `backend/src/services/characters.service.ts:144`
   - Query: `.from('characters').insert([characterData]).select().single()`
   - Resolves: world_id from world_slug via `world_id_mapping`

2. **GET /api/characters**
   - Get characters
   - Location: `backend/src/services/characters.service.ts:277`
   - Query: `.from('characters').select('*').eq('user_id|cookie_id', ownerId).order('created_at', { ascending: false })`
   - Filters: Supports world_slug or world_id (UUID)

3. **GET /api/characters/:id**
   - Get character by ID
   - Location: `backend/src/services/characters.service.ts:349`
   - Query: `.from('characters').select('*').eq('id', characterId).eq('user_id|cookie_id', ownerId).single()`

4. **PUT /api/characters/:id**
   - Update character
   - Location: `backend/src/services/characters.service.ts:431`
   - Query: `.from('characters').update(updateData).eq('id', characterId).eq('user_id|cookie_id', ownerId).select().single()`

5. **DELETE /api/characters/:id**
   - Delete character
   - Location: `backend/src/services/characters.service.ts:470`
   - Query: `.from('characters').delete().eq('id', characterId).eq('user_id|cookie_id', ownerId)`

6. **Games Service - Update Active Game**
   - Location: `backend/src/services/games.service.ts:285, 844`
   - Query: `.from('characters').update({ active_game_id, updated_at }).eq('id', characterId)`

**Dependencies**: References `world_id_mapping` (via world_id), `games` (via active_game_id)

---

### `turns`

**Purpose**: Turn history for game sessions.

**Usage**: High - used in turns service and games service.

**Queries**:

1. **POST /api/games/:id/turn**
   - Create turn record
   - Location: `backend/src/services/games.service.ts:1373`
   - Query: `.from('turns').insert(turnRecord).select('*').single()`
   - Stores: AI response in `content` (jsonb), metadata in `meta` (jsonb)

2. **GET /api/games/:id/turns**
   - Get game turns
   - Location: `backend/src/services/games.service.ts:1469`
   - Query: `.from('turns').select('*').eq('game_id', gameId).order('turn_number', { ascending: true }).limit(limit + 1)`
   - Supports: Cursor-based pagination

3. **GET /api/games/:id/session**
   - Get session turns
   - Location: `backend/src/services/games.service.ts:1536`
   - Query: `.from('turns').select('id, game_id, turn_number, role, content, meta, created_at').eq('game_id', gameId).order('turn_number', { ascending: true })`

4. **Games Service - Fetch Created Turn**
   - Location: `backend/src/services/games.service.ts:821`
   - Query: `.from('turns').select('turn_number, role, content, meta, created_at').eq('game_id', createdGameId).eq('turn_number', createdTurnNumber).single()`

**Dependencies**: References `games` (via game_id)

---

### `entry_points`

**Purpose**: Entry point definitions (adventures, scenarios, sandboxes, quests).

**Usage**: High - used in games service for spawn and assembler.

**Queries**:

1. **POST /api/games/start (spawnV3)**
   - Validate entry point
   - Location: `backend/src/services/games.service.ts:380`
   - Query: `.from('entry_points').select('id, slug, type, world_id').eq('id', entry_point_id).eq('lifecycle', 'active').single()`

2. **Games Service - Get Entry Point Type**
   - Location: `backend/src/services/games.service.ts:108`
   - Query: `.from('entry_points').select('type').eq('id', adventure.id).single()`

**Dependencies**: Referenced by `games`, `entry_point_rulesets`

---

### `entry_point_rulesets`

**Purpose**: Junction table linking entry points to rulesets.

**Usage**: Medium - used in games service and assembler.

**Queries**:

1. **POST /api/games (spawn)**
   - Get primary ruleset
   - Location: `backend/src/services/games.service.ts:123`
   - Query: `.from('entry_point_rulesets').select('ruleset_id').eq('entry_point_id', adventure.id).order('sort_order', { ascending: true }).limit(1)`

2. **POST /api/games/start (spawnV3)**
   - Get primary ruleset
   - Location: `backend/src/services/games.service.ts:452`
   - Query: `.from('entry_point_rulesets').select('rulesets:ruleset_id (id, slug)').eq('entry_point_id', entry_point_id).order('sort_order', { ascending: true }).limit(1)`

**Dependencies**: References `entry_points` and `rulesets`

---

### `world_id_mapping`

**Purpose**: Maps world slugs (text) to UUIDs (source of truth for world identity).

**Usage**: High - used extensively for world identity resolution.

**Queries**:

1. **Characters Service - Resolve World ID**
   - Location: `backend/src/services/characters.service.ts:107, 199`
   - Query: `.from('world_id_mapping').select('uuid_id').eq('text_id', worldSlug).single()`

2. **Games Service - Resolve World Slug**
   - Location: `backend/src/services/games.service.ts:201, 553`
   - Query: `.from('world_id_mapping').select('text_id').eq('uuid_id', worldId).single()`

**Dependencies**: Referenced by `characters`, `games` (via world_id)

---

### `user_profiles`

**Purpose**: User profile data including creator fields, avatar approval, roles.

**Usage**: High - used in profile service, auth, and admin operations.

**Queries**:

1. **GET /api/me**
   - Get user profile
   - Location: `backend/src/routes/me.ts:37`
   - Query: `.from('profiles').select('*').eq('id', userId).single()`

2. **PUT /api/v2/chimera/profile**
   - Update creator profile
   - Location: `backend/src/routes/chimera-profile.ts:53, 94`
   - Queries:
     - Check slug: `.from('user_profiles').select('auth_user_id').eq('creator_slug', slug).neq('auth_user_id', userId).single()`
     - Update: `.from('user_profiles').update({...}).eq('auth_user_id', userId).select().single()`

3. **Profile Service - Get Profile**
   - Location: `backend/src/services/profile.service.ts:147`
   - Query: `.from('user_profiles').select('*').eq('auth_user_id', userId).single()`

4. **Games Service - Check Admin Role**
   - Location: `backend/src/services/games.service.ts:1009`
   - Query: `.from('user_profiles').select('role').eq('auth_user_id', ownerId).single()`

**Dependencies**: Referenced by various services for user metadata

---

### `cookie_groups`

**Purpose**: Guest user cookie groups for linking multiple devices/cookies.

**Usage**: Medium - used in profile service and games service.

**Queries**:

1. **Profile Service - Get Cookie Group**
   - Location: `backend/src/services/profile.service.ts:285`
   - Query: `.from('cookie_groups').select('*').eq('id', cookieId).single()`

2. **Games Service - Ensure Cookie Group**
   - Location: `backend/src/services/games.service.ts:1623`
   - Queries:
     - Check: `.from('cookie_groups').select('id').eq('id', cookieId).single()`
     - Create: `.from('cookie_groups').insert({ id: cookieId, user_id: null, ... }).select().single()`

**Dependencies**: Referenced by `cookie_group_members`, `characters`, `games`

---

### `cookie_group_members`

**Purpose**: Cookie group membership tracking.

**Usage**: Low - used in profile service.

**Queries**:

1. **Profile Service - Create Member**
   - Location: `backend/src/services/games.service.ts:1662`
   - Query: `.from('cookie_group_members').insert({ cookie_id, group_id, device_label, ... })`

**Dependencies**: References `cookie_groups`

---

### `idempotency_keys`

**Purpose**: Idempotency tracking for game spawn and turn operations.

**Usage**: Medium - used in games service and idempotency service.

**Queries**:

1. **POST /api/games/start (spawnV3)**
   - Check idempotency
   - Location: `backend/src/services/games.service.ts:356`
   - Query: `.from('idempotency_keys').select('response_data').eq('key', idempotency_key).eq('operation', 'game_spawn').is('game_id', null).eq('status', 'completed').single()`

2. **POST /api/games/start (spawnV3)**
   - Store idempotency record
   - Location: `backend/src/services/games.service.ts:923`
   - Query: `.from('idempotency_keys').insert({ key, owner_id, game_id, operation, request_hash, response_data, status, completed_at })`

**Dependencies**: References `games` (via game_id, nullable)

---

### `prompt_snapshots`

**Purpose**: Frozen prompt snapshots for versioning and debugging.

**Usage**: Medium - used in prompt snapshot service and games service.

**Queries**:

1. **Prompt Snapshot Service - Get Latest**
   - Location: `backend/src/services/promptSnapshotService.ts` (referenced)
   - Query: `.from('prompt_snapshots').select('*').eq('entity_type', type).eq('entity_id', entityId).order('version', { ascending: false }).limit(1).single()`

2. **Games Service - Lookup Snapshot**
   - Location: `backend/src/services/games.service.ts:229, 595`
   - Query: Similar to above, used to link snapshots to games

**Dependencies**: Referenced by `games` (via prompt_snapshot_id)

---

### `awf_saves`, `awf_save_blobs`, `awf_save_diffs`

**Purpose**: Save game system with snapshots, diffs, and integrity verification.

**Usage**: Low - used in save service (Phase 23 feature).

**Queries**:

1. **Save Service - Create/Attach Save**
   - Location: `backend/src/saves/save-service.ts:156, 172`
   - Queries:
     - Check existing: `.from('awf_saves').select('save_id').eq('session_id', sessionId).eq('user_id_hash', userHash).single()`
     - Create: `.from('awf_saves').insert({ session_id, user_id_hash, version, turn_id: 0, integrity_ok: true }).select('save_id').single()`

2. **Save Service - Persist Turn**
   - Location: `backend/src/saves/save-service.ts:238, 258, 276, 294`
   - Queries:
     - Get save: `.from('awf_saves').select('*').eq('save_id', saveId).single()`
     - Store blob: `.from('awf_save_blobs').upsert({ blob_hash, blob_type: 'diff', bytes, size, enc: 'none' })`
     - Store diff: `.from('awf_save_diffs').upsert({ save_id, from_turn, to_turn, diff_hash, chain_hash })`
     - Update save: `.from('awf_saves').update({ turn_id, latest_chain_hash, updated_at }).eq('save_id', saveId)`

3. **Save Service - Materialize**
   - Location: `backend/src/saves/save-service.ts:362, 560, 582, 590`
   - Queries:
     - Get save: `.from('awf_saves').select('*').eq('save_id', saveId).single()`
     - Get snapshot: `.from('awf_save_blobs').select('bytes').eq('blob_hash', base_snapshot_hash).single()`
     - Get diffs: `.from('awf_save_diffs').select('diff_hash').eq('save_id', saveId).lte('to_turn', targetTurn).order('to_turn')`
     - Get diff blobs: `.from('awf_save_blobs').select('bytes').eq('blob_hash', diff.diff_hash).single()`

**Dependencies**: `awf_saves` references `awf_save_blobs` (via base_snapshot_hash, latest_chain_hash), `awf_save_diffs` references `awf_saves` and `awf_save_blobs`

---

### `awf_cloud_sync_config`

**Purpose**: Cloud sync configuration for save system.

**Usage**: Low - used in save service.

**Queries**:

1. **Save Service - Get Config**
   - Location: `backend/src/saves/save-service.ts:120`
   - Query: `.from('awf_cloud_sync_config').select('*').eq('id', 'default').single()`

**Dependencies**: Referenced by save service

---

### `awf_sync_audit`

**Purpose**: Audit log for sync operations.

**Usage**: Low - used in save service.

**Queries**:

1. **Save Service - Log Audit**
   - Location: `backend/src/saves/save-service.ts:728`
   - Query: `.from('awf_sync_audit').insert({ save_id, device_id, operation, details })`

**Dependencies**: References `awf_saves` (via save_id, nullable)

---

### `feature_flags`, `config_meta`

**Purpose**: Feature flags and configuration metadata.

**Usage**: Low - used in config service.

**Queries**:

1. **Config Service - Get Config**
   - Location: `backend/src/services/config.service.ts:332, 333, 398`
   - Queries:
     - Get flags: `.from('feature_flags').select('*')`
     - Get version: `.from('config_meta').select('version').single()`
     - Update version: `.from('config_meta').update({ version }).eq('id', 'default')`

**Dependencies**: Referenced by config service

---

## Query Patterns

### Common Patterns

1. **Ownership Checks**: Most queries filter by `owner_user_id` or check `visibility` for access control
2. **Diffing Pattern**: Update operations for links (rulesets, entities, packs) use fetch → diff → delete removed → insert added
3. **Join Queries**: Many queries use Supabase's join syntax: `.select('*, related:table_name(...)')`
4. **Single Record Queries**: Use `.single()` and handle `PGRST116` error code (not found)
5. **Idempotency**: Game spawn operations check `idempotency_keys` before creating new records

### Access Control Patterns

- **Owner-only**: Filter by `owner_user_id === userId`
- **Public or Owner**: Use `.or('visibility.eq.public,owner_user_id.eq.${userId}')`
- **Admin-only**: Use `supabaseAdmin` client and require `publisher` role
- **Guest Support**: Check both `user_id` and `cookie_group_id` for ownership

### Error Handling

- `PGRST116`: No rows found (expected for single queries when not found)
- `23505`: Unique constraint violation
- Always check `error.code` before checking `data`

---

## Notes

- **Chimera V2** tables use text-based IDs (not UUIDs) for most primary keys
- **Legacy tables** (`games`, `characters`, etc.) use UUIDs
- **World identity** is normalized: `world_id_mapping` maps slugs (text) to UUIDs
- **RLS (Row Level Security)** is enforced on most tables; admin operations use `supabaseAdmin` to bypass
- **Cascade deletes** are used for junction tables (links are deleted when parent is deleted)
- **Versioning** is used for `chimera_ruleset_templates` and `chimera_content_packs` (version increments on update)


