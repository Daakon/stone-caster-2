# Jev shadow evaluation and canary baseline

Date: 2026-09-21
Paired/latency follow-up rerun: 2026-09-23

## Safety boundary

Jev is observer-only by default. The only opt-in canary authority is independently gated for `action_classification` and `feasibility`; target selection, engine requirement, NPC reaction eligibility, and impact magnitude remain shadow-only. Both canary flags default to `false`, so existing Director-authoritative behavior is unchanged unless explicitly enabled.

The canary path does not mutate state. It supplies validated typed fields used to construct or constrain Director intent; the Engine/state layer remains the sole gameplay authority. A Jev field is authoritative only when its schema is valid, its deterministic validator accepts it, and its confidence meets `JEV_CANARY_CONFIDENCE_THRESHOLD`. Otherwise the current OpenRouter/GPT Director path is used immediately.

`JEV_CANARY_COMPARE=true` runs Jev and GPT Director together and follows the validated Jev fields for the two promoted families while recording disagreement. `JEV_CANARY_COMPARE=false` with `JEV_CANARY_SKIP_GPT=true` measures the no-redundant-Director path; GPT is still called for turns where the promoted fields cannot safely produce a typed intent. No additional Jev family has been promoted.

No hosted Supabase data was modified and nothing was deployed.

## Architecture assessment

Stone Caster already has a backend provider boundary for the primary model (`backend/src/config/llm-config.ts` and `backend/src/services/runtime/llm.provider.ts`), role-specific Director/Narrator services, per-turn LLM usage capture, and persisted turn/audit records. Jev is added beside those seams through `JevShadowService` and the `JevRunner` interface; the default runner uses TypeSafe's supported JavaScript SDK once per turn with a batched, closed-set request. The supported `jev.cmd` path remains available as an explicit development fallback via `JEV_RUNNER=cli`.

Initial Jev responsibilities are action classification and feasibility checks, selected because both have bounded outputs and deterministic validators. Jev does not handle prose narration, world-state mutation, Engine resolution, persistence, architecture, debugging, or ambiguous/high-impact engineering decisions. The Engine and application state remain authoritative.

No generic `jev.askAnything` MCP tool was added. The repository already has a narrowly scoped local Jev CLI capability, while exposing unrestricted provider access to the development agent would bypass the typed contracts and validation boundary. A future agent-facing tool should expose only a specific contract such as classification or evaluation if a measured workflow needs it.

Telemetry now records whether Jev was attempted, whether its response and schema were valid, whether deterministic validation passed, whether fallback occurred, whether the primary model ran, and the final authority (`jev`, `primary`, `deterministic`, or `none`).

## Evaluation harness

The comparison report does not treat the Director as ground truth. Each decision is independently labeled when deterministic evidence is available:

- `director_correct_jev_correct`
- `director_correct_jev_wrong`
- `director_wrong_jev_correct`
- `both_wrong`
- `undetermined` when deterministic evidence cannot decide

The deterministic validators check target presence and eligibility, registered engine capability and trigger mapping, state/capability feasibility, schema-valid impact applicability, eligible NPC reaction candidates, and supported action classification. A decision is left undetermined when those rules do not establish an answer; no second LLM judge is used.

The six decision families are emitted in one batched TypeSafe SDK request per turn: action classification, engine requirement, feasibility, primary target, impact magnitude, and NPC reaction. This verifies that the six decisions are not six serial Jev calls. The telemetry records `single_batched_request`, request-level wall latency, and the batch latency attached to each decision. No concurrency optimization has been applied. Only action classification and feasibility can affect authority; the other four families remain shadow-only.

Telemetry records request/response character counts, estimated tokens (`characters / 4`), decision count and types, command, execution mode, model/version when exposed, per-decision latency scope, Jev cost, GPT cost avoided, authority/fallback decisions, disagreement, gameplay outcome, and configurable pricing metadata. Pricing is read from environment variables and is not part of gameplay logic:

