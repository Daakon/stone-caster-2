# The Smart Compiler Process Specification

The **Smart Compiler** (executed via the `POST /api/v2/chimera/stories/:id/rebuild` endpoint) is a backend service designed to ensure efficiency, integrity, and security by pre-processing all narrative and mechanical data once. It is the bridge between the Creation Tools (Phase 1) and the Play Engine (Phase 4).

---

## 1. Compiler Inputs: The Source Data
The process begins by fetching all configuration and data assets linked to the Story Dimension.

### **Source Data (Normalized)**
| Source | Purpose |
|--------|---------|
| **Rulesets (Forces)** | The Rules: Provides `action_rules`, `prompt_rules`, `key_definitions`, and `state_schema_contributions`. |
| **Entities** | The Objects: Provides `base_state_json` (unstructured data) for players and NPCs. |
| **Lore Entries** | The Facts: Provides `entry_text` for background knowledge (RAG). |
| **World** | The Setting: Provides `character_schema_contributions` (e.g., Essence) for the final schema merge. |

---

## 2. Stage 1: Merging Forces (Schema Definition)
The compiler’s first job is to establish the final, definitive schema that governs the story.

### **Load Order**
Rulesets are merged sequentially using a *last-in-wins* priority:
1. Main System
2. Subsystems
3. Modifiers

### **Schema Merger**
The service performs a deep merge of the `RulesetDefinitionV1` JSON objects.

### **Output → Final Schema**
This produces the complete, unified schema used for verification and state creation:
- **master_state_keys**: Combined list of all required mechanical keys (health, skills, etc.)
- **master_narrative_keys**: Combined list of required narrative keys (backstory, mood, etc.)
- **final_state_schema**: Final structure for `chimera_game_states` initialization

---

## 3. Stage 2: Data Sorting and Pruning (The Efficiency Gate)
This is the core "Smart Compiler" logic, ensuring the final artifact is lean and secure.

### **Entity Pruning (Action Context)**
- The compiler iterates through all `Entity.base_state_json` records.
- Every key is checked against `master_state_keys`.
- **Any key not present is discarded** to keep the action context clean and valid.
- The resulting pruned mechanical data is stored in:
  - `action_context_json.elements`

### **RAG Vectorization (Narrative Context)**
- All `LoreEntry.entry_text` plus entity narrative fields (e.g., backstory) are processed.
- Each text block is converted into a **vector embedding**.
- The output forms:
  - `narrative_context_json.rag_index`

This enables fast and accurate semantic search during gameplay.

---

## 4. Stage 3: Final Artifact Generation
The compiler synthesizes all processed components into a single optimized 4-Key JSON artifact, stored in `chimera_story_compiled_ruleset`.

### **Compiled JSON Artifact**
This is the only resource the Play Engine ever needs.

| Key | Data Contents | Play Engine Use |
|------|---------------|------------------|
| **action_context_json** | Merged `action_rules` and pruned elements data | Used by the ActionResolver for deterministic processing |
| **narrative_context_json** | Merged `prompt_rules_with_guardrails` and RAG index | Used by MasContextProvider for prompt assembly and semantic lookup |
| **parser_context_json** | Merged parser rules and lists of available actions/entities | Used by ActionParser for intent and sentiment detection |
| **final_state_schema** | Full merged schema for all tiers (0, 1, 2) | Used by StateFactory for initial game state creation |

---

## Summary
The Smart Compiler guarantees that:
- The Play Engine receives **pre-processed**, **verified**, and **safe** data.
- Narrative and mechanical systems are unified into a single optimized artifact.
- Runtime is fast because all expensive work is done once during compile.

This process is a foundational requirement for the MVP architecture.

