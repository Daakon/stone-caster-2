# Prompt System Inventory

## Core Files (Foundation Layer)

### 1. Foundation Layer
- `world-codex.{world}-lore.md` - World lore & setting
- `world-codex.{world}-logic.json` - World-specific rules & mechanics

### 2. Core Systems Layer  
- `systems.unified.json` - Universal mechanics & rules
- `style.ui-global.json` - UI & presentation standards

### 3. Engine Layer
- `core.rpg-storyteller.json` - Core narrative protocols
- `engine.system.json` - AWF contract & action definitions
- `awf.scheme.json` - JSON schema validation

### 4. AI Behavior Layer
- `agency.presence-and-guardrails.json` - AI behavior controls & safety

### 5. Data Management Layer
- `save.instructions.json` - Save/load protocols
- `validation.save.json` - Save validation rules
- `validation.assets.json` - Asset validation rules
- `validation.world-specific.json` - World-specific validation

### 6. Performance Layer
- `performance.benchmarks.json` - Performance guidelines & optimization

### 7. Content Layer
- `adventure.{world}.json` - Current adventure context

### 8. Enhancement Layer
- `essence-integration-enhancement.json` - Mystika essence mechanics (if applicable)
- `adventure.{world}-expanded.json` - Expanded world content (if applicable)

## File Mapping

| Scope | File | Version | Required Context Keys | Load Order |
|-------|------|---------|----------------------|------------|
| world | world-codex.mystika-lore.md | 1.0 | world.name, world.setting | 1 |
| world | world-codex.mystika-logic.json | 1.0 | world.rules, world.mechanics | 2 |
| core | systems.unified.json | 1.0.0 | - | 3 |
| core | style.ui-global.json | 1.0 | - | 4 |
| core | core.rpg-storyteller.json | 1.0 | - | 5 |
| core | engine.system.json | 2.1 | - | 6 |
| core | awf.scheme.json | 1.0 | - | 7 |
| core | agency.presence-and-guardrails.json | 1.0 | - | 8 |
| core | save.instructions.json | 1.0 | - | 9 |
| core | validation.save.json | 1.0 | - | 10 |
| core | validation.assets.json | 1.0 | - | 11 |
| core | validation.world-specific.json | 1.0 | - | 12 |
| core | performance.benchmarks.json | 1.0 | - | 13 |
| adventure | adventure.whispercross.json | 1.0 | adventure.name, adventure.scenes | 14 |
| enhancement | essence-integration-enhancement.json | 1.0 | world.essence_system | 15 |

## Variable Allowlist

### Core Variables
- `character.name` - Player character name
- `character.level` - Character level
- `character.race` - Character race
- `character.class` - Character class
- `character.skills` - Character skill values
- `character.stats` - Character stat values

### Game Variables
- `game.id` - Game session ID
- `game.turn_index` - Current turn number
- `game.summary` - Game state summary
- `game.current_scene` - Current scene ID

### World Variables
- `world.name` - World name
- `world.setting` - World setting description
- `world.genre` - World genre
- `world.themes` - World themes array
- `world.rules` - World-specific rules
- `world.mechanics` - World mechanics

### Adventure Variables
- `adventure.name` - Adventure name
- `adventure.scenes` - Adventure scenes
- `adventure.objectives` - Adventure objectives
- `adventure.npcs` - Adventure NPCs

### Runtime Variables
- `runtime.ticks` - Runtime tick count
- `runtime.presence` - Current presence state
- `runtime.ledgers` - Active ledgers
- `runtime.flags` - Runtime flags
- `runtime.last_acts` - Last actions taken
- `runtime.style_hint` - Style hint for this turn

## Load Order Validation

### Pre-Load Checks
- [ ] All required files exist
- [ ] File versions are compatible
- [ ] World-specific files match current world
- [ ] No circular dependencies

### Post-Load Validation
- [ ] AWF schema is valid
- [ ] All required systems are loaded
- [ ] World-specific rules are active
- [ ] Performance guidelines are available




























