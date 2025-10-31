# Entry Point Prompt Assembly Flow

**Last Updated**: 2025-02-01

---

## Overview

This document describes the complete flow from admin prompt authoring to runtime game session assembly for entry points (adventures, scenarios, sandboxes, quests).

---

## The Full Journey

### Step 1: Admin Creates Entry Point

**UI**: Admin > Entry Points > Create New

**Actions**:
1. Admin fills in entry point details:
   - Type: `'adventure' | 'scenario' | 'sandbox' | 'quest'`
   - World ID (required)
   - Ruleset IDs (one or more)
   - Title, description, tags, visibility
2. Admin adds prompt content:
   - Option A: Fill in `prompt` JSONB field with structured data
   - Option B: Fill in `content` JSONB field with narrative text
3. System saves to `entry_points` table

**Database**:
```sql
INSERT INTO entry_points (
    id, slug, type, world_id, title, description, prompt, ...
) VALUES (
    'ep_whispercross_001',
    'whispercross-mystery',
    'scenario',
    'world_mystika',
    'The Whispercross Mystery',
    'A tense encounter at a magical crossroads',
    '{"opening": "As dusk falls..."}',
    ...
);
```

---

### Step 2: Prompt Segments Created

**Mechanism**: Background job, admin action, or API trigger

**What Happens**:
The system transforms entry point prompt data into `prompt_segments` rows:

**Main Entry Content** (`scope='entry'`):
```sql
INSERT INTO prompt_segments (scope, ref_id, content, active) VALUES
('entry', 'ep_whispercross_001', 
 'This is a scenario where the player must negotiate with a mysterious figure at Whispercross. 
  Tone: tense, mysterious. Keep dialogue cryptic.', 
 true);
```

**Opening Content** (`scope='entry_start'`):
```sql
INSERT INTO prompt_segments (scope, ref_id, content, active) VALUES
('entry_start', 'ep_whispercross_001',
 'You arrive at the crossroads as dusk falls. A cloaked figure waits in the shadows.',
 true);
```

**Key Points**:
- `scope='entry'` → used on **every turn** of the game
- `scope='entry_start'` → used **only on the first turn**
- `ref_id` → references the `entry_point.id`
- Multiple segments can exist for the same entry point (combined during assembly)

---

### Step 3: Player Starts Game

**UI**: Player > Browse Adventures/Scenarios > Select Entry Point > Start Game

**API Call**:
```
POST /api/games/start
Body: { entry_point_id: "ep_whispercross_001" }
```

**Backend Actions**:
1. Fetch entry point details:
   ```sql
   SELECT id, world_id, type FROM entry_points 
   WHERE id = 'ep_whispercross_001' AND visibility = 'public';
   ```

2. Fetch associated rulesets:
   ```sql
   SELECT ruleset_id, sort_order FROM entry_point_rulesets 
   WHERE entry_point_id = 'ep_whispercross_001' 
   ORDER BY sort_order;
   ```

3. Fetch associated NPCs (if any):
   ```sql
   SELECT npc_id, tier FROM entry_point_npcs 
   WHERE entry_point_id = 'ep_whispercross_001';
   ```

4. Create game record:
   ```sql
   INSERT INTO games (id, entry_point_id, world_id, owner_user_id, status, ...)
   VALUES (uuid_generate_v4(), 'ep_whispercross_001', 'world_mystika', ..., 'active', ...);
   ```

---

### Step 4: Assembler Builds First Turn Prompt

**Assembler Entry Point**: `src/prompt/assembler/assembler.ts::assemblePrompt()`

**Assembly Order (First Turn)**:
```
1. core
2. ruleset(s)  ← Multiple rulesets in sort_order
3. world
4. entry       ← Entry point main content
5. entry_start ← First-turn-only opening
6. npc         ← Associated NPCs
7. [game_state] ← Runtime-generated (empty on first turn)
8. [player]    ← Runtime-generated (character details)
9. [rng]       ← Runtime-generated (random seed)
10. [input]    ← Runtime-generated (player input, empty on first turn)
```

