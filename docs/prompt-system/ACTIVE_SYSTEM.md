# Active Prompt System Architecture

**Status**: Current production system  
**Last Updated**: 2025-02-01

---

## Overview

The Stone Caster prompt system assembles AI instructions from content authored in admin tables and combines them at runtime for game sessions. This document describes the active, production architecture.

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│ ADMIN CONTENT TABLES (Source of Truth)                  │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ worlds   │  │ rulesets │  │  entry   │  │  npcs  │ │
│  │          │  │          │  │  points  │  │        │ │
│  │ • prompt │  │ • prompt │  │ • prompt │  │• prompt│ │
│  │   (text) │  │   (text) │  │  (jsonb) │  │ (jsonb)│ │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
└─────────────────────────────────────────────────────────┘
              ↓
      Admin authors prompt content
              ↓
┌─────────────────────────────────────────────────────────┐
│ ASSEMBLY TABLE (Runtime)                                 │
│                                                          │
│  ┌──────────────────────────────────────────┐           │
│  │ prompt_segments                          │           │
│  │ ┌──────────────────────────────────────┐ │           │
│  │ │ scope    │ ref_id    │ content       │ │           │
│  │ ├──────────┼───────────┼───────────────┤ │           │
│  │ │ core     │ null      │ [sys prompts] │ │           │
│  │ │ ruleset  │ ruleset.X │ [ruleset txt] │ │           │
│  │ │ world    │ world.Y   │ [world txt]   │ │           │
│  │ │ entry    │ entry.Z   │ [entry txt]   │ │           │
│  │ │ npc      │ npc.A     │ [npc txt]     │ │           │
│  │ └──────────┴───────────┴───────────────┘ │           │
│  └──────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────┘
              ↓
      Assembler fetches segments
              ↓
