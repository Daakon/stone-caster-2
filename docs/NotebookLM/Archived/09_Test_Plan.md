# 09 Test Plan

*(StoneCaster / Chimera Engine – MVP)*

This document defines the **complete test strategy** for validating the MVP system across Compiler, Runtime Engine, MAS-1/MAS-2 prompt pipelines, Database Schema, and API integrity.
All examples use **quadruple backticks (````)** for NotebookLM stability.

The Test Plan covers:

* **Unit tests** (Compiler, Engine logic, DTO validation)
* **Integration tests** (API, DB, RLS, embeddings)
* **Scenario tests** (multi-turn story flows)
* **Prompt tests** (MAS-1 & MAS-2 contract compliance)
* **Regression tests** (ruleset updates)
* **Load tests** (optional, later milestone)

---

# 1. Testing Philosophy

StoneCaster's architecture demands *determinism* in all non-LLM systems and *well-defined constraints* for all LLM outputs.
Therefore, the MVP Test Plan enforces:

1. **Compiler determinism** – same input → identical compiled story.
2. **Engine determinism** – same intent & state → identical resolution.
3. **Strict DTO validation** – all inbound/outbound JSON must match schemas.
4. **RLS integrity** – unauthorized access must be provably impossible.
5. **LLM compliance** – MAS prompts must obey output shape and narrative rules.

---

# 2. Test Categories Overview

```md
| Category                 | Purpose                                      | Tools                |
|--------------------------|----------------------------------------------|----------------------|
| Unit Tests               | Validate individual modules                   | Vitest / Jest        |
| Integration Tests        | Validate API + DB interactions                | Supertest / PostgREST|
| Compiler Tests           | Deterministic merges + schema construction    | Node + Snapshot tests|
| Engine Tests             | Skill checks, stamina, survival, combat       | Node                 |
| MAS Contract Tests       | Validate JSON shape & constraints             | LLM mocks / validators|
| Scenario / Story Tests   | Full multi-turn flows                         | Test harness         |
| RLS Tests                | Ownership / read/write permissions            | Postgres RLS testing |
| Performance Tests        | Turn latency & API responsiveness             | k6 / Locust          |
```

---

# 3. Unit Tests

## 3.1 Compiler Unit Tests

Tests should validate:

* Ruleset dependency resolution
* Exclusion group enforcement
* State contributions merge
* MAS instruction bundle aggregation (no key collisions)
* Lore index construction

Example:

```json
{
  "input": {"rulesets": ["d100-5-pillars", "npc-personalities"]},
  "expected.schema.tier1_entity": {"stats": {}, "personality": {}}
}
```

---

## 3.2 Engine Unit Tests

Validate deterministic logic:

* D100 roll-under evaluation
* Contest outcomes
* Stamina drain
* Hunger decay
* Emotional deltas
* Relationship changes
* Time advancement

Example test:

```json
{
  "state": {"tier2_system": {"current_stamina": 90}},
  "action": {"skill_id": "root_finesse", "difficulty_mod": -10},
  "expected.stamina": 88
}
```

---

## 3.3 DTO Validation Tests

* Validate all MAS-1/MAS-2 contract fields
* Validate all API DTOs
* Validate compiled story schema

---

# 4. Integration Tests

## 4.1 API Endpoints

Test all core endpoints:

* POST /worlds
* POST /entities
* POST /lore
* POST /chimera/compile
* POST /play/start
* POST /play/cast

Each test validates:

* Required fields present
* Correct RLS behavior
* Valid response DTOs

Example:

```json
{
  "endpoint": "/chimera/compile",
  "payload": {"world_id": "uuid", "selected_ruleset_keys": ["d100-5-pillars"]},
  "must_include": ["story_id", "initial_state", "instructions.mas1", "instructions.mas2"]
}
```

---

## 4.2 Database Integration Tests

Validate:

* JSONB writes
* foreign key cascades
* triggers (if added later)
* materialized views (optional)

---

## 4.3 RLS Tests

For each table:

* Owner can INSERT/UPDATE/DELETE
* Non-owner cannot access
* Public tables (rulesets) are readable

Example forbidden read:

```json
{
  "user": "not_owner",
  "action": "select",
  "table": "chimera_entities",
  "expect": "denied"
}
```

