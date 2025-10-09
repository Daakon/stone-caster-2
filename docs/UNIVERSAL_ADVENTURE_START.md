# Universal Adventure Start System

## Overview

The Universal Adventure Start system provides deterministic adventure resolution with AI-first narration, enabling character-aware openings while maintaining backward compatibility with existing adventure files.

## Key Features

- **Deterministic Resolution**: Clear order for resolving starting scenes
- **AI-First Narration**: Character-aware openings without hardcoded scripts
- **Backward Compatibility**: Supports existing `opening.scene` and `opening.summary` formats
- **Flexible Input Grammar**: Supports various command formats for adventure starts
- **Comprehensive Testing**: Full test coverage for all acceptance criteria

## New Adventure Format

### Start Object Schema

```json
{
  "start": {
    "scene": "forest_meet",        // required scene id
    "policy": "ai_first",          // default
    "hints": ["wounded shifter", "small camp ahead"] // optional, non-prescriptive
  }
}
```

### Policy Values

- **`ai_first`** (default): The model composes initial narration purely from world+player+scene context. Hints are soft nudges only—never quoted or forced.
- **`scripted`** (optional): If present, runtime may include scene script lines, but still must let the AI stitch them naturally and adapt to player sheet.

## Adventure Format Requirements

### Required Start Structure

All adventures must use the new `start` format:

```json
{
  "start": {
    "scene": "gatehouse",
    "policy": "ai_first",
    "hints": ["Bells toll at dusk."]
  },
  "scenes": [
    {
      "id": "gatehouse",
      "description": "The gatehouse stands silent"
    }
  ]
}
```

### Validation

The system validates that:
- `start` object is present and properly structured
- `start.scene` exists in the `scenes` array
- All required fields are present

## Input Grammar

The system supports flexible command parsing:

### Supported Commands

- `Begin the adventure` - Use active adventure
- `Begin adventure "<id>"` - Start specific adventure
- `Begin adventure "<id>" from "<scene>"` - Start at specific scene
- `Start adventure "<id>"` - Alternative to begin
- `Begin scene "<id>"` - Start specific scene

### Examples

```
Begin the adventure
Begin adventure "whispercross"
Begin adventure "whispercross" from "forest_meet"
Start adventure "mystika-tutorial"
Begin scene "forest_meet"
```

## Resolution Order

The system resolves starting scenes in this deterministic order:

1. **Explicit Scene**: If user input names both adventure and scene → use that
2. **Adventure Start**: Else use `adventure.start.scene` (required)
3. **Error**: If adventure doesn't have proper start structure → error with actionable message

## AI-First Opening Behavior

For the very first turn of an adventure:

1. **Load Start Scene**: Load `start.scene`
2. **Fire Events**: Fire any `on_scene_start` events (e.g., introduce Kiera)
3. **Compose AWF**: Generate output with:
   - `scn`: the resolved scene id
   - `txt`: AI-generated narration (no verbatim script lines unless `policy: "scripted"`)
   - `choices`: derive from scene's affordances if present; otherwise create 2–3 sensible choices
   - `acts`: include `TIME_ADVANCE` (ticks ≥ 1) exactly once
   - `val`: include if engine requires it (keep legacy behavior)

## Implementation

### Core Services

- **`AdventureStartService`**: Schema normalization and start resolution
- **`AdventureInputParserService`**: Command parsing and validation
- **`UniversalAdventureService`**: Integration with existing AI and prompt services

### Key Methods

```typescript
// Normalize legacy adventure format
normalizeAdventure(adventure: any): AdventureWithStart

// Resolve starting scene with deterministic order
resolveAdventureStart(
  adventure: AdventureWithStart,
  explicitSceneId?: string,
  availableAdventures?: string[]
): { sceneId: string; startData: StartData } | AdventureStartError

// Generate first-turn AWF with AI-first narration
generateFirstTurnAWF(
  sceneId: string,
  startData: StartData,
  sceneData: any,
  worldContext: any,
  playerContext: any,
  timeData: { band: string; ticks: number }
): any
```

