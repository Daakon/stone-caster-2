# Chat E2E (Non-Streaming JSON) — Gap & Implementation Plan

**Date**: 2025-01-21  
**Status**: PLANNING (No code changes)  
**Goal**: Deliver non-streaming chat endpoint with full JSON validation, delta application, and telemetry

---

## Target Behavior (Non-Streaming JSON)

### Contract

```
Client → POST /api/chat/turn
  { gameId, input, idempotencyKey }

Server:
  1. Assemble full prompt (core → ruleset → world → entry → entry_start (turn 1) → npc → game_state → player → rng → input)
  2. Call model (OpenAI with response_format: json_object)
  3. Model returns strict JSON (one payload, no streaming)
  4. Validate JSON against TurnResponseSchema
  5. Apply deltas atomically (relationships, flags, state)
  6. Persist: player turn + narrator turn + costs + metadata
  7. Return final narrator turn to client

Client: Displays "processing..." → receives full turn → renders
```

### Key Characteristics

- **Non-streaming**: Client waits for complete response
- **Strict JSON**: Model must return valid TurnResponseSchema or turn fails
- **Atomic**: Turn insert + delta application + state update in single transaction
- **Validated deltas**: Schema validation before applying any state changes
- **Telemetry**: Full trace of assembly, tokens, NPC tiers, deltas

---

## Critical Gaps & Tasks

### Gap 1: JSON Schema + Validation (Adapter + API)

**Why It Matters**: Current flow parses JSON and validates, but validation happens after turn creation. Invalid JSON could corrupt state.

**Where**:
- `backend/src/model/awf-model-provider.ts:84-89` (logs parse failure, does not throw)
- `backend/src/services/turns.service.ts:346-436` (validates after parsing)

**What**:
1. Create strict JSON validator at adapter layer:
   - File: `backend/src/adapters/json-model-adapter.ts`
   - Method: `generateJson(prompt: string, schema: ZodSchema): Promise<{ json: T, raw: string, tokens: TokenUsage }>`
   - Behavior: Parse → validate → throw if invalid → return typed object
2. Wire auto-repair:
   - On JSON.parse failure → call `OpenAIService.repairJSONResponse`
   - Retry once → throw if repair fails
3. Update TurnsService to use strict validator:
   - Call `adapter.generateJson(prompt, TurnResponseSchema)`
   - Remove manual JSON.parse + safeParse steps (handled in adapter)
   - Validation guaranteed before applyTurn

**Owner/Role**: Backend (adapters + services)

**Effort**: M (3-5 hours)

**Dependencies**: None

**Acceptance**:
- [ ] Adapter throws on invalid JSON (no silent failures)
- [ ] Auto-repair attempted once on parse failure
- [ ] TurnsService receives typed, validated object
- [ ] Unit test: malformed JSON → auto-repair → success
- [ ] Unit test: irreparable JSON → throw TurnValidationError

---

### Gap 2: Adapter Method for JSON Output

**Why It Matters**: Confirm OpenAI adapter uses `response_format: json_object` consistently.

**Where**:
- `backend/src/model/awf-model-provider.ts:54-98` (already has it!)
- `backend/src/services/openai.service.ts:92-134` (does NOT have it)

**What**:
1. Extend OpenAIService with JSON-only method:
   - Method: `generateJsonResponse(prompt: string, schema?: ZodSchema): Promise<{ content: any, usage }>`
   - Add `response_format: { type: 'json_object' }` to request
   - Parse response.choices[0].message.content as JSON
   - Optionally validate against schema if provided
2. Update TurnsService to use new method:
   - Replace `generateTurnResponse` call with `openaiService.generateJsonResponse(prompt, TurnResponseSchema)`

**Owner/Role**: Backend (openai.service.ts, turns.service.ts)

**Effort**: S (1-2 hours)

**Dependencies**: None

**Acceptance**:
- [ ] OpenAIService.generateJsonResponse exists
- [ ] Always sets `response_format: { type: 'json_object' }`
- [ ] Returns parsed JSON object
- [ ] Optional schema validation before return
- [ ] Unit test: valid JSON → returns object
- [ ] Unit test: invalid JSON → throws

---

### Gap 3: Turn Handler Flow (Apply Deltas Atomically)

**Why It Matters**: Current flow: player turn insert → model call → narrator turn insert → delta application. No transaction wrapper. Partial failure leaves inconsistent state.

**Where**:
- `backend/src/services/turns.service.ts:48-542` (runBufferedTurn)
- `backend/src/services/games.service.ts` (applyTurn)

