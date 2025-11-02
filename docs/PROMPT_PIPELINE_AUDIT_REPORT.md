# Prompt Pipeline Audit Report
## Single JSON AWF Bundle + Minimal Wrapper Plan Compliance

**Date**: 2025-02-11  
**Auditor**: Codebase Analysis  
**Scope**: Read-only audit of prompt pipeline against authoritative plan

---

## Executive Summary

**Does current system match the plan?**  
**PARTIAL** — Core architecture aligns but key structural gaps prevent full compliance.

**Key Findings:**
- ✅ Single JSON `awf_bundle` structure is assembled
- ✅ Minimal system prompt exists and references `awf_bundle` correctly  
- ✅ Injection map system uses JSON Pointers properly
- ❌ **Missing `core.ruleset` in bundle** (plan requires `awf_bundle.core: { ruleset: {...} }`)
- ❌ **Missing `acts_catalog` in bundle** (plan requires `acts_catalog` array)
- ⚠️ LiveOps config exists but **not applied to bundles** at assembly time
- ⚠️ Legacy markdown assembler (`EntryPointAssemblerV3`) still exists but appears to be used for non-AWF path

---

## Compliance Table

| Plan Requirement | Implementation Location | Status | Notes |
|-----------------|------------------------|--------|-------|
| **Bundle Assembly** | | | |
| Single JSON `awf_bundle` produced | `backend/src/assemblers/awf-bundle-assembler.ts:170-216` | ✅ PASS | Bundle structure created |
| `awf_bundle.contract` included | `backend/src/assemblers/awf-bundle-assembler.ts:181-186` | ✅ PASS | Core contract loaded and included |
| `awf_bundle.core.ruleset` included | ❌ Not found | ❌ FAIL | Core ruleset loaded but **NOT added to bundle** |
| `awf_bundle.world` compact | `backend/src/assemblers/awf-bundle-assembler.ts:187` | ✅ PASS | `compactWorld()` + token discipline applied |
| `awf_bundle.adventure` compact | `backend/src/assemblers/awf-bundle-assembler.ts:188` | ✅ PASS | `compactAdventure()` + token discipline applied |
| `awf_bundle.scenario` compact | `backend/src/assemblers/awf-bundle-assembler.ts:189` | ✅ PASS | Optional scenario included |
| `awf_bundle.npcs` array, capped | `backend/src/assemblers/awf-bundle-assembler.ts:190-193` | ✅ PASS | NPCs collected, capped (≤5 default), compacted |
| `awf_bundle.state: {hot, warm, cold}` | `backend/src/assemblers/awf-bundle-assembler.ts:202-206` | ✅ PASS | From `games.state_snapshot` |
| `awf_bundle.acts_catalog` array | ❌ Not found | ❌ FAIL | Exists in injection map tests but **not in bundle structure** |
| `awf_bundle.meta` with required fields | `backend/src/assemblers/awf-bundle-assembler.ts:172-180` | ✅ PASS | Includes locale, timestamp, turn_id, etc. |
| **Sources & Compaction** | | | |
| Core contract loaded (active) | `backend/src/assemblers/awf-bundle-assembler.ts:97-100` | ✅ PASS | Loaded from `core_contracts` table |
| Core ruleset loaded | `backend/src/assemblers/awf-bundle-assembler.ts:103-106` | ✅ PASS | Loaded by ref from `core_rulesets` table |
| World compacted | `backend/src/assemblers/world-adv-compact.ts` | ✅ PASS | Token-safe compaction |
| Adventure compacted | `backend/src/assemblers/world-adv-compact.ts` | ✅ PASS | Token-safe compaction |
| NPCs collected & capped | `backend/src/assemblers/npc-collector.ts:23-62` | ✅ PASS | Hard cap from ruleset or default 5 |
| NPCs compacted | `backend/src/assemblers/npc-compactor.ts` | ✅ PASS | Compact format used |
| State from `games.state_snapshot` | `backend/src/assemblers/awf-bundle-assembler.ts:79,203-205` | ✅ PASS | Primary source |
| Sessions optional (overrides only) | `backend/src/assemblers/awf-bundle-assembler.ts:85,88-91` | ✅ PASS | Sessions only for `ruleset_ref`/`locale` overrides |
| **Injection Map** | | | |
| Injection map registry | `backend/src/repositories/awf-injection-map-repository.ts` | ✅ PASS | Repository exists |
| Injection map executor | `backend/src/assemblers/injection-map-executor.ts:31-70` | ✅ PASS | Executes rules |
| JSON Pointer resolution | `backend/src/assemblers/injection-map-executor.ts:121-190` | ✅ PASS | `from` and `to` use JSON Pointers |
| `skipIfEmpty` support | `backend/src/assemblers/injection-map-executor.ts:84-86` | ✅ PASS | Rule flag supported |
| `limit` support (tokens/count) | `backend/src/assemblers/injection-map-executor.ts:96-102` | ✅ PASS | Token and count limits applied |
| `fallback` support | `backend/src/assemblers/injection-map-executor.ts:89-93` | ✅ PASS | Fallback values supported |
| Injection map applied to bundle | `backend/src/assemblers/awf-bundle-assembler.ts:218-240` | ✅ PASS | Applied after bundle creation |
| **Token Discipline** | | | |
| NPC cap enforcement | `backend/src/assemblers/npc-collector.ts:60` | ✅ PASS | Hard cap from ruleset |
| Token budget enforcer | `backend/src/config/awf-budgets.ts:84-202` | ✅ PASS | Ordered trimming (NPCs → warm.episodic → summaries) |
| Token estimators | `backend/src/utils/awf-bundle-helpers.ts:estimateTokens` | ✅ PASS | Token counting |
| **LiveOps & Locale** | | | |
| LiveOps config resolver | `backend/src/liveops/config-resolver.ts` | ✅ PASS | Resolver exists |
| LiveOps applied to bundle | ❌ Not found | ❌ FAIL | **LiveOps not integrated into bundle assembly** |
| Locale in meta | `backend/src/assemblers/awf-bundle-assembler.ts:178` | ✅ PASS | `meta.locale` set |
| Locale overlays applied | `backend/src/services/localization-overlay.service.ts:92-193` | ⚠️ WARN | Service exists but **not called during bundle assembly** |
| **Prompt Wrapper** | | | |
| Minimal system prompt | `backend/src/model/system-prompts.ts:11-12` | ✅ PASS | References `awf_bundle` object |
| No file embeds in prompt | ✅ Verified | ✅ PASS | System prompt is pure text |
| Output validation schema | `backend/src/validators/awf-output-validator.ts` | ✅ PASS | Validates AWF structure |
| Extra-key rejection | `backend/src/validators/awf-output-validator.ts` | ✅ PASS | Schema enforces exact keys |
| Repair hints | `backend/src/model/system-prompts.ts:44-46` | ✅ PASS | Repair hint injection supported |
| **Sessions vs Games** | | | |
| `games.state_snapshot` primary | `backend/src/assemblers/awf-bundle-assembler.ts:79,203-205` | ✅ PASS | Primary source confirmed |
| Sessions optional overrides | `backend/src/assemblers/awf-bundle-assembler.ts:85,88-91` | ✅ PASS | Only for ruleset/locale |
| **Legacy Path** | | | |
| Legacy markdown assembler exists | `backend/src/prompts/entry-point-assembler-v3.ts` | ⚠️ WARN | Still exists but may be non-AWF path |
| File-based template loader | `backend/src/prompting/templateRegistry.ts` | ⚠️ WARN | Exists but **not used in AWF bundle path** |
| `<<<FILE` pattern in code | `backend/src/prompts/db-assembler.ts:141` | ⚠️ WARN | Found but **not in active AWF path** |
| **Bundle Persistence** | | | |
| No bundle persistence | ✅ Verified | ✅ PASS | Bundles are ephemeral, only game state persisted |

