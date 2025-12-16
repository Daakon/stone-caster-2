# 08 Data Model  
*(StoneCaster / Chimera Engine – MVP)*

This file specifies the **physical data model** for the MVP: table layout, JSONB envelopes, promoted columns, indexes, RLS, and migration rules. It implements the hybrid pattern used throughout your architecture: **canonical JSONB for flexibility + select SQL columns for filters/joins/perf**, with pgvector for lore retrieval. :contentReference[oaicite:0]{index=0} :contentReference[oaicite:1]{index=1}

---

## 1. Storage Principles

1) **Hybrid-first**  
- Canonical payloads live in JSONB.  
- Frequently filtered/joined fields are **promoted** to typed columns.  
- Vector search for lore uses `pgvector`. :contentReference[oaicite:2]{index=2}

2) **Deterministic runtime**  
- Runtime state is stored as **tiered JSONB** snapshots with deltas per turn. :contentReference[oaicite:3]{index=3}

3) **Contracts as code**  
- Shapes mirror `04_Domain_Model_and_JSON_Specs` and `chimera-full-schemas.json`. Contract tests fail on drift. :contentReference[oaicite:4]{index=4}

---

## 2. Logical Entities → Physical Tables

| Logical Entity | Table | Canonical (JSONB) | Promoted Columns (typed) | Notes |
|---|---|---|---|---|
| WorldDefinition | `chimera_worlds` | `world_json` | `id uuid PK`, `author_id uuid`, `title text`, `created_at timestamptz` | Author-owned world with ruleset keys |
| RulesetTemplate | `chimera_ruleset_templates` | `ruleset_json` | `id uuid PK`, `key text`, `ui_category text`, `exclusion_group text NULL`, `version text` | Read-only catalog surfaced to UI; populated from admin seeds :contentReference[oaicite:5]{index=5} |
| EntityTemplate | `chimera_entities` | `entity_json` | `id uuid PK`, `world_id uuid FK`, `name text`, `is_player boolean` | Player or NPC seed for compile |
| LoreFragment | `chimera_lore` | `lore_json` | `id uuid PK`, `world_id uuid FK`, `title text`, `visibility text` | Indexed for embeddings |
| Lore Embedding | `lore_embeddings` | — | `id uuid PK`, `lore_id uuid FK`, `story_id uuid`, `embedding vector(1536)` | IVFFlat index for cosine search |
| CompiledStory | `compiled_stories` | `compiled_json` | `story_id uuid PK`, `world_id uuid FK`, `version text`, `compiled_at timestamptz` | Artifact fed to runtime |
| GameState (per turn) | `chimera_game_states` | `state_json` | `session_id uuid`, `story_id uuid`, `turn_index int`, `updated_at timestamptz` | Append-only or latest-by-key view |
| Session | `chimera_sessions` | `session_json` | `session_id uuid PK`, `story_id uuid`, `player_entity_id uuid`, `created_at timestamptz` | Bootstrap and ownership |

The above reflects the hybrid plan and runtime loop commitments. :contentReference[oaicite:6]{index=6} :contentReference[oaicite:7]{index=7}

---

## 3. DDL (baseline)

> PostgreSQL + pgvector. Names use `snake_case`, timestamps are `timestamptz`.

```sql
-- Worlds
create table if not exists chimera_worlds (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null,
  title text not null,
  world_json jsonb not null,
  created_at timestamptz not null default now()
);

create index on chimera_worlds (author_id);
create index on chimera_worlds using gin ((world_json jsonb_path_ops));

-- Rulesets (catalog)
create table if not exists chimera_ruleset_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  ui_category text not null check (ui_category in ('foundation','expansion','flavor')),
  exclusion_group text null,
  version text not null default '1.0.0',
  ruleset_json jsonb not null
);

create index on chimera_ruleset_templates (key);
create index on chimera_ruleset_templates (ui_category);
create index on chimera_ruleset_templates (exclusion_group);
create index on chimera_ruleset_templates using gin ((ruleset_json jsonb_path_ops));

-- Entities
create table if not exists chimera_entities (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references chimera_worlds(id) on delete cascade,
  name text not null,
  is_player boolean not null default false,
  entity_json jsonb not null
);

create index on chimera_entities (world_id);
create index on chimera_entities (is_player);
create index on chimera_entities using gin ((entity_json jsonb_path_ops));

-- Lore
create table if not exists chimera_lore (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references chimera_worlds(id) on delete cascade,
  title text not null,
  visibility text not null check (visibility in ('public','private')),
  lore_json jsonb not null
);

create index on chimera_lore (world_id);
create index on chimera_lore (visibility);
create index on chimera_lore using gin ((lore_json jsonb_path_ops));

-- pgvector
create extension if not exists vector;

create table if not exists lore_embeddings (
  id uuid primary key default gen_random_uuid(),
  lore_id uuid not null references chimera_lore(id) on delete cascade,
  story_id uuid null,
  embedding vector(1536) not null
);

-- Use IVFFlat for scale; build after populating some rows
create index if not exists idx_lore_embed_ivf on lore_embeddings
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Compiled stories
create table if not exists compiled_stories (
  story_id uuid primary key,
  world_id uuid not null references chimera_worlds(id) on delete cascade,
  version text not null,
  compiled_at timestamptz not null default now(),
  compiled_json jsonb not null
);

create index on compiled_stories (world_id);
create index on compiled_stories (compiled_at desc);

-- Sessions
create table if not exists chimera_sessions (
  session_id uuid primary key default gen_random_uuid(),
  story_id uuid not null references compiled_stories(story_id) on delete cascade,
  player_entity_id uuid not null,
  created_at timestamptz not null default now(),
  session_json jsonb not null default '{}'::jsonb
);

create index on chimera_sessions (story_id);

-- Game state (per turn)
create table if not exists chimera_game_states (
  session_id uuid not null references chimera_sessions(session_id) on delete cascade,
  story_id uuid not null,
  turn_index int not null,
  updated_at timestamptz not null default now(),
  state_json jsonb not null,
  primary key (session_id, turn_index)
);

create index on chimera_game_states (story_id);
create index on chimera_game_states using gin ((state_json jsonb_path_ops));