**What**:
1. Wrap turn flow in Supabase transaction:
   ```typescript
   const { data, error } = await supabase.rpc('begin_transaction');
   try {
     // 1. Insert player turn
     // 2. Assemble prompt
     // 3. Call model
     // 4. Validate JSON
     // 5. Insert narrator turn
     // 6. Apply deltas (relationships, flags, state)
     // 7. Update turn_count
     await supabase.rpc('commit_transaction');
   } catch (err) {
     await supabase.rpc('rollback_transaction');
     throw err;
   }
   ```
   - **Note**: Supabase does not expose .rpc('begin'). Alternative: use Postgres function that wraps entire operation.
2. Create stored procedure `turn_atomic_apply`:
   - Input: gameId, playerInput, narratorContent, deltas, costs
   - Steps: insert player turn → insert narrator turn → update game state → update relationships → return narrator turn
   - Output: narrator turn row
3. Update TurnsService to call stored procedure:
   - Replace multi-step flow with single `.rpc('turn_atomic_apply', params)`

**Owner/Role**: Backend (database + services)

**Effort**: M (4-6 hours; includes writing + testing stored procedure)

**Dependencies**: None

**Acceptance**:
- [ ] Turn insert + delta application wrapped in transaction
- [ ] Rollback on any failure (no partial state)
- [ ] Unit test: model failure → no player turn persisted
- [ ] Unit test: delta failure → rollback narrator turn
- [ ] Integration test: full turn → all state updated atomically

---

### Gap 4: Moderation & Caps

**Why It Matters**: No content moderation or user quotas. Risk of abuse or harmful content.

**Where**: None (gap)

**What**:
1. **Input Moderation** (pre-input check):
   - File: `backend/src/services/moderation.service.ts`
   - Method: `moderateInput(text: string): Promise<{ flagged: boolean, categories: string[] }>`
   - Provider: OpenAI Moderation API (`https://api.openai.com/v1/moderations`)
   - Behavior: POST { input: text } → check flagged → reject if true
   - Wire into TurnsService before prompt assembly
2. **Output Moderation** (optional post-output):
   - Method: `moderateOutput(narrative: string): Promise<{ flagged: boolean }>`
   - Optional; only enabled if `ENABLE_OUTPUT_MODERATION=true`
   - Reject turn if flagged
3. **Per-User Token Cap**:
   - Table: `user_quotas` (user_id, daily_token_limit, tokens_used_today, reset_at)
   - Check before turn: `SELECT tokens_used_today FROM user_quotas WHERE user_id = $1 AND reset_at > now()`
   - Reject if `tokens_used_today + estimated_prompt_tokens > daily_token_limit`
   - Increment `tokens_used_today` after turn
4. **Per-Turn Token Cap**:
   - Enforce max_tokens = 2000 (output)
   - Enforce max prompt tokens = 8000 (AWF budget config already exists)
   - Reject turn if prompt exceeds budget

**Owner/Role**: Backend (moderation.service.ts, turns.service.ts, database migration)

**Effort**: L (6-8 hours; includes moderation API integration + quota table + tests)

**Dependencies**: OpenAI Moderation API key

**Acceptance**:
- [ ] Input moderation rejects harmful content (hate, violence, sexual)
- [ ] Output moderation optional, configurable
- [ ] Per-user daily token cap enforced
- [ ] Per-turn token cap enforced
- [ ] Unit test: flagged input → 400 MODERATION_REJECTED
- [ ] Unit test: over quota → 402 INSUFFICIENT_QUOTA

---

### Gap 5: Token Accounting (turns.tokens_in/out)

**Why It Matters**: Current flow records costs in `turns.costs` jsonb. Need explicit tokens_in/tokens_out columns for analytics.

**Where**:
- `db/migrations/20250130000000_core_schema.sql:93-102` (turns table)
- `supabase/migrations/20250107_enhance_turn_recording.sql:6-10` (enhanced columns)

**What**:
1. Add columns to turns table:
   ```sql
   ALTER TABLE turns ADD COLUMN tokens_in INTEGER;
   ALTER TABLE turns ADD COLUMN tokens_out INTEGER;
   ALTER TABLE turns ADD COLUMN cost_usd NUMERIC(10,6);
   ```
2. Update TurnsService to populate columns:
   - `tokens_in = modelResponse.usage.prompt_tokens`
   - `tokens_out = modelResponse.usage.completion_tokens`
   - `cost_usd = (tokens_in * RATE_INPUT + tokens_out * RATE_OUTPUT)`
   - Keep existing `costs` jsonb for compatibility
