# Prompt Assembler Documentation

## Overview

The Prompt Assembler is a deterministic system that builds AI prompts from database-stored segments in a specific order. It enforces token budgets, handles NPC tier reveals, and supports entry_start (first-turn only) functionality.

## Architecture

The assembler follows a pure function design with side-effect adapters:

- **Core**: `assembler.ts` - Main assembly orchestration
- **Database**: `db.ts` - Segment fetching with Supabase/Postgres
- **NPCs**: `npc.ts` - Tier-based NPC content selection
- **State**: `state.ts` - Dynamic content adapters
- **Budget**: `budget.ts` - Token estimation and truncation
- **Formatting**: `markdown.ts` - Section delimiters and formatting

## Layer Order and Rationale

The assembler builds prompts in this exact order:

1. **`core`** - System-level instructions (never dropped)
2. **`ruleset`** - Game rules and mechanics (never dropped)
3. **`world`** - World setting and context
4. **`entry`** - Adventure/scenario setup
5. **`entry_start`** - First-turn only welcome (controlled by `isFirstTurn`)
6. **`npc`** - NPC descriptions and behaviors (tier-based)
7. **`game_state`** - Current game state summary
8. **`player`** - Character information
9. **`rng`** - Random number generation context
10. **`input`** - User input (most likely to be truncated)

### Rationale

- **Core/Ruleset**: Essential system instructions, never dropped
- **World/Entry**: Foundational context, dropped only in extreme cases
- **Entry_start**: First-turn only to avoid repetition
- **NPCs**: Tier-based reveals for progressive disclosure
- **State layers**: Dynamic content, most likely to be truncated
- **Input**: User-specific, most volatile content

## Content Sources

### Database Segments

All static content comes from the `prompt_segments` table:

```sql
-- Core segments (no ref_id)
SELECT * FROM prompt_segments WHERE scope = 'core' AND active = true;

-- Ruleset segments
SELECT * FROM prompt_segments WHERE scope = 'ruleset' AND ref_id = 'ruleset.classic_v1' AND active = true;

-- World segments  
SELECT * FROM prompt_segments WHERE scope = 'world' AND ref_id = 'world.mystika' AND active = true;

-- Entry segments
SELECT * FROM prompt_segments WHERE scope = 'entry' AND ref_id = 'ep.whispercross' AND active = true;

-- Entry start segments (first turn only)
SELECT * FROM prompt_segments WHERE scope = 'entry_start' AND ref_id = 'ep.whispercross' AND active = true;

-- NPC segments (tier-based)
SELECT * FROM prompt_segments WHERE scope = 'npc' AND ref_id = 'npc.innkeeper' AND active = true;
```

### Dynamic Content

Dynamic content comes from function arguments:

- **`gameStateText`** - Current game state summary
- **`playerText`** - Character sheet/bio
- **`rngText`** - RNG seed/policy information
- **`inputText`** - User input (raw or summarized)

## Token Budget Policy

### Estimation

Uses simple heuristic: **~4 characters per token**

```typescript
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
```

### Truncation Order

When over budget, truncation applies in this order:

1. **Trim INPUT** - Reduce to N chars keeping sentence boundary
2. **Compress GAME_STATE** - Replace with summary cue
3. **Reduce NPC tiers** - Drop highest tiers first
4. **Drop NPC block** - Remove entire NPC section
5. **Drop world/entry** - Only in extreme cases

### Budget Configuration

```typescript
const config = {
  tokenBudget: 8000,        // Total prompt limit
  npcTokenBudget: 600,      // NPC section limit
  inputTrimChars: 800,      // Input truncation limit
  gameStateCompressChars: 400 // Game state compression limit
};
```

## NPC Tiering Behavior

### Tier Selection

NPCs use tiered content with progressive disclosure:

```typescript
// NPC with multiple tiers
const npc = {
  npcId: 'npc.innkeeper',
  tier: 1  // Include tiers 0 and 1, exclude 2+
};

// Database segments
const segments = [
  { id: 1, content: 'Basic description', metadata: { tier: 0 } },
  { id: 2, content: 'Knows local secrets', metadata: { tier: 1 } },
  { id: 3, content: 'Has magical items', metadata: { tier: 2 } }
];
```

### Budget Management

When NPC section exceeds budget:

1. **Reduce tiers** - Drop highest tier for all NPCs
2. **Drop NPCs** - Remove lowest priority NPCs
3. **Summarize** - Replace with behavior cues

### Metadata Conventions

```typescript
// NPC segment metadata
{
  tier: 0,                    // Tier level (0 = basic, higher = detailed)
  type: 'npc_description',    // Content type
  priority: 'high'           // Optional priority
}
```

## Entry Start One-Time Rule

The `entry_start` scope is only included when `isFirstTurn = true`:

```typescript
const args: AssembleArgs = {
  entryPointId: 'ep.whispercross',
  isFirstTurn: true,  // Include entry_start
  // ... other args
};
```

**Responsibility**: The consumer (e.g., `/games/start`) sets `isFirstTurn` and manages the game flag afterward. The assembler is stateless and trusts the flag.

## Examples

### First Turn Prompt

```typescript
const args: AssembleArgs = {
  entryPointId: 'ep.whispercross',
  worldId: 'world.mystika',
  rulesetId: 'ruleset.classic_v1',
  isFirstTurn: true,
  gameStateText: 'You arrive at the Whispercross Inn.',
  playerText: 'You are a level 3 fighter.',
  inputText: 'I want to explore the inn.',
  npcs: [{ npcId: 'npc.innkeeper', tier: 1 }]
};

const result = await assemblePrompt(args, dbAdapter);
```

