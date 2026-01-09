# 07 Architecture Patterns and Standards
*(StoneCaster / Chimera Engine – MVP)*

**Role:** This document serves as the architectural reference for the backend design patterns, state management strategies, and data interchange standards used in the Chimera Engine.

---

## 1. Service Architecture & Documentation Pattern

The backend follows a strict **Service-Oriented Architecture** where business logic is encapsulated within specific domains (Runtime, Authoring, Compiler).

### 1.1 Service Responsibilities
To maintain clean separation of concerns, every Service defines three key architectural properties:
* **Role:** The high-level purpose of the component.
* **Responsibility:** The specific functional boundaries (e.g., "Manages in-memory state", "Orchestrates turn loop").
* **Constraints:** Critical invariants (e.g., "Must be deterministic", "Mutates state in-place").

*Reference Strategy: Services link to their "Ground Truth" specifications (e.g., `@02_Data_Schema` or `@03_Engine_Logic`) to contextualize their implementation.*

### 1.2 Execution Contracts
Critical logic methods define an **Execution Contract** regarding state mutation:
* **Mutation Policy:** Explicitly identifies if a method modifies its input arguments (In-Place Mutation) or returns a new object (Immutability).
* **Source of Truth:** Identifies if a return value is the authoritative data source or a derived summary.

---

## 2. State Management Architecture

The Chimera Engine uses a hybrid state model designed to handle dynamic, user-defined schemas ("Tier 1" and "Tier 2").

### 2.1 Authoritative State Pattern
* **In-Memory Authority:** During the execution of a Turn, the `StateService` holds the **Mutable** copy of the game state. Logic operations modify this instance directly.
* **Persistence Strategy:** The database persists the **Final Snapshot** extracted from the `StateService` at the end of the transaction. The system does *not* rely on merging calculated deltas to the DB, ensuring that the in-memory reality is always what gets saved.

### 2.2 Deep Path Handling (Auto-Vivification)
To support the modular nature of Rulesets (which may add arbitrary deep paths like `globals.narrative.atmosphere` at runtime), the system implements an **Auto-Vivification Pattern**:
* **Lazy Initialization:** When writing to a nested path, the system automatically initializes missing parent objects or arrays.
* **Resilience:** This prevents runtime errors when accessing optional or newly added schema fields, allowing the engine to handle "Open World" data structures gracefully.

### 2.3 Sequential State Chaining
To ensure data integrity during multi-target or multi-step actions:
* **Pattern:** The execution pipeline uses strict **State Chaining**.
* **Flow:** The output state of Logic Step N serves as the input state for Logic Step N+1.
* **Avoidance:** Parallel state forking is avoided to prevent "Lost Update" scenarios where simultaneous modifications (e.g., Stamina costs from two different attacks) might overwrite each other.

---

## 3. Observability & Tracing Standards

The Deterministic Engine implements a **Structured Tracing Pattern** to make decision logic visible without relying on debugger breakpoints.

### 3.1 Trace Categories
Logs are categorized to separate "Flow" from "Data Mutation":
* **Logic Trace:** Records the step-by-step execution path of the Ruleset Engine (e.g., matching triggers, iterating targets).
* **State Mutation:** Records specific value changes (e.g., "Stamina: 80 -> 75") to audit mechanical outcomes.
* **Logic Warning:** Captures handled exceptions, such as missing paths or failed condition checks, without crashing the runtime.

---

## 4. Simulation & Testing Architecture

To verify deterministic logic without incurring LLM latency or costs, the system implements a **Scenario Bypass Layer**.

### 4.1 Deterministic Scenario Injection
The `LlmProvider` includes a bypass mechanism that detects specific test signatures (prefixed with `test_`) in user input.
* **Mechanism:** When detected, the provider skips the AI call and injects a pre-defined, complex `Mas1Intent` payload.
* **Purpose:** This allows instant verification of complex engine loops (e.g., Multi-Target Combat, Social Logic, Travel Gating) using hardcoded, reproducible data scenarios.

---

## 5. Data Interchange Standards

### 5.1 MAS-1 Intent Structure
The interface between the Action Interpreter (MAS-1) and the Engine is strictly typed to support compound user actions.

**Canonical Structure (Array Wrapper):**
The payload is always wrapped in an object containing an `intents` array to satisfy JSON-mode enforcement while supporting multiple sequential actions.

```json
{
  "intents": [
    {
      "trigger_id": "combat_action",      // Routing Key
      "target_ids": ["uuid-1", "uuid-2"], // Multi-Target Support
      "parameters": {                     // Logic Payload
        "verb": "slash",
        "tactic_tag": "aggressive",
        "skill_id": "root_force"
      },
      "duration_tag": "moment"            // Time Advancement
    }
  ]
}