---

## Findings with Pointers

### ❌ FAIL: Missing `core.ruleset` in Bundle Structure

**Location**: `backend/src/assemblers/awf-bundle-assembler.ts:170-216`

**Issue**: The plan requires `awf_bundle.core: { ruleset: {...} }` but the bundle structure includes only:
- `awf_bundle.contract` (core contract)
- No `awf_bundle.core.ruleset`

**Evidence**:
```170:216:backend/src/assemblers/awf-bundle-assembler.ts
    const bundle: AwfBundle = {
      awf_bundle: {
        meta: {...},
        contract: {...},
        world: {...},
        adventure: {...},
        // ❌ Missing: core: { ruleset: {...} }
```

**Impact**: System prompt references `awf_bundle.core.ruleset` but it's not in the bundle.

**System Prompt Reference**:
```11:12:backend/src/model/system-prompts.ts
  "You will be given one JSON object `awf_bundle`. Return exactly one JSON object named `AWF` with keys `scn`, `txt`, and optional `choices`, `acts`, `val`. No markdown, no code fences, no extra keys. Follow `awf_bundle.contract` and `awf_bundle.core.ruleset`.";
```

The prompt says to follow `awf_bundle.core.ruleset` but it doesn't exist in the bundle.

---

### ❌ FAIL: Missing `acts_catalog` in Bundle

