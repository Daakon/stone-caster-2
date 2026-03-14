# 02 Data Schema and Definitions
*(StoneCaster / Chimera Engine – MVP)*

This document serves as the **canonical reference** for the system's terminology, logical domain model, and physical database structure. It merges the Glossary, JSON Specifications, and Database Schema into a single source of truth.

---

# PART 1: GLOSSARY AND DEFINITIONS

## 1. Core System Terms

**StoneCaster**
The overall platform enabling authors to build worlds, compile stories, and deliver AI-driven narrative gameplay.

**Chimera Engine**
The runtime logic and prompt-governance system that interprets player actions, resolves outcomes deterministically, and generates narrative.

**Chimera Engine Workflow**
The structured pipeline governing how prompts, state, and logic interact: **Director → Engine → Narrator**

**Compiler**
Transforms author-created content + selected rulesets into a **Compiled Story**, including schema definitions, initial state, instruction bundles, and lore index metadata.

**Compiled Story**
A frozen, immutable set of instructions and starting values that defines how a playable story behaves.

**Player Session**
A runtime instance of a compiled story with a session_id, active turn index, evolving state, and message history.

**Game State**
A full snapshot of Tier0, Tier1, and Tier2 data at a specific turn.

**Forces (UI Term)**
The collection of **Rulesets** (physics/mechanics) governing the story. Formerly "Laws".

**Elements (UI Term)**
The collection of **Entities** (Characters, Items, Locations) in the story. Formerly "Cast".

**World Preset**
A pre-configured "Genre Card" (e.g., High Fantasy) selected in Step 1. Applies default Forces and Safety Filters.

**Library vs. Forge**
*Library*: Clone existing assets. *Forge*: Create new assets.

## 2. Tiers of the Domain Model

**Tier 0 (T0) — World**
Global parameters: time band, environmental fields, selected rulesets, safety filters.

**Tier 1 (T1) — Entities**
All actors in the story (player + NPCs), including identity, stats, personality, preferences, emotional state, and relationships.

**Tier 2 (T2) — Systems**
Global and systemic mechanics: stamina, hunger, combat states, magic system values, agendas, survival flags.

## 3. Director-Narrator Model Terms

**Director (Strategic Lead)**
Role: Interpret player text, extract intent, determine skill route, assign duration tag, and detect gating failures. Defines social reality and queues tactical actions.
*Output: Unified Intent DTO with intent_queue, unseen_ripples, and proximity_cluster.*

**Narrator (Cinematic Lead)**
Role: Narrate outcome, apply style injections, reflect state readouts, embody NPC moods, and integrate lore. Synthesizes Director's intent with Engine's results.
*Output: Structured JSON with narration and hints.*

**Instructions Bundle**
Compiler-generated set of constraints and style rules applied to Director and Narrator.

## 4. Ruleset Terms

**Ruleset**
A JSON definition that modifies state structure, defines engine behaviors, and adds MAS instructions.

**Exclusion Group**
Ruleset category where only one option may be selected (e.g., only one skill system).

**State Contribution**
A JSON merge defining new or modified fields in T0/T1/T2.

## 5. Engine Terms

**Resolution Summary**
The Engine's distilled description of action outcome (success, fail, strain). Used as Narrator context.

**State Delta**
Minimal changes applied to the previous state to form the new state.

**Duration Tag**
Used by Director and Engine to advance time: *moment, scene, journey, rest*.

**Hard Gate**
A rule preventing an action (e.g., collapsed stamina blocks travel).

## 6. Survival & Combat Terms

**Stamina**
Short-term energy resource affecting physical action.

**Physical Condition**
Derived from stamina: *Rested, Winded, Exhausted, Collapsed*.

**Hunger State**
Long-term pressure: *Sated, Hungry, Starving*.

**Relationship Spotlight**
A memory or shared history that colors NPC reactions in the current turn.

---

# PART 2: DOMAIN MODEL AND JSON SPECIFICATIONS

StoneCaster uses a **deterministic tiered world model**. This structure is **compiled**, not free-form. Director/Narrator *must obey* the resulting schema.

## 1. WorldDefinition JSON (Authoring)

    {
      "world_id": "uuid",
      "title": "string",
      "summary": "string",
      "genre_tags": ["string"],
      "safety_filters": ["pg", "pg13", "rlite"],
      "ruleset_keys": [
        "d100-5-pillars",
        "vitality-stamina-system",
        "world-cycle-time-bands"
      ],
      "world_metadata": {
        "starting_time_band": "Dusk",
        "environment": {
          "biome": "urban",
          "culture_notes": "Low-magic guild intrigue"
        }
      }
    }

## 2. EntityTemplate JSON (Authoring)