**Fetch Calls**:
```typescript
// Core segments (no ref_id)
const coreSegments = await dbAdapter.getSegments('core');

// Ruleset segments (one or more)
const rulesets = await dbAdapter.getRulesetsForEntry(entryPointId);
for (const ruleset of rulesets) {
  const rulesetSegments = await dbAdapter.getSegments('ruleset', ruleset.id);
  // ...combine
}

// World segments
const worldSegments = await dbAdapter.getSegments('world', worldId);

// Entry segments (main content)
const entrySegments = await dbAdapter.getSegments('entry', entryPointId);

// Entry start segments (first turn only)
if (isFirstTurn) {
  const entryStartSegments = await dbAdapter.getSegments('entry_start', entryPointId);
}

// NPC segments
for (const npc of npcs) {
  const npcSegments = await dbAdapter.getSegments('npc', npc.npcId);
  // ...combine with tier logic
}
```

**Result**:
```markdown
=== CORE_BEGIN ===
You are a fantasy RPG narrator. Always use second person...
=== CORE_END ===

=== RULESET_BEGIN ===
D&D 5e rules. Track HP, spell slots...
=== RULESET_END ===

=== WORLD_BEGIN ===
Mystika is a realm of high magic and ancient mysteries...
=== WORLD_END ===

=== ENTRY_BEGIN ===
This is a scenario where the player must negotiate...
=== ENTRY_END ===

=== ENTRY_START_BEGIN ===
You arrive at the crossroads as dusk falls...
=== ENTRY_START_END ===

=== NPC_BEGIN ===
[Mysterious Figure] - Speaks in riddles, knows more than they reveal...
=== NPC_END ===

=== PLAYER_BEGIN ===
Character: [Player name], Level 5 Wizard...
=== PLAYER_END ===

=== INPUT_BEGIN ===
[Empty on first turn]
=== INPUT_END ===
```

---

### Step 5: AI Generates Response

**AI Prompt**: The assembled prompt from Step 4

**AI Model**: GPT-4, Claude, or configured LLM

**Response**:
```json
{
  "narrative": "As you approach the crossroads, the cloaked figure turns toward you. 'You seek passage,' they say, more statement than question. Their voice is like autumn leaves rustling. 'But the way is not free.'",
  "choices": [
    {"id": "1", "label": "Ask about the price of passage"},
    {"id": "2", "label": "Try to intimidate them"},
    {"id": "3", "label": "Offer to share your rations"}
  ]
}
```

**Save to Database**:
```sql
INSERT INTO turns (game_id, turn_index, narrative, choices, ...) VALUES
([game_id], 0, '[narrative text]', '[choices json]', ...);
```

---

### Step 6: Ongoing Turns

**Player Action**:
Player selects a choice → Frontend sends:
```
POST /api/games/{game_id}/turns
Body: { choice_id: "1", input_text: "What do you want?" }
```

**Assembly Order (Ongoing Turns)**:
```
1. core
2. ruleset(s)
3. world
4. entry       ← Still included
5. npc         ← Still included
6. [game_state] ← Game state from previous turns
7. [player]    ← Updated character state
8. [rng]       ← Random seed
9. [input]     ← Player's choice and input
```

**Key Difference**: **`entry_start` is excluded after first turn**.

**Fetch Calls** (same as first turn, except):
```typescript
// Skip entry_start on ongoing turns
if (isFirstTurn) {
  // entry_start segments
} else {
  // Skip entry_start
}
```

**Result**:
Same scopes as first turn, but:
- `entry_start` section is removed
- `game_state` now contains recent history summary
- `input` contains player's choice and text

---

## Entry Point Types: No Difference in Assembly

All entry point types (`adventure`, `scenario`, `sandbox`, `quest`) assemble **identically**:

- Same scopes: `entry` and `entry_start`
- Same assembly order
- Same NPC handling
- Same token budgeting

**Type field is for**:
- Player UI filtering ("Show me only scenarios")
- Content curation
- Analytics

**Type field is NOT for**:
- Prompt assembly logic
- Scope selection
- Truncation policies

---

## Token Budget and Truncation

### Budget Enforcement

Default: **8000 tokens**

### Truncation Steps

If assembled prompt exceeds budget:

