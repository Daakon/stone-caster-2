# 05 Technical Implementation Specs
*(StoneCaster / Chimera Engine – MVP)*

This document defines the **Interfaces, Verification, and Safety** of the system. It combines the **API Contract**, **Test Plan**, **UX Flows**, and **Security Protocols**.

---

# PART 1: API CONTRACT

## 1. Conventions
* **Base URL**: `https://api.stonecaster.app/v1`
* **Auth**: Bearer JWT in `Authorization` header.
* **Response**: JSON. Errors use a uniform envelope: `{ "error": { "code": "...", "message": "..." } }`

## 2. Core DTO Summaries

**Compiled Story DTO**
    {
      "story_id": "uuid",
      "world_id": "uuid",
      "version": "1.0.0",
      "compiled_at": "timestamp",
      "compiled_json": { "schema": {}, "initial_state": {}, "instructions": {} }
    }

**Game State DTO**
    {
      "session_id": "uuid",
      "turn_index": 3,
      "updated_at": "timestamp",
      "state_json": { "tier0_world": {}, "tier1_entities": {}, "tier2_system": {} }
    }

## 3. Key Endpoints

### Authoring
* `POST /worlds`: Create a new world container.
* `POST /entities`: Create a Player or NPC template.
* `POST /lore`: Upload world context for RAG.
* `POST /chimera/compile`: Triggers the Compiler.
    * **Input**: `world_id`, `selected_ruleset_keys`.
    * **Output**: `CompiledStory` object (Deterministic artifact).

### Runtime (The Turn Loop)
* `POST /play/start`: Initialize a session from a Compiled Story.
* `POST /play/cast`: Execute a turn.
    * **Input**: `{ "session_id": "...", "text": "Pick the lock." }`
    * **Output**:
        {
          "messages": [{ "role": "assistant", "content": "The lock clicks..." }],
          "state_delta": { "tier2_system.current_stamina": -2 },
          "updated_state": { "..." }
        }

---

# PART 2: TEST PLAN

## 1. Testing Philosophy
StoneCaster demands **determinism** in non-LLM systems and **strict constraints** for LLM outputs.
1.  **Compiler Determinism**: Same input → identical compiled story.
2.  **Engine Determinism**: Same intent & state → identical resolution.
3.  **RLS Integrity**: Unauthorized access must be provably impossible.

## 2. Test Categories

**Unit Tests**
* **Compiler**: Validate dependency resolution, exclusion groups, and state merging.
* **Engine**: Validate D100 math, stamina drain, hunger decay, and time advancement.

**Integration Tests**
* **API**: Ensure `POST /chimera/compile` returns valid JSON schemas.
* **Database**: Verify JSONB writes and Foreign Key cascades.

**MAS Contract Tests (LLM Validation)**
* **MAS-1**: Output must be JSON. Must contain `intent` and `duration_tag`. Must NOT contain narration.
* **MAS-2**: Output must be JSON. Must contain `narration`. Must NOT reveal mechanics. Must NOT contradict state.

**Scenario Tests**
Multi-turn scripted flows to validate state persistence:
> Step 1: Input "Look around" → Expect Time Advance.
> Step 2: Input "Pick lock" → Expect Stamina Drain.

---

# PART 3: UX FLOWS AND WIREFRAMES

## 1. High-Level Flow
**Author**: [World Preset] → [Forces/Elements/Lore Tabs] → [Bind Tab: Compile] → **Story Ready**
**Player**: Start Session → View Opening → Enter Action → Receive MAS Output → **State Updates**

## 2. Core Player Screen (Story View)

**Layout Components:**
1.  **Narration Window**: The primary text feed. Scrolls history.
2.  **Action Input**: "What do you do?" text box.
3.  **State Panel (Sidebar)**:
    * **Time Band**: e.g., "Deep Night"
    * **Stamina**: e.g., "88 (Winded)"
    * **Hunger**: e.g., "Hungry"
    * **NPC Context**: e.g., "Arven: Cautious | Memory: Old Debt"

## 3. Feedback States
* **MAS-1 Hard Gate**: If action is blocked (e.g., Collapsed), show a diegetic warning: *"You are too exhausted to move."*
* **Compiler Error**: Show specific conflict: *"Ruleset Conflict: Only one skill system may be selected."*

---

# PART 4: SECURITY AND COMPLIANCE

## 1. Security Philosophy
1.  **Zero-Trust**: Application code must not trust LLM output.
2.  **RLS-First**: All data access is restricted by Row Level Security in PostgreSQL.
3.  **Immutable Artifacts**: Compiled stories cannot be modified after creation.

## 2. Authorization (RLS Policies)
* **Worlds/Entities**: Only `author_id` can read/write.
* **Compiled Stories**: Public read (for players), Server-only write.
* **Sessions**: Owner-only access.

## 3. LLM Safety & Validation
* **Input Sanitization**: Trim whitespace, enforce max length (800 chars).
* **Output Validation**:
    * **MAS-1**: Verify JSON structure and allowed `intent` keywords.
    * **MAS-2**: Verify JSON structure, no HTML, no mechanics leaks.
* **Content Filters**: Enforce PG/PG-13/R-lite constraints via system prompt instructions.

## 4. Data Protection
* **PII**: System stores no PII beyond Auth email.
* **Logging**: Do not log raw player narrative text (privacy). Log only metadata and mechanical outcomes.