3. Index for analytics:
   ```sql
   CREATE INDEX idx_turns_tokens_in ON turns(tokens_in);
   CREATE INDEX idx_turns_tokens_out ON turns(tokens_out);
   CREATE INDEX idx_turns_cost_usd ON turns(cost_usd);
   ```

**Owner/Role**: Backend (migration + services)

**Effort**: S (1-2 hours)

**Dependencies**: None

**Acceptance**:
- [ ] turns.tokens_in populated on every turn
- [ ] turns.tokens_out populated on every turn
- [ ] turns.cost_usd calculated correctly
- [ ] Indexes created for analytics queries
- [ ] Backward compatible with existing costs jsonb

---

### Gap 6: UI "Processing" UX

**Why It Matters**: UI already shows spinner during turn submission. Need to ensure "processing..." message is clear.

**Where**:
- `frontend/src/pages/UnifiedGamePage.tsx:686-688`
- `frontend/src/components/gameplay/TurnInput.tsx`

**What**:
1. Update TurnInput component:
   - Show "Generating response..." message below spinner
   - Disable input field during submission
   - Show estimated time (e.g., "~10 seconds")
2. Add error handling:
   - Display error message if turn fails
   - Retry button for transient errors
3. No changes needed for streaming (already non-streaming)

**Owner/Role**: Frontend

**Effort**: S (1 hour)

**Dependencies**: None

**Acceptance**:
- [ ] "Processing..." message visible during turn
- [ ] Input disabled during turn
- [ ] Error message displayed on failure
- [ ] Retry button for 500/503 errors

---

### Gap 7: Telemetry Additions

**Why It Matters**: Need assembly trace (segment IDs, NPC tiers, truncation) for debugging.

**Where**:
- `backend/src/services/turns.service.ts` (prompt_meta population)
- `src/prompt/assembler/assembler.ts:34-104` (meta returned)

**What**:
1. Enhance prompt_meta to include:
   ```json
   {
     "segments_used": { "core": [1,2], "npc": [8,9], ... },
     "tokens_estimated": 3456,
     "truncated": { "game_state": { "original": 500, "final": 300 } },
     "npc_tiers": { "npc.kiera": 2, "npc.thorne": 1 },
     "assembly_trace": {
       "npcs_included": ["npc.kiera", "npc.thorne"],
       "relationship_scores": { "npc.kiera": 85, "npc.thorne": 42 },
       "truncation_events": [
         { "scope": "game_state", "original_tokens": 500, "final_tokens": 300 }
       ]
     }
   }
   ```
2. Update assembler to collect NPC tier info:
   - File: `src/prompt/assembler/npc.ts` (buildNpcBlock)
   - Add `npcTiers` to metadata
   - Add relationship scores for debugging
3. Log to turn_analytics table (optional):
   - Insert row with raw prompt, raw response, metadata
   - Useful for debugging failed turns

**Owner/Role**: Backend (assembler + services)

**Effort**: M (3-4 hours)

**Dependencies**: None

**Acceptance**:
- [ ] prompt_meta.npc_tiers populated
- [ ] prompt_meta.assembly_trace includes relationship scores
- [ ] Truncation events logged with before/after tokens
- [ ] turn_analytics row created for every turn (optional)

---

### Gap 8: Optional Cache for Static Stack

**Why It Matters**: core + ruleset + world + entry do not change per turn. Caching static prefix reduces assembly time.

**Where**:
- `backend/src/assemblers/awf-bundle-assembler-cached.ts` (already caches docs)
- `backend/src/repositories/prompt.repository.ts:169-185` (prompt cache)

**What**:
1. Cache static prefix (core + ruleset + world + entry):
   - Cache key: `static_prefix:{worldId}:{rulesetId}:{entryPointId}`
   - TTL: 1 hour
   - Contents: assembled markdown for core, ruleset, world, entry sections
   - Invalidate on prompt segment update
2. Assemble dynamic layers per turn:
   - Load cached static prefix
   - Append: entry_start (if first turn), npc, game_state, player, rng, input
   - Return full prompt
3. Wire into assembler:
   - File: `src/prompt/assembler/assembler.ts`
   - Method: `assemblePromptCached(args, dbAdapter)`
   - Check cache → hit: load prefix + append dynamic → miss: assemble full + cache prefix

**Owner/Role**: Backend (assembler + cache)

**Effort**: M (4-5 hours)

**Dependencies**: Cache provider (already exists)

**Acceptance**:
- [ ] Static prefix cached on first turn
- [ ] Subsequent turns load from cache (faster assembly)
- [ ] Cache invalidated on prompt segment update
- [ ] Unit test: first turn → miss → cache populated
- [ ] Unit test: second turn → hit → faster assembly
- [ ] Metrics: cache hit rate logged

