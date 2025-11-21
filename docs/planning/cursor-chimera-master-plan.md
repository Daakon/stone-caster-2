# Cursor Task Breakdown: Plan Comparison & Recommendation

> **Purpose**: Compare `gemini-chimera-master-plan.md` and `gpt-chimera-master-plan.md` for their effectiveness as Cursor task breakdown guides. Analyze pros/cons and provide recommendations for creating actionable phase-based prompts. **Also considers `chimera-full-schemas.json` as a complementary resource.**

---

## Executive Summary

| Plan | Best For | Primary Strength | Primary Weakness |
|-----|----------|------------------|------------------|
| **Gemini** | High-level architecture, conceptual clarity | Concise, domain-focused, prompt strategy guidance | Lacks implementation details, no ready-to-use prompts |
| **GPT** | Implementation-ready, comprehensive specs | Ready-to-paste prompt packs, complete contracts, file paths | Very long, potentially overwhelming, may be too prescriptive |
| **Schemas JSON** | Concrete examples, seed data, test fixtures | Real working examples, standard library catalog, validates patterns | Not a planning doc, needs to be used alongside a plan |

**Recommendation**: Use **GPT plan as primary** with **`chimera-full-schemas.json` for examples** and **Gemini plan as reference** for domain concepts. The schemas file provides the missing concrete examples that make GPT plan's prompts immediately actionable.

---

## Detailed Comparison

### 1. Structure & Organization

#### Gemini Plan
- **Structure**: 3 main sections (Domain Models, Implementation Phases, Prompt Strategy)
- **Length**: ~130 lines, highly condensed
- **Organization**: Top-down, concept-first approach
- **Pros**:
  - Easy to scan and understand at a glance
  - Clear separation of "what" (domain) vs "how" (implementation)
  - Section 3 provides explicit prompt strategy guidance
- **Cons**:
  - Phases are high-level bullet points, not actionable prompts
  - No file paths, API routes, or concrete examples
  - Requires significant interpretation to generate Cursor prompts

#### GPT Plan
- **Structure**: 16 sections covering contracts, storage, services, frontend, compiler, runtime, testing, deployment, phases
- **Length**: ~590 lines, comprehensive
- **Organization**: Bottom-up, implementation-first approach
- **Pros**:
  - Section 13 ("Phase Plan with Cursor Prompt Packs") provides ready-to-paste prompts
  - Complete JSON contracts (Section 1) serve as source of truth
  - Explicit file paths, folder layouts, API routes
  - Includes acceptance criteria, testing strategy, observability
- **Cons**:
  - Information density may overwhelm Cursor in single prompts
  - Some sections (e.g., Section 7 "Prompt Specifications") are for runtime, not Cursor
  - Risk of Cursor getting lost in details vs. focusing on current phase

---

### 2. Task Breakdown Granularity

#### Gemini Plan
**Phase Breakdown:**
1. Database & System Assets (2 tasks)
2. Creator Services & UI (2 tasks)
3. Compiler Logic (4 steps, sequential)
4. Runtime Loop (2 tasks)
5. Validation (1 task)

**Granularity Assessment:**
- ✅ **Pros**: Clear logical grouping, minimal overlap
- ❌ **Cons**: Each phase is too broad for single Cursor sessions
  - "Phase 2: Creator" combines backend services AND UI
  - "Phase 3: Compiler" is 4 distinct steps that should be separate prompts
  - No explicit sub-phases or checkpoints

**Example Phase 2 Task:**
> "Ruleset Service (Hub & Spoke Validation): Enforce: Exactly one `foundation` ruleset per story..."

**Issues for Cursor:**
- No file paths specified
- No validation logic examples
- No error handling patterns
- No test requirements

#### GPT Plan
**Phase Breakdown:**
0. Terminology + Contracts
1. DB + Repos + RLS
2. Authoring CRUD + Uploads
3. Casting Circle Wizard (FE)
4. Compiler Pipeline
5. Character Creator (3 Layers)
6. Runtime Loop
7. Game View (FE)
8. Seeds + QA + Observability

**Granularity Assessment:**
- ✅ **Pros**: 
  - Each phase has explicit "Goal" and "Output"
  - Ready-to-paste "Cursor Prompt Pack" for each phase
  - Phases are scoped to single Cursor sessions (backend OR frontend, not both)
  - Clear separation of concerns (Phase 3 = FE only, Phase 2 = BE only)
