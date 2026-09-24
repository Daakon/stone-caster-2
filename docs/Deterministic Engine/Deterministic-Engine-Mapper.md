# StoneCaster Master Action Registry
**Status:** Generated from `chimera_ruleset_templates.json`
**Purpose:** Defines the deterministic logic pipeline for every action available in the Compiled Story.

---

## 1. Combat Actions
**Source Ruleset:** `cinematic-combat-lite`
**Category:** Foundation (Exclusion Group: `combat_core`)

### Action: `resolve_clash`
**Trigger:** `intent_match` (Keyword: `combat_action` -> *attack, defend, dodge, feint, charge*)
**Logic Pipeline:**
1.  **Calculate Advantage:**
    * **Function:** `logic.map`
    * **Input:** `input.tactic_tag`
    * **Map:** `reckless` (-20), `trickery` (+20), `defensive` (-10), `aggressive` (+10).
    * **Output:** `tactic_modifier`
2.  **Roll Contest:**
    * **Function:** `resolution.contest`
    * **Actor:** `combat_prowess` + `tactic_modifier`
    * **Target:** `combat_prowess`
    * **Output:** `clash_result` (*actor_win, target_win*)
3.  **Apply NPC Wound:**
    * **Function:** `state.set`
    * **Path:** `tier1_entity.combat_condition`
    * **Value:** "Wounded"
    * **Condition:** `clash_result == actor_win` AND `current_condition == Healthy`
4.  **Apply NPC Defeat:**
    * **Function:** `state.set`
    * **Path:** `tier1_entity.combat_condition`
    * **Value:** "Defeated"
    * **Condition:** `clash_result == actor_win` AND `current_condition == Wounded`
5.  **Apply Player Wound:**
    * **Function:** `state.set`
    * **Path:** `tier1_player.combat_condition`
    * **Value:** "Wounded"
    * **Condition:** `clash_result == target_win`

> **MISSING LOGIC (Gap Analysis):**
> * **Stamina Cost:** No step deducts stamina.
> * **Escalating Wounds:** No step for "Minor" or "Major" injury.
> * **Atmosphere:** No step to update `tier1_world.narrative.atmosphere`.

---

## 2. Survival & Vitality Actions
**Source Ruleset:** `vitality-stamina-system`
**Category:** Foundation (Exclusion Group: `vitality_core`)

### Action: `take_rest`
**Trigger:** `intent_match` (Keyword: `rest_action` -> *rest, camp*)
**Logic Pipeline:**
1.  **Restore Stamina:**
    * **Function:** `state.modify`
    * **Path:** `tier1_entity.current_stamina`
    * **Amount:** +100 (Clamp Max: 100)
2.  **Set Rested:**
    * **Function:** `state.set`
    * **Path:** `tier1_entity.physical_condition`
    * **Value:** "Rested"

### Action: `force_rest_scenario`
**Trigger:** `stat_change` (Target: `tier1_entity.current_stamina`)
**Logic Pipeline:**
1.  **Trigger Collapse:**
    * **Function:** `output.emit`
    * **Message:** "The character is too exhausted to continue..."
    * **Condition:** `current_stamina <= 0`

### Action: `apply_travel_fatigue`
**Trigger:** `intent_match` (Keyword: `travel_action` -> *travel, explore*)
**Logic Pipeline:**
1.  **Drain Stamina:**
    * **Function:** `state.modify`
    * **Path:** `tier1_entity.current_stamina`
    * **Amount:** -20
2.  **Check Exhaustion:**
    * **Function:** `logic.thresholds`
    * **Source:** `current_stamina`
    * **Map:** 0="Collapsed", 20="Exhausted", 50="Winded", 90="Rested"
    * **Output Path:** `tier1_entity.physical_condition`

---

## 3. Needs & Metabolism
**Source Ruleset:** `needs-survival-basic`
**Category:** Foundation (Requires: `vitality-stamina-system`, `world-cycle-time-bands`)

### Action: `consume_food`
**Trigger:** `intent_match` (Keyword: `eat_action`)
**Logic Pipeline:**
1.  **Restore Satiety:**
    * **Function:** `state.modify`
    * **Path:** `tier1_entity.satiety`
    * **Amount:** +40 (Clamp Max: 100)
2.  **Update State:**
    * **Function:** `logic.thresholds`
    * **Source:** `satiety`
    * **Map:** 0="Starving", 30="Hungry", 80="Well Fed"
    * **Output Path:** `tier1_entity.hunger_state`