## Testing

### Unit Tests

- Schema normalization for all legacy formats
- Start resolution with all resolution orders
- Input grammar parsing for all command formats
- AWF generation with proper structure and acts

### E2E Tests

- **AC1**: Whispercross start with AI-first narration
- **AC2**: Explicit scene override functionality
- **AC3**: Backward compatibility with legacy opening format
- **AC4**: Error handling when no adventure present
- **AC5**: Never fallback to generic world intro when adventure exists
- **AC6**: All tests pass with comprehensive coverage

## Acceptance Criteria

### AC1 - Whispercross Start
With `adventure.start.prompt.json` present and input `Begin the adventure`, the first AWF:
- `scn === "forest_meet"`
- `txt` references Kiera's wounded presence and nearby camp without quoting hardcoded lines
- One `TIME_ADVANCE` act is present (ticks ≥ 1)
- Choices reflect `forest_meet` intent (e.g., follow Kiera, scout, withdraw), not generic world menu

### AC2 - Explicit Scene
Input: `Begin adventure "adv.whispercross.start.v3" from "forest_meet"` produces the same outcome as AC1 even if `start.scene` differs (explicit overrides default).

### AC3 - Adventure Validation
An adventure with proper start structure:
```json
{
  "start": {
    "scene": "gatehouse",
    "policy": "ai_first",
    "hints": ["Bells toll at dusk."]
  },
  "scenes": [
    { "id": "gatehouse", "description": "The gatehouse stands silent" }
  ]
}
```
starts at `gatehouse`, uses "ai_first" narration, and incorporates hints naturally into the AI-generated text.

### AC4 - No Adventure Present
If no adventure is available and user says `Begin the adventure`, respond with an error payload (not prose) that lists available adventures or instructs to load one.

### AC5 - Never Generic Fallback
When an adventure exists, the first AWF never defaults to a world-only intro (e.g., "You find yourself in a tranquil village…").

### AC6 - Tests Pass
Unit + integration tests cover normalization, resolution order, first-turn AWF shape, single `TIME_ADVANCE`, and choice derivation.

## Adventure Format Requirements

### For Adventure Authors

All adventures must use the new `start` format:

```json
{
  "start": {
    "scene": "forest_meet",
    "policy": "ai_first",
    "hints": ["wounded shifter", "small camp ahead"]
  },
  "scenes": [
    {
      "id": "forest_meet",
      "description": "A wounded shifter approaches through the mist"
    }
  ]
}
```

### For Developers

1. **Integration**: Use `UniversalAdventureService` for adventure start logic
2. **Validation**: All adventures must pass `validateAdventure()` before processing
3. **Testing**: Run comprehensive test suite to ensure proper format compliance

## Future Considerations

- **Enhanced Policies**: Additional policy types may be added (e.g., `hybrid`, `guided`)
- **Scene Events**: Enhanced `on_scene_start` event system for complex scene initialization
- **Choice Intelligence**: Smarter choice derivation based on player context and world state

## Troubleshooting

### Common Issues

1. **"ADVENTURE_START_UNRESOLVED"**: No valid starting scene found
   - Check that adventure has `start.scene` or `scenes[0].id`
   - Verify scene IDs are valid

2. **"INVALID_SCENE"**: Explicit scene not found in adventure
   - Check scene ID spelling and case
   - Verify scene exists in adventure's scenes array

3. **"NO_ADVENTURE_PRESENT"**: No adventure available
   - Load an adventure before starting
   - Check adventure loading logic

### Debug Information

Enable debug logging to see:
- Adventure normalization process
- Scene resolution order
- AI context building
- AWF generation details

## Related Documentation

- [API Contract](./API_CONTRACT.md) - Adventure start endpoints
- [Test Plan](./TEST_PLAN.md) - Comprehensive testing strategy
- [Migration Plan](./MIGRATION_PLAN.md) - Detailed migration steps