- ⚠️ **Cons**: 
  - Some phases (e.g., Phase 4 "Compiler Pipeline") are still large and may need sub-phases
  - Phase 0 is meta-work that might be skipped in practice

**Example Phase 2 Prompt:**
```
Implement Express routes under /chimera/* for CRUD. Validate with Zod. Add asset.service.ts for signed upload URLs (R2). Write supertest specs for happy/error paths.
```

**Strengths for Cursor:**
- Specific technology stack mentioned (Express, Zod, R2, supertest)
- Clear deliverables (routes, service, tests)
- Actionable verbs ("Implement", "Add", "Write")

---

### 3. Prompt Actionability

#### Gemini Plan
**Prompt Strategy Section (Section 3):**
> "When starting the chat, provide the context above, then ask for these specific artifacts in order:
> 1. 'Generate the SQL Schema'...
> 2. 'Generate the Types'...
> 3. 'Generate the Compiler'...
> 4. 'Generate the Runtime'..."

**Assessment:**
- ✅ **Pros**: Provides a clear sequence and artifact-focused approach
- ❌ **Cons**: 
  - Prompts are too generic ("Generate the SQL Schema" - which tables? what indexes?)
  - No context about existing codebase structure
  - No validation criteria or test requirements
  - Assumes Cursor has full context from Sections 1-2, which may not fit in context window

**Usability Score**: 3/10 - Requires significant manual refinement before use

#### GPT Plan
**Cursor Prompt Packs (Section 13):**
Each phase includes:
- **Goal**: One-sentence objective
- **Output**: Specific files/deliverables
- **Cursor Prompt Pack**: Ready-to-paste block

**Example (Phase 1):**
```
Add SQL migrations for tables listed in section 2.1 with indexes in 2.2. Use Supabase style. Generate Node pg repositories with typed methods for CRUD. Add basic RLS templates (authors vs players). Write integration tests using a test DB.
```

**Assessment:**
- ✅ **Pros**: 
  - Self-contained prompts (references section numbers that exist in same doc)
  - Specific technologies mentioned (Supabase, Node pg)
  - Includes test requirements
  - Can be copy-pasted directly into Cursor
- ⚠️ **Cons**: 
  - References other sections (e.g., "section 2.1") - requires full document context
  - Some prompts are still multi-sentence and could be clearer
  - No explicit "what NOT to do" or common pitfalls

**Usability Score**: 8/10 - Can be used directly with minor context additions

---

### 4. Completeness & Coverage

#### Gemini Plan
**Coverage:**
- ✅ Domain models (Section 1)
- ✅ High-level phases (Section 2)
- ✅ Prompt strategy (Section 3)
- ❌ Missing:
  - JSON contracts/examples
  - File paths and folder structure
  - API route specifications
  - Testing strategy
  - Deployment considerations
  - Error handling patterns
  - Acceptance criteria

**Gap Analysis**: ~40% complete for implementation guidance

#### GPT Plan
**Coverage:**
- ✅ Glossary & core concepts (Section 0)
- ✅ JSON contracts (Section 1)
- ✅ Database schema (Section 2)
- ✅ Backend services & API (Section 3)
- ✅ Frontend pages & components (Section 4)
- ✅ Compiler detailed spec (Section 5)
- ✅ Runtime loop spec (Section 6)
- ✅ LLM prompt templates (Section 7)
- ✅ Testing strategy (Section 8)
- ✅ Observability (Section 9)
- ✅ Deployment (Section 10)
- ✅ Standard library seeds (Section 11)
- ✅ Acceptance criteria (Section 12)
- ✅ Phase prompts (Section 13)
- ✅ Risk matrix (Section 14)
- ✅ Roadmap (Section 15)
- ✅ Done checklist (Section 16)

**Gap Analysis**: ~95% complete for implementation guidance

---

### 5. Cursor-Specific Considerations

#### Context Window Efficiency

**Gemini Plan:**
- ✅ Fits easily in context window (~130 lines)
- ✅ Can be included in every Cursor prompt without truncation
- ❌ Lacks detail, so Cursor may need to ask clarifying questions or make assumptions

