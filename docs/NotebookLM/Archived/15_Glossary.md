# 15 Glossary and Definitions

*(StoneCaster / Chimera Engine – MVP)*

This document serves as the **canonical terminology reference** for all systems, rulesets, authoring tools, runtime components, MAS models, and engine concepts.
It ensures that every term across documentation, UI, compiler code, and runtime behavior is consistent.

Definitions are written for absolute clarity so they can be used directly by NotebookLM, Cursor, developers, and authors.

---

# 1. Core System Terms

### **StoneCaster**

The overall platform enabling authors to build worlds, compile stories, and deliver AI-driven narrative gameplay.

### **Chimera Engine**

The runtime logic and prompt-governance system that interprets player actions, resolves outcomes deterministically, and generates narrative.

### **Chimera Engine Workflow**

The structured pipeline governing how prompts, state, and logic interact:
**MAS-1 → Engine → MAS-2**

### **Compiler**

Transforms author-created content + selected rulesets into a **Compiled Story**, including:

* schema definitions
* initial state
* instruction bundles (MAS-1 & MAS-2)
* lore index metadata
* token budgets

### **Compiled Story**

A frozen, immutable set of instructions and starting values that defines how a playable story behaves.

### **Player Session**

A runtime instance of a compiled story with:

* session_id
* active turn index
* evolving state
* message history

### **Game State**

A full snapshot of Tier0, Tier1, and Tier2 data at a specific turn.

### **Forces (UI Term)**

The collection of **Rulesets** (physics/mechanics) governing the story.
Formerly "Laws".

### **Elements (UI Term)**

The collection of **Entities** (Characters, Items, Locations) in the story.
Formerly "Cast".

### **World Preset**

A pre-configured "Genre Card" (e.g., High Fantasy) selected in Step 1.
It applies a set of default Forces and Safety Filters to jumpstart creation.

### **Library vs. Forge**

*   **Library**: The mode for picking existing assets to "clone" into the story.
*   **Forge**: The mode for creating new assets from scratch.

---

# 2. Tiers of the Domain Model

### **Tier 0 (T0) — World**

Global parameters:

* time band
* environmental fields
* selected rulesets
* safety filters

### **Tier 1 (T1) — Entities**

All actors in the story (player + NPCs), including:

* identity
* stats
* personality
* preferences/phobias
* emotional state
* relationships
* quirks

### **Tier 2 (T2) — Systems**

Global and systemic mechanics:

* stamina
* hunger
* combat states
* magic system values
* agendas
* survival flags

---

# 3. MAS Model Terms

### **MAS-1 (Action Interpreter)**

Role:

* interpret player text
* extract intent
* determine skill route
* assign duration tag
* apply difficulty modifiers
* detect gating failures

Outputs structured JSON **only**, never prose.

### **MAS-2 (Narrative Engine)**

Role:

* narrate outcome of resolved action
* apply style injections
* reflect state readouts
* embody NPC moods, quirks, values, and relationships
* integrate lore (when relevant)
* respect narrative restrictions

Outputs structured JSON containing:

```json
{
  "narration": "...",
  "hints": ["..."]
}
```

### **Instructions Bundle**

Compiler-generated set of constraints and style rules applied to MAS-1 and MAS-2.

### **Style Injections**

Narrative cues (tone, sensory detail, tension) added by rulesets.

### **State Readouts**

Values MAS-2 must incorporate in output.

---

# 4. Ruleset Terms

### **Ruleset**

A JSON definition that:

* modifies state structure
* defines engine behaviors
* adds MAS instructions
* enforces mechanical or narrative constraints

### **Foundation Ruleset**

Defines primary mechanics (skills, stamina, time, combat).

### **Expansion Ruleset**

Adds depth to NPC behavior, emotional systems, or narrative style.

### **Flavor Ruleset**

Adds optional tone or world-building elements.

### **Exclusion Group**

Ruleset category where only one option may be selected (e.g., only one skill system).

### **State Contribution**

A JSON merge defining new or modified fields in T0/T1/T2.

---

# 5. Engine Terms

### **Resolution Summary**