---

## Proposed JSON Schema (v1)

**File**: `shared/src/types/api.ts:137-161` (already exists!)

**TurnResponseSchema** (Zod):
```typescript
export const TurnResponseSchema = z.object({
  narrative: z.string().min(1).max(10000),
  emotion: z.enum(['neutral', 'happy', 'sad', 'angry', 'fearful', 'surprised', 'excited']),
  choices: z.array(z.object({
    id: z.string().uuid(),
    label: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
  })).max(10),
  npcResponses: z.array(z.object({
    npcId: z.string(),
    response: z.string().max(1000),
    emotion: z.string(),
  })).max(20).optional(),
  worldStateChanges: z.record(z.string(), z.unknown()).optional(),
  relationshipDeltas: z.record(z.string(), z.number().int().min(-100).max(100)).optional(),
  factionDeltas: z.record(z.string(), z.number().int().min(-100).max(100)).optional(),
  debug: z.object({
    promptState: z.record(z.string(), z.unknown()).optional(),
    promptText: z.string().optional(),
    aiResponseRaw: z.string().optional(),
    processingTime: z.number().optional(),
    tokenCount: z.number().optional(),
  }).optional(),
});
```

**Changes from Existing**:
- Added `.max()` constraints for safety (prevent abuse)
- `relationshipDeltas`: constrain to -100 to +100 per turn
- `factionDeltas`: constrain to -100 to +100 per turn
- Otherwise identical

**Acceptance**: No schema changes needed unless constraints desired.

---

## Risk Mitigations

### Risk 1: Invalid JSON Handling

**Risk**: Model returns malformed JSON; turn fails.

**Mitigation**:
1. Use `response_format: { type: 'json_object' }` (OpenAI forces valid JSON)
2. Single auto-repair attempt via `OpenAIService.repairJSONResponse`
3. Fallback: return 422 VALIDATION_FAILED with raw response in details for debugging

**Acceptance**:
- [ ] 99% of turns return valid JSON (OpenAI enforces)
- [ ] Auto-repair recovers 80% of remaining 1%
- [ ] Final failure rate < 0.2%

---

### Risk 2: Long-Running Requests

**Risk**: Model call hangs indefinitely; user waits forever.

**Mitigation**:
1. Set request timeout: 30 seconds
2. OpenAI client abort signal:
   ```typescript
   const controller = new AbortController();
   setTimeout(() => controller.abort(), 30000);
   await openai.chat.completions.create({ ..., signal: controller.signal });
   ```
3. Return 504 GATEWAY_TIMEOUT if timeout exceeded
4. Client retries with exponential backoff (max 3 retries)

**Acceptance**:
- [ ] Timeout set to 30s
- [ ] Request aborted after timeout
- [ ] Client receives 504, retries with backoff
- [ ] Manual retry button available

---

### Risk 3: Data Races

**Risk**: Concurrent turns on same game; state corrupted.

**Mitigation**:
1. Idempotency key required (already in place)
2. Database lock on games table:
   ```sql
   SELECT * FROM games WHERE id = $1 FOR UPDATE;
   ```
3. Reject concurrent turns with 409 CONFLICT
4. Client prevents double-submit via disabled button

**Acceptance**:
- [ ] Idempotency key prevents duplicate turns
- [ ] Database lock prevents concurrent state updates
- [ ] 409 CONFLICT returned for concurrent requests
- [ ] Client button disabled during submission

---

### Risk 4: Prompt Injection

**Risk**: User inputs prompt markers (e.g., `=== CORE_BEGIN ===`) to hijack AI.

**Mitigation**:
1. Strip/escape user block markers:
   ```typescript
   const sanitized = input.replace(/===\s*\w+_(BEGIN|END)\s*===/g, '');
   ```
2. Wrap user input in strict delimiters:
   ```
   === INPUT_BEGIN ===
   [user input here, no processing]
   === INPUT_END ===
   ```
3. Prompt model to ignore instructions in INPUT section

**Acceptance**:
- [ ] User input sanitized (block markers removed)
- [ ] Input wrapped in strict delimiters
- [ ] Model instructions updated to ignore user directives
- [ ] Unit test: user inputs `=== CORE_BEGIN ===` → stripped

---

## Cut Lines

### Minimal Viable Changes (MVP)

**Must Have** (Ship chat):
1. Gap 1: JSON schema + validation (adapter layer)
2. Gap 2: Adapter method for JSON output
3. Gap 3: Turn handler flow (atomic transaction)
4. Gap 5: Token accounting (tokens_in/tokens_out)
5. Gap 6: UI "processing" UX