Entities may be players or NPCs; NPC fields allow deeper personality, relationship, and emotional modeling.

    {
      "entity_id": "uuid",
      "name": "Kiera",
      "tags": ["player"],
      "stats": {
        "root_force": 40,
        "root_finesse": 60,
        "root_awareness": 55,
        "root_insight": 45,
        "root_influence": 50
      },
      "defaults": {
        "current_stamina": 90,
        "satiety": 70,
        "wealth_tier": 1
      },
      "personality": {
        "core_traits": ["Brave", "Stoic"],
        "core_values": ["Honor"],
        "quirks": ["Taps fingers when thinking"],
        "current_objective": "Recover the missing ledger"
      },
      "social": {
        "relationships": {
          "npc_arven": {
            "affinity": 35,
            "memory_spotlight": "Old Debt",
            "tags": ["trusted_contact"]
          }
        }
      },
      "emotional": {
        "valence": "neutral",
        "mood": "focused"
      }
    }

## 3. RulesetDefinition (Catalog)

Each ruleset contributes state fields, engine functions, and AI instructions.

    {
      "id": "uuid",
      "key": "d100-5-pillars",
      "ui_category": "foundation",
      "exclusion_group": "skill_system_root",
      "version": "1.0.0",
      "state_contributions": {
        "tier2_system.current_stamina": { "default": 100 },
        "tier2_system.physical_condition": "Rested"
      },
      "actions": {
        "resolve_skill_check": {
          "type": "engine_function",
          "parameters": ["skill_id", "difficulty"]
        }
      },
      "ai_instructions": {
        "director": {
          "intent_keywords": ["attack", "climb", "sneak"],
          "skill_routing": { "fallback_root": "root_force" }
        },
        "narrator": {
          "state_readouts": [
            { "path": "tier2_system.physical_condition", "label": "PHYSICAL CONDITION" }
          ]
        }
      }
    }

## 4. CompiledStory JSON (Runtime Artifact)

The compiler produces this deterministic artifact.

    {
      "story_id": "uuid",
      "world_id": "uuid",
      "version": "1.0.0",
      "selected_rulesets": ["d100-5-pillars", "vitality-stamina-system"],
      "schema": {
        "tier0_world": {},
        "tier1_entity": {},
        "tier2_system": {}
      },
      "initial_state": {
        "tier0_world": {
          "current_time_band": "Deep Night",
          "current_tick": 0
        },
        "tier1_entities": {
          "player_id": {
            "name": "Kiera",
            "stats": {"root_force": 40},
            "emotional": {"valence": "neutral"}
          }
        },
        "tier2_system": {
          "current_stamina": 90,
          "physical_condition": "Winded",
          "hunger_state": "Hungry"
        }
      },
      "instructions": {
        "director": {"...": "..."},
        "narrator": {"...": "..."}
      },
      "lore_index": {
        "retrieval": {"k": 3, "min_score": 0.65}
      }
    }

## 5. RuntimeState JSON (Per Turn)

    {
      "session_id": "uuid",
      "turn_index": 4,
      "tier0_world": {
        "current_tick": 4,
        "current_time_band": "Deep Night"
      },
      "tier1_entities": {
        "player_id": {
          "stats": {"root_force": 40},
          "emotional": {"valence": "neutral", "mood": "focused"},
          "social": {
            "relationships": {
              "npc_arven": {
                "affinity": 33,
                "memory_spotlight": "Old Debt"
              }
            }
          }
        }
      },
      "tier2_system": {
        "current_stamina": 88,
        "physical_condition": "Winded",
        "hunger_state": "Hungry"
      }
    }

## 6. Director Unified Intent DTO

    {
      "turn_meta": {
        "resolution_mode": "engine | narrative",
        "atmosphere_shift": "string",
        "time_jump_minutes": 0
      },
      "unseen_ripples": [
        {
          "target_id": "uuid",
          "type": "relationship | emotional | status",
          "delta_tier": "Minor | Moderate | Major | Severe",
          "property_path": "string",
          "reason": "string"
        }
      ],
      "intent_queue": [
        {
          "actor_id": "uuid",
          "trigger_id": "string",
          "intended_targets": ["uuid"],
          "proximity_cluster": ["uuid"],
          "parameters": {
            "verb": "string",
            "impact_tier": "Low | Moderate | High | Severe",
            "tactic_tag": "string",
            "skill_id": "string"
          }
        }
      ]
    }

## 7. Narrator Output DTO

    {
      "narration": "The lock gives a reluctant click...",
      "hints": ["Your stomach tightens with hunger."]
    }

---

# PART 3: PHYSICAL DATA MODEL

## 1. Storage Principles

