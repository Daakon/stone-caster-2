# StoneCaster Prompt System Discovery Addendum
## Codebase Findings for Phase 1 Implementation

**Date**: January 30, 2025  
**Purpose**: Document actual implementation details discovered from codebase analysis for Scenario Prompt Infrastructure (Phase 1)

---

## 1. Token Budgeting Priority Sequence

**Location**: `src/prompt/assembler/budget.ts:107-210`

### Current Truncation Policy (Exact Order)

When token budget is exceeded, the system applies truncation in this priority:

1. **INPUT text** (trim to 10% of budget, ~800 chars for 8000 token budget)
   - Preserves first and last portions of user input
   - Middle section truncated with indicator

2. **GAME_STATE** (compress to 5% of budget, ~400 chars)
   - Summarizes game state history
   - Adds compression indicator

3. **NPC tiers** (reduce detail level)
   - Progressively drops higher tiers (3 → 2 → 1 → 0)
   - Per-NPC tier drop tracking

4. **NPC scope** (drop entire block)
   - Only if still over budget after tier reduction
   - Marked in `droppedScopes` array

5. **WORLD and ENTRY** (drop as absolute last resort)
   - **Only if > 1.5x over budget** (> 12,000 tokens for 8000 budget)
   - Drops in order: world first, then entry
   - Extremely rare - indicates severe content bloat

### Scopes NEVER Dropped

- **CORE**: System-wide rules (always preserved)
- **RULESET**: Ruleset mechanics (always preserved)

### Scenario Placement in Truncation Policy

**Current State**: Scenario is **NOT explicitly handled** in truncation logic

**Discovery**: The `applyTruncationPolicy` function (lines 123-209) uses regex matching on scope names:
```typescript
const scopeMatch = new RegExp(`=== ${scope.toUpperCase()}_BEGIN ===\\n.*?\\n=== ${scope.toUpperCase()}_END ===`, 's');
```

This means scenario would be implicitly included in step 5 (world/entry drop logic) if we added it to the `scopesToDrop` array.

**Decision for Phase 1**: 
- **DO NOT change truncation priority** (per spec)
- **Emit policy warning**: `SCENARIO_POLICY_UNDECIDED` when budget is tight
- **Safe default**: Treat scenario like entry (drop only if severely over budget)
- **Future Phase**: Explicit scenario truncation priority (likely between entry and npc)

---

## 2. Assembly Audit Shape

**Location**: `src/prompt/assembler/types.ts:50-63`

### Current Audit Structure

```typescript
type AssembleResult = {
  prompt: string;
  meta: {
    order: Scope[];                          // Assembly order used
    segmentIdsByScope: Record<Scope, number[]>; // Segment IDs per scope
    tokensEstimated: number;                 // Total token count (post-assembly)
    truncated?: {
      droppedScopes?: Scope[];               // Dropped scopes
      npcDroppedTiers?: NpcTierDrop[];       // NPC tier reductions
      inputTrimmed?: { fromChars, toChars }; // Input truncation
      gameStateCompressed?: boolean;         // Game state compression
      policyWarnings?: string[];             // Phase 1: Added for undecided policies
    };
  };
};
```

### Phase 1 Enhancements Required

Add structured audit trail with:
- **Per-scope token counts** (pre and post truncation)
- **Assembly context** (isFirstTurn, scenarioSlug, worldSlug)
- **Policy notes** (SCENARIO_POLICY_UNDECIDED warnings)
- **Timestamp** (assembledAt)
- **Human-readable summary** (for admin preview)

**Implementation**: Extend `AssembleResult.meta` to include:
```typescript
audit?: {
  assembledAt: string;
  context: {
    isFirstTurn: boolean;
    worldSlug: string;
    scenarioSlug?: string;
    entryPointId: string;
  };
  scopes: Array<{
    scope: Scope;
    segmentCount: number;
    tokensBeforeTruncation: number;
    tokensAfterTruncation: number;
    dropped: boolean;
  }>;
  policyNotes: string[];
  summary: string; // Human-readable text
};
```

---

## 3. Budget Accounting (Current State)

**Location**: `src/prompt/assembler/budget.ts:13-16, 246-266`

### Token Estimation

- **Heuristic**: ~4 characters per token
- **Function**: `estimateTokens(text: string): number`
- **Accuracy**: ±20% (simple approximation, production should use tiktoken)

### Per-Scope Accounting (Currently Missing)

**Discovery**: The system tracks:
- Total tokens (post-assembly)
- Truncation events (boolean flags)
- Segment IDs per scope

**Missing**: Per-scope token counts (before and after truncation)

**Phase 1 Addition**: Calculate and store per-scope token counts during assembly for audit trail.

---

## 4. Admin API Validation Pattern