**GPT Plan:**
- ❌ Too long to include in full (~590 lines)
- ⚠️ Requires selective inclusion (e.g., "Section 2.1 tables" + "Section 13 Phase 1 prompt")
- ✅ But provides complete context when needed (no ambiguity)

#### Prompt Clarity for AI

**Gemini Plan:**
- Uses abstract language: "Establish the 'Greenfield' storage layer"
- Requires interpretation: "Handle Cloudflare image uploads"
- Ambiguous scope: "The Creator (Services & UI)" - which comes first?

**GPT Plan:**
- Uses concrete language: "Add SQL migrations for tables listed in section 2.1"
- Specific deliverables: "Generate Node pg repositories with typed methods for CRUD"
- Clear sequence: Phases numbered 0-8 with explicit dependencies

#### Error Prevention

**Gemini Plan:**
- ❌ No explicit error handling requirements
- ❌ No validation patterns specified
- ❌ No "common mistakes to avoid" section

**GPT Plan:**
- ✅ Section 14 "Risk Matrix" identifies potential issues
- ✅ Section 5.5 "Compiler Errors" lists error codes
- ✅ Testing strategy (Section 8) includes error path coverage
- ⚠️ But risks are scattered, not consolidated per phase

---

### 6. Impact of `chimera-full-schemas.json`

**What It Provides:**
- **System Schemas** (`0_SYSTEM_SCHEMAS`): Strict definition of `chimera_ruleset_schema` with field descriptions
- **Standard Library Catalog** (`1_STANDARD_LIBRARY_CATALOG`): Complete catalog of 15+ example rulesets organized by category:
  - Foundations: `rs_d100_core`, `rs_d20_core`, `rs_time_simple`
  - Expansions: Attributes, Health, Stamina, Mana, Survival, Weather, Inventory, Equipment, Progression, Factions, Quests
  - Flavor: `rs_theme_gothic`, `rs_theme_steampunk`
- **Compiler Artifacts** (`2_COMPILER_ARTIFACTS`): Example compiled story showing the output structure

**How This Changes the Analysis:**

#### Strengthens GPT Plan Significantly
- ✅ **Fills GPT Section 11 Gap**: GPT plan mentions "Standard Library (MVP Seed)" but doesn't provide the actual data. The schemas file IS that seed data.
- ✅ **Provides Concrete Examples**: Instead of abstract JSON contracts, Cursor can see real working rulesets with actual values
- ✅ **Demonstrates Patterns**: Shows how exclusion groups work (`skill_engine`, `health_system`), how dependencies chain (`rs_survival_basic` depends on `rs_time_simple`), and how state contributions merge
- ✅ **Test/Seed Data Ready**: Can be directly imported for Phase 8 (Seeds + QA) or used in compiler tests
- ✅ **Validates Architecture**: The structure confirms both plans' approaches are aligned

#### Weakens Gemini Plan's Value
- ❌ **Reduces Need for Abstract Definitions**: Gemini's high-level domain models are less needed when you have concrete examples
- ❌ **Makes Prompt Strategy Less Useful**: Gemini's "Generate the Types" prompt becomes less necessary when you can show Cursor: "Use this JSON structure as the source of truth"
- ⚠️ **But Still Useful For**: Quick conceptual reference, explaining the "why" behind the structure

#### New Hybrid Approach Becomes Optimal

**Best Practice with All Three Resources:**

1. **For Type Generation (Phase 0)**:
   - Use `chimera-full-schemas.json` as the **source of truth** for structure
   - Reference GPT Section 1 JSON contracts for **complete field definitions**
   - Use Gemini Section 1 for **domain context** (what each "Stone" means)

2. **For Implementation (Phases 1-8)**:
   - Use GPT Section 13 prompts as **primary task list**
   - Include relevant ruleset examples from `chimera-full-schemas.json` in prompts:
     - "Implement ruleset validation using `rs_d100_core` and `rs_d20_core` as examples of exclusion groups"
     - "Seed the database with rulesets from `chimera-full-schemas.json` section `1_STANDARD_LIBRARY_CATALOG`"

3. **For Testing (Phase 8)**:
   - Use schemas file directly as test fixtures
   - Compiler tests can use the example compiled story in `2_COMPILER_ARTIFACTS`

