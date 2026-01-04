# Design Document: Adaptive State Engine (ASE)

## 1. Executive Summary
The Adaptive State Engine (ASE) is the central nervous system of the Chimera Platform. It moves away from a monolithic "Game State" blob in favor of a **Segmented, Schema-Driven Architecture**.

**Core Philosophy:**
* **Context-Aware:** We only load what is needed for the current scene (The "Spotlight" System).
* **Schema-Driven:** Active Rulesets dictate the structure of the state. If a ruleset adds "Sanity," the engine allocates memory for it.
* **Separation of Concerns:** The "Mechanical Truth" (Math) is strictly separated from the "Narrative Truth" (Prose).
* **Future-Proof:** Designed with Dependency Inversion to allow a seamless transition from Postgres to Redis for high-frequency state management.

---

## 2. Architecture: The "Spotlight" System

The Game State is divided into three distinct persistence scopes to optimize for token usage (LLM) and calculation speed (Deterministic Engine).

### A. Mechanical State (`mechanical_state`)
* **Purpose:** The "Engine Room." Contains only raw numbers, tags, and IDs required to resolve actions.
* **Consumer:** The Deterministic Rules Engine.
* **Characteristics:** High read/write frequency. Strictly typed. Minimized size.
* **Structure:**
    ```json
    {
      "globals": { "turn": 1, "time_phase": "night", "danger_level": 5 },
      "entities": {
        "uuid-player": { "hp": 100, "str": 15, "tags": ["hero", "stunned"] },
        "uuid-enemy": { "hp": 50, "str": 10, "tags": ["goblin"] }
      },
      "index": { "uuid-player": "active", "uuid-enemy": "active" }
    }
    ```

### B. Narrative Focus (`narrative_focus`)
* **Purpose:** The "Stage." Contains descriptive text, visual cues, and atmospheric context.
* **Consumer:** The AI Storyteller (LLM).
* **Characteristics:** Read-heavy, Append-only (mostly). "Soft" data.
* **Structure:**
    ```json
    {
      "scene_context": "A damp cave smelling of mildew...",
      "visual_tags": {
        "uuid-enemy": "A small, green creature with a jagged dagger."
      },
      "dialogue_history": [...]
    }
    ```

### C. Scene Registry (`scene_registry`)
* **Purpose:** The "Backstage." Tracks entities and world nodes that are *not* currently active.
* **Consumer:** Simulation Manager / Director.
* **Characteristics:** Large storage, low frequency.
* **Structure:**
    ```json
    {
      "entity_locations": { "uuid-merchant": "town_square", "uuid-dragon": "mountain_peak" },
      "node_states": { "town_gate": "locked" }
    }
    ```

---

## 3. The Data Flow & Contracts

### The Action Contract
Every Action defined in a Ruleset acts as a contract.
> *"To execute Action X, the State MUST contain Property Y."*

* **Validation:** The Engine rejects actions if the `mechanical_state` lacks the required properties defined by the active Rulesets.
* **Hydration:** When a character enters a scene, the system "Hydrates" them—pulling their base template and wrapping it in the specific properties required by the *current* Scene's active rulesets.

### The Loading Cycle (Spotlight)
1.  **Scene Transition:** Player moves Node A -> Node B.
2.  **Unload:** Active NPCs in Node A are stripped of their "Mechanical" weight and saved to `scene_registry`.
3.  **Load:** NPCs in Node B are pulled from `scene_registry`.
4.  **Compile:** The Engine builds the new `mechanical_state` containing only the Player + Node B Entities.

---

## 4. Implementation Strategy

We follow **SOLID Principles**, specifically **Dependency Inversion**, to abstract the database layer.

### Phase 1: Data Model & Persistence
**Goal:** Define the storage shape and strict Interfaces.
* **Database:** Split `chimera_game_states` into segmented JSONB columns.
* **Interfaces:** Define strict TypeScript types (`MechanicalState`, `ActiveEntity`).
* **Repository Pattern:** Create `IGameStateRepository` to decouple logic from Postgres.

### Phase 2: The State Factory (Logic)
**Goal:** Build the "Compiler" that creates the state.
* **Ruleset Harvester:** Scans active rulesets for global variable definitions.
* **Entity Projector:** Maps `CharacterTemplate` -> `ActiveEntity`.
* **Factory Service:** Pure logic function: `(Rulesets, Template, World) => GameState`.

### Phase 3: Integration (API)
**Goal:** Connect the system.
* **API:** `POST /game/init` uses the Factory to generate the initial state.
* **Frontend:** Bootloader fetches and validates the segmented state.

---

## 5. Verification Protocols

For every phase, we verify against these standards:

1.  **Determinism Check:** Can the `mechanical_state` resolve a dice roll *without* reading the `narrative_focus`?
2.  **Token Economy:** Is the data sent to the LLM (Narrative Focus) free of unnecessary math/stats?
3.  **Redis Readiness:** Is the `IGameStateRepository` implemented such that we could swap the backend for Redis tomorrow without changing the Engine?