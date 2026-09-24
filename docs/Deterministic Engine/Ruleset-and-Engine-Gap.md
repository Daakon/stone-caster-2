# Comprehensive Ruleset & Engine Gap Analysis
**Status:** Review of Cross-System Dependencies & Conditional Logic
**Objective:** Align deterministic actions with variable state availability and intended gameplay depth.

---

## 1. The "Variable State" Problem (Conditional Execution)
**Issue:** Actions currently assume all rulesets are active. If a story uses `cinematic-combat-lite` but *not* `vitality-stamina-system`, the engine will crash when trying to deduct stamina, or unfairly ignore the *lack* of stamina penalties.

**Requirement:** Every logic step accessing a specific subsystem (Vitality, Needs, Social) must be wrapped in a **Schema Existence Check**.

### Missing Engine Logic: `state.exists`
We need a standard condition to verify a path exists before acting on it.

* **Logic Patch:** Add `conditions` to every "Optional" step.
    * *Example:* In `resolve_clash`, the Stamina Deduction step must have:
        ```json
        "conditions": [{ "op": "exists", "path": "tier1_entity.current_stamina" }]
        ```

---

## 2. Cross-System Dependency Matrix (The "Gaps")
This section identifies where specific actions should trigger effects in *other* rulesets if they are present.

### A. Combat <-> Vitality (Stamina Impact)
* **Current State:** Combat deducts stamina (fixed cost).
* **Missing Logic (The Gap):**
    * **Exhaustion Penalty:** If `current_stamina` is low (< 20%), the actor should suffer a major penalty to `combat_prowess`.
    * **Adrenaline Surge:** If `current_stamina` is full, there might be a slight initiative or defense bonus.
* **Required Fix:**
    * Add a `logic.map_range` step in `resolve_clash` to convert Stamina % to a Modifier (-20 to 0) *before* the dice roll.
    * Wrap this in `state.exists` check.

### B. Time <-> Needs (The "Rest" Trap)
* **Current State:** `take_rest` advances the clock and restores stamina.
* **Missing Logic:**
    * **Metabolic Decay:** Advancing time via "Rest" does *not* currently trigger the hunger/thirst decay defined in `needs-survival-basic`. A player could rest for days and never starve.
* **Required Fix:**
    * `take_rest` must explicitly call or trigger the `apply_metabolic_decay` logic, passing the duration (e.g., "long_rest") as an argument.

### C. Social <-> Memory (Contextual Bonuses)
* **Current State:** `run_context_spotlight` surfaces a memory text string.
* **Missing Logic:**
    * **Mechanic Impact:** The memory is purely visual. It does not affect the *math* of the interaction.
    * If the Spotlight is "Rival (-10)", purely social checks (Persuade) should suffer a penalty.
* **Required Fix:**
    * Social actions (`propose_relationship_arc`) need to read the `current_interaction_context` severity/role and apply it as a modifier to the success threshold.

---

## 3. Detailed Action & State Audit
The following table outlines exactly what needs to be updated in the `CompiledStory` JSON to achieve the intended depth.

| Action / Scope | Gap Identified | Proposed Solution | Dependency |
| :--- | :--- | :--- | :--- |
| **`resolve_clash`** | **Missing Stamina Penalty:** High/Low stamina doesn't change hit chance. | Add `calc_stamina_mod` step: Map `current_stamina` (0-20%) to -20 penalty. | `vitality-stamina-system` |
| **`resolve_clash`** | **Missing Escalation:** Wounds are binary (Healthy/Wounded). | Update `state.transition` map to 3-tier: Healthy → Minor → Major → Defeated. | `cinematic-combat-lite` |
| **`take_rest`** | **Hunger Immunity:** Resting doesn't make you hungry. | Inject `apply_metabolic_decay` step into `take_rest` action logic. | `needs-survival-basic` |
| **`consume_food`** | **Infinite Eating:** No check for "Overfed" or "Sick". | Add condition: If `satiety > 95`, prevent eating or apply "Sluggish" status. | `needs-survival-basic` |
| **`propose_arc`** | **No History:** Ignores past betrayals (Tags) in math. | Add logic to sum `severity` of negative tags and subtract from Success Chance. | `npc-relationships` |
| **`cast_spell`** | **Safe Casting:** No risk of "Burnout" if stamina is low. | Add `risk_check`: If stamina < cost, allow cast but trigger `hp_damage` or `fumble`. | `stamina-based-magic` |
| **ALL Actions** | **Narrative Static:** World "Atmosphere" rarely updates. | Add `state.set` for `narrative.atmosphere` on all major verbs (Combat="Tense", Rest="Peaceful", Social="Intimate"). | `core-narrative` |

---

## 4. Implementation Action Plan

To close these gaps and finalize the engine structure, we must perform these tasks in order.

### Phase 1: Patching the Data (Ruleset Definitions)
We cannot write engine code for logic that isn't in the JSON.
1.  **Refine `cinematic-combat-lite`:**
    * Add `calc_stamina_mod` step (Conditional).
    * Add 3-Tier Wound Transition map.
    * Add Atmosphere trigger ("Tense").
2.  **Refine `vitality-stamina-system`:**
    * Update `take_rest` to trigger `metabolic_decay` (if Needs exist).
3.  **Refine `npc-relationships`:**
    * Implement the 9-axis `stats` object (Trust, Romance, etc.).
    * Implement `apply_relationship_delta` with Logic Maps.

### Phase 2: Engine Capability Upgrade
The TypeScript Engine (`resolution.service.ts`) needs new capabilities to handle the updated JSON.
1.  **Implement `logic.conditional`:** Support `if (state.exists(path)) { ... }`.
2.  **Implement `logic.map_range`:** Support mapping a value (0-100) to a modifier (-20 to +20).
3.  **Implement `state.exists`:** Helper to check deep keys without crashing.

### Phase 3: The "Grand Unified Mock" Test
Once patched, we run the following scenario to verify **all** cross-system connections work:
1.  **Start:** Stamina 10/100 (Exhausted).
2.  **Action:** "Attack Guard."
3.  **Expected:**
    * Engine detects Low Stamina -> Applies -20 Penalty.
    * Attack likely Fails (due to penalty).
    * Player takes Damage (Counter-attack).
    * Atmosphere becomes "Tense".
4.  **Action:** "Rest."
5.  **Expected:**
    * Stamina restores to 100.
    * **BUT** Satiety drops (due to time passing).
    * Atmosphere becomes "Peaceful".

**Decision Point:**
Do you want me to generate the **JSON Patch for `cinematic-combat-lite`** first (fixing the combat/stamina gap), or the **Typescript Interface** for the new conditional engine logic?