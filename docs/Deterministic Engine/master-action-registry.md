# StoneCaster Master Action Registry (v3.0) & Engine Protocols
**Status:** Clean Action Logic with Engine-Level Safety.
**Philosophy:** Rulesets declare *what* to change. The Engine decides *how* to handle missing state (Defaults/Ignores).

---

## Part 1: Engine "Safety Layer" Protocols
*These are the hard-coded behaviors the Deterministic Engine MUST implement to handle missing data without crashing or requiring verbose JSON checks.*

### 1. The "Ghost Path" Protocol (State Modification)
**Scenario:** An action tries to modify `tier1_entity.current_stamina` (e.g., -5), but that path does not exist on the entity.
**Engine Behavior:**
* **Numeric Modifiers (`state.modify`):** If the path is missing, the step is **IGNORED** (No-op).
    * *Result:* Attacking costs 0 stamina if the Stamina System isn't loaded.
* **Absolute Sets (`state.set`):** If the path is missing, the Engine **CREATES** the path and sets the value.
    * *Result:* Atmosphere updates to "Tense" even if it wasn't defined before.

### 2. The "Average Joe" Protocol (Stat Resolution)
**Scenario:** A contest calls for `tier1_entity.combat_prowess` vs `tier1_player.root_force`, but one entity lacks the stat.
**Engine Behavior:**
* **Missing Attributes:** Default to **50** (The universal baseline).
    * *Result:* An unstated Guard defends with 50 skill.
* **Missing Thresholds:** If checking a value that doesn't exist (e.g., `satiety`), treat it as **100** (Full/Safe).

### 3. The "Implied State" Protocol (Transitions)
**Scenario:** Combat tries to transition `combat_condition` from "Healthy" to "Minor Injury", but the target has no `combat_condition`.
**Engine Behavior:**
* **Undefined Input:** Treat `undefined` as the first key in the transition map (usually "Healthy" or "Normal").
    * *Result:* The first hit always works, initializing the state to "Minor Injury".

---

## Part 2: Master Action Registry
*The compiled logic steps the Engine receives. Note the absence of "exists" checks; the Engine handles that.*

### 1. Combat Actions
**Source:** `cinematic-combat-lite`
**Trigger:** `intent: combat_action`

#### Action: `resolve_clash`
**Logic Pipeline:**
1.  **Deduct Cost:**
    * **Function:** `state.modify`
    * **Args:** `{ path: "tier1_entity.current_stamina", amount: -5 }`
    * *Engine Note:* If no stamina bar, this step is skipped automatically.
2.  **Update Atmosphere:**
    * **Function:** `state.set`
    * **Args:** `{ path: "tier1_world.narrative.atmosphere", value: "Tense" }`
3.  **Calculate Advantage:**
    * **Function:** `logic.map`
    * **Input:** `input.tactic_tag` (*reckless, trickery*)
    * **Map:** `{ reckless: -20, trickery: 20, defensive: -10, aggressive: 10 }`
    * *Default:* 0
4.  **Roll Contest:**
    * **Function:** `resolution.contest`
    * **Actor:** `combat_prowess` + `tactic_modifier`
    * **Target:** `combat_prowess` (Defaults to 50 if missing)
5.  **Escalate Wound (Target):**
    * **Function:** `state.transition`
    * **Args:** `{ target: "tier1_entity.combat_condition", map: { "Healthy": "Minor Injury", "Minor Injury": "Major Injury", "Major Injury": "Defeated" } }`
    * *Engine Note:* If target has no condition, assume "Healthy" -> apply "Minor Injury".
6.  **Apply Wound (Player):**
    * **Function:** `state.set`
    * **Args:** `{ path: "tier1_player.combat_condition", value: "Wounded" }`

---

### 2. Social & Relationship Actions
**Source:** `npc-relationships`
**Trigger:** `intent: social_action` (*flirt, insult, betray*)

#### Action: `apply_relationship_delta`
**Logic Pipeline:**
1.  **Identify Axis:**
    * **Function:** `logic.map`
    * **Input:** `input.verb`
    * **Map:** `{ flirt: "desire", compliment: "warmth", insult: "respect", confide: "trust" }`
