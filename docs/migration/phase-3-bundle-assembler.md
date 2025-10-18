# Phase 3: AWF Bundle Assembler

This document outlines the implementation of Phase 3 for the AWF (Adventure World Format) bundle migration. This phase focuses on building a deterministic bundle assembler that creates single-object JSON requests for AI model processing.

## Overview

Phase 3 implements a pure, typed assembler function that takes session data and player input to produce a complete AWF bundle. The assembler uses injection maps to place document components into the bundle structure and applies scene-based slice selection for optimal token usage.

## Core Function

### `assembleBundle(params: AwfBundleParams): Promise<AwfBundleResult>`

The main assembly function that creates an AWF bundle from session data and player input.

**Parameters:**
- `sessionId: string` - Session identifier
- `inputText: string` - Player's latest message for this turn

**Returns:**
- `AwfBundleResult` - Complete bundle with metrics

## Bundle Structure

The assembled bundle follows this skeleton structure:

```json
{
  "awf_bundle": {
    "meta": {
      "engine_version": "1.0.0",
      "world": "world.mystika",
      "adventure": "adv.whispercross",
      "turn_id": 1,
      "is_first_turn": true,
      "timestamp": "2023-01-01T00:00:00Z"
    },
    "contract": {
      "id": "core.contract.v4",
      "version": "v4",
      "hash": "abc123...",
      "doc": { /* contract content */ }
    },
    "world": {
      "ref": "world.mystika",
      "hash": "def456...",
      "slice": ["timekeeping", "whispercross_region"],
      "doc": { /* optional inline content */ }
    },
    "adventure": {
      "ref": "adv.whispercross",
      "hash": "ghi789...",
      "slice": ["timekeeping", "adventure_progression"],
      "start_hint": { /* only on first turn */ },
      "doc": { /* optional inline content */ }
    },
    "npcs": {
      "active": [ /* up to 5 NPCs */ ],
      "count": 3
    },
    "player": {
      "id": "player-123",
      "name": "Player Name",
      "traits": { /* character traits */ },
      "skills": { /* character skills */ },
      "inventory": [ /* character inventory */ ]
    },
    "game_state": {
      "hot": { /* current state */ },
      "warm": { "episodic": [], "pins": [] },
      "cold": { /* persistent state */ }
    },
    "rng": {
      "seed": "deterministic-seed",
      "policy": "deterministic"
    },
    "input": {
      "text": "I look around the forest",
      "timestamp": "2023-01-01T00:00:00Z"
    }
  }
}
```

## Data Sources

The assembler reads from the following repositories:

### Core Data
- **CoreContractsRepo.getActive()** - Active core contract
- **WorldsRepo.getByIdVersion(id)** - World document
- **AdventuresRepo.getByIdVersion(id)** - Adventure document
- **AdventureStartsRepo.getByAdventureRef(id)** - Adventure start (optional)
- **SessionsRepo.get(sessionId)** - Session data
- **GameStatesRepo.get(sessionId)** - Game state data
- **InjectionMapRepo.get('default')** - Injection map configuration

### Player Data
- **Characters table** - Player character information
- **Games table** - Player game state

### NPC Data
- **Adventure NPCs** - From adventure document
- **Game State NPCs** - From current game state

## Assembly Rules

### 1. Skeleton Creation
The assembler creates the base bundle structure with all required fields.

### 2. Document Placement
Uses `injection_map.build` JSON Pointers to place:
- Core contract → `/awf_bundle/contract`
- World ref/hash/slice → `/awf_bundle/world/...`
- Adventure ref/hash/slice → `/awf_bundle/adventure/...`
- Player sheet → `/awf_bundle/player`
- Active NPC cards → `/awf_bundle/npcs`
- State: hot/warm/cold → `/awf_bundle/game_state/...`
- RNG (seed + policy) → `/awf_bundle/rng`
- Input text → `/awf_bundle/input/text`
- Meta information → `/awf_bundle/meta`

### 3. Slice Selection
Slices are selected based on current scene or defaults:

**Scene-Based Selection:**
- If `game_state.hot.scene` is set, use scene-specific slices
- Scene slice policy maps scenes to relevant slices
- Examples: `forest_clearing` → `['timekeeping', 'whispercross_region', 'encounter_forest_edge']`

**Default Selection:**
- If no scene or scene not in policy, use default slices
- World defaults: `['timekeeping', 'whispercross_region', 'world_lore']`
- Adventure defaults: `['timekeeping', 'whispercross_region', 'adventure_progression']`

### 4. First Turn Behavior
Special handling for first turns:

**Time Seeding:**
- If `sessions.is_first_turn === true` and `hot.time` is empty, do not set time/band
- Prevents premature time advancement

