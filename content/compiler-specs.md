# Chimera Compiler Specification (v1.2)

**Version:** 1.2
**Context:** Node.js/Express Backend
**Role:** Static Asset Processor & Validator
**Core Philosophy:** Logic is Data. No `eval()`. No Dynamic Scripting.

---

## I. Acceptance Criteria

### 1. Schema & Dependency Validation
* [ ] **Root Validation:** Reject files missing `id`, `pipeline_compatibility`, `ui_category`.
* [ ] **Version Check:** `pipeline_compatibility` must match the current Engine SemVer.
* [ ] **Dependency Check:** Ensure all `dependencies` listed are present in the selection.
* [ ] **Exclusion Check:** Ensure no two rulesets share an `exclusion_group`.

### 2. State Tree Aggregation
* [ ] **Merge Definitions:** Recursively merge `tier1_entity` and `tier1_global` definitions using deep-merge logic (e.g., `lodash.merge` style).
* [ ] **Collision Resolution:** Prioritize World Modules > Expansions > Foundation.
* [ ] **Optimization:** Strip UI-only fields (`form_hints`, `ui_category`) to reduce JSON payload size for the client.

### 3. MAS 1 Map Flattening
* [ ] **Aggregate Keywords:** Collect all `intent_keywords` maps.
* [ ] **Specificity Sort:** Sort keywords by phrase length (descending).
* [ ] **Output:** `master_intent_map.json` (Ready for easy lookup).

### 4. MAS 2 Prompt Indexing
* [ ] **Bucket Sort:** Separate `style_injections` into `static` vs `dynamic` arrays.
* [ ] **Condition Handling:** Store `condition` strings as raw data strings.
    * *Note:* The Runtime will use a safe expression evaluator (like `mathjs` or a custom lexer) to check these, NEVER `eval()`.
* [ ] **Output:** `prompt_template.json`.

### 5. Registry Linking & Signature Verification
**Requirement:** Map JSON Data Objects to pre-defined JavaScript Functions.
* [ ] **Key Lookup:** Check if `logic.function` (e.g., `"cat_02_state_mutation.modify_stat"`) exists as a key in the Backend's `FunctionRegistry` map.
* [ ] **Argument Schema Validation:**
    * The Registry must define a JSON Schema for every function's arguments.
    * The Compiler validates the Ruleset's `args` object against that Schema.
    * *Example:* If Registry expects `amount: number` and Ruleset has `amount: "10"`, **Fail the Build**.
* [ ] **Sanitization:** Ensure no arguments contain executable strings or malicious payloads.

---

## II. Out of Scope (Strict Security)

1.  **NO `eval()` or `new Function()`:** The Compiler guarantees that the Runtime never needs to execute a string as code. All logic is handled by passing JSON data to trusted internal functions.
2.  **NO Dynamic Imports:** The Compiler does not allow Rulesets to import external Node modules.
3.  **NO AI API Calls:** The Compiler organizes the prompt structure but does not communicate with the LLM.

---

## III. Example: Valid vs Invalid Logic (Node Context)

**VALID (Passes Compiler):**
```json
"logic": {
  "function": "cat_02_state_mutation.modify_stat",
  "args": { "path": "hp", "amount": -10 }
}
```
*Runtime Execution:*
`Registry["cat_02_state_mutation.modify_stat"](state, { path: "hp", amount: -10 })`

**INVALID (Fails Compiler):**
```json
"logic": "state.hp -= 10"
```
*Reason:* Requires `eval()`. **Security Risk.** Rejected.