**Location**: `backend/src/routes/admin.ts:103-122, 537-584`

### Validation Style

**Schema Definition** (Zod):
```typescript
const PromptSchema = z.object({
  layer: LayerSchema,                      // Required, lowercase transform
  world_slug: z.string().nullable().optional(),
  adventure_slug: z.string().nullable().optional(),
  scene_id: z.string().nullable().optional(),
  turn_stage: z.enum(['any', 'start', 'ongoing', 'end']).default('any'),
  sort_order: z.number().int().min(0).default(0),
  version: z.string().default('1.0.0'),
  content: z.string().min(1),              // Required
  metadata: z.record(z.any()).default({}),
  active: z.boolean().default(true),
  locked: z.boolean().default(false)
});
```

**Error Response Format**:
```typescript
// Validation errors (400)
{
  ok: false,
  error: 'Validation error',
  details: zodError.errors // Array of Zod error objects
}

// Business logic errors (400/403/404)
{
  ok: false,
  error: 'Human-readable message'
}

// Success (200/201)
{
  ok: true,
  data: T
}
```

### Phase 1 Validation Rules for Scenario

**Add to PromptSchema**:
```typescript
.refine(
  (data) => {
    // If layer is 'scenario', scenario_slug is required
    if (data.layer === 'scenario') {
      return !!data.scenario_slug;
    }
    return true;
  },
  {
    message: "scenario_slug is required when layer is 'scenario'",
    path: ['scenario_slug']
  }
)
.refine(
  (data) => {
    // If scenario_slug is provided, layer must be 'scenario'
    if (data.scenario_slug) {
      return data.layer === 'scenario';
    }
    return true;
  },
  {
    message: "scenario_slug can only be used with layer='scenario'",
    path: ['layer']
  }
);
```

---

## 5. Preview Data Access Pattern

**Discovery**: No dedicated preview endpoint exists currently.

**Observation**: Admin prompts API uses direct Supabase client:
```typescript
const { data, error } = await supabase
  .from('prompting.prompts')
  .select()
  .eq('layer', layer)
  .eq('active', true)
  .order('sort_order', { ascending: true });
```

**Phase 1 Implementation**: Create new endpoint `/api/admin/prompts/preview` that:
1. Accepts mock context (worldSlug, scenarioSlug, isFirstTurn)
2. Fetches segments using existing Supabase pattern
3. Calls `assemblePrompt()` directly (no RPC)
4. Returns assembled text + audit

---

## 6. Reusable Editor Components

**Location**: `frontend/src/pages/admin/PromptAdmin.tsx`

### Current Components

- **Layer Selector**: Hardcoded options array (line 30-36)
  ```typescript
  const BASE_LAYER_OPTIONS = [
    'core', 'world', 'adventure', 'adventure_start', 'optional'
  ];
  ```

- **Category Suggestions**: Object map by layer (line 38-43)
  ```typescript
  const CATEGORY_SUGGESTIONS: Record<string, string[]> = {
    core: ['logic', 'output_rules', 'npc_agency', 'failsafes'],
    world: ['world_rules', 'world_npcs', 'world_events'],
    adventure: ['story_beats', 'encounters', 'adventure_npcs'],
    adventure_start: ['opening_state', 'intro', 'npc_snapshot'],
  };
  ```

- **Token Estimate**: Inline calculation (reuses backend estimator)

- **Metadata Editor**: `Tabs` component with JSON preview

### Phase 1 Additions

**Layer Selector**:
```typescript
const BASE_LAYER_OPTIONS = [
  'core', 'world', 'scenario', 'adventure', 'adventure_start', 'optional'
];
```

**Category Suggestions**:
```typescript
const CATEGORY_SUGGESTIONS: Record<string, string[]> = {
  // ... existing ...
  scenario: ['opening', 'tone', 'npc_context', 'act_transitions'],
};
```

**Scenario Picker**: New autocomplete component
- Fetches from `/api/entry-points?type=scenario`
- Displays: `{title} ({slug})`
- Stores: `scenario_slug` value

---

## 7. Entry Point Data Structure

**Location**: `db/migrations/20250130000000_core_schema.sql:32-56`

### Entry Points Table

```sql
CREATE TABLE IF NOT EXISTS entry_points (
  id text PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  type text NOT NULL CHECK (type IN ('adventure', 'scenario', 'sandbox', 'quest')),
  world_id text NOT NULL REFERENCES worlds(id),
  ruleset_id text NOT NULL REFERENCES rulesets(id),
  title text NOT NULL,
  description text NOT NULL,
  synopsis text,
  status text NOT NULL DEFAULT 'draft',
  visibility text NOT NULL DEFAULT 'public',
  content_rating text NOT NULL DEFAULT 'safe',
  tags text[] NOT NULL DEFAULT '{}',
  content jsonb NOT NULL DEFAULT '{}',
  ...
);
```

