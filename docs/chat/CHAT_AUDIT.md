# Chat E2E (Non-Streaming JSON) — Audit Report

**Date**: 2025-01-21  
**Scope**: Evaluate current codebase readiness for non-streaming JSON chat endpoint  
**Status**: READ-ONLY EVALUATION

---

## Summary

### What Works Today

The codebase has substantial infrastructure already in place for non-streaming JSON responses:

- **Prompt assembly**: Fully functional assembler with correct order (core → ruleset → world → entry → entry_start → npc → game_state → player → rng → input)
- **isFirstTurn handling**: Correctly includes/excludes entry_start segments
- **NPC tier injection**: Working tier computation based on relationships (trust, warmth, respect, romance, awe, fear)
- **Model adapters**: Both mock and OpenAI adapters exist; OpenAI adapter already uses `response_format: { type: 'json_object' }`
- **JSON schema**: Comprehensive `TurnResponseSchema` defined in `shared/src/types/api.ts`
- **Non-streaming service**: `TurnsService.runBufferedTurn` already generates complete responses (no streaming)
- **Token accounting**: turns.costs jsonb field records prompt_tokens, completion_tokens, total_tokens
- **UI compatibility**: Frontend uses mutation + refetch pattern with loading indicators (no streaming assumptions)

### What's Missing

- **Dedicated chat endpoint**: No `/api/chat/*` routes; current flow uses `/api/games/:id/turn`
- **JSON validation on model output**: Parser exists but no strict pre-delta validation checkpoint
- **Atomic transaction**: Turn creation + delta application not wrapped in single transaction
- **NPC relationship delta application**: Deltas accepted in schema but not persisted to `npc_relationships` table
- **Input moderation**: No content filtering or denylist checks
- **Per-user caps/quotas**: No token/day limits or per-turn maximums enforced
- **Assembly trace logging**: NPC tiers, truncation events not explicitly logged for debugging

---

## Assembler Usage

### Call Sites

| File | Function | Parameters | isFirstTurn | Notes |
|------|----------|------------|-------------|-------|
| `src/api/games.start.post.ts` | handler | `assemblePrompt(assembleArgs, dbAdapter)` | `true` | Line 111-121; first turn bootstrap with entry_start |
| `src/api/games.turns.post.ts` | handler | `assemblePrompt(assembleArgs, dbAdapter)` | `false` | Line 121-133; subsequent turns exclude entry_start |
| `src/services/games.ts` | startGame | `assemblePrompt(assembleArgs, dbAdapter)` | `true` | Line 83-93; service layer game start |
| `backend/src/services/prompts.service.ts` | createInitialPrompt | `databasePromptAssembler.assemblePrompt(params)` | N/A | Line 50-79; uses DatabasePromptAssembler (different path) |
| `backend/src/prompts/wrapper.ts` | assemblePrompt | `PromptWrapper.assemblePrompt(context, gameState, ...)` | Derived | Line 53-109; wrapper with SYSTEM/CORE/WORLD/ADVENTURE/PLAYER/RNG/INPUT sections |

### entry_start Inclusion Logic

**Location**: `src/prompt/assembler/assembler.ts:54-60`

```typescript
if (args.isFirstTurn) {
  const entryStartSegments = await dbAdapter.getSegments('entry_start', args.entryPointId);
  if (entryStartSegments.length > 0) {
    segmentIds.entry_start.push(...entryStartSegments.map(s => s.id));
    parts.push(block('entry_start', entryStartSegments.map(s => s.content).join('\n\n')));
  }
}
```

**Behavior**: Only included when `isFirstTurn === true` and segments exist for the entry point.

### NPC Tier Handling

**Tier Computation**: `src/services/npc.ts:91-96`

```typescript
export function computeTier(rel: NpcRelationship): number {
  const relationshipScore = rel.trust + rel.warmth + rel.respect + rel.romance + rel.awe - rel.fear;
  const tier = Math.floor(relationshipScore / 40);
  return Math.max(0, Math.min(3, tier));
}
```

**Integration**: `src/services/npc.ts:106-127` - buildNpcArgs

- Fetches entry point bindings from `entry_point_npcs` table
- Loads/creates relationships from `npc_relationships` table
- Computes tier per NPC
- Returns `NpcArgs[]` with `{ npcId, tier }`

**Assembler Injection**: `src/prompt/assembler/assembler.ts:63-74`

- Calls `buildNpcBlock(args.npcs, args.npcTokenBudget ?? 600, dbAdapter)`
- Budget default: 600 tokens

**NPC Table Schema**: `db/migrations/20250101_npc_system.sql:42-58`