**Example Enhanced Prompt with Schemas:**

```
[Context: GPT Section 13 Phase 1 - DB + Repos + RLS]
[Context: GPT Section 2.1 - Table definitions]

[Examples: chimera-full-schemas.json]
- Use the structure in `0_SYSTEM_SCHEMAS.chimera_ruleset_schema` to validate ruleset definitions
- The `1_STANDARD_LIBRARY_CATALOG` section shows how exclusion groups work (e.g., `rs_d100_core` and `rs_d20_core` both have `exclusion_group: "skill_engine"`)

[Task: Create migration for `chimera_ruleset_templates` table that stores rulesets matching the schema structure shown in the examples]
```

**Usability Impact:**

| Aspect | Before Schemas | After Schemas |
|--------|----------------|---------------|
| **GPT Plan Actionability** | 8/10 | **9/10** (concrete examples) |
| **Gemini Plan Value** | 3/10 | **2/10** (examples reduce need for abstraction) |
| **Type Generation Clarity** | 6/10 | **10/10** (JSON structure is unambiguous) |
| **Test Data Availability** | 4/10 | **10/10** (ready-to-use seed data) |
| **Pattern Understanding** | 5/10 | **9/10** (real examples show patterns) |

---

## Recommendations

### For Immediate Use

1. **Primary Plan**: Use **GPT plan (gpt-chimera-master-plan.md)** as the implementation guide
   - Copy Section 13 "Phase Plan with Cursor Prompt Packs" as your starting point
   - Include relevant sections (e.g., Section 1 contracts, Section 2.1 tables) as context when needed

2. **Essential Examples**: Use **`chimera-full-schemas.json`** as concrete reference
   - Include relevant ruleset examples in prompts (e.g., "Use `rs_d100_core` structure as template")
   - Use `1_STANDARD_LIBRARY_CATALOG` as seed data for Phase 8
   - Reference `0_SYSTEM_SCHEMAS` when generating TypeScript types

3. **Reference Plan**: Keep **Gemini plan (gemini-chimera-master-plan.md)** for:
   - Quick domain concept refresher
   - High-level architecture discussions
   - When you need to explain the system to stakeholders

### For Enhanced Cursor Prompts

**Hybrid Approach (Recommended):**
1. Start with GPT plan's Phase prompt
2. Add concrete examples from `chimera-full-schemas.json` (most important for clarity)
3. Include GPT plan's relevant JSON contracts (Section 1) for complete field definitions
4. Add Gemini plan's domain model definitions (Section 1) only if conceptual context needed
5. Add GPT plan's acceptance criteria (Section 12) as validation

**Example Enhanced Prompt Structure:**
```
[Context: Database Schema from GPT Section 2.1]
[Context: Example Ruleset Structure from chimera-full-schemas.json 0_SYSTEM_SCHEMAS]
[Context: Real Examples from chimera-full-schemas.json 1_STANDARD_LIBRARY_CATALOG (rs_d100_core, rs_d20_core)]

[Task: GPT Section 13 Phase 1 Prompt - Create chimera_ruleset_templates table]

[Validation: GPT Section 12 Acceptance Criteria]
```

**Why Schemas File First:**
- Concrete examples reduce ambiguity more than abstract definitions
- Cursor can pattern-match against real structures
- Less interpretation needed = fewer errors

### For Phase Refinement

**Break Down Large Phases:**
- GPT Phase 4 "Compiler Pipeline" should be split into 4 sub-phases matching Gemini's 4 steps:
  - 4a: Base Load & Injection
  - 4b: Dependency & Exclusion Resolution
  - 4c: Master Schema Builder
  - 4d: Entity Filter & Initial State

**Add Missing Phases:**
- Gemini's "Phase 1: Base Character Asset" is missing from GPT plan
- Add as Phase 0.5 or integrate into Phase 5

---

## Pros/Cons Summary Table