---

# 5. Compiler Test Suite

## 5.1 Ruleset Dependency Solver

* Missing dependency → fail
* Valid chain → pass
* Cycles → explicit error

## 5.2 Exclusion Group Conflicts

Tests should confirm:

* Only one skill root may be selected
* Only one combat engine

## 5.3 State Contribution Merge

Tests validate:

* No overwrite of unrelated branches
* Merge precedence respected
* Conflicts raise errors

## 5.4 Instruction Bundle Aggregation

* MAS-1: union of intent keywords, gates, duration rules
* MAS-2: union of injections, readouts, narrative restrictions

Snapshot tests should ensure **no accidental changes** to output.

---

# 6. Engine Test Suite

## 6.1 Skill Checks

Validate:

* Criticals
* Fumbles
* Ordinary success/failure
* Stats influenced by difficulty

## 6.2 Stamina System Tests

Examples:

* Below 20 → status = Exhausted
* Below 0 → state = Collapsed
* Exhausted → block combat actions

## 6.3 Hunger System Tests

* Tick-based hunger decay
* Threshold transitions (Hungry → Starving)
* Starving blocks certain behaviors

## 6.4 Combat System Tests

* Contest resolution
* Ladder state advance (Healthy → Wounded)

## 6.5 Emotional & Relationship Tests

* Relationship affinity deltas
* Mood shifts via preferences & triggers
* Agenda activation when urgency > threshold

---

# 7. MAS Contract Tests

MAS tests validate **shape**, **style constraints**, and **rule adherence**.

## 7.1 MAS-1 Contract Tests

MAS-1 output must:

* Contain all required keys
* Never contain narration
* Respect gating rules
* Map to correct skill

```json
{
  "player_text": "try to sneak inside",
  "expect": {"intent": "attempt_action", "skill_id": "root_finesse"}
}
```

---

## 7.2 MAS-2 Contract Tests

MAS-2 output must:

* Produce valid JSON
* Contain `narration`
* Never break narrative-restrictions
* Use style injections appropriately
* Reflect state readouts

Anti-pattern tests ensure MAS-2 does **not**:

* Reveal mechanics (rolls, stats)
* Contradict stamina/hunger state
* Ignore relationship spotlight

---

# 8. Scenario / Story Tests

These are **multi-turn scripted flows** validating real-world play.

Example Scenario:

```json
{
  "steps": [
    {"input": "Look around.", "expect_state": {"tier0_world.current_tick": 1}},
    {"input": "Pick the lock.", "expect_state": {"tier2_system.current_stamina": 88}},
    {"input": "Talk to Arven.", "expect_state": {"tier1_entities.npc_arven.emotional.mood": "cautious"}}
  ]
}
```

Scenario tests validate:

* Turn sequencing
* State deltas
* Prompt assembly correctness
* Narrative consistency

---

# 9. Regression Tests

Triggered whenever:

* A ruleset changes
* Compiler changes
* Engine mechanics change

Regression suite ensures:

* No output drift in compiled stories
* No behavioral drift in engine logic
* MAS prompts remain stable

Snapshot testing is mandatory for:

* `compiled_json`
* `initial_state`
* `instructions` bundles

---

# 10. Performance Tests (Optional for MVP)

Goals:

* Runtime turn latency < 300ms (Engine only)
* API round-trip < 500ms
* LLM calls dependent on provider SLA

k6 Example:

```json
{
  "vus": 50,
  "duration": "30s",
  "endpoint": "/play/cast",
  "target_latency_ms": 500
}
```

---

# 11. Test Harness Requirements

The test harness must:

* Mock MAS-1/MAS-2 when testing Engine or Compiler
* Use real LLM for contract tests (optional offline mode)
* Preload worlds + entities for scenario tests
* Assert diffable JSON output

---

# 12. Summary

This MVP Test Plan ensures:

* Compiler outputs remain deterministic
* Engine behaviors are predictable and correct
* MAS models obey strict boundaries
* State evolution remains consistent across turns
* APIs are reliable, validated, and secure

Upon completing this test suite, StoneCaster will have **full end-to-end verification**, covering every subsystem required for MVP.
