# Gemini-Generated Implementation Plan for Chimera System

This document provides a detailed, phased plan to implement the Chimera System as defined in the planning documents.

## Phase 1: Implement the Creator Layer

**Goal:** Establish the foundational data structures and services for creating and managing game assets.

*   **Task 1.1: Define TypeScript Interfaces**
    *   **File:** `frontend/src/types/chimera.d.ts` (or a similar shared location)
    *   **Action:** Define the core TypeScript interfaces based on `Chimera System Design.md`:
        *   `ChimeraAssetRef`
        *   `WorldDefinition`
        *   `EntityTemplate`
        *   `RulesetDefinition`

*   **Task 1.2: Create Database Schema**
    *   **Location:** `db/migrations`
    *   **Action:** Create a new SQL migration file to define the necessary tables:
        *   `chimera_worlds`: Columns to store `WorldDefinition` data.
        *   `chimera_entities`: Columns to store `EntityTemplate` data.
        *   `chimera_rulesets`: Columns to store `RulesetDefinition` data from `chimera-full-schemas.json`.

*   **Task 1.3: Implement Creator Services (Backend)**
    *   **Location:** `backend/src/services`
    *   **Action:** Develop services for asset management:
        *   `WorldsService`: CRUD operations for worlds.
        *   `EntitiesService`: CRUD operations for entities.
        *   `RulesetsService`: CRUD operations for rulesets.

*   **Task 1.4: Expose Creator API (Backend)**
    *   **Location:** `backend/src/routes`
    *   **Action:** Create API endpoints to provide access to the creator services.

## Phase 2: Implement the Compiler Layer

**Goal:** Develop the logic to transform the created assets into a playable story artifact.

*   **Task 2.1: Create Compiler Service (Backend)**
    *   **Location:** `backend/src/services`
    *   **Action:** Create a new `CompilerService`.

*   **Task 2.2: Implement 4-Step Compilation Process**
    *   **Action:** Implement the core compilation logic within the `CompilerService`:
        1.  **Base Load & Injection:** Load `base_character.json` and inject world-specific schema extensions.
        2.  **Dependency Resolution:** Validate ruleset dependencies and check for exclusion group conflicts.
        3.  **Master Allowlist Generation:** Aggregate all `state_contributions` and `actions` from active rulesets.
        4.  **Entity Processing:** Filter `raw_data` from entity templates into `tier1_mechanical_state` and `tier0_narrative_context` based on the allowlist.

*   **Task 2.3: Define CompiledStory Interface**
    *   **File:** `frontend/src/types/chimera.d.ts`
    *   **Action:** Add the `CompiledStory` interface.

*   **Task 2.4: Create Compiler Endpoint (Backend)**
    *   **Location:** `backend/src/routes`
    *   **Action:** Create a new API endpoint that accepts a story configuration (a list of world, entity, and ruleset IDs) and returns a `CompiledStory` object.

## Phase 3: Implement the Runtime Layer

**Goal:** Build the core game engine that processes user input and manages game state.

*   **Task 3.1: Define Runtime Interfaces**
    *   **File:** `frontend/src/types/chimera.d.ts`
    *   **Action:** Add the following interfaces:
        *   `GameState`
        *   `Mas1ResponseDto`
        *   `EngineResultDto`
        *   `Mas2ResponseDto`

*   **Task 3.2: Implement Runtime Services (Backend)**
    *   **Location:** `backend/src/services`
    *   **Action:** Develop the three core services of the runtime loop:
        1.  **`Mas1Service` (Interpreter):** Parses user text input into a structured `ActionDto`. This will likely require integration with an LLM.
        2.  **`EngineService` (Resolver):** Executes the logic for a given action, calculates state changes (`numeric_deltas`), and produces an `outcome_summary`.
        3.  **`Mas2Service` (Narrator):** Takes the engine result and generates the narrative output (`ripple_narrative`) and any narrative state changes (`mutations`). This will also likely require LLM integration.

*   **Task 3.3: Implement the Game Loop**
    *   **Location:** `backend/src/services`
    *   **Action:** Create a `GameLoopService` to orchestrate the MAS1 -> Engine -> MAS2 flow.

*   **Task 3.4: Implement State Management**
    *   **Action:** Choose and implement a solution for managing `GameState` on the backend during a user's session (e.g., in-memory cache like Redis, or a database).

*   **Task 3.5: Create Runtime Endpoints (Backend)**
    *   **Location:** `backend/src/routes`
    *   **Action:** Create an endpoint to handle user input, which will trigger the game loop and return the result to the client.

## Phase 4: Frontend Implementation

**Goal:** Build the user interface for creating and playing stories.

*   **Task 4.1: Implement Ruleset Selection Wizard**
    *   **Location:** `frontend/src/components/creator/`
    *   **Action:** Build the React components for the "3-Step Wizard" to select Foundation, Expansion, and Flavor rulesets.

*   **Task 4.2: Implement Character Creator**
    *   **Location:** `frontend/src/components/creator/`
    *   **Action:** Create a dynamic character creator form that includes fields from `base_character.json` and `character_schema_extensions` from the selected world.

*   **Task 4.3: Implement Main Game View**
    *   **Location:** `frontend/src/components/game/`
    *   **Action:** Develop the main gameplay interface, including:
        *   A narrative log to display `ripple_narrative`.
        *   A status display for Tier 1 state (HP, mana, etc.).
        *   A text input for the user.

*   **Task 4.4: Integrate with Backend**
    *   **Action:** Connect all frontend components to the backend API endpoints for creating stories, compiling them, and playing the game.