**Start Hints:**
- Include `adventure_start` scaffolding under `awf_bundle.adventure.start_hint`
- Provides initial scene and description for AI context

### 5. NPC Management
- Only include active NPCs (maximum 5)
- Filter based on current scene or adventure context
- Include essential NPC information: id, name, description, role, location

## Helper Functions

### JSON Pointer Operations
- **`setAtPointer(obj, pointer, value)`** - Set value at JSON Pointer path
- **`getAtPointer(obj, pointer)`** - Get value at JSON Pointer path

### Token Estimation
- **`estimateTokens(json: object)`** - Simple char/4 heuristic for token counting
- **`stableStringify(value)`** - Stable JSON stringification for consistent output

### RNG Generation
- **`generateRngSeed(sessionId, turnId)`** - Deterministic seed generation
- Ensures same inputs produce same RNG state

### Slice Selection
- **`selectSlices(currentScene, sceneSlicePolicy, defaultSlices)`** - Scene-based slice selection
- **`filterActiveNpcs(npcs, maxCount)`** - Limit NPCs to maximum count

### Metrics Calculation
- **`calculateBundleMetrics(bundle, buildTime)`** - Calculate size and performance metrics
- **`validateBundleStructure(bundle)`** - Validate bundle structure and required fields

## Scene Slice Policy

The scene slice policy maps scenes to relevant slices for token optimization:

```typescript
const sceneSlicePolicy = {
  'forest_clearing': ['timekeeping', 'whispercross_region', 'encounter_forest_edge'],
  'town_square': ['timekeeping', 'whispercross_region', 'encounter_town_square'],
  'dungeon_entrance': ['timekeeping', 'whispercross_region', 'encounter_dungeon_entrance'],
  'boss_encounter': ['timekeeping', 'whispercross_region', 'encounter_boss'],
  'default': ['timekeeping', 'whispercross_region', 'encounter_general']
};
```

## Validation

### Bundle Structure Validation
The assembler validates the complete bundle structure:

**Required Fields:**
- `awf_bundle.meta.turn_id` (number)
- `awf_bundle.meta.is_first_turn` (boolean)
- `awf_bundle.input.text` (non-empty string)
- `awf_bundle.contract` (present)
- `awf_bundle.world.ref` (string)
- `awf_bundle.adventure.ref` (string)

**Type Validation:**
- All required fields must be present and correct type
- Input text must be non-empty
- Turn ID must be positive integer
- Boolean fields must be boolean

### Error Handling
- **Missing Data**: Throws error if required data sources are missing
- **Validation Errors**: Returns detailed error information for invalid bundles
- **Logging**: Comprehensive logging of assembly process and metrics

## Development Script

### `dump-awf-bundle.ts`

A development script for testing bundle assembly:

**Usage:**
```bash
npm run dump:awf-bundle -- --session <sessionId> --text "<player input>" [--output <outputPath>]
```

**Features:**
- Assembles bundle for given session and input
- Writes bundle to `/tmp/awf-bundles/<session>-<turn>.json`
- Prints byte size and estimated tokens
- Shows bundle structure summary
- Displays slice and NPC details

**Example:**
```bash
npm run dump:awf-bundle -- --session "session-123" --text "I look around the forest"
```

**Output:**
```
🚀 AWF Bundle Dump Script
========================
Session ID: session-123
Input Text: "I look around the forest"

📦 Assembling bundle...

💾 Writing bundle to: /tmp/awf-bundles/session-123-2023-01-01T00-00-00Z.json

📊 Bundle Metrics:
==================
Byte Size: 2,456 bytes
Estimated Tokens: 614
NPC Count: 3
Slice Count: 4
Build Time: 45ms
Assembly Time: 67ms

🏗️  Bundle Structure:
====================
Meta: engine=1.0.0, world=world.mystika, adventure=adv.whispercross
Turn: 1 (first: true)
Contract: core.contract.v4 v4
World: world.mystika (2 slices)
Adventure: adv.whispercross (2 slices)
NPCs: 3 active
Player: Test Player
Input: "I look around the forest"
Start Hint: forest_clearing - You find yourself in a forest clearing

🔍 Slice Details:
=================
World Slices: timekeeping, whispercross_region
Adventure Slices: timekeeping, adventure_progression

👥 Active NPCs:
================
1. Forest Guardian (guardian) - A wise old tree spirit
2. Traveling Merchant (merchant) - A friendly trader
3. Local Guide (guide) - A knowledgeable local

🎮 Game State Summary:
======================
Hot State: 3 keys (scene, time, weather...)
Warm State: 2 keys (episodic, pins...)
Cold State: 1 keys (persistent...)

✅ Bundle dump completed successfully!
📁 Output file: /tmp/awf-bundles/session-123-2023-01-01T00-00-00Z.json
```

