# Prompt Types and Composition Rules

## Overview
This document enumerates all prompt types, composition rules, and sources used in the Stone Caster system.

## Prompt Types

### 1. Core System Prompts
**Source**: Database `prompts` table with `scope = 'core'`
**Purpose**: Base game rules and system instructions
**Content**: 
- Game mechanics
- AI behavior guidelines
- Response formatting rules
- Safety constraints

### 2. World Prompts
**Source**: Database `prompts` table with `scope = 'world'`
**Purpose**: World-specific content and lore
**Content**:
- World description
- Lore and history
- NPCs and locations
- World-specific rules

### 3. Adventure Prompts
**Source**: Database `prompts` table with `scope = 'adventure'`
**Purpose**: Adventure-specific content
**Content**:
- Adventure storyline
- Key events
- Adventure-specific NPCs
- Adventure rules

### 4. Scenario Prompts
**Source**: Database `prompts` table with `scope = 'scenario'`
**Purpose**: Starting scenario content
**Content**:
- Initial scene description
- Starting conditions
- Scenario-specific NPCs
- Initial objectives

### 5. Quest Prompts
**Source**: Database `prompts` table with `scope = 'quest'`
**Purpose**: Quest-specific content
**Content**:
- Quest objectives
- Quest-specific rules
- Quest NPCs
- Quest rewards

## Prompt Composition Rules

### Assembly Order
1. **SYSTEM**: Core system instructions (always first)
2. **CORE**: Base game rules and mechanics
3. **WORLD**: World-specific content
4. **ADVENTURE**: Adventure-specific content
5. **GAME_STATE**: Current game state (first turn only)
6. **PLAYER**: Character data and stats
7. **RNG**: Random number generation data
8. **INPUT**: Player input and choices

### Section Delimiters
```
=== SYSTEM_BEGIN ===
[System instructions]
=== SYSTEM_END ===

=== CORE_BEGIN ===
[Core game rules]
=== CORE_END ===
```

### Variable Replacement
**Context Variables**:
- `{world_slug}`: World identifier
- `{adventure_slug}`: Adventure identifier
- `{scene_id}`: Current scene
- `{player_name}`: Character name
- `{player_stats}`: Character statistics
- `{game_state}`: Current game state

### Token Management
**Estimation**: 1 token ≈ 4 characters
**Limits**: 
- Core prompts: ~2000 tokens
- World prompts: ~3000 tokens
- Adventure prompts: ~2000 tokens
- Total prompt: ~8000 tokens

## Prompt Sources

### Database Tables
1. **prompts**: Core prompt segments
   - `id`: UUID primary key
   - `slug`: Prompt identifier
   - `scope`: Prompt type (core/world/adventure/scenario/quest)
   - `version`: Version number
   - `content`: Prompt text
   - `active`: Whether prompt is active
   - `metadata`: Additional metadata

2. **worlds**: World-specific content
   - `doc`: World document (JSONB)
   - Contains world lore, NPCs, locations

3. **adventures**: Adventure-specific content
   - `doc`: Adventure document (JSONB)
   - Contains adventure storyline, events

4. **scenarios**: Scenario-specific content
   - `doc`: Scenario document (JSONB)
   - Contains starting conditions, initial scene

### File Sources (Legacy)
**Location**: `backend/AI API Prompts/`
**Structure**:
- `worlds/{world}/world-codex.{world}-lore.md`
- `worlds/{world}/adventures/{adventure}/adventure.prompt.json`
- `worlds/{world}/adventures/{adventure}/adventure.start.prompt.json`

## Prompt Assembly Process

### Database Assembly
**Service**: `DatabasePromptAssembler`
**Process**:
1. Fetch prompt segments from database
2. Build context object with variables
3. Process segments with variable replacement
4. Assemble final prompt with sections
5. Return prompt text and metadata

### Legacy Assembly
**Service**: `PromptWrapper`
**Process**:
1. Load prompt files from filesystem
2. Build context from game state
3. Assemble sections in order
4. Apply variable replacement
5. Return formatted prompt

## Prompt Caching

### Database Caching
**Repository**: `PromptRepository`
**Strategy**:
- Cache segments by world/adventure/scene
- Invalidate on segment updates
- Use `clearCache()` for forced refresh

### Performance Optimization
- Indexed lookups on `prompts` table
- Connection pooling for database access
- Segment caching to reduce database calls

## Prompt Validation

### Content Validation
- Check for required sections
- Validate variable replacement
- Ensure token limits are respected
- Verify prompt completeness

### Error Handling
- `DB_PROMPTS_EMPTY`: No segments found
- `DB_PROMPTS_UNAVAILABLE`: Database unavailable
- `PROMPT_ASSEMBLY_FAILED`: Assembly error
- `TOKEN_LIMIT_EXCEEDED`: Token limit exceeded

## Prompt Versioning

### Version Management
- Auto-increment version on insert
- Single active version per slug/scope
- Hash-based content verification
- Rollback capability

### Migration Support
- Legacy file-based prompts
- Database migration tools
- Backward compatibility
- Gradual migration strategy

## Prompt Categories

### Core Categories
1. **System**: Base AI instructions
2. **Mechanics**: Game rules and systems
3. **World**: World-specific content
4. **Adventure**: Adventure-specific content
5. **Scenario**: Starting scenario content
6. **Quest**: Quest-specific content

### Enhancement Categories
1. **Combat**: Combat-specific rules
2. **Social**: Social interaction rules
3. **Exploration**: Exploration rules
4. **Magic**: Magic system rules
5. **Economy**: Economic system rules

## Prompt Metadata

### Segment Metadata
- `id`: Segment identifier
- `layer`: Prompt layer (core/world/adventure)
- `category`: Prompt category
- `priority`: Assembly priority
- `dependencies`: Required segments

### Assembly Metadata
- `totalSegments`: Number of segments
- `totalVariables`: Number of variables
- `loadOrder`: Segment load order
- `warnings`: Assembly warnings
- `tokenCount`: Estimated token count

## Prompt Testing

### Unit Tests
- Segment loading and processing
- Variable replacement
- Assembly order validation
- Error handling

### Integration Tests
- End-to-end prompt assembly
- Database connectivity
- Performance testing
- Cache validation

## Prompt Administration

### Admin Interface
- Prompt CRUD operations
- Version management
- Activation/deactivation
- Content validation

### Monitoring
- Assembly performance
- Error rates
- Cache hit rates
- Token usage