### Action: `apply_metabolic_decay`
**Trigger:** `intent_match` (Keyword: `trigger_time_pass` -> *wait, sleep, travel*)
**Logic Pipeline:**
1.  **Resolve Decay Amount:**
    * **Function:** `logic.map`
    * **Input:** `input.duration_tag`
    * **Map:** `scene` (-2), `journey` (-40), `long_rest` (-25), `short_rest` (-5), `moment` (0).
2.  **Apply Decay:**
    * **Function:** `state.modify`
    * **Path:** `tier1_entity.satiety`
    * **Amount:** [Result from Step 1]
3.  **Check Thresholds:**
    * **Function:** `logic.thresholds` (Updates `hunger_state`)

---

## 4. Magic System
**Source Ruleset:** `stamina-based-magic`
**Category:** Foundation (Exclusion Group: `magic_core`)

### Action: `cast_spell`
**Trigger:** `intent_match` (Keyword: `cast_magic`)
**Logic Pipeline:**
1.  **Deduct Cost:**
    * **Function:** `state.modify`
    * **Path:** `tier1_entity.current_stamina`
    * **Amount:** -25
2.  **Resolve Skill:**
    * **Function:** `resolution.resolve`
    * **Skill ID:** Dynamic (`@tier1_entity.casting_stat_id`)
3.  **Exhaustion Check:**
    * **Function:** `logic.thresholds` (Updates `physical_condition`)

---

## 5. Skill Resolution
**Source Ruleset:** `d100-5-pillars` (OR `d100-skill-engine`)
**Category:** Foundation (Exclusion Group: `skill_system_root`)

### Action: `resolve_skill_check`
**Trigger:** `request_match` (Explicit Engine Call)
**Logic Pipeline:**
1.  **Resolve Cascade Value:** Looks up skill; falls back to Root node (e.g., *Pick Lock* -> *Finesse*).
2.  **Calculate Target:** Base Value + Difficulty Mod.
3.  **Roll Dice:** D100 Roll Under.
4.  **Determine Outcome:** Compare Roll vs Target (Crit/Success/Fail/Fumble).
5.  **Broadcast:** Emit result to MAS-2.

---

## 6. Social & Relationship Actions
**Source Ruleset:** `npc-relationships` & `npc-value-impact-tagging`

### Action: `run_context_spotlight`
**Trigger:** `intent_match` (Keyword: `general_interaction` -> *greet, talk, ask*)
**Logic Pipeline:**
1.  **Reset:** Set `current_interaction_context` to "None".
2.  **Filter:** Find relationship tags with `severity >= 8`.
3.  **Promote:** Set `current_interaction_context` to the most recent high-severity tag (e.g., "REMEMBER: Stole Amulet (Rival)").

### Action: `commit_impact_to_memory`
**Trigger:** `intent_match` (Keyword: `impact_event`)
**Logic Pipeline:**
1.  **Calc Conflict:** Intersect Player Action Tags vs. NPC `core_values`.
2.  **Write Memory:** If conflict exists, Add Tag: `{ role: "Offender", origin: "Violated [Value]", severity: 10 }` to `relationships`.

---

## 7. Personality & Mood Actions
**Source Ruleset:** `npc-preferences-phobias` & `npc-quirks-habits`

### Action: `detect_aversion_match` / `detect_interest_match`
**Trigger:** `intent_match` (Keyword: `general_conversation`)
**Logic Pipeline:**
1.  **Scan:** Check input text for keywords matching `aversion_triggers` or `interest_triggers`.
2.  **Modify Mood:** `state.modify` -> `tier1_entity.emotional_valence` (-15 or +10).

### Action: `filter_quirks_by_context`
**Trigger:** `stat_change` (Target: `tier1_entity.emotional_label`)
**Logic Pipeline:**
1.  **Clear:** Empty `active_quirks`.
2.  **Populate:** Copy quirks from `quirk_registry` where `trigger_state` matches current Mood or "Always".

---

## 8. Capability Actions
**Source Ruleset:** `wealth-capability-lite`

### Action: `check_affordability`
**Trigger:** `intent_match` (Keyword: `purchase_attempt`)
**Logic Pipeline:**
1.  **Compare:** Contest `tier1_entity.wealth_tier` vs `input.cost_tier`.
2.  **Deny:** If target wins (Cost > Wealth), trigger `state.stop` with "You cannot afford this."