**Scenario Filtering**:
```sql
SELECT id, slug, title, description
FROM entry_points
WHERE type = 'scenario'
  AND status = 'active'
  AND visibility IN ('public', 'unlisted')
ORDER BY title;
```

---

## 8. Testing Framework Locations

### Unit Tests (Vitest)

**Location**: `src/prompt/assembler/*.test.ts` (to be created)

**Existing Pattern**: None found in assembler module

**Phase 1**: Create:
- `src/prompt/assembler/assembler.test.ts`
- `src/prompt/assembler/budget.test.ts`

### Integration Tests (Vitest)

**Location**: `backend/tests/routes/*.test.ts`

**Existing Pattern**: `backend/tests/routes/admin.test.ts` (lines 1-24)

**Phase 1**: Extend `admin.test.ts` with scenario validation tests

### E2E Tests (Playwright)

**Location**: `e2e/*.spec.ts` (to be created)

**Phase 1**: Create:
- `e2e/admin-scenario-prompts.spec.ts`
- `e2e/player-scenario-start.spec.ts`

---

## 9. Observability Infrastructure

**Discovery**: No centralized logging or metrics system in place.

**Current State**:
- `console.log()` statements in services
- No structured logging
- No metrics/counters library

**Phase 1 Approach**:
- Use `console.log()` with structured JSON format
- Track counters in-memory (global object)
- Admin debug panel reads from in-memory store
- **Future**: Integrate with observability platform (DataDog, New Relic, etc.)

**Logging Format**:
```typescript
console.log(JSON.stringify({
  level: 'info',
  event: 'prompt_assembled',
  timestamp: new Date().toISOString(),
  context: {
    gameId: string,
    worldSlug: string,
    scenarioSlug?: string,
    isFirstTurn: boolean
  },
  metrics: {
    totalTokens: number,
    perScopeTokens: Record<Scope, number>,
    truncationEvents: string[]
  }
}));
```

---

## 10. Feature Flag Implementation

**Discovery**: No feature flag library in use.

**Phase 1 Approach**: Environment variables

**Backend** (`backend/.env`):
```bash
FEATURE_SCENARIO_LAYER=true
FEATURE_SCENARIO_POLICY_REPORT=true
```

**Frontend** (`frontend/.env`):
```bash
VITE_FEATURE_SCENARIO_LAYER=true
```

**Usage**:
```typescript
// Backend
const SCENARIO_ENABLED = process.env.FEATURE_SCENARIO_LAYER === 'true';

// Frontend
const SCENARIO_ENABLED = import.meta.env.VITE_FEATURE_SCENARIO_LAYER === 'true';
```

---

## 11. Markdown Scope Delimiters

**Location**: `src/prompt/assembler/markdown.ts`

**Pattern**:
```
=== {SCOPE}_BEGIN ===
{content}
=== {SCOPE}_END ===
```

**Scenario Example**:
```
=== SCENARIO_BEGIN ===
Opening: The forest whispers with ancient magic...
=== SCENARIO_END ===
```

---

## Summary: Phase 1 Implementation Strategy

### B3 (Token Budgeting)
- **Keep existing truncation order**
- Add scenario to per-scope token accounting
- Emit `SCENARIO_POLICY_UNDECIDED` warning when budget tight (> 0.9x budget)
- Do NOT change drop priority (treat as entry-level)

### B4 (Assembly Audit)
- Extend `AssembleResult.meta` with structured audit
- Track per-scope tokens (before/after)
- Include policy notes array
- Generate human-readable summary

### C1 (Admin API Validation)
- Add `scenario_slug` to `PromptSchema`
- Add cross-field validation (scenario layer ↔ scenario_slug)
- Return Zod validation errors in existing format

### C2 (Admin Preview Endpoint)
- New endpoint: `POST /api/admin/prompts/preview`
- Fetch segments via Supabase (no RPC)
- Call `assemblePrompt()` directly
- Return: text + audit + policy report

### D1-D3 (Admin UI)
- Add 'scenario' to layer options
- Create scenario picker (autocomplete from entry_points)
- Add category suggestions for scenario
- Extend preview modal with scenario toggle

### E1 (Player Flow)
- Add "Start Scenario" button (conditionally rendered)
- Create game with `scenario_slug` in metadata
- Route to game page with scenario context

### F1-F4 (Testing & Observability)
- Unit tests: Vitest (scope order, budgeting, audit)
- Integration tests: Admin API validation
- E2E tests: Playwright (admin + player flows)
- Logging: Structured JSON with per-scope metrics
- Counters: In-memory store with admin debug panel

---

**Next Steps**: Implement B3-F4 workstreams using these discovered patterns.