The Engine's distilled description of action outcome (success, fail, strain, etc.).
Used as MAS-2 context.

### **State Delta**

Minimal changes applied to the previous state to form the new state.

### **Deterministic Resolution**

Ensures the same input → same outcome.

### **Duration Tag**

Used by MAS-1 and Engine to advance time:

* moment
* scene
* journey
* rest

### **Hard Gate**

A rule preventing an action:

* collapsed stamina
* starving block
* combat-only actions attempted in non-combat context

---

# 6. Emotional / Social Terms

### **Valence**

Emotional polarity (positive / neutral / negative).

### **Mood**

Moment-to-moment emotional context (focused, weary, anxious).

### **Relationship Spotlight**

A memory or shared history that colors NPC reactions.

### **Affinity**

Numerical or qualitative measure of relationship strength.

### **Quirk**

NPC behavior trait triggered in specific moods or contexts.

### **Value Conflict**

NPC refuses to act against strongly held values.

---

# 7. Survival & Combat Terms

### **Stamina**

Short-term energy resource affecting physical action.

### **Physical Condition**

Derived from stamina thresholds:

* Rested
* Winded
* Exhausted
* Collapsed

### **Hunger State**

Long-term survival pressure:

* Sated
* Hungry
* Starving

### **Combat Condition**

Simplified contest-based system:

* Healthy
* Wounded
* Defeated

---

# 8. Lore & RAG Terms

### **Lore Fragment**

A discrete chunk of world-building text.

### **Embedding**

Vector representation of lore for semantic retrieval.

### **Lore Index**

Compiler-generated metadata for retrieving relevant lore at runtime.

### **Lore Fragment Limit**

Maximum lore pieces allowed in a MAS-2 prompt.

---

# 9. Prompt Assembly Terms

### **Prompt Budget**

Maximum tokens allocated for state, instructions, and narration.

### **State Summary**

Concise readable view of state used by MAS-1 and MAS-2.

### **Narrative Restrictions**

Rules MAS-2 must follow (e.g., no mechanics, no contradictions).

### **Agenda Behavior**

How NPC goals influence scene tone.

### **Quirk Behavior**

How quirks are injected into narrative.

---

# 10. UX Terms

### **Narration Window**

Where MAS-2’s output appears.

### **State Panel**

Real-time display of stamina, hunger, NPC moods, etc.

### **Action Input Box**

Where players type actions.

### **Session Card / Turn Card**

Optional visual representation of previous turn.

---

# 11. API & DB Terms

### **DTO (Data Transfer Object)**

Strict schema for API request/response.

### **RLS (Row Level Security)**

Postgres policy restricting row access by user.

### **JSONB Envelope**

Canonical shape for world, entity, lore, or story definitions.

### **Promoted Columns**

Typed SQL columns used for filtering or RLS enforcement.

### **IVFFlat Index**

Vector index for embedding similarity search.

---

# 12. Error Terms

### **MAS-1 Error**

Invalid intent or gated action.

### **MAS-2 Error**

Invalid JSON, broken style, or contradiction.

### **Compiler Error**

Ruleset conflict, missing dependency, invalid schema.

### **Runtime Error**

API or Engine error unrelated to LLM layers.

---

# 13. Safety Terms

### **Safety Filter**

Story-level content limits (PG, PG13, R-lite).

### **Forbidden Topics**

Content domains MAS-2 must not reference.

### **Narrative Guardrail**

Explicit constraint preventing MAS outputs from violating tone or logic.

---

# 14. Canonical Abbreviations

```md
T0 = Tier0 World  
T1 = Tier1 Entities  
T2 = Tier2 Systems 
MAS = Multiple Agent System  
DTO = Data Transfer Object  
RLS = Row Level Security
NPC = Non-Player Character  
IVF = Inverted File Index (vector search format)  
```

---

# 15. Summary

This Glossary ensures **shared vocabulary** across the entire project:

* developers
* authors
* LLM prompt engineers
* documentation writers
* NotebookLM embeddings

It is the authoritative source for terminology used throughout StoneCaster.
Any new concept introduced into the system must be added here to maintain consistency.
