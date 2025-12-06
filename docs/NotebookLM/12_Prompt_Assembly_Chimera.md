# 12 Prompt Assembly (Chimera)

*(Stone Caster – MVP)*

This document defines the **complete prompt-governance system** for Stone Caster's Chimera Engine.
It specifies how prompts are built, merged, constrained, and executed across:

**MAS-1 → Engine → MAS-2**

This is one of the most critical documents in the entire system and serves as the canonical reference for all runtime prompt behavior.

All JSON examples use **quadruple backticks (````)**.

---

# 1. Purpose of the Prompt Assembly System

The goal of the Chimera Engine is:

* Deterministic structure
* Reproducible outputs
* Consistent narrative tone
* Strict guardrails around LLM behavior
* Zero improvisation outside compiler-approved instructions

Prompts for MAS-1 and MAS-2 are **fully constructed at runtime** using:

* The compiled story’s instruction bundles
* Current game state
* Retrieved lore fragments
* State summaries
* Rule-derived style and behavior constraints

No prompt string may ever contain ad-hoc or developer-written logic.

---

# 2. Prompt Assembly Pipeline

```md
Compiler → CompiledStory.instructions → Runtime Prompt Builder
     ↓                                         ↓
  MAS-1 Input → MAS-1 Output → Engine → MAS-2 Input → MAS-2 Output
```

Each turn follows the same pipeline:

1. Player enters text
2. MAS-1 parses + returns intent JSON
3. Engine resolves deterministic state changes
4. MAS-2 narrates the outcome

---

# 3. State Summary Generation

State summaries condense Tier0/Tier1/Tier2 into a short form for MAS-1 and MAS-2.

Example summary:

```md
Deep Night; stamina 88 (Winded); hunger: Hungry;  
NPC Arven: mood cautious, quirk finger-tapping active;  
Relationship spotlight: Old Debt.
```

State summaries must:

* Use minimal tokens
* Include only relevant fields
* Remain consistent turn-to-turn

---

# 4. MAS-1 Prompt Template

MAS-1 converts free text → structured intent.
MAS-1 never produces prose.

## 4.1 System Prompt (Template)

```md
You are the Chimera Action Interpreter (MAS-1).
You convert player text into structured action intent.
You must:
- Identify intent
- Select skill
- Apply difficulty modifiers
- Apply duration tags
- Detect gating failures
- Return ONLY JSON
```

## 4.2 Template (Fully Assembled)

```json
{
  "system": "You are MAS-1...",
  "instructions": {
    "intent_keywords": [...],
    "difficulty_rules": {...},
    "skill_routing": {...},
    "duration_rules": {...},
    "hard_gates": [...]
  },
  "state_summary": "Deep Night; stamina low...",
  "player_text": "Pick the rusty lock quietly."
}
```

MAS-1 must output:

```json
{
  "intent": "attempt_action",
  "skill_id": "root_finesse",
  "difficulty_mod": -20,
  "duration_tag": "scene",
  "tactic_tag": null,
  "blocked_reason": null
}
```

---

# 5. Engine Layer — No Prompting

Engine uses **pure code**, not LLMs.
Its output is:

```json
{
  "resolution_summary": "Success with strain.",
  "state_delta": {"tier2_system.current_stamina": -2},
  "updated_state": {"...": "..."}
}
```

This feeds MAS-2.

---

# 6. MAS-2 Prompt Template

MAS-2 generates **narrative**, constrained by instructions.

## 6.1 System Prompt (Template)

```md
You are the Chimera Narrative Engine (MAS-2).
Your role is to describe the outcome of the player’s action.
You must:
- Reflect the updated state
- Embody NPC traits, moods, quirks, values, relationships
- Apply style injections
- Optionally integrate relevant lore
- Obey narrative restrictions
- Never reveal mechanics
- Return JSON only
```

## 6.2 Assembled MAS-2 Prompt

```json
{
  "system": "You are MAS-2...",
  "instructions": {
    "style_injections": [...],
    "state_readouts": [...],
    "narrative_restrictions": [...],
    "relationship_behavior": {...},
    "quirk_behavior": {...},
    "agenda_behavior": {...}
  },
  "resolution_summary": "Finesse check succeeded.",
  "state_after_engine": {...},
  "lore_fragments": ["Rumor about guild locks..."]
}
```

MAS-2 must output:

```json
{
  "narration": "The lock gives a reluctant click...",
  "hints": ["Your hunger sharpens your senses."]
}
```

---

# 7. Instruction Bundle Merging (Compiler)

The compiler merges instructions from all selected rulesets.

### 7.1 MAS-1 Merge Rules

* Union of all intent keywords
* Union of all hard gates
* Combined difficulty modifiers
* Combined duration tags
* Skill routing precedence: last loaded wins

### 7.2 MAS-2 Merge Rules

* Append & dedupe style injections
* Append state readouts in priority order
* Union of narrative restrictions
* Merge relationship behaviors
* Merge quirk behaviors
* Merge agenda behaviors

### 7.3 Hard Conflicts

If two rulesets modify the same path without namespacing → compiler error.

---

# 8. Lore Retrieval and Injection

## 8.1 Retrieval Algorithm

* Query vector DB using player intent + context
* Get top k fragments above threshold score
* Deduplicate across last 3 turns

## 8.2 Injection Rules

MAS-2 can only use lore if:

* It reinforces the scene
* It does not contradict state
* It does not overwhelm the turn

Proper style:

> "The grooves on the lock remind you of an old guild rumor..."

---

# 9. Token Budget Governance

Token budgets defined at compile-time:

```json
{
  "model": "gpt-4.1",
  "mas1_budget_tokens": 800,
  "mas2_budget_tokens": 1300,
  "state_summary_limit": 250,
  "lore_fragment_limit": 3
}
```

Runtime enforces:

* trimmed state summary
* limited lore fragments
* removal of unused instruction categories

---

# 10. MAS Error Handling

### 10.1 MAS-1 Errors

* Missing intent → guidance
* Gated action → diegetic block

Example:

```md
"You’re too exhausted to continue." 
```

### 10.2 MAS-2 Errors

* Contradiction
* Missing required readout
* Rule-breaking output

Runtime regenerates with **stricter instructions**.

---

# 11. Full Example Turn (End-to-End)

## Player Input

```md
"Pick the rusty lock quietly."
```

## MAS-1 Output

```json
{
  "intent": "attempt_action",
  "skill_id": "root_finesse",
  "difficulty_mod": -20,
  "duration_tag": "scene",
  "blocked_reason": null
}
```

## Engine Output

```json
{
  "resolution_summary": "Success with strain.",
  "state_delta": {"tier2_system.current_stamina": -2},
  "updated_state": {"...": "..."}
}
```

## MAS-2 Output

```json
{
  "narration": "The lock gives a reluctant click under your careful touch, the Deep Night pressing close around you.",
  "hints": ["Your stomach tightens with hunger."]
}
```

---

# 12. Guardrails Summary

MAS-1 must:

* Produce structured actions only
* Respect hard gates

MAS-2 must:

* Follow narrative tone rules
* Reflect state, never contradict
* Obey restrictions & style injections

Engine must:

* Remain deterministic
* Produce state deltas consistent with rulesets

Compiler must:

* Merge instructions with no ambiguity
* Validate ruleset integrity

---

# 13. Summary

Prompt Assembly is the **operational backbone** of StoneCaster.
It ensures the system produces:

* Predictable results
* Consistent style
* Ruleset-aware narration
* Deterministic mechanical outcomes
* Strictly governed LLM behavior

This specification must be updated with any new rulesets, narrative behaviors, or runtime capabilities.