**Total Effort**: ~15-20 hours

---

### Nice-to-Have Enhancers (Post-MVP)

**Should Have** (Ship soon after):
1. Gap 4: Moderation & caps (input/output moderation, quotas)
2. Gap 7: Telemetry additions (NPC tiers, assembly trace)
3. Risk 2: Long-running request timeouts
4. Risk 4: Prompt injection safeguards

**Could Have** (Later):
1. Gap 8: Optional cache for static stack
2. Auto-repair UI feedback ("AI response repaired")
3. Debug inspector panel (show prompt_meta, raw JSON)

**Total Effort**: ~15-20 hours additional

---

## Acceptance Checklist

**Non-Streaming JSON Chat Ready** when:

- [ ] **1. JSON Adapter**: `adapter.generateJson(prompt, schema)` exists and throws on invalid JSON
- [ ] **2. Auto-Repair**: Single repair attempt on parse failure
- [ ] **3. Atomic Turns**: Turn insert + delta application wrapped in transaction
- [ ] **4. Deltas Applied**: NPC relationshipDeltas persisted to `npc_relationships` table
- [ ] **5. Token Accounting**: `turns.tokens_in`, `turns.tokens_out`, `turns.cost_usd` populated
- [ ] **6. Validation Before Deltas**: Schema validation happens before `applyTurn` call
- [ ] **7. UI Processing Indicator**: "Generating response..." message shown, input disabled
- [ ] **8. Error Handling**: 422/500/504 errors displayed with retry button
- [ ] **9. Timeout**: 30s request timeout with abort signal
- [ ] **10. Prompt Injection**: User input sanitized (block markers stripped)
- [ ] **11. Unit Tests**: All gaps have passing unit tests
- [ ] **12. Integration Test**: Full turn flow (input → JSON → deltas → response) end-to-end
- [ ] **13. Load Test**: 10 concurrent turns on same game → all succeed or fail gracefully
- [ ] **14. Docs Updated**: API_CONTRACT.md, TEST_PLAN.md, FEATURES.md reflect chat endpoint

---

## Implementation Order

**Recommended Sequence**:

1. **Gap 2** (Adapter JSON method) — Foundation (1-2 hrs)
2. **Gap 1** (JSON validation) — Build on #1 (3-5 hrs)
3. **Gap 5** (Token accounting) — Independent, quick win (1-2 hrs)
4. **Gap 3** (Atomic transaction) — Core correctness (4-6 hrs)
5. **Gap 6** (UI processing UX) — User-facing polish (1 hr)
6. **Risk 2** (Timeout) — Safety (1 hr)
7. **Risk 4** (Prompt injection) — Safety (1 hr)
8. **Gap 4** (Moderation & caps) — Post-MVP (6-8 hrs)
9. **Gap 7** (Telemetry) — Post-MVP (3-4 hrs)
10. **Gap 8** (Cache) — Post-MVP (4-5 hrs)

**Total MVP**: ~13-17 hours  
**Total with Post-MVP**: ~28-37 hours

---

## Open Questions

1. **Which assembler is canonical?** Clarify if production uses `src/prompt/assembler/assembler.ts` (legacy) or `backend/assemblers/awf-bundle-assembler-cached.ts` (AWF). Answer informs where to add cache.

2. **Faction deltas?** `TurnResponseSchema.factionDeltas` accepted but no `faction_relationships` table. Should we create table or remove from schema?

3. **AWF migration status?** Is chat using AWF (Action-Word-Format) or legacy assembler? Affects which adapter to extend.

4. **Supabase transaction support?** Supabase client does not expose `.rpc('begin')`. Need to confirm if stored procedure approach is acceptable or if app-level rollback is preferred.

5. **OpenAI Moderation API key?** Required for Gap 4 (input moderation). Does project have API key? Fallback: simple denylist if API unavailable.

---

## Conclusion

The codebase is **80% ready** for non-streaming JSON chat. Key strengths:

- Assembler works correctly (entry_start, NPC tiers)
- OpenAI adapter already has `response_format: json_object`
- TurnsService is non-streaming (buffered)
- UI is compatible (no streaming assumptions)
- Token accounting structure exists

Key gaps to close:

1. Strict JSON validation at adapter layer
2. Atomic transaction wrapper for turn flow
3. NPC relationship delta persistence
4. Token accounting columns
5. Input moderation & quotas (post-MVP)

With **15-20 hours of focused work** (MVP gaps 1-3, 5-6), the chat endpoint will be production-ready for non-streaming JSON chat.

See `CHAT_AUDIT.md` for detailed findings.