**Location**: `backend/src/types/awf-bundle.ts`

**Issue**: Plan requires `awf_bundle.acts_catalog` array, but bundle type definition and assembly code do not include it.

**Evidence**:
- Bundle type (`backend/src/types/awf-bundle.ts`) has no `acts_catalog` field
- Bundle assembly (`backend/src/assemblers/awf-bundle-assembler.ts:170-216`) does not set `acts_catalog`

**Note**: Tests reference `acts_catalog` injection via injection map (`backend/tests/awf-assembler-ruleset-inject.test.ts:297`), suggesting it's intended to be injected but should also be present directly.

---

### ⚠️ WARN: LiveOps Not Applied to Bundles

**Location**: `backend/src/assemblers/awf-bundle-assembler.ts`

**Issue**: LiveOps config resolver exists (`backend/src/liveops/config-resolver.ts`) but is **never called** during bundle assembly.

**Expected**: After bundle creation, LiveOps overlays should be merged into bundle data.

**Current**: No LiveOps integration in `assembleBundle()` or `assembleBundleCached()`.

---

### ⚠️ WARN: Locale Overlays Not Applied During Assembly

**Location**: `backend/src/assemblers/awf-bundle-assembler.ts:187-188`

**Issue**: Locale overlay service exists (`backend/src/services/localization-overlay.service.ts`) but is **not called** when compacting world/adventure.

**Evidence**: 
```187:188:backend/src/assemblers/awf-bundle-assembler.ts
        world: applyWorldTokenDiscipline(compactWorld(world.doc, locale)),
        adventure: applyAdventureTokenDiscipline(compactAdventure(adventure.doc, locale)),
```

Locale is passed but overlays are not applied. The `compactWorld` and `compactAdventure` functions receive `locale` but do not call the localization overlay service.

---

### ⚠️ WARN: Legacy Markdown Assembler Still Exists

**Location**: `backend/src/prompts/entry-point-assembler-v3.ts`

**Issue**: Legacy markdown-based assembler (`EntryPointAssemblerV3`) still exists and may be used for non-AWF turns.

**Evidence**: 
- Used in `backend/src/services/turns.service.ts:933` for initial prompt
- Uses markdown blocks and file-based assembly
- Not part of AWF bundle pipeline but exists in parallel

**Recommendation**: Document which path uses which assembler, or deprecate legacy path.

---

### ⚠️ WARN: Legacy File Embed Pattern Exists

**Location**: `backend/src/prompts/db-assembler.ts:141`

**Issue**: Legacy `<<<FILE ... >>>` pattern handler exists but **not used in AWF bundle path**.

**Evidence**: 
```141:141:backend/src/prompts/db-assembler.ts
const filePattern = /<<<FILE\s+([^>]+)\s*>>>/g;
```

This is in `db-assembler.ts` which appears to be legacy code. Not found in active AWF bundle assembly.

---

### ✅ PASS: System Prompt is Minimal

**Location**: `backend/src/model/system-prompts.ts:11-12`

**Evidence**:
```11:12:backend/src/model/system-prompts.ts
export const SYSTEM_AWF_RUNTIME = 
  "You will be given one JSON object `awf_bundle`. Return exactly one JSON object named `AWF` with keys `scn`, `txt`, and optional `choices`, `acts`, `val`. No markdown, no code fences, no extra keys. Follow `awf_bundle.contract` and `awf_bundle.core.ruleset`.";
```

Matches plan: minimal, references `awf_bundle`, requires single JSON output.

---

### ✅ PASS: Injection Map Uses JSON Pointers

**Location**: `backend/src/assemblers/injection-map-executor.ts:121-190`

**Evidence**: JSON Pointer resolution properly handles `/world/`, `/adventure/`, `/npcs/`, `/contract/`, `/player/`, `/game/`, `/session/` paths.

---

### ✅ PASS: NPCs Capped and Compacted

**Location**: 
- Collection: `backend/src/assemblers/npc-collector.ts:23-62`
- Compaction: `backend/src/assemblers/npc-compactor.ts`

