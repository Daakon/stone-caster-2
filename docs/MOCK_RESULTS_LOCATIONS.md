# Mock AI Results - Location Reference

This document lists all locations where mock AI responses are generated for testing and development.

## The Toggle (single source of truth)

All mock behavior is governed by **`ENABLE_MOCK_AI=true`** in `backend/.env`, read at
call time via `isMockAiEnabled()` in `backend/src/config/ai-flags.ts`. Consumers:
`createLlmProvider()`, `LlmService.generateText()`, `Mas2Service.narrate()`,
`NarrativeService` (genesis + reactions), and the `GET /api/chimera/play/:id` chip seeding.
`USE_MOCK_LLM` is deprecated (still honored, logs a warning).

Independent of the flag, any player input starting with `test_` takes the **Scenario
Bypass** path (`isTestScenarioInput()`): the Director and Narrator return deterministic
scripted output even when real AI is enabled, so scenario checks never cost tokens.

## Primary Mock Providers

### 1. **MockLlmProvider** (`backend/src/services/runtime/llm.provider.ts`)
   - **Purpose**: Main mock provider for MAS-1 and MAS-2 responses
   - **Location**: Lines 81-105
   - **Methods**:
     - `generateJson<T>()` - Routes to MAS1 or MAS2 mocks based on system prompt
     - `generateMas1(userText: string)` - Lines 112-232
       - Returns `Mas1Intent[]` for test scenarios:
         - `test_combat`: Multi-target combat (Guard + Kiera)
         - `test_mixed`: Sequence aggregation (combat + rest)
         - `test_social`: Relationship logic (flirt with Bartender)
         - `test_travel`: Time & gating (navigate to location)
   - **Entity IDs Used** (from test story `901d84d8-ec64-4c0e-86cf-796e10262b97`):
     - Guard (Garret): `39757d45-2426-4377-a5d0-e99e9681d1ff`
     - Bartender: `00f2f66c-4ece-46df-ace9-af89a488c077`
     - Bard: `7a70ee42-101d-4dd3-8cee-2882fdd8a84e`
     - Kiera (Panther Shifter): `789dbece-3bc9-4080-82ce-31b47139fbb5`
     - Cael (Dire Wolf Shifter): `4c5bb787-53ce-487d-b574-c7a6c66070e7`
     - Location: `start_node` (from scene_registry)

### 2. **Mas2Service** (`backend/src/services/runtime/mas2.service.ts`)
   - **Purpose**: Deterministic narrator branch (`mockNarrate()`); the real LLM branch
     (docs/05 Narrator Constraint Model) runs when `ENABLE_MOCK_AI` is off and the
     input is not a `test_*` scenario
   - **Method**: `narrate()` routes to `mockNarrate()` per the toggle above
   - **Mock Responses**:
     - Combat actions: Uses actual entity names from game state
     - Rest actions: References tavern context
     - Social actions: Uses target entity names (e.g., "Bartender")
     - Navigate actions: References journey context
   - **State Updates**: 
     - Lines 85-103: Generates `state_updates` with actual entity IDs
     - Bartender (`00f2f66c...`): -10 trust on combat
     - Bard (`7a70ee42...`): -5 trust on combat
     - Cael (`4c5bb787...`): -5 trust, -3 warmth on combat

### 3. **NarrativeService** (`backend/src/services/game/narrative.service.ts`)
   - **Purpose**: Opening narrative (genesis) + legacy reactions
   - **Location**: `mockReaction()` and the mock-genesis branch
   - **Mock Flag**: `isMockAiEnabled()` per call (the old hardcoded `USE_MOCK_AI = true` is gone)
   - **Methods**:
     - `mockReaction()` - Lines 54-89: Generates deterministic narratives
     - `generateOpeningNarrative()` - Lines 95-99: Mock genesis narrative
   - **Entity References**: Uses Guard and Bartender IDs from state

## Secondary Mock Locations

### 4. **LlmService** (`backend/src/services/llm/llm.service.ts`)
   - **Purpose**: Mock AI toggle for cost-saving
   - **Location**: Lines 130-137
   - **Condition**: `process.env.ENABLE_MOCK_AI === 'true'`
   - **Response**: Returns structured mock JSON for narrative generation

### 5. **Legacy Action Parser** (`backend/src/services/play/action-parser.ts`)
   - **Purpose**: Legacy MAS-1 parser (may not be in active use)
   - **Location**: Lines 76-125 (`callMasApi()`)
   - **Note**: Returns `Mas1ResponseDto` (legacy format)

### 6. **Legacy MAS Context Provider** (`backend/src/services/play/mas-context-provider.ts`)
   - **Purpose**: Legacy MAS-2 provider (may not be in active use)
   - **Location**: Lines 58-92 (`callMas2Api()`)
   - **Note**: Returns legacy `Mas2ResponseDto` format

## Test-Specific Mocks

### 7. **Test Files**
   - `backend/src/tests/runtime-loop.spec.ts` - Lines 18-41: Test-specific MockLlmProvider
   - `backend/src/services/runtime/mas1.service.test.ts` - Mock LlmService for unit tests
   - Various other test files with mock implementations

## Entity ID Reference (Test Story)

From game state `901d84d8-ec64-4c0e-86cf-796e10262b97`:

| Entity | ID | Display Name | Type |
|--------|-----|--------------|------|
| Player | `2bfccd8e-9d2a-4b72-9151-544eb249ccd4` | Daakon | PLAYER |
| Bartender | `00f2f66c-4ece-46df-ace9-af89a488c077` | Bartender | NPC |
| Guard (Garret) | `39757d45-2426-4377-a5d0-e99e9681d1ff` | Guard | NPC |
| Bard | `7a70ee42-101d-4dd3-8cee-2882fdd8a84e` | Bard | NPC |
| Kiera | `789dbece-3bc9-4080-82ce-31b47139fbb5` | Kiera | NPC (Panther Shifter) |
| Cael | `4c5bb787-53ce-487d-b574-c7a6c66070e7` | Cael | NPC (Dire Wolf Shifter) |
| D.D. | `deac7b4d-c972-46cb-b8f8-284691c78be8` | D.D. | NPC (Drifter) |

## Test Scenarios

### `test_combat`
- **Targets**: Guard (Garret) + Kiera
- **Action**: `combat_action` with `slash`, `aggressive` tactic
- **Expected**: Engine processes two separate combat resolutions

### `test_mixed`
- **Intent A**: `combat_action` on Guard (defensive tactic)
- **Intent B**: `rest_action` (no target)
- **Expected**: Stamina cost from combat, then stamina recovery from rest

### `test_social`
- **Target**: Bartender
- **Action**: `social_action` with `flirt` verb
- **Expected**: Relationship delta applied (flirt -> desire)

### `test_travel`
- **Target**: `start_node` location
- **Action**: `navigate` with `travel` verb
- **Expected**: Time advancement and hunger decay

## Notes

- All mocks use actual entity IDs from the test story
- Mock responses reference actual entity names (Garret, Bartender, etc.)
- No fallback logic - mocks fail fast with clear errors
- Validation ensures all mock responses match `Mas1Intent` schema