┌─────────────────────────────────────────────────────────┐
│ GAME SESSION PROMPT (Final Assembly)                    │
│                                                          │
│  Core → Ruleset(s) → World → Entry → Entry_Start* →    │
│  NPCs → [Game State] → [Player] → [RNG] → [Input]      │
│                                                          │
│  *Entry_Start: first turn only                          │
│  [Brackets]: dynamic, runtime-generated                 │
└─────────────────────────────────────────────────────────┘
```

---

## Content Tables

### `worlds`

**Purpose**: World-level lore, setting, and tone guidance for AI

**Prompt Field**: `prompt` (TEXT)

**Example**:
```
You are narrating in the world of Mystika, a high-fantasy realm where magic is commonplace. 
Tone: mysterious, wonder-filled, with hints of ancient secrets.
```

### `rulesets`

**Purpose**: Game mechanics, rules, and system guidance for AI

**Prompt Field**: `prompt` (TEXT)

**Example**:
```
Use D&D 5e rules. Track HP, spell slots, and ability scores. 
Always show consequences for player actions within the rules.
```

### `entry_points`

**Purpose**: Entry points for adventures, scenarios, sandboxes, and quests

**Prompt Fields**:
- `prompt` (JSONB) - Turn 1 injection data
- `content` (JSONB) - Structured content including prompt text

**Type Values**: `'adventure' | 'scenario' | 'sandbox' | 'quest'`

**Key Point**: **Scenarios are entry_points with `type='scenario'`**. They use the same prompt structure and scopes as adventures.

### `npcs`

**Purpose**: NPC personalities, behaviors, and dialogue guidance

**Prompt Field**: `prompt` (JSONB)

**Example**:
```json
{
  "personality": "Wise elder, cautious but helpful",
  "speech_pattern": "Speaks in riddles and metaphors",
  "key_info": "Knows the location of the ancient artifact"
}
```

---

## prompt_segments Table

### Schema

```sql
CREATE TABLE prompt_segments (
    id bigserial PRIMARY KEY,
    scope text NOT NULL CHECK (scope IN (
        'core', 
        'ruleset', 
        'world', 
        'entry', 
        'entry_start', 
        'npc'
    )),
    ref_id text,  -- References parent entity (world.id, entry.id, etc.)
    version text NOT NULL DEFAULT '1.0.0',
    active boolean NOT NULL DEFAULT true,
    content text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
```

### Scopes

| Scope | Ref ID | Description | Example Use |
|-------|--------|-------------|-------------|
| `core` | null | System-wide prompts, always included | "You are a fantasy RPG narrator" |
| `ruleset` | `ruleset_id` | Ruleset-specific mechanics | "Use D&D 5e rules" |
| `world` | `world_id` | World lore and setting | "Mystika is a magical realm..." |
| `entry` | `entry_point_id` | Entry point main content | "The adventure begins in a tavern..." |
| `entry_start` | `entry_point_id` | First-turn-only opening | "You awaken with no memory..." |
| `npc` | `npc_id` | NPC-specific prompts | "Elder Thorne speaks cryptically" |

---

## Assembly Order

### First Turn
```
core → ruleset(s) → world → entry → entry_start → npc → [dynamic state]
```

### Ongoing Turns
```
core → ruleset(s) → world → entry → npc → [dynamic state]
```

**Dynamic State** (runtime-generated, not stored):
- `game_state` - Current game state summary
- `player` - Player character details
- `rng` - Random number generation context
- `input` - Player input for this turn

---

## Entry Points and Scenarios

### All Entry Point Types Use Same Scopes

Entry points have a `type` field:
- `adventure` - Traditional guided storyline
- `scenario` - Specific situation or challenge
- `sandbox` - Open-ended exploration
- `quest` - Goal-oriented mission

**All types use the same prompt scopes**: `entry` and `entry_start`.

**No separate scenario scope exists**. Scenarios are simply `entry_points` with `type='scenario'`.

### Example: Adventure vs. Scenario

**Adventure Entry Point**:
```sql
INSERT INTO entry_points (id, type, world_id, title, ...) VALUES
('adv_crystal_quest', 'adventure', 'mystika', 'The Crystal Quest', ...);

INSERT INTO prompt_segments (scope, ref_id, content) VALUES
('entry', 'adv_crystal_quest', 
 'A multi-session quest to recover the lost Crystal of Power...'),
('entry_start', 'adv_crystal_quest',
 'You receive a summons from the Council of Mages...');
```

**Scenario Entry Point**:
```sql
INSERT INTO entry_points (id, type, world_id, title, ...) VALUES
('scn_whispercross', 'scenario', 'mystika', 'Whispercross Encounter', ...);

INSERT INTO prompt_segments (scope, ref_id, content) VALUES
('entry', 'scn_whispercross',
 'A tense negotiation at the crossroads of the Whispering Woods...'),
('entry_start', 'scn_whispercross',
 'You arrive at the crossroads as dusk falls...');
```

**Both use identical scopes**. The `type` field is for player UI and filtering, not assembly logic.

---

## Player Flow

### Starting a Game

1. Player selects an entry point (adventure, scenario, etc.)
2. Frontend calls `POST /api/games/start` with `entry_point_id`
3. Backend:
   - Fetches entry point details
   - Retrieves `world_id`, `ruleset_id`, NPCs
   - Assembles prompt:
     ```
     core → rulesets → world → entry → entry_start → npcs → [player data]
     ```
4. AI generates first narrative response
5. Player sees opening narrative and choices

### Subsequent Turns

1. Player selects an action/choice
2. Frontend calls `POST /api/games/{id}/turns` with player input
3. Backend:
   - Fetches game state
   - Assembles prompt:
     ```
     core → rulesets → world → entry → npcs → game_state → player → input
     ```
   - Note: `entry_start` is **excluded** after first turn
4. AI generates response
5. Player sees narrative and new choices

---

## Token Budgeting and Truncation

### Budget Enforcement

Default budget: **8000 tokens**

### Truncation Order (when over budget)

1. Trim player `input` text
2. Compress `game_state`
3. Drop lower-tier NPC segments
4. Drop entire `npc` scope
5. **Last resort** (only if >150% over budget): Drop `world` or `entry`

**Core and ruleset are never dropped.**

### Policy Warnings

The assembler can emit `policyWarnings` in the assembly audit when truncation behavior is ambiguous or uses fallback logic.

---

## Assembler

### Location

`src/prompt/assembler/`

### Key Functions

**`assemblePrompt(args, dbAdapter)`**
- Main entry point for prompt assembly
- Returns `{ prompt, meta }` with full audit trail

**`applyTruncationPolicy(prompt, config, meta)`**
- Enforces token budget
- Returns truncated prompt and metadata

**`buildAssemblyAudit(...)`**
- Creates structured audit with per-scope token counts
- Includes policy notes and truncation details

### Assembly Result

```typescript
{
  prompt: string,                    // Final assembled text
  meta: {
    order: Scope[],                  // Scopes in assembly order
    segmentIdsByScope: Record<Scope, number[]>,  // IDs used per scope
    tokensEstimated: number,         // Total tokens
    truncated?: {                    // Optional truncation details
      droppedScopes?: Scope[],
      npcDroppedTiers?: NpcTierDrop[],
      inputTrimmed?: { fromChars, toChars },
      gameStateCompressed?: boolean,
    },
    audit?: {                        // Structured audit
      assembledAt: string,
      context: { isFirstTurn, worldSlug, entryPointId },
      scopes: AuditScopeDetail[],
      policyNotes: string[],
      summary: string
    }
  }
}
```

---

## Admin Authoring

### Creating World Prompts

1. Navigate to Admin > Worlds
2. Edit world
3. Add/update `prompt` text field
4. System creates `prompt_segments` with `scope='world'`, `ref_id=world.id`

### Creating Entry Point Prompts

1. Navigate to Admin > Entry Points
2. Create or edit entry point (adventure, scenario, etc.)
3. Add/update `prompt` or `content` JSONB
4. System creates `prompt_segments`:
   - `scope='entry'`, `ref_id=entry_point.id` (always included)
   - `scope='entry_start'`, `ref_id=entry_point.id` (first turn only)

### Creating NPC Prompts

1. Navigate to Admin > NPCs
2. Create or edit NPC
3. Add/update `prompt` JSONB with personality, speech patterns, etc.
4. System creates `prompt_segments` with `scope='npc'`, `ref_id=npc.id`

---

## Testing

### Unit Tests

Test assembler functions:
- Scope order correctness
- Segment inclusion/exclusion logic
- Token estimation
- Truncation policies
- Audit generation

### Integration Tests

Test full assembly:
- Fetch segments from DB
- Assemble complete prompt
- Verify scope order
- Confirm token budgets

### E2E Tests

Test player flows:
- Start game from entry point
- First turn includes `entry_start`
- Ongoing turns exclude `entry_start`
- All entry point types (adventure, scenario, etc.) work identically

---

## Key Differences from Legacy Systems

### This is the Active System

**Use**:
- Admin tables: `worlds`, `rulesets`, `entry_points`, `npcs`
- Assembly table: `prompt_segments`
- Assembler: `src/prompt/assembler/`

**Don't Use** (see `LEGACY_SYSTEMS.md`):
- `prompting.prompts` table
- `backend/src/prompts/database-prompt-assembler.ts`
- `backend/src/prompts/wrapper.ts`

---

## See Also

- [LEGACY_SYSTEMS.md](./LEGACY_SYSTEMS.md) - Deprecated systems
- [ENTRY_POINT_ASSEMBLY.md](./ENTRY_POINT_ASSEMBLY.md) - Detailed assembly flow
- [SCENARIOS.md](./SCENARIOS.md) - Scenario-specific guidance
- [../assembly/audit_fields.md](../assembly/audit_fields.md) - Assembly audit structure