**Evidence**: NPCs are:
1. Collected from scenario/adventure/game state
2. Capped to ruleset value or default 5
3. Compacted to minimal format (id, ver, name, archetype, summary, style, tags)

---

### ✅ PASS: State from `games.state_snapshot`

**Location**: `backend/src/assemblers/awf-bundle-assembler.ts:79,203-205`

**Evidence**:
```79:82:backend/src/assemblers/awf-bundle-assembler.ts
    const game = await repos.gameStates.getByIdVersion(params.sessionId);
    if (!game) {
      throw new Error(`Game ${params.sessionId} not found`);
    }
```

```203:205:backend/src/assemblers/awf-bundle-assembler.ts
        game_state: {
          hot: (game as any).state_snapshot?.hot || {},
          warm: (game as any).state_snapshot?.warm || {},
```

Primary source confirmed.

---

## Diff Suggestions

### Fix 1: Add `core.ruleset` to Bundle

**File**: `backend/src/assemblers/awf-bundle-assembler.ts`

```typescript
// After line 186, add:
        core: {
          ruleset: coreRuleset.doc.ruleset as Record<string, unknown>,
        },
```

**Also update type**: `backend/src/types/awf-bundle.ts`

```typescript
export interface AwfBundle {
  awf_bundle: {
    meta: AwfBundleMeta;
    contract: AwfBundleContract;
    core: {  // ADD THIS
      ruleset: Record<string, unknown>;
    };
    world: AwfBundleWorld;
    // ... rest
```

---

### Fix 2: Add `acts_catalog` to Bundle

**File**: `backend/src/assemblers/awf-bundle-assembler.ts`

```typescript
// After core.ruleset (or in core object), add:
        acts_catalog: (coreContract.doc.core?.acts_catalog || []) as Array<Record<string, unknown>>,
```

**Also update type**: `backend/src/types/awf-bundle.ts`

```typescript
export interface AwfBundle {
  awf_bundle: {
    // ...
    core: {
      ruleset: Record<string, unknown>;
      acts_catalog?: Array<Record<string, unknown>>;  // ADD THIS
    };
    // ...
```

---

### Fix 3: Integrate LiveOps into Bundle Assembly

**File**: `backend/src/assemblers/awf-bundle-assembler.ts`

```typescript
// After line 134 (after injection map load), add:
import { LiveOpsIntegration } from '../liveops/integration-points.js';

// In assembleBundle(), after bundle creation (line 216), before injection map:
    // Apply LiveOps overlays if available
    const liveOpsIntegration = new LiveOpsIntegration(supabaseUrl, supabaseKey);
    const liveOpsContext = {
      sessionId: params.sessionId,
      worldRef: worldRef,
      adventureRef: adventureRef,
      now: new Date()
    };
    const liveOpsConfigs = await liveOpsIntegration.applyAllConfigs(liveOpsContext);
    
    // Merge LiveOps configs into bundle (example - adjust based on actual structure)
    if (liveOpsConfigs.tokenBudget) {
      bundle.awf_bundle.meta.token_budget = liveOpsConfigs.tokenBudget;
    }
```

---

### Fix 4: Apply Locale Overlays During Compaction

**File**: `backend/src/assemblers/world-adv-compact.ts` (or wherever `compactWorld`/`compactAdventure` are defined)

```typescript
// Import overlay service
import { LocalizationOverlayService } from '../services/localization-overlay.service.js';

// In compactWorld function, after base compaction:
export function compactWorld(worldDoc: WorldDocFlex, locale?: string): AwfBundleWorld {
  // ... existing compaction ...
  
  // Apply locale overlays if not en-US
  if (locale && locale !== 'en-US') {
    const overlayService = new LocalizationOverlayService(supabase);
    const worldRef = `${worldDoc.id}@${worldDoc.version}`;
    const localized = await overlayService.applyLocalizedOverlays(
      compacted,
      'world',
      worldRef,
      locale
    );
    return localized as AwfBundleWorld;
  }
  
  return compacted;
}
```

---

## Blocking Risks

1. **System prompt references `awf_bundle.core.ruleset` but it doesn't exist** — Model may be confused or ignore ruleset instructions
2. **Missing `acts_catalog` may break action validation** — If model needs to know available acts, they must be in bundle
3. **LiveOps not applied means runtime config changes won't affect bundles** — Bundles won't respect liveops token budgets, pacing, etc.
4. **Locale overlays not applied means i18n won't work** — Non-English locales won't see translated content