- `game_id`, `npc_id` (composite PK)
- Relationship fields: trust, warmth, respect, romance, awe, fear, desire
- flags (jsonb), updated_at

---

## APIs

### Endpoints

| Endpoint | Method | File | Returns | Streaming? |
|----------|--------|------|---------|------------|
| `/api/games/start` | POST | `src/api/games.start.post.ts` | Full narrator turn (first) | No |
| `/api/games/:id/turns` | POST | `src/api/games.turns.post.ts` | Full narrator turn | No |
| `/api/games/:id/turn` | POST | `backend/src/routes/games.ts:237` | TurnResult | No |
| `/api/chat/*` | - | Not found | - | - |

### /api/games/start (Legacy)

**Flow**:
1. Validate entry_point_id, fetch entry point
2. Create game record with `turn_count: 0`, `entry_bootstrapped: false`
3. Get NPCs via buildNpcArgs
4. Assemble prompt with `isFirstTurn: true`
5. Call mockModel.generate (or real adapter)
6. Insert narrator turn (idx=1) with prompt_meta, content, costs
7. Mark `state.cold.flags.entry_bootstrapped = true`
8. Increment `turn_count` to 1
9. Return turn response

**Return Shape**: `StartGameResponse { game: { id, ..., meta }, turn: { idx, role, content, prompt_meta } }`

**Streaming Assumptions**: None; returns complete turn immediately.

### /api/games/:id/turns (Legacy)

**Flow**:
1. Validate input, fetch game
2. Create player turn record (idx = turn_count + 1)
3. Insert player turn
4. Get NPCs via buildNpcArgs
5. Assemble prompt with `isFirstTurn: false`, include game.state
6. Call mockModel.generate
7. Insert narrator turn (idx = turn_count + 2)
8. Update `game.turn_count`
9. Return narrator turn

**Return Shape**: `TurnResponse { turn: { idx, role, content, prompt_meta } }`

**Streaming Assumptions**: None; returns complete turn immediately.

### /api/games/:id/turn (Backend)

**Flow**: `backend/src/routes/games.ts:237-328`
1. Validate gameId, request body (optionId, userInput, userInputType)
2. Call `turnsService.runBufferedTurn({ gameId, optionId, userInput, userInputType, idempotencyKey, ownerId, isGuest })`
3. Return TurnResult or error

**Service**: `backend/src/services/turns.service.ts:48` - `runBufferedTurn`

**Characteristics**:
- Already non-streaming (buffered)
- Parses and validates JSON response (line 346-436)
- Transforms AWF format to TurnResponse (line 359)
- Applies turn via gamesService.applyTurn (line 439)
- Returns success/error

**Streaming Assumptions**: None; method is explicitly named "runBufferedTurn".

---

## Model Adapters

### Available Adapters

| Adapter | File | Method | JSON Support | Timeout/Retry |
|---------|------|--------|--------------|---------------|
| Mock | `src/model/modelAdapter.ts:25` | `generate({ prompt, maxTokens, temperature, stop })` | Returns text (not JSON) | None |
| OpenAI (AWF) | `backend/src/model/awf-model-provider.ts:45` | `infer({ system, awf_bundle })` | Yes (`response_format: { type: 'json_object' }`) | None observed |
| OpenAI Service | `backend/src/services/openai.service.ts:29` | `generateBufferedResponse(prompt)` | No (text response) | 3 retries, exponential backoff |
| OpenAI Service | `backend/src/services/openai.service.ts:48` | `generateStreamingResponse(prompt, onToken)` | No (streaming text) | 3 retries, exponential backoff |

### JSON-Only Method

**Yes**: `backend/src/model/awf-model-provider.ts:54-98` - `OpenAIModelProvider.infer`

```typescript
const response = await this.client.chat.completions.create({
  model: this.config.modelName,
  messages: [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify(awf_bundle, null, 2) }
  ],
  temperature: 0.7,
  max_tokens: 2000,
  response_format: { type: 'json_object' } // ← Forces JSON
});

const raw = response.choices[0]?.message?.content || '';
let json: any = undefined;
try {
  json = JSON.parse(raw);
} catch (parseError) {
  console.warn(`[AWF Model] Failed to parse JSON response:`, parseError);
}

return { raw, json };
```

**Behavior**:
- Forces JSON mode via OpenAI response_format
- Returns `{ raw: string, json?: any }`
- Catches parse errors, logs warning, continues (no throw)

### Timeouts/Retries

**OpenAIService**:
- Retries: 3 attempts (maxRetries)
- Backoff: Exponential (baseDelay * 2^(attempt-1))
- Delay: baseDelay not shown; likely 1000ms
- Throws after exhausting retries

