# Entry Point Dataflow Analysis

## Overview
This document traces the dataflow from user selection to chat initialization for each entry point type.

## Adventure Dataflow (Legacy)

### 1. User Selection
**Entry Point**: `/adventures` page
**Component**: Adventure listing page
**Data Source**: `adventures` table (legacy schema)

### 2. Character Selection
**Entry Point**: `/adventures/{id}/character-selection`
**Component**: `frontend/src/pages/CharacterSelectionPage.tsx`
**Process**:
- Load adventure details
- Present character options (premade, existing, new)
- User selects character type

### 3. Game Creation
**API Call**: `POST /api/games`
**Handler**: `backend/src/routes/games.ts` (lines 67-130)
**Process**:
- Validate request body
- Call `GamesService.spawn()`
- Create game record in `games` table
- Return game ID

### 4. Game Initialization
**API Call**: `POST /api/games/{id}/auto-initialize`
**Handler**: `backend/src/routes/games.ts` (lines 479-629)
**Process**:
- Validate game ownership
- Check turn count (must be 0)
- Call `TurnsService.runBufferedTurn()` with `optionId: 'game_start'`
- Generate initial AI prompt
- Create first turn record

### 5. Prompt Assembly
**Service**: `backend/src/services/prompts.service.ts`
**Process**:
- Build game context
- Assemble prompt using database segments
- Include world, adventure, character data
- Generate AI response

### 6. Chat Interface
**Component**: `frontend/src/pages/UnifiedGamePage.tsx`
**Process**:
- Load game state
- Display AI response
- Present choices to user
- Handle user input

## Scenario Dataflow (AWF)

### 1. User Selection
**Entry Point**: `/scenarios` page
**Component**: `frontend/src/pages/player/ScenarioPicker.tsx`
**Data Source**: `scenarios` table (AWF schema)

### 2. Scenario Listing
**API Call**: `GET /api/player/scenarios`
**Process**:
- Fetch public scenarios
- Apply filters (world, tags, search)
- Return scenario list with metadata

### 3. Scenario Selection
**User Action**: Click "Start Adventure" button
**Process**:
- Call `startScenario()` function
- Send `POST /api/player/games/start`

### 4. Game Creation
**API Call**: `POST /api/player/games/start`
**Handler**: `backend/src/routes/player.ts` (lines 82-162)
**Process**:
- Parse scenario reference
- Fetch scenario from database
- Check public availability
- Build initial state snapshot
- Create game state record

### 5. State Initialization
**Process**:
- Extract scenario metadata
- Set initial scene, objectives, flags
- Initialize party, inventory, resources
- Create game state with hot/warm/cold structure

### 6. Navigation to Game
**Process**:
- Navigate to `/game/{game_id}`
- Load game interface
- Initialize chat session

## Sandbox Dataflow (Planned)

### 1. User Selection
**Entry Point**: Sandbox mode (not fully implemented)
**Status**: Referenced in comments but implementation unclear

### 2. Expected Process
Based on code comments and structure:
- User selects sandbox mode
- Choose world/setting
- Start with minimal constraints
- Direct to game interface

## Prompt Assembly Process

### Database Prompt Assembly
**Service**: `backend/src/prompts/database-prompt-assembler.ts`
**Process**:
1. Fetch prompt segments from database
2. Build context object with variables
3. Process segments with variable replacement
4. Assemble final prompt with sections
5. Return prompt text and metadata

### Prompt Sections
**Structure**: Multiple sections with delimiters
- SYSTEM: Core system instructions
- CORE: Base game rules
- WORLD: World-specific content
- ADVENTURE: Adventure-specific content
- GAME_STATE: Current game state (first turn only)
- PLAYER: Character data
- RNG: Random number generation
- INPUT: Player input

### Prompt Sources
**Database Tables**:
- `prompts` table for core segments
- `worlds` table for world content
- `adventures` table for adventure content
- `scenarios` table for scenario content

## Game State Management

### State Structure
**Hot State**: Current scene, objectives, flags, party, inventory, resources
**Warm State**: Episodic memory, pins
**Cold State**: Meta information, world references

### State Updates
**Process**:
- User makes choice
- AI processes choice
- State updates based on AI response
- New choices presented to user

## Error Handling

### Common Error Points
1. **Scenario Not Found**: 404 error
2. **Scenario Not Public**: 403 error
3. **Game Already Initialized**: 400 error
4. **Prompt Assembly Failure**: 500 error
5. **AI Generation Failure**: 500 error

### Error Recovery
- Retry mechanisms for transient failures
- Fallback prompts for assembly failures
- User-friendly error messages
- Debug logging for troubleshooting

## Performance Considerations

### Database Queries
- Indexed lookups for scenarios
- Cached prompt segments
- Efficient state serialization

### AI Processing
- Prompt token limits
- Response caching
- Rate limiting

### Frontend Optimization
- Lazy loading of game components
- State management with React Query
- Optimistic updates for user actions