| Aspect | Gemini Plan | GPT Plan | Schemas JSON |
|--------|-------------|----------|--------------|
| **Conciseness** | ✅ Very concise | ❌ Very long | ✅ Compact (~250 lines) |
| **Actionability** | ❌ Requires interpretation | ✅ Ready-to-use prompts | ✅ Concrete examples |
| **Completeness** | ❌ High-level only | ✅ Comprehensive | ⚠️ Examples only, not a plan |
| **File Paths** | ❌ Not specified | ✅ Explicit paths | ❌ Not applicable |
| **API Routes** | ❌ Not specified | ✅ Complete API spec | ❌ Not applicable |
| **JSON Contracts** | ❌ Minimal examples | ✅ Full contracts | ✅ **Real working examples** |
| **Testing Strategy** | ❌ Not covered | ✅ Detailed strategy | ✅ **Seed/test data ready** |
| **Deployment** | ❌ Not covered | ✅ Complete deployment guide | ❌ Not applicable |
| **Prompt Packs** | ⚠️ Strategy only | ✅ Ready-to-paste | ❌ Not a planning doc |
| **Context Window** | ✅ Fits easily | ❌ Too large for full inclusion | ✅ Fits easily |
| **Domain Clarity** | ✅ Excellent | ⚠️ Good but buried in details | ⚠️ Shows structure, not concepts |
| **Error Handling** | ❌ Not specified | ⚠️ Scattered mentions | ❌ Not applicable |
| **Risk Mitigation** | ❌ Not covered | ✅ Section 14 risk matrix | ❌ Not applicable |
| **Pattern Examples** | ❌ Abstract only | ⚠️ Described but not shown | ✅ **Real patterns demonstrated** |
| **Seed Data** | ❌ Not provided | ⚠️ Referenced but not included | ✅ **Complete standard library** |

---

## Final Verdict

**Best Plan for Cursor Task Breakdown: GPT Plan + Schemas File**

**Primary Resources:**
1. **GPT Plan (gpt-chimera-master-plan.md)**: Implementation guide with ready-to-use prompts
2. **Schemas File (chimera-full-schemas.json)**: Concrete examples and seed data (ESSENTIAL)

**Rationale:**
1. **Immediate Usability**: GPT Section 13 provides copy-paste prompts
2. **Concrete Examples**: Schemas file provides real working rulesets that eliminate ambiguity
3. **Complete Specifications**: GPT plan has all contracts, schemas, and routes defined
4. **Test Data Ready**: Schemas file IS the seed data referenced in GPT Section 11
5. **Pattern Validation**: Real examples show how exclusion groups, dependencies, and state contributions work in practice

**With These Modifications:**
1. **Always Include Schemas Examples**: Reference `chimera-full-schemas.json` in every phase prompt where relevant
2. **Split Large Phases**: Break Phase 4 (Compiler) into 4 sub-phases
3. **Add Base Character Phase**: Include Gemini's Phase 1.2 (Base Character Asset)
4. **Create Phase Summaries**: Extract 1-paragraph summaries for context window efficiency
5. **Consolidate Risks**: Add per-phase "common pitfalls" sections

**Use Gemini Plan For:**
- Stakeholder communication (when you need the "why" not the "how")
- Architecture discussions
- Quick reference for domain concepts
- When you need a lightweight overview

**Critical Insight:**
The schemas file transforms GPT plan from "good" (8/10) to "excellent" (9/10) by providing the missing concrete examples. Without it, Cursor must infer patterns from abstract JSON contracts. With it, Cursor can pattern-match against real working examples.

---

## Next Steps

1. **Create Phase Summaries**: Extract 1-2 sentence summaries from GPT plan for each phase
2. **Enhance Prompt Packs**: Add "Common Pitfalls" and "Validation Checklist" to each GPT phase
3. **Integrate Schemas Examples**: Update each GPT phase prompt to reference relevant examples from `chimera-full-schemas.json`
4. **Create Hybrid Prompts**: Build template prompts that combine GPT plan + schemas file + selective Gemini context
5. **Test with Cursor**: Try Phase 1 prompt from GPT plan with schemas examples included and refine based on results

**Priority Actions:**
- **High**: Include `chimera-full-schemas.json` examples in Phase 0 (Types) and Phase 1 (DB) prompts
- **High**: Use `1_STANDARD_LIBRARY_CATALOG` directly as seed data for Phase 8
- **Medium**: Create a "quick reference" doc that maps GPT phases to relevant schemas sections
- **Low**: Extract Gemini domain concepts into a separate "Architecture Overview" doc for stakeholders