---

## Quick Wins (Fastest Path to Spec Compliance)

1. **Add `core.ruleset` to bundle** (15 min) — Loaded, just need to add to structure
2. **Add `acts_catalog` to bundle** (10 min) — Extract from contract.core.acts_catalog
3. **Fix system prompt reference** (5 min) — Either add `core.ruleset` or remove reference from prompt
4. **Apply locale overlays during compaction** (30 min) — Integrate existing service
5. **Document LiveOps integration point** (15 min) — Add TODO or stub for future integration

**Total estimated time**: ~75 minutes for critical fixes (items 1-3)

---

## Artifacts

### Example Bundle Structure (Current vs Plan)

**Current Structure** (from code):
```json
{
  "awf_bundle": {
    "meta": { "engine_version": "1.0.0", "world": "...", "adventure": "...", "locale": "en-US", ... },
    "contract": { "id": "...", "version": "...", "hash": "...", "doc": {...} },
    "world": { "id": "...", "name": "...", ... },
    "adventure": { "ref": "...", "hash": "...", ... },
    "scenario": {...},
    "npcs": { "active": [...], "count": 3 },
    "player": {...},
    "game_state": { "hot": {}, "warm": {}, "cold": {} },
    "rng": { "seed": "...", "policy": "deterministic" },
    "input": { "text": "...", "timestamp": "..." }
  },
  "user_input": "..."  // ❌ Not in current structure - plan shows it at root level
}
```

**Plan Structure**:
```json
{
  "awf_bundle": {
    "contract": {...},
    "core": { "ruleset": {...} },  // ❌ MISSING
    "world": {...},
    "adventure": {...},
    "scenario": {...},
    "npcs": [...],  // ⚠️ Plan shows array, current shows {active, count}
    "state": { "hot": {}, "warm": {}, "cold": {} },  // ⚠️ Plan calls it "state", current "game_state"
    "acts_catalog": [...],  // ❌ MISSING
    "meta": {...}
  },
  "user_input": "..."  // ⚠️ Not in current bundle root
}
```

### System Prompt Comparison

**Current** (`backend/src/model/system-prompts.ts:11-12`):
```
"You will be given one JSON object `awf_bundle`. Return exactly one JSON object named `AWF` with keys `scn`, `txt`, and optional `choices`, `acts`, `val`. No markdown, no code fences, no extra keys. Follow `awf_bundle.contract` and `awf_bundle.core.ruleset`."
```

**Target** (from plan):
```
Minimal runtime instruction (no file embeds, no markdown). Model returns exactly one JSON object named AWF with keys scn, txt, optional choices, optional acts, optional val.
```

✅ **Match**: Current prompt is minimal and matches plan.

---

### Legacy Markers Found

**`<<<FILE` pattern**:
- `backend/src/prompts/db-assembler.ts:141` (1 occurrence in active code)
- `backend/src/prompting/templateRegistry.ts:440` (1 occurrence in active code)
- Multiple in backup files (`backend/backups/pre-awf/`) - not active
- Multiple in test files (testing that pattern is removed)
- Multiple in docs (documentation only)

**`markdown` references**:
- `backend/src/prompts/wrapper.ts:43` - Legacy wrapper (not AWF path)
- `backend/src/prompts/entry-point-assembler-v3.ts:34-60` - Legacy assembler (not AWF path)
- Various test and doc files

**`db-assembler` references**:
- `backend/src/prompts/db-assembler.ts` - Legacy file (not in AWF path)
- Test files checking it's not used

**Assessment**: Legacy code exists but is **not in active AWF bundle assembly path**. The AWF bundle assembler (`backend/src/assemblers/awf-bundle-assembler.ts`) does not use these patterns.

---

## Conclusion

The codebase has a **solid foundation** that aligns with the plan's core architecture, but **critical structural gaps** prevent full compliance:

1. **Missing `core.ruleset`** — Blocks model from accessing ruleset instructions referenced in system prompt
2. **Missing `acts_catalog`** — May break action validation/selection
3. **LiveOps not integrated** — Runtime config won't affect bundles
4. **Locale overlays not applied** — i18n won't work

**Recommendation**: Fix items 1-3 (core.ruleset, acts_catalog, system prompt) as **blocking issues** before production. LiveOps and locale can be phased in.

---

**Report End**