**Output**:
```
=== CORE_BEGIN ===
You are a helpful AI game master.
=== CORE_END ===

=== RULESET_BEGIN ===
Use classic D&D rules for combat.
=== RULESET_END ===

=== WORLD_BEGIN ===
The world of Mystika is magical.
=== WORLD_END ===

=== ENTRY_BEGIN ===
You are at the Whispercross Inn.
=== ENTRY_END ===

=== ENTRY_START_BEGIN ===
Welcome to your adventure!
=== ENTRY_START_END ===

=== NPC_BEGIN ===
NPC: npc.innkeeper
The innkeeper is friendly.
He knows local secrets.
=== NPC_END ===

=== GAME_STATE_BEGIN ===
You arrive at the Whispercross Inn.
=== GAME_STATE_END ===

=== PLAYER_BEGIN ===
You are a level 3 fighter.
=== PLAYER_END ===

=== INPUT_BEGIN ===
I want to explore the inn.
=== INPUT_END ===
```

### Subsequent Turn Prompt

```typescript
const args: AssembleArgs = {
  entryPointId: 'ep.whispercross',
  worldId: 'world.mystika',
  rulesetId: 'ruleset.classic_v1',
  isFirstTurn: false,  // No entry_start
  gameStateText: 'You are in the inn common room.',
  playerText: 'You are a level 3 fighter.',
  inputText: 'I talk to the innkeeper.',
  npcs: [{ npcId: 'npc.innkeeper', tier: 2 }]  // Higher tier
};
```

**Output**: Same as above but without `ENTRY_START` block and with higher NPC tier content.

### Budget Truncation Example

```typescript
const args: AssembleArgs = {
  // ... same as above
  tokenBudget: 100,  // Very low budget
  inputText: 'Very long user input that exceeds the budget...'
};

const result = await assemblePrompt(args, dbAdapter);
```

**Output**: Input truncated, game state compressed, NPC tiers reduced, with truncation metadata:

```typescript
result.meta.truncated = {
  inputTrimmed: { fromChars: 500, toChars: 200 },
  gameStateCompressed: true,
  npcDroppedTiers: [
    { npcId: 'npc.innkeeper', fromTier: 2, toTier: 1 }
  ]
};
```

## API Contract

### Types

```typescript
export type AssembleArgs = {
  entryPointId: string;
  worldId: string;
  rulesetId: string;
  gameId?: string;
  isFirstTurn?: boolean;
  gameStateText?: string;
  playerText?: string;
  rngText?: string;
  inputText?: string;
  npcs?: Array<{ npcId: string; tier: number }>;
  tokenBudget?: number;
  npcTokenBudget?: number;
  locale?: string;
};

export type AssembleResult = {
  prompt: string;
  meta: {
    order: Scope[];
    segmentIdsByScope: Record<Scope, number[]>;
    tokensEstimated: number;
    truncated?: {
      droppedScopes?: Scope[];
      npcDroppedTiers?: Array<{ npcId: string; fromTier: number; toTier: number }>;
      inputTrimmed?: { fromChars: number; toChars: number };
      gameStateCompressed?: boolean;
    };
  };
};
```

### Main Function

```typescript
export async function assemblePrompt(
  args: AssembleArgs,
  dbAdapter: DbAdapter
): Promise<AssembleResult>
```

### Database Adapter

```typescript
export interface DbAdapter {
  getSegments(scope: Scope, refId?: string): Promise<SegmentRow[]>;
}
```

## Testing

The assembler includes comprehensive tests covering:

- **Order validation** - Blocks appear in correct sequence
- **Entry start behavior** - Included only when `isFirstTurn = true`
- **NPC tier selection** - Only segments up to specified tier
- **Budget management** - Truncation policies applied correctly
- **Core preservation** - Core and ruleset never dropped
- **Metadata tracking** - Segment IDs and truncation details

### Test Structure

```typescript
describe('Prompt Assembler', () => {
  let mockDb: MockDbAdapter;

  beforeEach(() => {
    mockDb = createMockDbAdapter();
  });

  it('should assemble blocks in correct order', async () => {
    // Test implementation
  });
});
```

## Integration

### With Game Loop

```typescript
// In game service
const prompt = await assemblePrompt({
  entryPointId: game.entry_point_id,
  worldId: game.world_id,
  rulesetId: game.ruleset_id,
  isFirstTurn: game.turn_count === 0,
  gameStateText: summarizeGameState(game.state),
  playerText: formatPlayerCharacter(player),
  inputText: userInput,
  npcs: getActiveNpcs(game.state, player.tier)
}, dbAdapter);
```

### With Supabase

```typescript
import { createClient } from '@supabase/supabase-js';
import { SupabaseDbAdapter } from './assembler/db';

const supabase = createClient(url, key);
const dbAdapter = new SupabaseDbAdapter(supabase);

const result = await assemblePrompt(args, dbAdapter);
```

## Performance Considerations

- **Database queries** - Segments fetched in parallel where possible
- **Token estimation** - Lightweight heuristic for speed
- **Truncation** - Applied only when necessary
- **Caching** - Segments can be cached by scope/ref_id
- **Memory** - Large prompts handled efficiently

## Error Handling

- **Validation** - Arguments validated before assembly
- **Database errors** - Graceful handling of fetch failures
- **Budget overflow** - Systematic truncation strategy
- **Invalid segments** - Filtered out during assembly

## Future Enhancements

- **Localization** - Multi-language segment support
- **Caching** - Segment caching for performance
- **Analytics** - Assembly metrics and optimization
- **Custom truncation** - User-defined truncation policies
- **Segment versioning** - A/B testing of prompt variations