**AWF Model Provider**:
- No retry logic
- No timeout configured
- Relies on OpenAI SDK defaults

### Error Shapes

**OpenAIService**: Throws `Error` with message "OpenAI request failed after N attempts: ..."

**AWF Provider**: Throws on API error, logs but does not throw on JSON parse failure.

### JSON Repair

**Location**: `backend/src/services/openai.service.ts:151-167`

**Method**: `repairJSONResponse(malformedResponse, originalPrompt)`

**Behavior**:
- Re-prompts model to fix malformed JSON
- Uses generateBufferedResponse
- Throws if repair fails
- **Currently unused** (no call sites found)

---

## JSON Protocol Readiness

### Existing Schema

**File**: `shared/src/types/api.ts:137-161`

**TurnResponseSchema** (Zod):
```typescript
z.object({
  narrative: z.string().min(1),
  emotion: z.enum(['neutral', 'happy', 'sad', 'angry', 'fearful', 'surprised', 'excited']),
  choices: z.array(z.object({
    id: z.string().uuid(),
    label: z.string().min(1),
    description: z.string().optional(),
  })),
  npcResponses: z.array(z.object({
    npcId: z.string(),
    response: z.string(),
    emotion: z.string(),
  })).optional(),
  worldStateChanges: z.record(z.string(), z.unknown()).optional(),
  relationshipDeltas: z.record(z.string(), z.number()).optional(),
  factionDeltas: z.record(z.string(), z.number()).optional(),
  debug: z.object({...}).optional(),
})
```

**Coverage**: Comprehensive. Includes narrative, choices, NPCs, deltas, debug.

### Current Validation Points

**Server (TurnsService)**: `backend/src/services/turns.service.ts:346-436`

```typescript
// 1. Parse JSON
const parsedResponse = JSON.parse(aiResponseText);

// 2. Transform AWF → TurnResponse
const transformedResponse = await this.transformAWFToTurnResponse(parsedResponse);

// 3. Pre-validation checks (custom)
if (!transformedResponse.narrative || transformedResponse.narrative.trim().length === 0) {
  return { success: false, error: ApiErrorCode.VALIDATION_FAILED, ... };
}
if (transformedResponse.narrative.trim().length < 10) {
  return { success: false, error: ApiErrorCode.VALIDATION_FAILED, ... };
}

// 4. Schema validation
const validationResult = TurnResponseSchema.safeParse(transformedResponse);
if (!validationResult.success) {
  return { success: false, error: ApiErrorCode.VALIDATION_FAILED, ... };
}

aiResponse = validationResult.data;
```

**Adapter**: AWF provider parses JSON, logs warning on failure, returns `{ raw, json? }`.

**Gaps**:
- No validation before applying deltas (validation happens, but deltas applied after in separate step)
- AWF provider does not throw on JSON parse failure (only logs)
- No strict schema validation at adapter layer

### Invalid JSON Handling

**Current Behavior**:
1. TurnsService catches JSON.parse error → returns `{ success: false, error: VALIDATION_FAILED }`
2. AWF provider catches parse error → logs, returns `{ raw, json: undefined }`

**Auto-Repair**:
- `OpenAIService.repairJSONResponse` method exists but **is not called** anywhere in the codebase.

**Recommendation**: Wire up auto-repair as fallback in TurnsService or adapter layer.

---

## State & Deltas

### Where Deltas Are Applied

**Primary Flow**: `backend/src/services/turns.service.ts:438-446`

```typescript
// Apply turn to game state with comprehensive turn data
const turnRecord = await gamesService.applyTurn(gameId, aiResponse, optionId, {
  userInput: userInput || optionId,
  userInputType: userInputType || 'choice',
  promptData: promptData,
  promptMetadata: promptMetadata,
  aiResponseMetadata: aiResponseMetadata,
  processingTimeMs: Date.now() - turnStartTime
});
```

**GamesService.applyTurn**: `backend/src/services/games.service.ts` (signature only found)

**GameStateService.applyActions**: `backend/src/services/game-state.service.ts:194-239`

- Handles actions: MOVE, FLAG_SET, STAT_DELTA, TIME_ADVANCE
- Updates `state.currentScene`, `state.ledgers`, `state.flags`, `state.character.stats`

**NPC Relationship Deltas**:
- Accepted in `TurnResponseSchema.relationshipDeltas` (record<string, number>)
- **No application logic found** to persist to `npc_relationships` table
- Gap: deltas parsed but not saved

