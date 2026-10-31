# 05 — Prompt-Driven Rule Packs, Prompt Compilation and Model Strategy

## Core choice: rich rules without a coded rules engine

StoneCaster supports simple narrative experiences and sophisticated rules-heavy RPGs through **versioned prompt modules**. Combat, skills, magic, social negotiation, crafting, resources, and progression are adjudicated by the model using selected instructions. The application does **not** hardcode dice, damage, skill checks, RPG formulas, stat progression or world-specific mechanics.

Code remains deterministic where necessary for integrity: authorization, IDs, content publication, active run status, scenario entry, event schema, duplicate prevention, atomic persistence, quotas, and visibility restrictions.

## Rule Pack definition

A Rule Pack is creator-facing reusable content with:

- `id`, `name`, `scope`, `revision`, `creator`, `worldCompatibility`, `visibility`.
- `intent`: the behavior this pack is meant to produce.
- `instructions`: the validated prompt module; explicit world-specific mechanics may be very detailed.
- `activationHints`: always-on, scene tags, action kinds, actor traits, scenario needs, or explicit selection.
- `priority`: bounded ordering within the hierarchy; never platform privilege.
- `requirements`: which typed state or knowledge chunks must be available before invocation.
- `examples`: positive/negative worked examples, useful for behavior consistency.
- `conflictsWith` and `dependsOn` references for creation-time checks.
- `evaluationFixtures`: scenarios that test expected behavior and contradictions.
- `qualityLabels`: narrative, tactical, relational, experimental (derived from evaluation, not marketing guesses).

Pack categories:

| Category | Examples | Typical activation |
|---|---|---|
| Character behavior | Agency, truthful self-presentation, relationship continuity | Often always-on |
| Social | Persuasion, politics, negotiation, reputation | Social confrontations |
| Capabilities | Skills, abilities, magic limits, crafting | Actions involving capability checks |
| Conflict | Tactical combat, injuries, fear, fatigue | Physical conflict |
| World systems | Time, travel, faction pressure, survival | Events that depend on world rules |
| Narrative style | Scene length, tone, action/dialogue balance | Scene preference (no authority over canon) |

## Rule selection levels

1. Platform guardrails and trusted event contracts (**not editable by creators**).
2. World canon, native constraints and default rule packs.
3. Scenario-specific additions/selections compatible with the world.
4. Character/persona ability definitions and NPC behavioral guidelines.
5. Player presentation preferences and current action.

A scenario can request a rule pack or make scenario-specific extensions, but cannot silently disable hard world limitations. A creator can provide a rules-only pack without creating a whole world. The compiler performs conflict detection and exposes the active rules to the creator.

## PromptCompiler contract

```ts
type CompileRequest = {
  timelineId: string; scenarioRunId: string;
  action: string; actors: string[];
  modelProfileId: string;
};

type CompiledSceneContext = {
  platformInstructions: string;
  stableWorldAndRules: string;
  activeScenarioAndActors: string;
  retrievedEvidence: Array<{ sourceId: string; text: string; kind: string }>;
  recentHistory: string;
  currentPlayerAction: string;
  outputContractVersion: string;
  audit: {
    includedRuleRevisionIds: string[];
    retrievedChunkIds: string[];
    estimatedInputTokens: number;
  };
};
```

Compiler duties: load the right published revisions; select relevant packs; enforce dependencies and conflicts; include mandatory state and authorized memories; maintain clear source labels and role separation; use token budgets and caching; fail with a diagnostics report if critical context cannot be assembled.

**Creator-authored instructions are lower trust than platform requirements.** Don't interpolate raw creator text into a higher-priority system message without validation and role separation. Apply pack schema validation and injection screening; preserve an audit of the compiled rule versions.

## Example: optional detailed tactical pack

A creator selects `Tactical Conflict — Detailed`. The module can direct the model to:

- Evaluate each participant's established abilities, training, intent, fatigue, injuries, equipment, range, movement and surroundings.
- Treat tactics as consequential: exploiting balance, surprise, positioning or preparation may overcome numerical strength.
- Describe plausible partial outcomes, counters, retreats, costs and recovery.
- Respect specific world limitations on magic/weapons/abilities; don't conjure unestablished skills.
- Propose injury, resource, position and disposition events with evidence from the scene.
- Avoid predetermined victory, automatic success, and arbitrary punishment.

This is a **prompt interpretation of fictional combat**, not a numeric combat resolver. Authors who want exact mathematical rules can include mathematical descriptions and worked examples in a pack; the platform must document that an LLM may make calculation or consistency errors. For exact deterministic tournament-quality mechanics, a future optional external tool/rules plugin could be offered, but is not required for the core product.

## Model architecture

Use a provider-neutral TypeScript `ModelGateway` with a **capability registry** rather than switching code on raw model names:

```ts
type ModelProfile = {
  id: 'standard' | 'premium' | 'experimental' | 'creator' | 'memory';
  provider: string; model: string;
  capabilities: {
    structuredOutput: boolean;
    tools: boolean;
    streaming: boolean;
    contextWindow: number;
  };
  estimatedCostPerMillionInput: number;
  estimatedCostPerMillionOutput: number;
  maxInputTokens: number; maxOutputTokens: number;
  enabled: boolean; evaluationVersion: string;
};
```

**Model names, API prices, promo rates, effort parameters and context sizes are configuration**, checked against current provider APIs before deploy. Do not bake October 2026 prices or the latest consumer model name into application logic or content definitions.

- Direct adapters for major providers (OpenAI, Anthropic, Google) through a common interface / AI SDK where supported.
- OpenRouter or another configurable aggregator for experimental/open-weight models; provider routing and structured output availability must be tested per endpoint.
- For each model, record supported structured schema, tool semantics, safety behavior, timeout, input/output prices, and best known rule-pack performance.
- Keep model selection pinned per scenario run unless player explicitly changes it and accepts a checkpoint.
- Fallback on service failure only to vetted, schema-compatible alternatives. Never silently change models if it substantially changes user price, content behavior, or required features.
- Avoid dedicated one-LLM-per-NPC calls. One scene model handles the cast while knowing each actor's private and shared context.

## Orchestration policy

Default one high-quality scene-model call per ordinary turn. Conditional second step when classification, feasibility or schema-repair is likely to improve correctness/cost. Previous Jev work may be reused only after benchmark; it must not become mandatory for all scenes without evidence. Treat model reasoning effort as a per-profile tunable, not a global constant.

No specific orchestration framework is required. Start with AI SDK and small services; prototype Mastra separately only if it reduces code or improves observability. Do not stack multiple overlapping agent frameworks.

## Cost and quality controls

- Budget by user subscription/credit allowance, model profile, input/output tokens, optional supporting calls, and generation jobs.
- Cache stable compiled world/rule segments keyed by revision IDs, and benefit from provider prompt caching if supported.
- Summarize/compact context carefully; retain authoritative events and critical NPC identity even when token budget is tight.
- Log usage and model rates used at time of call, retries, failures, and final committed outcome. Charge only according to explicit product billing policy; use a reservation/settlement design for credits.
- Release models through private evaluation → experimental → standard/premium. Validate rule-following and fiction quality, not just aggregate benchmark scores.

## Baseline evaluation matrix

For each model profile and major ruleset test: NPC agency, private knowledge containment, cross-scenario continuity, relationship consistency, tactical plausibility, content schema adherence, cost/turn, p50/p95 latency, and recovery after invalid output. Record when a model is unsuitable for detailed rule packs even if excellent at dialogue.