2.  **Calculate Delta:**
    * **Function:** `logic.map`
    * **Input:** `input.verb`
    * **Map:** `{ flirt: 5, compliment: 5, insult: -15, confide: 10, betray: -50 }`
3.  **Apply Change:**
    * **Function:** `state.modify`
    * **Args:** `{ path: "relationships.{target_id}.stats.{axis_key}", amount: "@delta" }`
    * *Engine Note:* If `stats` object is missing, Engine inits it with defaults (50) before modifying.
4.  **Grant Tag (High Affinity):**
    * **Function:** `state.list_op`
    * **Args:** `{ op: "add", item: { role: "Confidant" } }`
    * **Condition:** `relationships.{target_id}.stats.trust >= 80`

---

### 3. Survival & Vitality Actions
**Source:** `vitality-stamina-system` & `needs-survival-basic`

#### Action: `take_rest`
**Trigger:** `intent: rest_action`
**Logic Pipeline:**
1.  **Advance Clock:**
    * **Function:** `state.modify`
    * **Args:** `{ path: "tier1_world.clock_tick", amount: 20 }`
2.  **Restore Stamina:**
    * **Function:** `state.modify`
    * **Args:** `{ path: "tier1_entity.current_stamina", value: 100 }`
3.  **Trigger Decay (Cross-System):**
    * **Function:** `state.modify`
    * **Args:** `{ path: "tier1_entity.satiety", amount: -25 }`
    * *Engine Note:* If `satiety` doesn't exist (Needs system not installed), this step is silently skipped.
4.  **Reset Atmosphere:**
    * **Function:** `state.set`
    * **Args:** `{ path: "tier1_world.narrative.atmosphere", value: "Peaceful" }`

#### Action: `apply_travel_fatigue`
**Trigger:** `intent: travel_action`
**Logic Pipeline:**
1.  **Drain Cost:**
    * **Function:** `state.modify`
    * **Args:** `{ path: "tier1_entity.current_stamina", amount: -20 }`
2.  **Threshold Check:**
    * **Function:** `logic.thresholds`
    * **Args:** `{ source: "current_stamina", map: { 0: "Collapsed", 20: "Exhausted" } }`

---

## Part 3: Engine Function API (Implementation Spec)
*The Inputs/Outputs the TypeScript code must support.*

| Function Name | Input Schema | Engine Handling (Safety) |
| :--- | :--- | :--- |
| **`state.modify`** | `{ path, amount?, value?, clamp_min?, clamp_max? }` | **Safe Access:** If `path` is deeply nested and intermediate keys missing, abort step (unless `value` is set, then create). Clamp results. |
| **`state.set`** | `{ path, value }` | **Auto-Create:** Create path if missing. Always succeeds. |
| **`state.list_op`** | `{ path, op: "add"\|"remove", item }` | **Init Array:** If path is undefined, init empty array `[]` then push item. |
| **`state.transition`** | `{ target, map }` | **Defaulting:** If `target` value undefined, use `map`'s first key. If current value not in `map`, abort. |
| **`resolution.contest`** | `{ actor_stat_path, target_stat_path }` | **Defaults:** If path resolves to `undefined`, use **50**. |
| **`logic.thresholds`** | `{ source, map, output_path }` | **Defaults:** If `source` missing, assume **100** (Full/Safe). |
| **`logic.map`** | `{ input, map, default }` | **Fallback:** If `input` not found in `map`, return `default`. |

---

## Part 4: Next Steps

1.  **Patch Rulesets:** Update `cinematic-combat-lite` and `npc-relationships` to match the pipelines in Part 2 (removing the complex logic checks, relying on the clean list).
2.  **Build Dispatcher:** Update `resolution.service.ts` to implement the "Safety Layer" protocols defined in Part 1.
3.  **Verify:** Run the Combat -> Rest loop. Verify Stamina drains (if present), Wounds escalate (with defaults), and Time passes.