1.  **Hybrid-first**: Canonical payloads live in JSONB. Frequently filtered/joined fields are **promoted** to typed columns.
2.  **Deterministic runtime**: Runtime state is stored as **tiered JSONB** snapshots.
3.  **Contracts as code**: Shapes mirror the Domain Model schemas.

## 2. Logical Entities → Physical Tables

| Logical Entity | Table | Canonical (JSONB) | Promoted Columns (typed) |
|---|---|---|---|
| WorldDefinition | `chimera_worlds` | `world_json` | `id`, `author_id`, `title`, `created_at` |
| RulesetTemplate | `chimera_ruleset_templates` | `ruleset_json` | `id`, `key`, `ui_category`, `exclusion_group`, `version` |
| EntityTemplate | `chimera_entities` | `entity_json` | `id`, `world_id`, `name`, `is_player` |
| LoreFragment | `chimera_lore` | `lore_json` | `id`, `world_id`, `title`, `visibility` |
| Lore Embedding | `lore_embeddings` | — | `id`, `lore_id`, `story_id`, `embedding vector(1536)` |
| CompiledStory | `compiled_stories` | `compiled_json` | `story_id`, `world_id`, `version`, `compiled_at` |
| GameState | `chimera_game_states` | (Sharded: `mechanical`, `narrative`, `registry`) | `id`, `player_id`, `story_id`, `updated_at` |
| TurnHistory | `chimera_turns` | — | `id`, `game_state_id`, `turn_index`, `player_input` |
| AuditLog | `ai_audit_logs` | — | `id`, `turn_id`, `model_used`, `cost_stones` |
| Session | `chimera_sessions` | `session_json` | `session_id`, `story_id`, `player_entity_id`, `created_at` |

## 3. DDL (PostgreSQL + pgvector)

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
    create index on chimera_ruleset_templates (exclusion_group);

    -- Entities
    create table if not exists chimera_entities (
      id uuid primary key default gen_random_uuid(),
      world_id uuid not null references chimera_worlds(id) on delete cascade,
      name text not null,
      is_player boolean not null default false,
      entity_json jsonb not null
    );
    create index on chimera_entities (world_id);

    -- Lore
    create table if not exists chimera_lore (
      id uuid primary key default gen_random_uuid(),
      world_id uuid not null references chimera_worlds(id) on delete cascade,
      title text not null,
      visibility text not null check (visibility in ('public','private')),
      lore_json jsonb not null
    );

    -- pgvector
    create extension if not exists vector;

    create table if not exists lore_embeddings (
      id uuid primary key default gen_random_uuid(),
      lore_id uuid not null references chimera_lore(id) on delete cascade,
      story_id uuid null,
      embedding vector(1536) not null
    );
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

    -- Sessions
    create table if not exists chimera_sessions (
      session_id uuid primary key default gen_random_uuid(),
      story_id uuid not null references compiled_stories(story_id) on delete cascade,
      player_entity_id uuid not null,
      created_at timestamptz not null default now(),
      session_json jsonb not null default '{}'::jsonb
    );

    -- Game state (Active "Save File")
    create table if not exists chimera_game_states (
      id uuid primary key default gen_random_uuid(),
      story_id uuid not null,
      player_id uuid not null,
      mechanical_state jsonb not null default '{}',
      narrative_focus jsonb not null default '{}',
      scene_registry jsonb not null default '{}',
      action_queue jsonb not null default '[]',
      compiled_system_prompt text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    -- Index frequently accessed JSON paths if needed
    create index on chimera_game_states using gin (mechanical_state);

    -- Game History (The "Log" - Source of Truth)
    create table if not exists chimera_turns (
      id uuid primary key default gen_random_uuid(),
      game_state_id uuid not null references chimera_game_states(id) on delete cascade,
      turn_index int not null,
      player_input text not null,        -- The user's raw text
      director_intent jsonb,             -- Unified Intent DTO from Director (Intent Queue, Unseen Ripples)
      mechanical_delta jsonb,            -- Deterministic changes from Engine (Stats, Tags)
      narrator_output jsonb,              -- Final prose and hints from Narrator
      created_at timestamptz not null default now()
    );
    create index on chimera_turns (game_state_id, turn_index);

    -- Telemetry & Billing (Debugging)
    create table if not exists ai_audit_logs (
      id uuid primary key default gen_random_uuid(),
      turn_id uuid references chimera_turns(id) on delete set null, -- Link to Turn History
      game_id uuid, -- Redundant but useful for fast filtering without joins
      action_type text not null, -- e.g. 'GENESIS', 'TURN_REACTION'
      model_used text,
      prompt_tokens int,
      completion_tokens int,
      cost_stones int,
      raw_response text, -- Full raw LLM output for debugging
      created_at timestamptz not null default now()
    );
    create index on ai_audit_logs (turn_id);