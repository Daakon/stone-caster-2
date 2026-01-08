# Deterministic Engine Implementation Spec (v1.0)
**Context:** This matches the `chimera_ruleset_templates` currently in the DB.

## 1. Engine "Safety Layer" Protocols
*The TypeScript engine must implement these default behaviors to handle optional modules.*

| Scenario | Engine Behavior |
| :--- | :--- |
| **Ghost Path** (Modifying a missing key) | **Ignore:** If `state.modify` targets a path that doesn't exist (e.g., `satiety`), skip the step. Do not crash. |
| **Ghost Path** (Setting a missing key) | **Create:** If `state.set` targets a missing path (e.g., `atmosphere`), create the path and set the value. |
| **Missing Stat** (Contest/Check) | **Default to 50:** If an entity lacks `combat_prowess` or `root_force`, assume a value of **50**. |
| **Missing Threshold** (Logic Check) | **Default to Safe:** If checking `satiety` thresholds but the stat is missing, assume value is **100** (Optimal). |

---

## 2. Supported Function API
*The Engine must implement a `switch` case for these specific function strings found in the JSON.*

### A. State Mutators (Changes Data)
* **`state.modify`**:
    * **Inputs:** `path` (string), `amount` (number), `value` (number, optional override), `clamp_min` (optional), `clamp_max` (optional).
    * **Logic:** `current = get(path) || 0; new = current + amount; set(path, clamp(new))`.
* **`state.set`**:
    * **Inputs:** `path` (string), `value` (any).
    * **Logic:** `set(path, value)`.
* **`state.list_op`**:
    * **Inputs:** `path` (string), `op` ("add" | "remove" | "clear"), `item` (object).
    * **Logic:** Get array at path (init if missing). Push or filter `item`.
* **`state.transition`**:
    * **Inputs:** `target` (string path), `map` (object: CurrentValue -> NextValue).
    * **Logic:** `current = get(target); next = map[current]; if (next) set(target, next)`.

### B. Logic Computers (Returns Values)
* **`logic.map`**:
    * **Inputs:** `input` (string), `map` (object), `default` (any).
    * **Logic:** Returns `map[input]` or `default`.
* **`logic.thresholds`**:
    * **Inputs:** `source` (path), `map` (Threshold -> Label), `output_path`.
    * **Logic:** Find largest threshold <= source value. Set `output_path` to that label.
* **`logic.complex_check`**:
    * **Inputs:** `requirements` (object: StatName -> MinValue).
    * **Logic:** Return `true` only if ALL stats >= requirements.
* **`resolution.contest`**:
    * **Inputs:** `actor_stat_path`, `target_stat_path`, `actor_mod` (optional).
    * **Logic:** `(Roll(Actor) + Mod) - Roll(Target)`. Return "actor_win" or "target_win".

---

## 3. Verified Action Logic (Reference Only)
*The Engine doesn't "know" this logic, it just executes the JSON. This confirms what the JSON will ask the Engine to do.*

* **Combat (`resolve_clash`):** Deducts 5 Stamina (if exists) -> Sets Atmosphere "Tense" -> Rolls Contest -> Escalates Wound (Healthy->Minor->Major->Defeated).
* **Social (`apply_relationship_delta`):** Maps verb to Axis (e.g., Flirt->Desire) -> Maps verb to Amount -> Updates Stat -> Grants "Confidant" tag if Trust > 80.
* **Rest (`take_rest`):** Advances Clock +20 -> Restores Stamina -> Decays Satiety -25 (if exists) -> Sets Condition "Rested" -> Sets Atmosphere "Peaceful".