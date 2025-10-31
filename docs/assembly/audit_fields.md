# Assembly Audit Fields Reference
## Phase 1: Scenario Support

**Last Updated**: January 30, 2025

This document describes the structured audit trail fields emitted by the prompt assembler.

---

## AssemblyAudit Type

```typescript
type AssemblyAudit = {
  assembledAt: string;
  context: AssemblyContext;
  scopes: AuditScopeDetail[];
  policyNotes: string[];
  summary: string;
};
```

---

## Field Definitions

### `assembledAt` (string)

- **Format**: ISO 8601 timestamp
- **Example**: `"2025-01-30T12:00:00.000Z"`
- **Purpose**: Timestamp when prompt was assembled
- **Usage**: Audit trail, debugging, performance tracking

### `context` (AssemblyContext)

```typescript
type AssemblyContext = {
  isFirstTurn: boolean;
  worldSlug?: string;
  scenarioSlug?: string;
  entryPointId?: string;
};
```

#### Fields:

- **`isFirstTurn`** (boolean): Whether this is the first turn of a game session
  - `true`: Includes `entry_start` segments
  - `false`: Excludes `entry_start` segments
- **`worldSlug`** (string, optional): World identifier (e.g., `"mystika"`)
- **`scenarioSlug`** (string, optional): Scenario identifier (Phase 1, e.g., `"whispercross_scenario"`)
- **`entryPointId`** (string, optional): Entry point identifier (e.g., `"ep.mystika.whispercross"`)

### `scopes` (Array<AuditScopeDetail>)

Per-scope token accounting and metadata.

```typescript
type AuditScopeDetail = {
  scope: Scope;
  segmentCount: number;
  tokensBeforeTruncation: number;
  tokensAfterTruncation: number;
  dropped: boolean;
};
```

#### Fields:

- **`scope`** (Scope): Scope name (e.g., `"core"`, `"scenario"`, `"npc"`)
- **`segmentCount`** (number): Number of database segments included (0 for dynamic scopes)
- **`tokensBeforeTruncation`** (number): Token count before budget enforcement
- **`tokensAfterTruncation`** (number): Token count after budget enforcement
- **`dropped`** (boolean): Whether entire scope was dropped due to budget constraints

#### Example:

```json
{
  "scope": "scenario",
  "segmentCount": 3,
  "tokensBeforeTruncation": 1500,
  "tokensAfterTruncation": 1500,
  "dropped": false
}
```

### `policyNotes` (Array<string>)

Array of policy warnings emitted during assembly.

#### Phase 1 Policy Warning Codes:

**`SCENARIO_POLICY_UNDECIDED`**

- **Trigger**: Scenario present AND budget utilization > 90%
- **Meaning**: Scenario truncation priority not defined; using default behavior
- **Example**:
  ```
  "SCENARIO_POLICY_UNDECIDED: Scenario truncation priority not defined. Budget utilization: 95.0%. Scenario may be dropped if severely over budget (>150%)."
  ```

**`SCENARIO_DROPPED`**

- **Trigger**: Scenario scope dropped due to severe budget overrun (>150% of budget)
- **Meaning**: Scenario was removed to meet budget constraints
- **Example**:
  ```
  "SCENARIO_DROPPED: Scenario scope dropped due to severe budget overrun (>150%)."
  ```

### `summary` (string)

Human-readable summary of the assembly.

#### Format:

```
Assembled prompt with {scopeCount} scopes. Total tokens: {tokensAfter} [{reductionPercent}% reduction from {tokensBefore}]. [Dropped scopes: {droppedScopesList}]. [Scenario: {scenarioSlug}]
```

#### Examples:

**No truncation**:
```
"Assembled prompt with 10 scopes. Total tokens: 8200. Scenario: whispercross_scenario"
```

**With truncation**:
```
"Assembled prompt with 10 scopes. Total tokens: 7900 (6.0% reduction from 8400). Scenario: whispercross_scenario"
```

**With dropped scopes**:
```
"Assembled prompt with 8 scopes. Total tokens: 7500 (15.0% reduction from 8800). Dropped scopes: npc. Scenario: whispercross_scenario"
```

---

## Budget Accounting

### Token Estimation

- **Heuristic**: ~4 characters per token
- **Function**: `estimateTokens(text: string): number`
- **Accuracy**: ±20% (simple approximation)

### Per-Scope Token Calculation

**Function**: `calculatePerScopeTokens(prompt: string): Record<string, number>`

**Method**: Regex matching on scope delimiters:
```
=== {SCOPE}_BEGIN ===
{content}
=== {SCOPE}_END ===
```

**Output**: Map of scope names to token counts

**Example**:
```typescript
{
  "core": 1200,
  "world": 2400,
  "scenario": 1500,
  "entry": 600,
  "npc": 900
}
```

---

## Truncation Priority (Current)

**Order** (highest priority first):

1. **INPUT** (trim to 10% of budget)
2. **GAME_STATE** (compress to 5% of budget)
3. **NPC** (reduce tiers, then drop entire scope)
4. **WORLD** (drop only if severely over budget, >150%)
5. **SCENARIO** (drop only if severely over budget, >150%) ← Phase 1: Same as entry
6. **ENTRY** (drop only if severely over budget, >150%)

**NEVER DROPPED**:
- **CORE**: System-wide rules
- **RULESET**: Ruleset mechanics

---

## Usage Examples

### Checking for Scenario Policy Warnings

```typescript
if (result.meta.audit?.policyNotes.some(note => note.startsWith('SCENARIO_POLICY_UNDECIDED'))) {
  console.warn('Scenario policy undecided - budget may be tight');
}
```

### Calculating Truncation Impact

```typescript
const audit = result.meta.audit;
const scenarioDetail = audit?.scopes.find(s => s.scope === 'scenario');

if (scenarioDetail) {
  const reduction = scenarioDetail.tokensBeforeTruncation - scenarioDetail.tokensAfterTruncation;
  if (reduction > 0) {
    console.log(`Scenario truncated by ${reduction} tokens`);
  }
}
```

### Displaying Human-Readable Summary

```typescript
const summary = result.meta.audit?.summary || 'No audit available';
console.log(summary);
// Output: "Assembled prompt with 10 scopes. Total tokens: 7900 (6.0% reduction from 8400). Scenario: whispercross_scenario"
```

---

## Future Enhancements (Post-Phase 1)

- **Explicit scenario truncation priority** (between entry and npc)
- **Scenario_start scope** (first-turn only scenario content)
- **RAG retrieval accounting** (dynamic content injection)
- **Multi-model token estimation** (GPT-4, Claude, etc.)
- **Real-time token budget monitoring** (WebSocket updates)

---

## Related Documentation

- `docs/prompt-system-discovery-addendum.md` - Codebase findings
- `docs/examples/audits/scenario_first_turn.json` - First turn audit example
- `docs/examples/audits/scenario_ongoing.json` - Ongoing turn audit example
- `src/prompt/assembler/budget.ts` - Budget implementation
- `src/prompt/assembler/types.ts` - Type definitions