```text
JEV_INPUT_USD_PER_1M_TOKENS
JEV_OUTPUT_USD_PER_1M_TOKENS
JEV_SHADOW_TIMEOUT_MS
GPT_DIRECTOR_INPUT_USD_PER_1M_TOKENS
GPT_DIRECTOR_OUTPUT_USD_PER_1M_TOKENS
JEV_MODEL
JEV_MODEL_VERSION
JEV_HIGH_CONFIDENCE_THRESHOLD
JEV_CANARY_ACTION_CLASSIFICATION
JEV_CANARY_FEASIBILITY
JEV_CANARY_CONFIDENCE_THRESHOLD
JEV_CANARY_COMPARE
JEV_CANARY_SKIP_GPT
JEV_CANARY_BASELINE_GPT_COST_USD
```

The current pricing defaults are `JEV_INPUT_USD_PER_1M_TOKENS=0.042` and `JEV_OUTPUT_USD_PER_1M_TOKENS=0`. They are telemetry-only, live outside gameplay logic, and can be overridden per environment.

## Required-green baseline

The maintained smoke command below is the required-green baseline for this work. It covers the Phase 1/Phase 2 contract smoke, runtime guards and rule steps, Jev, API routes, and mock-action compatibility.

```text
npm.cmd exec --workspace=backend -- vitest run --silent \
  tests/awf-bundle-assembler.core-ruleset.test.ts \
  tests/integration/turns.create-v2.spec.ts \
  tests/awf-phase16-mechanics.test.ts tests/awf-phase17-economy.test.ts \
  tests/awf-phase18-party.test.ts tests/awf-phase19-world-sim.test.ts \
  tests/awf-phase20-authoring.test.ts tests/awf-phase21-dialogue.test.ts \
  tests/awf-phase24-metrics.test.ts tests/awf-phase25-ops.test.ts \
  tests/awf-phase26-marketplace.test.ts tests/awf-phase27-autoplay-simple.test.ts \
  tests/awf-phase28-liveops-simple.test.ts \
  src/services/runtime/rule-steps.test.ts \
  src/services/runtime/engine.fumble.test.ts \
  src/services/runtime/gameplay-guards.test.ts \
  src/services/runtime/jev-shadow.service.test.ts \
  src/tests/mock-actions.spec.ts \
  tests/catalogNpcs.openapi.spec.ts \
  tests/routes/publishing.public.preflight.test.ts \
  tests/routes/publishing.admin.activity.test.ts \
  tests/routes/publishing.admin.audit.test.ts \
  tests/routes/publishing.admin.checklist.test.ts \
  tests/routes/publishing.wizard.rollout.test.ts \
  tests/routes/admin.test.ts
```

Result: **25 test files passed, 393 tests passed**.

Additional green checks:

- `npm.cmd run build:server` -- passed.
- Jev service/test lint -- passed.
- `npm.cmd run local:smoke:real` -- 14/14 passed.
- `npm.cmd run local:smoke:browser` -- 2/2 passed in the local browser smoke run.
- `node --check scripts/stonecaster-playtest.mjs` -- passed.
- `node --check scripts/jev-paired-evaluation.mjs` and `node --check scripts/jev-latency-probe.mjs` -- passed.
- The maintained 25-file suite was rerun after the SDK and interleaved-harness changes: 25 files / 393 tests passed.
- `git diff --check` -- passed.

## Legacy-known-red baseline

The full server command remains tracked separately:

```text
npm.cmd run test:server
```

Current result: **160 failed files / 234, 383 failed tests, 7 errors** across **1,498 tests**. The failed-file, failed-test, and error counts match the recorded legacy baseline; the total test count includes additional focused runtime/Jev tests that are green. The failures are concentrated in historical suites for removed `.js` module paths, old Supabase mock chains, legacy profile/publishing expectations, older runtime expectations, and other unrelated migrations. The new Jev tests are green and did not add a new legacy failure to that aggregate.

The direct historical Director/Engine runtime group is also tracked as known red: `d100-resolution.test.ts` has one seeded-roll expectation failure and `engine.service.test.ts` has five old outcome/delta expectations. Those failures are outside the maintained required-green smoke subset above.

## Larger Jev dataset

Scenario file: `scripts/playtest-scenarios/jev-shadow-dataset.json`.

It contains 27 turns covering observation, normal conversation, persuasion, flirting, threats, combat, counterattack/brace, movement, rest, food/resource use, impossible actions, ambiguous actions, multi-action inputs, malformed and nonsensical inputs, named and unnamed NPCs, unsupported engine actions, and multi-turn continuity.

### Real OpenRouter gameplay + Jev, compare mode