**Order**:
1. Player turn inserted
2. Model called
3. JSON parsed + validated
4. Turn record created with aiResponse
5. `gamesService.applyTurn` called
6. Game state updated

**Gaps**:
- NPC relationship deltas not persisted
- Faction deltas not persisted (no `faction_relationships` table found)

### Transaction Notes

**No atomic transaction wrapper observed**:
- Player turn insert (step 1)
- Narrator turn insert (via applyTurn)
- Game state update (via applyTurn)

Each step is separate DB call. If any step fails, prior steps are not rolled back.

**Risk**: Partial failure could leave player turn without narrator response.

**Recommendation**: Wrap in Supabase transaction or implement compensating rollback.

---

## Security/Moderation

### Input Moderation

**Pre-Input Checks**: None found

- No denylist or banned words filter
- No content classification (violence/sexual/hate)
- No provider moderation API call (e.g., OpenAI Moderation API)

**Request Validation**: Basic Zod schema

```typescript
GameTurnRequestSchema.parse({ optionId, userInput?, userInputType? })
```

- optionId must be UUID
- userInput is optional string
- userInputType is optional enum

**Gap**: No content moderation.

### Output Moderation

**Post-Output Checks**: None found

- No moderation of AI-generated narrative
- No filtering of NPC responses
- No safety classifier

**Gap**: Optional post-output moderation not implemented.

### RLS (Row-Level Security)

**Enforcement**: Supabase-level policies (not visible in app code)

**Notes**:
- `games` table: owner_user_id nullable (supports guest games)
- Endpoints check `ownerUserId` matches `game.owner_user_id` (e.g., `src/api/games.turns.post.ts:85-87`)
- Backend routes use `optionalAuth` middleware

**Gap**: RLS policies not audited (outside app scope).

### Caps/Quotas

**Per-User Token Cap**: None found

**Per-Turn Token Cap**: 
- Model max_tokens set to 1000 (legacy) or 2000 (AWF)
- No rejection if user exceeds daily token allowance

**Rate Limiting**: None observed in `/api/games/:id/turn` endpoint

**Gap**: No user-level quotas enforced.

---

## Telemetry/Costs

### Token Recording

**Table**: `turns.costs` (jsonb)

**Schema** (from code):
```json
{
  "prompt_tokens": <number>,
  "completion_tokens": <number>,
  "total_tokens": <number>
}
```

**Source**: `modelResponse.usage` from adapter

**Files**:
- `src/api/games.start.post.ts:148-150` (costs populated from mockModel.usage)
- `src/api/games.turns.post.ts:158-162` (costs populated)

### Metadata Recording

**Table**: `turns.prompt_meta` (jsonb)

**Schema**:
```json
{
  "segments_used": { "core": [1, 2], "ruleset": [3], ... },
  "tokens_estimated": <number>,
  "truncated": <object>,
  "order": ["core", "ruleset", ...]
}
```

**Source**: `assemblePrompt` returns `{ prompt, meta }`

**Enhanced Columns** (from migration `supabase/migrations/20250107_enhance_turn_recording.sql:6-10`):
- user_prompt (TEXT)
- narrative_summary (TEXT)
- is_initialization (BOOLEAN)
- session_id (UUID)
- sequence (INTEGER)

**Analytics Table**: `turn_analytics` (separate table)
- raw_ai_response (JSONB)
- raw_user_prompt (TEXT)
- raw_system_prompt (TEXT)
- model_identifier (VARCHAR)
- token_count (INTEGER)
- processing_time_ms (INTEGER)
- prompt_metadata (JSONB)
- response_metadata (JSONB)

**Current Usage**: Enhanced columns added but not fully populated in all code paths.

### Assembly Trace Logging

**What's Logged**:
- Segment IDs by scope (prompt_meta.segments_used)
- Token estimation (prompt_meta.tokens_estimated)
- Truncation events (prompt_meta.truncated)

**What's Missing**:
- NPC tier per NPC (which NPC got which tier)
- Relationship scores used for tier computation
- Truncation specifics (which segment was truncated, by how many tokens)

**Recommendation**: Add `npc_tiers` field to prompt_meta with `{ "npc.kiera": 2, "npc.thorne": 1 }`.

---

## UI

### Pages/Components

| Component | File | Purpose | Streaming? |
|-----------|------|---------|------------|
| UnifiedGamePage | `frontend/src/pages/UnifiedGamePage.tsx` | Main game UI | No |
| GamePlayPage | `frontend/src/pages/GamePlayPage.tsx` | Simple game play | No |
| GamePage | `frontend/src/pages/GamePage.tsx` | Alternative game UI | No |
| HistoryFeed | `frontend/src/components/gameplay/HistoryFeed.tsx` | Turn history display | No |
| TurnInput | `frontend/src/components/gameplay/TurnInput.tsx` | Player input form | No |
| ChoiceButtons | `frontend/src/components/gameplay/ChoiceButtons.tsx` | AI choice selection | No |