1. Trim `input` text (player's message)
2. Compress `game_state` (summarize history)
3. Drop lower-tier `npc` segments
4. Drop entire `npc` scope
5. **Last resort** (only if >150% over budget): Drop `world` or `entry`

**Core and ruleset are never dropped**.

Entry segments are preserved as long as possible. If dropped, the game loses context of what adventure/scenario it's in.

---

## Scenarios: Special Considerations

### Scenarios Are Entry Points

Scenarios are `entry_points` with `type='scenario'`. They use the same `entry` and `entry_start` scopes.

### No Separate Scope

There is **no `scenario` scope** in `prompt_segments`. Scenarios use:
- `scope='entry'` for ongoing context
- `scope='entry_start'` for opening narration

### Authoring a Scenario

1. Create entry point with `type='scenario'`
2. Add prompt segments:
   ```sql
   INSERT INTO prompt_segments (scope, ref_id, content) VALUES
   ('entry', '[scenario_id]', 'Tone: tense mystery. NPC is secretive...'),
   ('entry_start', '[scenario_id]', 'As dusk falls, you arrive at the crossroads...');
   ```
3. Player starts scenario (same flow as adventure)

### Player Experience

From the player's perspective, scenarios may:
- Be shorter (single session)
- Focus on a specific challenge or situation
- Have a clear goal or outcome

But technically, they assemble and play **identically** to adventures.

---

## Example: Whispercross Scenario

### Admin Setup

```sql
-- Create entry point
INSERT INTO entry_points (id, slug, type, world_id, title, description, ...)
VALUES ('ep_whispercross_001', 'whispercross', 'scenario', 'world_mystika', 
        'Whispercross Mystery', 'Negotiate with a mysterious figure', ...);

-- Link rulesets
INSERT INTO entry_point_rulesets (entry_point_id, ruleset_id, sort_order)
VALUES ('ep_whispercross_001', 'ruleset_dnd5e', 1);

-- Link NPCs
INSERT INTO entry_point_npcs (entry_point_id, npc_id, tier)
VALUES ('ep_whispercross_001', 'npc_mysterious_figure', 1);

-- Create prompt segments
INSERT INTO prompt_segments (scope, ref_id, content, active) VALUES
('entry', 'ep_whispercross_001',
 'Scenario: negotiation at Whispercross. Tone: mysterious, tense. The figure knows more than they reveal.', 
 true),
('entry_start', 'ep_whispercross_001',
 'You arrive at the crossroads as dusk falls. A cloaked figure waits in the shadows.', 
 true);
```

### First Turn Assembly

```
CORE: You are a fantasy RPG narrator...
RULESET: D&D 5e rules...
WORLD: Mystika is a realm of high magic...
ENTRY: Scenario: negotiation at Whispercross. Tone: mysterious...
ENTRY_START: You arrive at the crossroads as dusk falls...
NPC: [Mysterious Figure] speaks cryptically, reveals little...
PLAYER: Character: [name], Level 5 Wizard...
INPUT: [empty]
```

**Tokens**: ~1200 estimated

### Ongoing Turn Assembly

Player chose: "Ask about the price of passage"

```
CORE: You are a fantasy RPG narrator...
RULESET: D&D 5e rules...
WORLD: Mystika is a realm of high magic...
ENTRY: Scenario: negotiation at Whispercross. Tone: mysterious...
[ENTRY_START REMOVED]
NPC: [Mysterious Figure] speaks cryptically, reveals little...
GAME_STATE: Turn 0: arrived at crossroads, met cloaked figure...
PLAYER: Character: [name], Level 5 Wizard...
INPUT: Player asked: "What do you want?"
```

**Tokens**: ~1500 estimated

---

## API Endpoints Reference

### Start Game
```
POST /api/games/start
Body: { entry_point_id: string }
Response: { gameId, firstTurn: { narrative, choices } }
```

### Submit Turn
```
POST /api/games/{gameId}/turns
Body: { choice_id: string, input_text?: string }
Response: { turnId, narrative, choices }
```

### Get Entry Point Details (Admin)
```
GET /api/admin/entry-points/{id}
Response: { id, type, world_id, title, description, prompt, ... }
```

---

## See Also

- [ACTIVE_SYSTEM.md](./ACTIVE_SYSTEM.md) - Full system architecture
- [SCENARIOS.md](./SCENARIOS.md) - Scenario-specific guidance
- [LEGACY_SYSTEMS.md](./LEGACY_SYSTEMS.md) - Deprecated systems
- `../assembly/audit_fields.md` - Assembly audit structure
- `src/prompt/assembler/README.md` - Assembler implementation details

