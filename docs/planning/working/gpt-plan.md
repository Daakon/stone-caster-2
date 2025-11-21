# GPT Implementation Plan

## Phase 0 - Domain Alignment & Terminology Hardening
**Goals**
- Adopt the canonical "Story Dimension" composition (world + forces + elements + lore + entities + player template) and ensure every team artifact uses the corrected StoneCaster naming system (`docs/planning/casting-circle-naming.md:1`).

**Jira-ready tasks**
1. **Create shared glossary + design brief** - Capture authoritative definitions for Forces, Elements, Lore, Casting Circle stones with examples; circulate in Confluence/Notion (`docs/planning/casting-circle-naming.md:8`).
2. **Audit existing services/repos for legacy terminology** - Identify DB tables, GraphQL schemas, UI copy, and pipeline scripts still embedding "packs", "modules", or deprecated structures.
3. **Deliver migration matrix** - For each legacy term, define the new equivalent + code locations + blockers; attach rollout order and owners.
4. **Update developer tooling/docs** - Patch README, API docs, CLI help text, and onboarding slides to use the unified vocabulary before functional work begins.

**Exit criteria**
- Glossary approved by design + engineering leads; all repos have open PRs or issues for renames; no blocker terms remain in UI strings.

## Phase 1 - Creator Layer Data Model & Storage
**Goals**
- Implement the Layered Character architecture (`docs/planning/Chimera System Design.md:28`) and normalize storage for Worlds, Entities, Rulesets, and Lore fragments.

**Jira-ready tasks**
1. **Model Layer 1 asset import** - Load `docs/planning/base_character.json` into persistent storage, expose read-only API, and add schema validation.
2. **Design WorldDefinition persistence** - New table/collection capturing metadata, Cloudflare asset refs, character schema extensions, and lore fragment arrays (`docs/planning/Chimera System Design.md:45`).
3. **EntityTemplate repository** - Implement CRUD for entity blobs that mix narrative + mechanical keys; include diff tooling for authors (`docs/planning/Chimera System Design.md:74`).
4. **RulesetDefinition storage upgrade** - Enforce Hub/Spoke contracts with exclusion groups, dependencies, actions, AI instructions (`docs/planning/Chimera System Design.md:105`).
5. **Lore ingestion & RAG prep** - Pipeline to chunk lore fragments into embeddings ready for compile-time injection (`docs/planning/Chimera System Design.md:65`).
6. **Back-office UI updates** - Extend authoring UI to edit schema extensions, lore fragments, and ruleset metadata; include validation states.

**Exit criteria**
- All creator assets persist with versioning, API tests cover CRUD and validation, and UI allows authors to manage data without manual JSON edits.

## Phase 2 - Casting Circle Experience (World/Forces/Elements/Lore)
**Goals**
- Rebuild the Casting Circle wizard using the four-stone metaphor so authors can assemble Story Dimensions end-to-end (`docs/planning/casting-circle-naming.md:107`).

**Jira-ready tasks**
1. **World Stone workflow** - UI + API flow to select or create a world, set tone/geography, and confirm global schema contributions.
2. **Forces Stone selection + validation** - Implement the 3-step ruleset wizard (Foundations -> Expansions -> Flavor) with dependency/exclusion enforcement (`docs/planning/Chimera System Design.md:99`).
3. **Elements Stone builder** - Tooling to drag/drop or bulk-import NPCs, locations, factions, etc., ensuring they remain independent of Forces while referencing allowed schema keys (`docs/planning/casting-circle-naming.md:41`).
4. **Lore Stone injection** - Interface to attach lore fragments, books, histories, etc., and preview how they enter the RAG index (`docs/planning/casting-circle-naming.md:79`).
5. **Story Dimension summary panel** - Real-time preview showing which Forces, Elements, Lore pieces, and schema contributions will compile; highlight conflicts before compile.

**Exit criteria**
- Authors can build a complete Story Dimension in the UI without direct DB edits; runtime validations prevent illegal combinations of rulesets/elements/lore.

## Phase 3 - Compiler Layer Implementation
**Goals**
- Build the 4-step compiler pipeline that converts authoring assets into CompiledStory artifacts ready for runtime loading (`docs/planning/Chimera System Design.md:149`).