### Chat Routes

**No `/chat` routes found**. Existing pages use `/game/:gameId` or similar.

### Streaming Assumptions

**UnifiedGamePage** (`frontend/src/pages/UnifiedGamePage.tsx:686-688`):
```tsx
{isSubmittingTurn && (
  <RefreshCw className="h-4 w-4 animate-spin" />
)}
```

**Pattern**: useMutation + refetch + loading state

**No streaming**: No SSE, no WebSocket, no fetch with ReadableStream.

**Compatible**: UI already shows "processing..." indicator. Non-streaming JSON fits perfectly.

### Debug/Inspector

**No debug inspector found** for prompt_meta or raw JSON.

**Recommendation**: Add optional debug panel to display prompt assembly, raw JSON, token counts.

---

## Caching & Performance

### Static-Stack Cache

**Current Caching**:

| Layer | File | Strategy | TTL |
|-------|------|----------|-----|
| Prompt segments | `backend/src/repositories/prompt.repository.ts:169-185` | In-memory Map | 5 min |
| AWF bundle docs | `backend/src/assemblers/awf-bundle-assembler-cached.ts:272-316` | loadWithCache (core, world, adventure) | 1 hour |
| Compacted slices | `backend/src/assemblers/awf-bundle-assembler-cached.ts:321-359` | loadSlicesWithCache | 30 min |

**Cache Provider**: `backend/src/cache/CacheProvider.ts:23-95` - InMemoryCacheProvider (LRU)

**Invalidation**:
- PromptRepository: manual `clearCache()`
- AWF bundle: hash-based (cache key includes hash)

### Static-Stack Potential

**Cacheable Layers** (do not change per turn):
- core
- ruleset
- world
- entry

**Dynamic Layers** (change per turn):
- entry_start (first turn only)
- npc (tier may change)
- game_state
- player
- rng
- input

**Recommendation**: Cache assembled "core+ruleset+world+entry" as single blob. Append dynamic layers per turn.

**File**: Could extend `backend/src/assemblers/awf-bundle-assembler-cached.ts` or `backend/src/repositories/prompt.repository.ts` to cache static prefix.

### Performance Notes

**No observed bottlenecks** in read-only audit.

**Budget enforcement**: `backend/src/config/awf-budgets.ts:74-202` - TokenBudgetEnforcer already implements orderly trimming.

---

## Risks

### Top 5 Risks

1. **JSON Validation Gap**: Deltas applied after validation, not before. Invalid deltas could corrupt game state.
   - **Mitigation**: Move validation before applyTurn; reject entire turn if invalid.

2. **No Transaction Wrapper**: Player turn + narrator turn + state update are separate DB calls. Partial failure leaves inconsistent state.
   - **Mitigation**: Wrap in Supabase transaction (`.rpc('begin')`, `.rpc('commit')`, `.rpc('rollback')`).

3. **NPC Relationship Deltas Not Persisted**: Schema accepts deltas, but no code updates `npc_relationships` table.
   - **Mitigation**: Add delta persistence in applyTurn or GameStateService.

4. **No Input/Output Moderation**: User could submit harmful content; AI could generate unsafe content.
   - **Mitigation**: Add OpenAI Moderation API call pre-input and optional post-output.

5. **Long-Running Requests**: No timeout on model calls; user could wait indefinitely.
   - **Mitigation**: Set request timeout (30s) and abort signal on fetch/OpenAI client.

---

## Questions/Unknowns

1. **Which assembler is production?** Multiple assemblers exist (src/prompt/assembler, backend/prompts/database-prompt-assembler, backend/prompts/wrapper). Which is actively used for chat?

2. **AWF vs legacy?** AWF system (Action-Word-Format) appears newer. Is chat using AWF or legacy assembler?

3. **RLS policies?** Supabase RLS mentioned but policies not visible in app code. Need to audit `supabase/policies.sql` or dashboard.

4. **Faction deltas?** `TurnResponseSchema.factionDeltas` accepted but no `faction_relationships` table found. Ignored or placeholder?

5. **Auto-repair wiring?** `OpenAIService.repairJSONResponse` exists but unused. Should it be wired into TurnsService?

---

## Next Steps

See `CHAT_GAP_PLAN.md` for actionable implementation plan.

