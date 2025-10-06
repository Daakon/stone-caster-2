# Prompt Assembly System

This directory contains the Layer P2 prompt assembly pipeline that dynamically loads and assembles prompts from the `GPT Prompts/` directory structure.

## Architecture

The system follows a strict load order and authority hierarchy to ensure consistent AI behavior:

```
Game Context → PromptAssembler → PromptLoader → GPT Prompts/
     ↓              ↓                ↓              ↓
Character      Manifest         File System    JSON/MD Files
World          Templates        Load Order     Dynamic Content
Adventure      Validation       Variables      World-Specific
Runtime        Assembly         Audit Trail    Core Systems
```

## Load Order (Authority Hierarchy)

Templates are loaded in this strict order, with later files having higher authority:

### 1. Foundation Layer (Load Order 1-2)
- `world-codex.{world}-lore.md` - World lore & setting
- `world-codex.{world}-logic.json` - World-specific rules & mechanics

### 2. Core Systems Layer (Load Order 3-4)
- `systems.unified.json` - Universal mechanics & rules
- `style.ui-global.json` - UI & presentation standards

### 3. Engine Layer (Load Order 5-7)
- `core.rpg-storyteller.json` - Core narrative protocols
- `engine.system.json` - AWF contract & action definitions
- `awf.scheme.json` - JSON schema validation

### 4. AI Behavior Layer (Load Order 8)
- `agency.presence-and-guardrails.json` - AI behavior controls & safety

### 5. Data Management Layer (Load Order 9-12)
- `save.instructions.json` - Save/load protocols
- `validation.save.json` - Save validation rules
- `validation.assets.json` - Asset validation rules
- `validation.world-specific.json` - World-specific validation

### 6. Performance Layer (Load Order 13)
- `performance.benchmarks.json` - Performance guidelines & optimization

### 7. Content Layer (Load Order 14)
- `adventure.{world}.json` - Current adventure context

### 8. Enhancement Layer (Load Order 15-16)
- `essence-integration-enhancement.json` - World-specific mechanics
- `adventure.{world}-expanded.json` - Expanded world content

## File Structure

```
backend/src/prompts/
├── README.md              # This file
├── loader.ts              # Generic file loader
├── manifest.ts            # Template manifest and world configs
├── assembler.ts           # Main prompt assembly service
├── schemas.ts             # Zod schemas for validation
├── variables.ts           # Variable allowlist and validation
└── inventory.md           # File inventory and mapping
```

## Usage

### Basic Usage

```typescript
import { PromptAssembler } from './assembler.js';
import type { PromptContext } from './schemas.js';

const assembler = new PromptAssembler();
await assembler.initialize();

const context: PromptContext = {
  game: {
    id: 'game-123',
    turn_index: 5,
    summary: 'Turn 6 | World: mystika | Character: Kiera',
    current_scene: 'whispercross-outer-paths',
    state_snapshot: { /* game state */ },
    option_id: 'ch_approach_kiera',
  },
  world: {
    name: 'mystika',
    setting: 'A world saturated in ambient magic',
    genre: 'fantasy',
    themes: ['essence', 'magic', 'adventure'],
    rules: { /* world rules */ },
    mechanics: { /* world mechanics */ },
    lore: 'World lore content',
    logic: { /* world logic */ },
  },
  character: {
    name: 'Kiera',
    level: 3,
    race: 'shifter',
    class: 'scout',
    skills: { stealth: 2, survival: 3 },
    // ... other character data
  },
  adventure: {
    name: 'whispercross',
    scenes: [/* adventure scenes */],
    objectives: ['Find the missing children'],
    npcs: [/* adventure NPCs */],
    places: [/* adventure places */],
    triggers: [/* adventure triggers */],
  },
  runtime: {
    ticks: 5,
    presence: 'present',
    ledgers: { /* runtime ledgers */ },
    flags: { /* runtime flags */ },
    last_acts: [/* last actions */],
    style_hint: 'cautious',
  },
  system: {
    schema_version: '1.0.0',
    prompt_version: '2.0.0',
    load_order: [],
    hash: 'template-hash',
  },
};

const result = await assembler.assemblePrompt(context);
console.log(result.prompt); // Complete assembled prompt
console.log(result.audit);  // Audit trail
```

### Integration with PromptsService

The system integrates with the existing `PromptsService`:

```typescript
import { promptsService } from '../services/prompts.service.js';

const gameContext = {
  id: 'game-123',
  world_id: 'mystika',
  character_id: 'char-456',
  state_snapshot: { /* game state */ },
  turn_index: 5,
};

const prompt = await promptsService.buildPrompt(gameContext, 'ch_approach_kiera');
```