## Testing

### Unit Tests

The assembler includes comprehensive unit tests:

**Test Coverage:**
- **First Turn Assembly** - Tests first turn behavior with start hints
- **Subsequent Turn Assembly** - Tests normal turn processing
- **Error Handling** - Tests missing data scenarios
- **Helper Functions** - Tests all utility functions
- **Validation** - Tests bundle structure validation
- **Determinism** - Tests that same inputs produce same outputs

**Test Files:**
- `backend/tests/awf-bundle-assembler.test.ts` - Main assembler tests
- `backend/tests/awf-bundle-helpers.test.ts` - Helper function tests

### Test Scenarios

**First Turn Tests:**
- `is_first_turn=true` → includes `adventure.start_hint`
- `hot.time` empty → no time seeding
- Default slices selected when no scene

**Second Turn Tests:**
- `is_first_turn=false` → no start hints
- Scene-based slice selection
- Normal turn processing

**Error Handling Tests:**
- Missing session → throws error
- Missing active core contract → throws error
- Missing world/adventure → throws error

**Validation Tests:**
- Valid bundle structure → no errors
- Missing required fields → validation errors
- Invalid field types → validation errors

**Determinism Tests:**
- Same inputs → identical output
- Different inputs → different output
- RNG seed consistency

## Performance Considerations

### Size Hygiene
- **NPC Limit**: Maximum 5 active NPCs to control token usage
- **Slice Selection**: Scene-based slices reduce irrelevant content
- **Optional Inline Content**: World/adventure inline content disabled by default
- **Token Estimation**: Logs approximate token counts for monitoring

### Optimization
- **Deterministic Output**: Same state → same bundle bytes (except timestamps)
- **Efficient Queries**: Single queries for each data source
- **Caching**: Repository pattern allows for future caching
- **Metrics**: Built-in performance monitoring

### Logging
- **Assembly Metrics**: Build time, byte size, token count
- **Slice Selection**: Logs selected slices and counts
- **NPC Management**: Logs active NPC count
- **Error Details**: Comprehensive error logging with context

## Integration Points

### Phase 1 Integration
- **Repositories**: Uses all Phase 1 repositories
- **Validators**: Uses Phase 1 document validators
- **Hashing**: Uses Phase 1 hashing utilities

### Phase 2 Integration
- **Admin Data**: Uses data created by Phase 2 admin interface
- **Document Management**: Leverages Phase 2 document management

### Future Phases
- **Phase 4**: Act application system will consume bundles
- **Phase 5**: Turn processing integration
- **Phase 6**: Performance optimization and monitoring

## Configuration

### Environment Variables
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_KEY` - Supabase service key

### Feature Flags
- Bundle assembler is behind existing feature flags
- Not wired into turn processing yet (Phase 4)
- Development and testing only

## Usage Examples

### Basic Assembly
```typescript
import { assembleBundle } from './assemblers/awf-bundle-assembler.js';

const result = await assembleBundle({
  sessionId: 'session-123',
  inputText: 'I look around the forest'
});

console.log('Bundle assembled:', result.metrics);
```

### Development Testing
```bash
# Test first turn
npm run dump:awf-bundle -- --session "session-123" --text "I look around the forest"

# Test subsequent turn
npm run dump:awf-bundle -- --session "session-123" --text "I walk to the tavern"
```

### Error Handling
```typescript
try {
  const result = await assembleBundle(params);
  // Process bundle
} catch (error) {
  if (error.message.includes('Session not found')) {
    // Handle missing session
  } else if (error.message.includes('No active core contract')) {
    // Handle missing core contract
  } else {
    // Handle other errors
  }
}
```

## Rollback Instructions

To rollback Phase 3 changes:

1. **Remove Assembler**: Delete `backend/src/assemblers/awf-bundle-assembler.ts`
2. **Remove Helpers**: Delete `backend/src/utils/awf-bundle-helpers.ts`
3. **Remove Policy**: Delete `backend/src/policies/scene-slice-policy.ts`
4. **Remove Types**: Delete `backend/src/types/awf-bundle.ts`
5. **Remove Validators**: Delete `backend/src/validators/awf-bundle-validators.ts`
6. **Remove Script**: Delete `backend/scripts/dump-awf-bundle.ts`
7. **Remove Tests**: Delete `backend/tests/awf-bundle-assembler.test.ts`
8. **Remove Script**: Remove `dump:awf-bundle` from `package.json`

## Next Steps

Phase 3 provides the foundation for:

- **Phase 4**: Act application system using assembled bundles
- **Phase 5**: Integration with existing turn processing
- **Phase 6**: Performance optimization and monitoring

The bundle assembler is now ready for integration with the AI model processing pipeline in subsequent phases.