**Jira-ready tasks**
1. **Step 1 loader** - Service to load `base_character` + inject selected world schema extensions into the character template.
2. **Dependency & exclusion engine** - Implement topological validation for active rulesets with actionable error messages and tags aggregation (`docs/planning/Chimera System Design.md:158`).
3. **Master schema builder** - Merge Tier1 and Tier0 allowlists + actions map + AI instructions across all active rulesets (`docs/planning/Chimera System Design.md:164`).
4. **Entity filter** - Iterate entity blobs, split into tier1 mechanical vs tier0 narrative; discard disallowed keys and surface audit log (`docs/planning/Chimera System Design.md:170`).
5. **Artifact writer** - Persist `CompiledStory` objects with master schema, narrative index, and initial state per the contract (`docs/planning/Chimera System Design.md:180`).
6. **Compiler CLI + tests** - Command to compile a Story Dimension locally with snapshot-based regression tests.

**Exit criteria**
- Any Story Dimension that passes Casting Circle validations compiles into a deterministic artifact; compiler errors are localized and test suite covers regression scenarios.

## Phase 4 - Runtime Layer & Loop Contracts
**Goals**
- Implement MAS1 -> Engine -> MAS2 runtime loop with Tier1 mechanical and Tier0 narrative persistence as defined in the GameState contract (`docs/planning/Chimera System Design.md:225`).

**Jira-ready tasks**
1. **GameState schema upgrade** - Update runtime database to store `tier1_mechanical` and `tier0_narrative` exactly as specified (`docs/planning/Chimera System Design.md:250`).
2. **MAS1 service** - Interpret user prompts using master_schema actions and produce `Mas1ResponseDto` with sentiment analysis hooks (`docs/planning/Chimera System Design.md:280`).
3. **Engine executor** - Deterministic evaluator that consumes `action_dto`, validates costs, executes logic references, and emits `EngineResultDto` (`docs/planning/Chimera System Design.md:298`).
4. **MAS2 narrator** - Generate ripple narrative text + Tier0 mutations while consuming lore fragments and runtime sentiment (`docs/planning/Chimera System Design.md:313`).
5. **State reducer + persistence** - Apply numeric deltas and narrative mutations atomically, ensuring rollback on failure.
6. **Client view formatter** - Produce ClientViewDto snapshots combining tier1/tier0 state + latest narrative for the frontend (`docs/planning/Chimera System Design.md:327`).

**Exit criteria**
- Runtime loop executes for compiled stories end-to-end with logging/tracing; integration tests cover sample scenarios from standard library rulesets.

## Phase 5 - Standard Library Integration & QA
**Goals**
- Import reference rulesets and validate them through the new pipeline, ensuring Casting Circle surfaces them properly and compiler/runtime execute expected behaviors (`docs/planning/chimera-full-schemas.json:21`).

**Jira-ready tasks**
1. **Ruleset data import** - Seed DB with all foundations/expansions/flavor modules from `chimera_full_schemas.json` and attach metadata from Part 4 tables (`docs/planning/Chimera System Design.md:333`).
2. **Validation suite** - Automated tests that compile sample story mixes (e.g., D100 + Survival + Gothic) and assert resulting master_schema/actions_map (`docs/planning/chimera-full-schemas.json:233`).
3. **Runtime smoke packs** - Scenario scripts that run MAS loop using seeded stories to confirm engine + narrator outputs.
4. **Lore-to-RAG verification** - Ensure lore fragments selected in Casting Circle appear inside `narrative_context_index` of compiled artifacts.
5. **Performance & observability** - Instrument compiler + runtime metrics (compile time, loop latency) and add dashboards/alerts.
6. **Author documentation** - Publish "How to extend the Standard Library" guide referencing canonical schemas.

**Exit criteria**
- Standard library stories compile and run without manual fixes, QA reports green across compiler/runtime pipelines, and documentation is live for authors.

## Phase 6 - Launch, Migration, and Support
**Goals**
- Roll out to production, migrate legacy stories, and set up support processes.

**Jira-ready tasks**
1. **Migration tooling** - Scripts to map legacy stories into Story Dimension format, including forces/elements/lore separation.
2. **Backfill compiled artifacts** - Re-run compiler for every migrated story and store compiled outputs for runtime availability.
3. **Feature flag rollout** - Gate Casting Circle + compiler + runtime changes behind configurable flags with gradual rollout plan.
4. **Monitoring & triage playbooks** - Document how to debug compiler failures, runtime loop issues, and author-reported problems.
5. **Training sessions** - Run workshops for narrative designers and live-ops showing new workflows.
6. **Post-launch review** - Collect metrics, author feedback, and bug trends to plan the next iteration.

**Exit criteria**
- All active stories migrated, new pipeline fully live, and support teams trained with documented playbooks.