## Variable System

### Allowlisted Variables

The system enforces a strict allowlist of variables that can be used in templates:

#### Character Variables
- `character.name` - Player character name
- `character.level` - Character level
- `character.race` - Character race
- `character.class` - Character class
- `character.skills` - Character skill values
- `character.stats` - Character stat values
- `character.inventory` - Character inventory
- `character.relationships` - Character relationships
- `character.flags` - Character flags

#### Game Variables
- `game.id` - Game session ID
- `game.turn_index` - Current turn number
- `game.summary` - Game state summary
- `game.current_scene` - Current scene ID
- `game.state_snapshot` - Complete game state
- `game.option_id` - Player's chosen option

#### World Variables
- `world.name` - World name
- `world.setting` - World setting description
- `world.genre` - World genre
- `world.themes` - World themes array
- `world.rules` - World-specific rules
- `world.mechanics` - World mechanics
- `world.lore` - World lore content
- `world.logic` - World logic

#### Adventure Variables
- `adventure.name` - Adventure name
- `adventure.scenes` - Adventure scenes
- `adventure.objectives` - Adventure objectives
- `adventure.npcs` - Adventure NPCs
- `adventure.places` - Adventure places
- `adventure.triggers` - Adventure triggers

#### Runtime Variables
- `runtime.ticks` - Runtime tick count
- `runtime.presence` - Current presence state
- `runtime.ledgers` - Active ledgers
- `runtime.flags` - Runtime flags
- `runtime.last_acts` - Last actions taken
- `runtime.style_hint` - Style hint for this turn

#### System Variables
- `system.schema_version` - Schema version
- `system.prompt_version` - Prompt version
- `system.load_order` - Load order
- `system.hash` - Template hash

### Template Syntax

Variables in templates use double curly brace syntax:

```markdown
## World: {{world.name}}

You are playing as {{character.name}}, a {{character.level}} level {{character.race}} {{character.class}}.

Current scene: {{game.current_scene}}
Turn: {{game.turn_index}}
```

## World Configuration

The system automatically detects and configures worlds based on the `GPT Prompts/Worlds/` directory structure:

```
GPT Prompts/Worlds/
├── Mystika/
│   ├── world-codex.mystika-lore.md
│   ├── world-codex.mystika-logic.json
│   ├── adventure.whispercross.json
│   └── style.mystika.md
├── Verya/
│   ├── world-codex.veyra-lore.md
│   ├── world-codex.veyra-logic.json
│   └── adventure.veywood.json
└── Templates/
    ├── build-text.world.template.md
    └── style.world.template.md
```

## Audit Trail

Every prompt assembly generates a complete audit trail:

```typescript
{
  templateIds: ['mystika-world-codex-lore', 'systems-unified', 'engine-system'],
  version: '1.0.0',
  hash: 'a1b2c3d4e5f6',
  contextSummary: {
    world: 'mystika',
    adventure: 'whispercross',
    character: 'Kiera',
    turnIndex: 5,
  },
  tokenCount: 1250,
  assembledAt: '2025-01-06T15:30:00.000Z',
}
```

## Error Handling

The system gracefully handles various error conditions:

- **Missing Templates**: Warns about missing required templates but continues
- **Invalid Variables**: Logs warnings for non-allowlisted variables
- **File Read Errors**: Continues with available templates
- **Validation Failures**: Provides detailed error messages

## Testing

Run the test suite:

```bash
cd backend
npm test -- prompts
```

Tests cover:
- Template loading and validation
- Variable allowlist enforcement
- Context assembly
- Error handling
- Audit trail generation

## Future Enhancements

The system is designed to support future enhancements:

1. **Supabase Registry**: Templates can be migrated to database storage
2. **Version Management**: Template versioning and rollback
3. **A/B Testing**: Multiple template versions for experimentation
4. **Performance Optimization**: Template caching and pre-compilation
5. **Admin Interface**: Web UI for template management

## Troubleshooting

### Common Issues

1. **No templates found for world**: Check that world-specific files exist in `GPT Prompts/Worlds/{world}/`
2. **Invalid variables in template**: Ensure all variables are in the allowlist
3. **Load order conflicts**: Verify template load order in the manifest
4. **Missing required templates**: Check that core templates exist in `GPT Prompts/Core/`

### Debug Mode

Enable debug logging by setting the log level:

```typescript
console.log('Prompt assembled:', {
  templateCount: result.metadata.totalSegments,
  tokenCount: result.audit.tokenCount,
  world: result.audit.contextSummary.world,
  turn: result.audit.contextSummary.turnIndex,
});
```