The run used the local Supabase stack, the real OpenRouter Director/Narrator path, Jev in canary compare mode, and the default Engine/state authority:

| Metric | Result |
|---|---:|
| Turns / available turns | 27 / 27 |
| Jev decisions | 156 |
| Deterministically labeled | 99 |
| Undetermined | 57 |
| Director correct / Jev correct | 57 |
| Director correct / Jev wrong | 6 |
| Director wrong / Jev correct | 32 |
| Both wrong | 4 |
| Jev validity | 100% |
| Average Jev confidence | 0.743 |
| Average Jev probability | 0.848 |
| Average batch-scoped decision latency | 469 ms |
| Total Jev wall-clock latency | 12,623 ms |
| Jev estimated cost | $0.000700 |
| GPT Director observed cost | $0.012065 |
| Hypothetical shadow hybrid cost | $0.004600 |
| Hypothetical shadow hybrid savings | 61.9% |

The six-family shadow comparison remains useful for evaluation, but the Director is not used as the label source. In compare mode all 27 Director calls still ran, so actual Director calls avoided and actual cost savings were zero. The 54 promoted-family decisions produced:

| Canary metric | Result |
|---|---:|
| Jev-authoritative decisions | 41 / 54 |
| GPT-authoritative fallback decisions | 13 / 54 |
| Authoritative Jev accuracy | 100% (41 / 41) |
| Fallback rate | 24.1% (13 / 54) |
| False-accept rate | 0% (0 / 41) |
| False-reject rate | 8.9% (4 / 45 known-correct Jev decisions) |
| Correct-decision confidence | 0.62–1.00, mean 0.949 (45) |
| Incorrect-decision confidence | none observed |
| Director calls avoided | 0 / 27 |
| Actual cost savings | -$0.000700 (redundant Jev cost) |
| Average Jev end-to-end latency | 6,603 ms |
| Average Director latency | 2,380 ms |
| Latency delta | +4,223 ms |
| Possible gameplay divergences | 13 |

The “possible gameplay divergence” count means a promoted Jev field disagreed with Director and the turn changed state or was marked impossible. It is not a claim that the Jev result was wrong; the Engine still accepted/rejected the final typed intent.

By family in compare mode:

- **Action classification:** 21/27 Jev-authoritative and 6/27 GPT-authoritative, 100% Jev-authoritative accuracy, 22.2% fallback, mean confidence 0.908.
- **Feasibility:** 20/27 Jev-authoritative and 7/27 GPT-authoritative, 100% Jev-authoritative accuracy, 25.9% fallback, four false rejects among 24 known-correct Jev decisions, mean confidence 0.880.

### Real OpenRouter gameplay + Jev, skip-GPT mode

The same 27-turn dataset was run with the two canary flags enabled, `JEV_CANARY_COMPARE=false`, `JEV_CANARY_SKIP_GPT=true`, and a measured local control baseline of `$0.0004468556` per Director turn for avoided-cost accounting:

| Canary metric | Result |
|---|---:|
| Jev-authoritative decisions | 39 / 54 |
| GPT-authoritative fallback decisions | 15 / 54 |
| Authoritative Jev accuracy | 100% (39 / 39) |
| Fallback rate | 27.8% (15 / 54) |
| False-accept rate | 0% (0 / 39) |
| False-reject rate | 13.3% (6 / 45 known-correct Jev decisions) |
| Correct-decision confidence | 0.69–1.00, mean 0.950 (45) |
| Incorrect-decision confidence | none observed |
| Director calls avoided | 17 / 27 |
| Jev estimated cost | $0.000700 |
| GPT cost avoided | $0.007597 |
| Actual baseline-based cost savings | $0.006897 / 90.8% |
| Average Jev end-to-end latency | 5,200 ms |
| Average Director latency on fallback turns | 1,869 ms |
| Latency delta | +3,331 ms |
| Possible gameplay divergences | 7 |

The skip-mode savings are measured against the configured local Director baseline, not a provider invoice. Jev remained the slower end-to-end path in this run because the current implementation waits for a Jev decision before proceeding; no latency optimization was made.

By family in skip mode:

- **Action classification:** 21/27 Jev-authoritative and 6/27 GPT-authoritative, 100% Jev-authoritative accuracy, 22.2% fallback, no false rejects among known-correct decisions, mean confidence 0.915.
- **Feasibility:** 18/27 Jev-authoritative and 9/27 GPT-authoritative, 100% Jev-authoritative accuracy, 33.3% fallback, six false rejects among 24 known-correct Jev decisions, mean confidence 0.880.

## Paired gameplay and latency follow-up

The paired harness is in `scripts/jev-paired-evaluation.mjs`. It compares the persisted authoritative record emitted by `scripts/stonecaster-playtest.mjs`, including mechanical state, scene/location presence, turn metadata, and the Director intent actually used. Narrative output and suggested-action queues are compared separately. Entity IDs are canonicalized by display name so separate local game instances can be compared.

The paired scenario sets are:

- `scripts/playtest-scenarios/jev-paired-core.json`: observation, rest, food, water, impossible actions, movement, and continuity.
- `scripts/playtest-scenarios/jev-paired-interaction.json`: named conversation, persuasion, flirting, threats, combat/counterattack, unnamed NPC interaction, and ambiguity.

Each mode ran both eight-turn sets (16 turns total) against the same canonical starting state and input sequence. The scenario `seed` values are reproducibility labels; the current local API does not expose a supported game-seed override, so the runs used separate game IDs. Successful runs explicitly targeted local Supabase and did not modify hosted Supabase.

The current control-vs-mode paired results were:

| Comparison | Full persisted state | Mechanical state | Scene/presence | Action queue | Turn metadata | Director intent | Narrative-only |
|---|---:|---:|---:|---:|---:|---:|---:|
| GPT-only vs Jev compare | 16/16 (100%) | 14/16 (87.5%) | 2/16 (12.5%) | 16/16 (100%) | 16/16 (100%) | 16/16 (100%) | 0/16 (0%) |
| GPT-only vs Jev skip-GPT | 16/16 (100%) | 14/16 (87.5%) | 2/16 (12.5%) | 16/16 (100%) | 16/16 (100%) | 16/16 (100%) | 0/16 (0%) |

The compare run had one failed interaction turn (HTTP 422) because the primary Director returned the invalid schema value `impact_tier: "Minor"`; this was not counted as a Jev failure. These divergence rates are not evidence that Jev caused the state changes. Each run invokes real OpenRouter Director/Narrator behavior in separate game instances, so natural model sampling caused decision and state differences even with equal canonical starts. Jev-specific telemetry marked possible gameplay divergence on 3/16 compare turns and 2/16 skip turns; those markers indicate a promoted-field disagreement or impossible-state outcome, not a Jev correctness verdict. The harness reports full persisted state, mechanical state, scene/presence, action queue, turn metadata, Director intent, and narrative-only divergence separately without treating the Director as ground truth.

### Paired canary metrics

Across the two paired sets, 32 promoted-family decisions were evaluated per mode:

| Metric | Jev compare | Jev skip-GPT |
|---|---:|---:|
| Jev-authoritative | 30/32 | 30/32 |
| Fallback rate | 6.25% | 6.25% |
| Authoritative Jev accuracy | 100% (30/30) | 100% (30/30) |
| False accepts | 0 (0%) | 0 (0%) |
| False rejects | 0 (0%) | 0 (0%) |
| Correct confidence | mean 0.983 (30) | mean 0.982 (30) |
| Incorrect confidence | none observed | none observed |
| Action classification: fallback / accuracy / false accept / false reject | 12.5% / 100% / 0% / 0% | 12.5% / 100% / 0% / 0% |
| Feasibility: fallback / accuracy / false accept / false reject | 0% / 100% / 0% / 0% | 0% / 100% / 0% / 0% |

The feasibility result is too small to overturn the larger dataset's false-reject signal, so feasibility remains in canary. Action classification remains the primary promotion candidate.

### Latency breakdown

The local probe is `scripts/jev-latency-probe.mjs`. It runs equivalent requests through `jev.cmd decide --file` and the project dependency `@typesafe-ai/sdk`; the CLI side remains useful for measuring the optional fallback overhead. Results from the prior CLI/SDK probe were:

| Component | Average |
|---|---:|
| `jev.cmd` process startup | 7.4 ms |
| Request serialization | 0.55 ms |
| Full CLI wall clock | 400.27 ms |
| CLI-reported request/network/inference aggregate | 293 ms |
| CLI overhead outside reported request | 107.27 ms |
| Parsing/reporting | 0.12 ms |
| Persistent SDK total | 207.12 ms |
| Persistent SDK request/network aggregate | 207 ms |

The installed client reported model `jev-1.13.0`, approximately 842 input tokens and 148 output tokens for the probe request. It exposes request timing and token usage, but not a separate server inference timer. Process startup was therefore not the source of the approximately 3.3-second end-to-end skip-mode penalty in the prior probe. The supported SDK path is now preferred and removes the measured CLI wrapper overhead; no speculative protocol was implemented.

The current five-iteration probe measured CLI startup at 8.05 ms average, CLI wall clock at 459.40 ms, CLI-reported network/inference at 345 ms, CLI overhead at 114.40 ms, and project SDK total at 212.47 ms. Removing the measured CLI wrapper overhead projects approximately 345 ms for the same CLI request; the supported SDK measured approximately 212 ms end-to-end. The ~3.3-second gameplay penalty was therefore not process startup and does not persist in the interleaved SDK run.

### Interleaved SDK gameplay run

`scripts/jev-interleaved-latency.mjs` ran both eight-turn scenario sets (16 turns per mode) against the same canonical setup and inputs, rotating mode order every turn. `scripts/jev-interleaved-report.mjs` aggregates the persisted timeline/audit outputs. These runs measure latency and deterministic Jev validation; independently sampled GPT outputs are not used as proof of causal Jev state divergence.

| Mode | Full turn p50 / p95 | SDK Jev p50 / p95 | Director p50 / p95 (calls) | Narrator p50 / p95 | Actual Director calls / avoided | Fallback turns |
|---|---:|---:|---:|---:|---:|---:|
| GPT-only | 8,869 / 27,248 ms | — | 3,638 / 20,718 ms (16) | 5,279 / 8,797 ms | 16 / 0 | — |
| Jev compare | 8,663 / 22,237 ms | 270 / 409 ms | 3,596 / 15,424 ms (16) | 5,150 / 7,739 ms | 16 / 0 | 2 |
| Jev skip-GPT | 6,473 / 10,381 ms | 240 / 290 ms | 2,177 / 4,785 ms (3) | 5,891 / 9,757 ms | 3 / 13 | 3 |

The previous approximately 3.3-second skip-GPT penalty does not persist: in this interleaved sample, skip-GPT was 2,396 ms faster at p50 and 16,867 ms faster at p95 than GPT-only. The difference includes avoided Director work and normal provider variance; it is not attributed to Jev alone. Compare mode added about 287 ms average SDK Jev time while retaining all Director calls.

Across the 16 valid canary decisions per promoted family and mode, action classification was 14/16 Jev-authoritative with 100% accuracy on accepted decisions, 2/16 fallback, zero false accepts, and zero false rejects. Feasibility was 16/16 Jev-authoritative with 100% accuracy, zero fallback, zero false accepts, and zero false rejects. Action classification remains the primary promotion candidate. Feasibility remains canary pending a larger sample.

The skip-GPT path made 13/16 actual Director calls unnecessary. At the configured Jev rate, skip-GPT Jev cost was $0.001600 across both sets; observed GPT-only Director cost was $0.008324, skip-GPT fallback Director cost was $0.001281, gross GPT cost avoided was $0.007044, and net savings after Jev were $0.005444. These are local estimated costs from telemetry, not provider invoice amounts.

The first interaction probe also reproduced the known primary-Director schema failure (`impact_tier: "Minor"`, HTTP 422); the corrected rerun completed all 16 turns successfully. This remains a legacy Director validation issue, not a Jev failure.

## Promotion review

Only action classification and feasibility have an implemented canary gate, both default-off. On this larger dataset, both had zero false accepts at the configured 0.80 threshold, but the sample is still a local canary measurement and not a production recommendation. Action classification had the lower fallback rate and no observed false rejects in the promoted-family labels. Feasibility was also perfectly accurate when accepted, but had more fallbacks and false rejects.

Target selection, engine requirement, NPC reaction eligibility, and impact magnitude remain shadow-only. In particular, NPC reaction produced known Jev errors and engine requirement disagreed with deterministic rules; neither is eligible for promotion. No additional Jev decision family should be promoted without review.
