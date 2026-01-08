# 01 Product Goal and Scope  
*(StoneCaster / Chimera Engine – MVP)*

## 1. Product Vision
StoneCaster is a **player-driven narrative RPG engine** powered by structured rulesets, deterministic state updates, and guided narrative generation. Authors define **Worlds**, **Entities**, **Rulesets**, and **Lore**, which are compiled into a playable **Chimera Story Bundle**. The engine scales from rule-heavy tactical adventures to 'cozy' atmospheric simulations where relationships and ambiance take precedence over combat. Players experience this bundle through an interactive loop governed by:

1. **MAS-1** – intent analysis, action classification, and deterministic parameter extraction.  
2. **Engine** – state updates, ruleset resolution, time advancement, resource systems, contest logic.  
3. **MAS-2** – fully guided narration constrained by state, rulesets, entity context, active conditions, values, emotions, time bands, and relationship memory.

The MVP’s purpose is not to demonstrate full feature breadth, but to deliver a **stable, repeatable, tightly scoped proof of the core storytelling loop**, with enough authoring capability for real-world viability.

---

## 2. MVP Goal
Deliver a **minimal yet complete authoring-to-play pipeline**:

- Authors can define a world, choose rulesets, write key entities, and add lore.  
- The system compiles these assets into a structured, validated state bundle.  
- Players can **start**, **submit actions**, and **receive narratively coherent outcomes** following clear, deterministic game rules.

Success = **Author → Compile → Play → Deterministic Updates → Constrained Narrative** works every time.

---

## 3. Target Users (MVP)

### Primary
- **Narrative Designers / Worldbuilders** wanting to rapidly create RPG-style interactive stories without coding.  
- **RPG Players** who enjoy story-forward, rules-governed interactive fiction.

### Secondary
- Solo developers wanting a rules-driven narrative engine.  
- Designers wanting a sandbox for simulation-heavy NPCs with emotional, motivational, and behavioral layers.

---

## 4. MVP Deliverables

### Authoring (Casting Circle Editor)
The author uses a **Non-Linear Tabbed Interface** (`World` | `Forces` | `Elements` | `Lore` | `Bind`) to assemble a story:

1. **World (Tab 1)**: Select a **World Preset** (e.g., High Fantasy, Cyber Sprawl) which sets default Forces and Safety. (Gating: Tabs 2-5 disabled until World selected).
2. **Forces (Tab 2)**: Configure rulesets with **Visual Hierarchy** (Expansions nested under Foundations).
   * **Inheritance Rule:** The Story is *additive*. The World's rulesets are the immutable baseline. The Story author can layer *additional* rulesets on top, but cannot subtract from the World's physics.
3. **Elements (Tab 3)**: Add Entities/NPCs via **Library** (clone) or **Forge** (create new).
4. **Lore (Tab 4)**: Add Contextual Lore via Library/Forge.
5. **Bind (Tab 5)**: Compile the story.

Output: a fully validated **Chimera Story Bundle**.

---

### Compiler
The compiler will:

- Validate ruleset dependencies + exclusion groups.  
- Merge all ruleset actions, instructions, and state schema into a unified model.  
- Produce:
  - **Tier definitions** - **State definitions** - **AI instruction bundles** (MAS-1 & MAS-2)  
  - **Global mechanics** (skill system, stamina, hunger, combat states, wealth tiers, etc.)  
  - **RAG ingestion** of lore  
  - **Initial game state**

Compiler success → game can launch with deterministic expectations.

---

### Runtime (Play Loop)
The runtime supports the loop:

1. **MAS-1** interprets player text → intent, parameters, difficulty, tags.  
2. **Engine** uses rulesets to:
   - Resolve contests (e.g., D100 5-pillars, D100 roll-under engine, cinematic combat).  
   - Update stamina, hunger, emotional valence, relationship tags, time band advancement, etc.  
   - Apply threshold logic, forced conditions, and contextual triggers from rulesets.  
3. **MAS-2** produces narration strictly constrained by:
   - Rule-defined style injections  
   - State readouts  
   - System conditions  
   - Active quirks, values, phobias, agendas, relationships  
   - Time bands & survival needs  
   - Combat condition states  
   - Wealth & capability tags  
   - And all other rulesets active in the world

---

## 5. Scope of the MVP
This defines **exactly what IS included**.

### In Scope

#### A. Authoring
- CRUD: Worlds, Entities, Rulesets (predefined), Lore.  
- Casting Circle Wizard with validation.  
- Automatic ingestion of lore into embeddings.  

#### B. Compiler
- Ruleset dependency resolution and exclusion checks.  
- JSON schema merging from rulesets + world.  
- Generation of:  
  - MAS-1 instructions  
  - MAS-2 style injections + state readouts  
  - Engine state machine (tiered)  
  - Time advancement logic  
  - Deterministic update pipeline  
- Error reporting with actionable feedback.

#### C. Runtime
- MAS-1 intent analysis (one round).  
- Engine:  
  - D100 skill system (roll-under; cascade roots)  
  - Stamina drain & restoration  
  - Hunger / satiety decay and states  
  - Time bands (moment/scene/journey/rest)  
  - Combat Lite (Healthy → Wounded → Defeated)  
  - Wealth capability checks  
  - NPC personality, quirks, agendas, values, phobias, relationships with memory-scoring  
- MAS-2 narrative output, constrained and state-aware.

#### D. Minimal UI
- Core play client: multiline action composer + MAS guidance.  
- Game log (message history) with MAS-1/MAS-2 groupings.  
- State sidebar (stats, conditions, NPC spotlight, time band).  
- Play hub (`/play`) for session management (resume/abandon).  
- Discovery browsers (Worlds, NPCs, Stories) with cross-linking detail modals.  
- Create hub (`/create`) + Casting Circle wizard for authoring.  
- Profile & Author hubs plus conversion screens (stones/subscription) for account management.

#### E. Database / Infra
- Hybrid DB model: structured columns for filters, JSONB for canonical model.  
- pgvector for RAG.  
- Supabase auth + RLS.  
- Cloudflare R2 asset storage.

---

## 6. Out of Scope (MVP Exclusions)
These features **will not** be implemented:

- Inventory system (replaced by Wealth/Capability)  
- Economic market, shops, crafting  
- Party system or multi-character control  
- Spatial movement/map rendering  
- Multi-actor combat  
- Branching dialogue trees  
- Advanced UI widgets beyond core text loop  
- Marketplace / story sharing hub  
- Complex multi-step quests (NPC agendas cover a minimalist form)  
- Multiplayer or shared sessions  
- Persistent world state beyond a single player session

---

## 7. Constraints
- Runtime must remain under **4 seconds** p95 for action → full narrative response.  
- Compiler must remain under **2 seconds** p95 for medium-sized worlds.  
- MAS-2 narrative must **never contradict state**.  
- MAS-1 must route intents consistently using ruleset keywords + skill mappings.  
- The engine must enforce **hard gates** such as:  
  - Collapse preventing movement/combat (vitality rules).  
  - Hunger starvation impacting narrative description and action viability.  
  - Relationship memory surfacing emotional tone.

---

## 8. MVP Success Criteria

### A. Functional
- Authors can produce a complete story in < 10 minutes.  
- 100 percent of rulesets in DB can compile without breaking dependency or exclusion rules.  
- Player actions consistently update state according to rules.  
- Narration always respects:  
  - Condition states  
  - Emotional/relational values  
  - Skills and thresholds  
  - Time band constraints  
  - Active quirks / agendas / values  
  - Survival needs  
  - Combat state  
  - Wealth/capabilities  
  - All other rule-injected styles

### B. Stability
- No undefined behavior when multiple rulesets act on the same Tier1 fields.  
- RAG retrieval stays within allowed context window and is stable.

### C. Experience
- Player feels the world react — emotionally, physically, temporally, narratively — to every action.  
- Authors feel that their rules + lore genuinely shape player output.

---

## 9. Future Scope (Post-MVP)
Not required, but framing future growth:

- Visual maps, scenes, and spatial exploration  
- Inventory & equipment system (non-abstract)  
- Party-based play  
- Deep quest scripting  
- Multiplayer  
- Marketplace for sharing stories  
- Export/import story bundles

---
---

# 02 Value Props and Success Metrics  
*(StoneCaster / Chimera Engine – MVP)*

## 1. Core Value Proposition
StoneCaster provides a **rules-driven narrative engine** that blends deterministic game mechanics with adaptive storytelling. It removes the burden of writing complex logic, balancing systems, and maintaining narrative consistency by giving authors a **structured, reliable, and deeply expressive toolset** powered by modular rulesets.

The result is a platform where:
- Authors can build rich, reactive worlds without coding.
- Players experience stories where **mechanics and narrative reinforce each other**.
- The system ensures **consistency, fairness, and replayability** using deterministic rules grounded in the author’s chosen rulesets.

---

## 2. Key Value Props by Persona

### A. **For Authors (Primary Creator Persona)**
1. **Fast World Creation** Authors can produce a fully playable interactive story in minutes using the Casting Circle Editor's **World Presets** rather than constructing state machines, quest flows, or dialogue trees manually.

2. **Modular Ruleset Ecosystem** The system lets authors shape the physics, emotions, combat, survival, and social logic of their world simply by selecting rulesets.  
   This leverages the rich foundations already present in your database (e.g., D100 Pillars, Vitality/Stamina, NPC Values, Personality, Quirks, Combat Lite, etc.).

3. **Narrative Consistency with Zero Micromanagement** MAS-2 ensures tone, behavior, emotions, survival needs, time-of-day, and relationships remain coherent across all scenes without the author needing to script every scenario.

4. **Deterministic Simulation Backbone** Authors retain total control over how the world works because underlying mechanics (stamina, hunger, relationship scoring, contests, etc.) are deterministic, readable, and inspectable.

5. **Separation of Creative and Technical Complexity** Authors focus on lore and worldbuilding while the system handles:  
   - State updates  
   - Time advancement  
   - Skill resolution  
   - Emotional state propagation  
   - Relationship memory surfacing  
   - Behavioral triggers

---

### B. **For Players**
1. **Stories That React and Remember** NPCs have personalities, values, quirks, phobias, agendas, and relational memory—allowing the story to feel alive, dynamic, and deeply personal.

2. **Fair, Understandable Mechanics** Clear deterministic rules (e.g., D100 roll-under, stamina thresholds, hunger states) reinforce transparency and fairness.

3. **Narrative That Honors Player Decisions** Every action updates world state and NPC attitudes, and MAS-2 narration strictly follows these updates—never contradicting the underlying mechanics.

4. **Replayability** Changing rulesets, entities, or lore produces dramatically different worlds and outcomes.

---

## 3. Business / Platform Value Props

### A. **Scalable Content Ecosystem**
Because rules are modular and stories compile into consistent bundles, the system can scale into:
- A marketplace of published stories  
- User-generated content libraries  
- Genre packs and premium rule expansions  
- AI-curated scenario recommendation engines

### B. **Clear Technical Separation of Concerns**
The architecture separates:
- Author data  
- Rulesets  
- Compiler outputs  
- Runtime logic  
- MAS-1 and MAS-2 instructions

This ensures long-term maintainability and easier evolution into modular “Chimera Engine Packs.”

### C. **Production-Grade Stability with Low Operational Overhead**
Deterministic rules + structured state = predictable compute/runtime costs.  
MAS-1 and MAS-2 calls remain bounded and optimized.

---

## 4. MVP Success Metrics

### Category A — **Authoring Success**
- **Story Creation Time** Authors should be able to create a playable world in **under 10 minutes**.
- **Compilation Reliability** More than **95 percent of first attempts** should compile successfully without structural errors.  
- **Ruleset Compatibility Stability** All selectable predefined rulesets must successfully pass dependency + exclusion validation.

### Category B — **Runtime Stability**
- **Action Loop Performance** - MAS-1 + Engine + MAS-2 combined response time: **p95 < 4 seconds**.  
- **State Determinism** - 100 percent of actions must produce reproducible state transitions given the same initial state and input.  
- **Narrative Coherence** - MAS-2 must not contradict engine state or rule-defined constraints in **99 percent+** of responses.

### Category C — **Player Experience**
- **Emotional Reactivity** NPCs update relational memories, values, and emotional states in at least **90 percent** of relevant interactions.  
- **Meaningful Consequence Rate** At least **80 percent** of player actions should produce visible narrative or mechanical consequences (state change, tone shift, NPC behavior alteration, time advancement, etc.).  
- **Session Completion** 60 percent of players should complete a defined story arc or continue beyond the first 10 turns.

### Category D — **Content Quality / Consistency**
- **Ruleset-Driven Narrative Fidelity** MAS-2 must incorporate at least **one active state_readout or style_injection** from active rulesets in **80 percent** of responses.  
- **Tone & Style Enforcement** Rich rulesets (personality, quirks, values, agendas, hunger, stamina, combat condition, wealth/capability, etc.) must appear naturally in narration.

---

## 5. Guardrail Metrics (Quality Gates)

These prevent regressions during MVP development:

1. **Zero Contradictions Rule** No MAS-2 output may contradict state fields such as  
   stamina level, hunger state, emotional valence, relationship tags, combat condition, time band, or any rule-defined constraints.

2. **Deterministic Rule Execution** Engine logic must produce identical results given identical inputs (no random number drift, no hidden state).

3. **Ruleset Safety Guarantee** No rule may mutate a field outside of its allowed Tier or schema.

4. **Author Safety Guarantees** The compiler must prevent:  
   - cyclic dependencies,  
   - ruleset-exclusion conflicts,  
   - undefined fields or missing definitions.

---

## 6. Long-Term KPIs (Post-MVP Indicators)
Although not required for MVP launch, these shape future planning:

- **Number of published stories** - **Player retention & replay rate** - **Average story completion time** - **Conversion to premium ruleset packs** - **AI system stability & cost efficiency**

---

## 7. Summary Statement
The MVP succeeds if **authors can rapidly build a world**, **the system compiles it into a coherent rules-driven story**, and **players experience believable, reactive, mechanically consistent interactive fiction**—all within predictable performance and quality guarantees.

StoneCaster’s unique value lies at the intersection of **deterministic systems** and **adaptive narrative**, producing experiences no traditional narrative engine or sandbox RPG system can replicate at scale.

---
---

# 03 System Overview  
*(StoneCaster / Chimera Engine – MVP)*

## 1. High-Level Architecture
StoneCaster is structured as a **three-layer system**:

1. **Authoring Layer (Frontend)** Tools for creating Worlds, Entities, Rulesets (predefined), and Lore.  
   Output → Author Input Bundle.

2. **Compilation Layer (Chimera Compiler)** Validates, merges, and transforms author data + rulesets into a playable **Chimera Story Bundle**.  
   Output → CompiledStory (the canonical state + instructions package).

3. **Runtime Layer (Play Engine)** Executes the interactive loop:  
   **MAS-1 → Engine → MAS-2**, maintaining deterministic world state and constrained narration.

These layers are connected by strict JSON schemas and a hybrid data model ensuring reproducibility and clear separation of concerns.

---

## 2. Core System Components

### 2.1 Authoring Interface (Casting Circle Editor)
A **Non-Linear Tabbed Interface** enabling authors to:

- **World**: Start from a **World Preset** (Genre Card) to auto-populate defaults.
- **Forces**: Configure rulesets with visual grouping and exclusion checks.
- **Elements**: Manage Entities/NPCs using **Library** (clone) and **Forge** (create) modes.
- **Lore**: Manage Contextual Lore.
- **Bind**: Compile the story when ready.

The authoring interface produces a **complete Author Input Bundle**—the minimum information required for compilation.

---

### 2.2 Chimera Compiler
The compiler transforms author data and ruleset definitions into a unified, validated runtime model. It performs:

#### 2.2.1 Structural Validation
- Ruleset dependency resolution  
- Exclusion-group conflict detection  
- Schema checks: required fields, Tier assignments, data types  
- Entity and world schema validation  
- Lore formatting & safety validation

#### 2.2.2 Schema Merging
- Combines all selected ruleset schemas into a single **Tiered State Model**:
  - **Tier0** – global rules & world state  
  - **Tier1** – entity-level state (player + NPCs)  
  - **Tier2** – system/global mechanics (success bands, difficulty tiers, etc.)

#### 2.2.3 Instruction Aggregation
- Builds **MAS-1 instructions**:
  - Intent keyword mapping  
  - Difficulty extraction  
  - Duration tagging (Time Bands)  
  - Skill/attribute routing  
  - Forbidden or limited actions (collapse, hunger, fatigue enforcement)

- Builds **MAS-2 instructions**:
  - Style injections (tone, sensory detail, emotional coloration)  
  - State readouts for narration  
  - Agenda-driven nudging  
  - Combat flavor rules  
  - Value & phobia reactions  
  - Survival cues, exhaustion signals, time-of-day descriptions

#### 2.2.4 Lore Processing
- Chunks and embeds lore entries  
- Stores embeddings in vector DB for MAS-2 retrieval  
- Creates a retrieval plan (max fragments, scoring criteria)

#### 2.2.5 Initial Game State Construction
- Initializes player + NPC states  
- Applies ruleset-defined defaults (traits, stamina, hunger, wealth tier, combat condition, etc.)

**Compiler Output → CompiledStory** A structured bundle containing:

- Unified state schema  
- Initial state snapshot  
- Ruleset-derived mechanics  
- MAS-1 & MAS-2 instructions  
- Lore embeddings  
- Story metadata

This bundle is passed to the runtime with no further transformation.

---

## 3. Runtime Architecture

### 3.1 The Core Loop
Each turn follows the deterministic pipeline:

**MAS-1 → Engine → MAS-2 → Updated State**

1. **MAS-1 (Action Interpreter)** - Converts free-text player input into:  
     - intent  
     - parameters (targets, difficulty cues, tactic tags)  
     - duration tags  
     - emotion/relational hints  
   - Enforces ruleset constraints (e.g., collapse prevents travel/fight).

2. **Engine (Deterministic State Machine)** Applies all mechanics defined by active rulesets:
   - Skill checks (D100 Pillars or D100 Engine)  
   - Contests (combat, wealth checks)  
   - Stamina drain / restoration  
   - Hunger & satiety decay  
   - Emotional valence modifications  
   - Relationship graph updates (spotlight memory surfacing)  
   - Quirk activation based on emotional state  
   - Agenda and objective handling  
   - Phobia/interest triggered reactions  
   - Time Band advancement (moment → scene → journey/rest)

   The Engine produces:  
   - **state_delta** (all changes)  
   - **resolution_summary** (structured interpretation of mechanical results)

3. **MAS-2 (Narrative Composer)** Using the updated state + ruleset instructions, MAS-2 generates constrained narrative that respects:  
   - Personality, moods, values, quirks, agendas, phobias  
   - Relationship memory  
   - Hunger, stamina, combat condition  
   - Wealth capability constraints  
   - Active skill being resolved  
   - Time band sensory framing  
   - RAG-fed lore context

MAS-2 **cannot contradict state**. All narrative conditions must come from the compiled ruleset instructions or live state.

4. **State Writeback** State updates are persisted and exposed to the UI.

---

### 3.2 Engine Subsystems

#### 3.2.1 Skill Resolution Subsystem
- Handles D100 root competencies (Force, Finesse, Awareness, Insight, Influence).  
- Performs cascade resolution: specific → parent root node.  
- Supports difficulty modifiers and static success bands.

#### 3.2.2 Contest Resolution Subsystem
Used for:
- Combat Lite  
- Wealth purchasing tests  
- NPC vs Player contests

Returns (actor_win, target_win, tie) with mechanical follow-up (wound states, defeat, denial).

#### 3.2.3 Survival Subsystem
Handles:
- Stamina decay + threshold states (Rested → Exhausted → Collapsed)  
- Hunger decay + states (Well Fed → Hungry → Starving)  
- Forced rest / travel blocking  
- Needs-based narrative triggers

#### 3.2.4 Social & Emotional Subsystem
Drives NPC embodiment:
- Personality trait enforcement  
- Phobia/interest-triggered mood changes  
- Agenda urgency  
- Relationship memory spotlighting  
- Emotional valence adjustments  
- Quirk activation based on mood

#### 3.2.5 Time Subsystem
World Cycle & Time Bands:
- Assigns duration tags (moment, scene, journey, rest).  
- Advances tick and recalculates time band.  
- Supplies sensory framing for MAS-2.

---

## 4. Data Architecture

### 4.1 Hybrid Model
All canonical data (rulesets, worlds, entities, compiled stories, game states) live in **JSONB**, but certain fields are promoted into structured columns when needed for filtering or indexing.

Examples:
- `ruleset_template.key` (text index)  
- `compiled_story.author_id` (foreign key)  
- `game_state.session_id` (session lookup)  
- Vector embeddings stored in `lore_embeddings` table (pgvector)

This provides:
- Flexibility for schema evolution  
- Strict performance for runtime queries  
- Ease of ruleset composition

---

### 4.2 Storage Responsibilities

| Data Type | Storage | Purpose |
|----------|---------|---------|
| Worlds | JSONB | Canonical world definition |
| Entities / NPCs | JSONB | Personality, values, quirks, agendas, stats |
| Ruleset Templates | JSONB + SQL cols | Modular mechanics; selected by author |
| Compiled Stories | JSONB | Aggregated runtime instructions |
| Game States | JSONB | Full player state at each turn |
| Lore | JSONB + pgvector | RAG retrieval for MAS-2 |

---

## 5. Frontend Overview

### 5.1 Authoring UI
- Casting Circle Editor (Tabbed: World, Forces, Elements, Lore, Bind)
- World Presets (Genre Cards)
- Forces Editor (Ruleset configuration)
- Elements & Lore Manager (Library/Forge)
- Compile button (Bind Tab)
- Validator output panel

### 5.2 Player UI
Minimalist but functional for MVP:
- Text input box  
- Scrollable game log  
- State sidebar (summary of Tier1 fields)  
- Icons or lightweight cues for time band, stamina, hunger, combat state  
- Loading state + error handling

---

## 6. API Overview

### 6.1 Authoring Endpoints
- `POST /worlds`  
- `POST /entities`  
- `POST /lore`  
- `POST /compile` → returns CompiledStory

### 6.2 Runtime Endpoints
- `POST /play/start`  
- `POST /play/cast`  
  - Input: action text  
  - Output: MAS-1 → Engine → MAS-2 compiled result

### 6.3 Utility Endpoints
- `GET /rulesets`  
- `GET /rulesets/:id`  
- `POST /embed/lore` (background ingestion)

Complete details will be defined in **07_API_Contract.md**.

---

## 7. Deployment Architecture

### 7.1 Backend
- **Fly.io**: containerized Node/Express service  
- **Supabase**: database + RLS auth  
- **pgvector extension**: embedding storage  
- **Rate limits**: per-session and per-IP to protect AI endpoints

### 7.2 Frontend
- **Cloudflare Pages**: static deployment  
- **React + Vite**: UI framework  
- **React Query** for data fetching/cache

### 7.3 Assets
- **Cloudflare R2**: image & asset hosting

### 7.4 Observability
- Request logs  
- Compiler error metrics  
- Runtime latency tracking  
- MAS-1/MAS-2 cost metrics

---

## 8. System Guarantees

### Deterministic Mechanics  
Engine outputs must be reproducible.

### Narratively Strict Coherence  
MAS-2 cannot contradict or overwrite engine state.

### Ruleset Integrity  
Rulesets cannot mutate fields outside their allowed schema.

### Modular Extensibility  
Any new ruleset or genre pack must “plug into” the same Compiler → Runtime pipeline without architectural changes.

### Safety  
All author input and narrative output must follow safety filters applied at compile time and during runtime.

---

## 9. Summary
The MVP system architecture ensures:

- Authors can build worlds quickly.  
- Rulesets define mechanics, not code.  
- The Compiler produces a complete and deterministic runtime bundle.  
- Runtime executes a clean MAS-1 → Engine → MAS-2 pipeline.  
- Narration is immersive, rule-governed, and consistent.  
- The database and deployment strategy allow for scalability and long-term growth.

This overview anchors the remaining documents (Domain Model, API Contract, Test Plan, Glossary) and serves as the architectural reference for NotebookLM and Cursor-driven development.

---
---

# 14 Roadmap and Cutlines

*(StoneCaster / Chimera Engine – MVP)*

This document defines the **official product roadmap**, **scope boundaries**, and **cutline rules** that determine what is included in the MVP, what is deferred, and what should *never* be added without major revision.
It ensures alignment across engineering, design, LLM prompt architecture, authoring workflow, and gameplay experience.

---

# 1. Roadmap Philosophy

The roadmap for StoneCaster balances:

* **Speed** — ship a working MVP quickly.
* **Stability** — avoid overextending the system with advanced features.
* **Determinism** — maintain predictable narrative structure.
* **Scalability** — build primitives that support expansion packs.

The principle:

> Build the *framework*, not the universe.

---

# 2. Roadmap Overview

Phase 0 – Foundation     → Architecture, schemas, rulesets
Phase 1 – MVP            → Compiler + Runtime + MAS pipelines
Phase 2 – Feature Pack 1 → Inventory, factions, quests
Phase 3 – Ecosystem      → Marketplace, multi-genre expansions
Phase 4 – Enterprise     → B2B SaaS platform (separate product)

# 3. Phase 0 — Foundation (Complete or In Progress)

**Goals:**

* Establish Domain Model (Tier0/Tier1/Tier2)
* Create initial ruleset catalog
* Define MAS-1 and MAS-2 schemas & templates
* Establish prompt-governance system (Chimera)
* Create DB schema + RLS rules
* Define UX flows
* Write core documentation

**Artifacts:**

* Domain Model
* Rulesets Index
* API Contract
* Test Plan
* UX Wireframes
* Style & Tone Guide
* Prompt Assembly Spec

Status: **Complete** (with ongoing refinement)

---

# 4. Phase 1 — MVP (Current Phase)

This is the **playable story** milestone.

### MVP Must Include:

1. **Authoring Tools**
   * Create/edit worlds
   * Create/edit entities
   * Create/edit lore
   * Select rulesets
   * Compile story

2. **Compiler**
   * Deterministic merging of state contributions
   * MAS instruction bundles
   * Lore index embedding

3. **Runtime Engine**
   * MAS-1 interpretive layer
   * Deterministic engine (stamina, hunger, contests)
   * MAS-2 narrative generator
   * Turn-based loop

4. **Player Experience**
    * Start session and resume existing ones via the Play hub
    * Story view (narration + action composer + state panel)
    * Enter actions and review MAS-1/MAS-2 output with resolution drawer
    * Browse published Worlds/NPCs/Stories via modal-rich discovery views
    * Access Profile/Author hubs to view creations, manage account/billing, and initiate conversions (stones/subscriptions)

5. **Infrastructure**
   * Auth & RLS
   * Logging & monitoring
   * Basic error handling

6. **Content**
   * At least 2 example worlds
   * Minimal lore set

### MVP Deliverables

> * Player can complete a 30–60 minute story session
> * Author can build a story from scratch
> * LLM outputs stable JSON 99% of the time
> * Compiler generates deterministic outputs
> * State updates remain consistent across turns

---

# 5. Phase 1 Cutlines (What Will Not Be Included)

Anything here is explicitly **excluded** from MVP.

## 5.1 Gameplay Features (Cut from MVP)

* Inventory system
* Item crafting
* Detailed combat engine (distance, targeting, HP)
* Quest chains / objectives system
* Factions system
* Money/economy simulation
* Reputation scores
* Alignment/morality system
* Detailed dialogue trees
* Party-based gameplay
* Non-linear scene branching

These rely on more complex state transitions and require expanded rulesets.

## 5.2 AI Features

* Memory persistence across sessions
* Reinforcement learning loops
* AI-generated rulesets
* Full story auto-generation
* Player emotion detection

## 5.3 Platform Features

* Marketplace
* Modding toolkit
* Developer API for external games
* Multi-device sync with offline mode

## 5.4 Admin Tools

* Version history for worlds/entities/lore
* Automated migration engine for stories
* Ruleset creation UI (admin-only in MVP)

---

# 6. Phase 2 — Feature Pack 1 (Post-MVP)

Focuses on **mechanical depth**.

## 6.1 Major Features

* Inventory (lightweight)
* Items + equipment
* Money + trade tiers
* Factions system
* Simple quest flags
* Emotional memory queues
* NPC long-term objectives

## 6.2 Required Additions

* New rulesets
* New engine procedures
* Expanded entity definitions
* Cross Story NPC Persistance (companions)

---

# 7. Phase 3 — Ecosystem Expansion

Turns StoneCaster into a platform.

## 7.1 Marketplace

* Buy/sell worlds, rulesets, art packs
* Creator revenue sharing

## 7.2 Player Accounts & Cloud Saves

* Cross-device syncing

## 7.3 Multi-Genre Expansion

* Noir pack
* Sci-fi pack
* Cozy pack
* Horror pack
* Superhero pack

Each includes:
* Genre-specific rulesets
* Tone injectors
* MAS-2 behavior extensions

---

# 8. Phase 4 — Enterprise (Separate Product)

This phase is **not** part of StoneCaster D2C.
It becomes an enterprise SaaS product with:

* SSO
* Admin dashboards
* Compliance frameworks (SOC2, HIPAA where relevant)
* API-based story engines for other companies

This is a **separate product line**, not a continuation of MVP.

---

# 9. Scope Boundaries (Deciding What Stays Out of MVP)

A feature is considered **Out of Bounds** for MVP if:

1. **It requires new ruleset categories** (e.g., factions, economy).
2. **It introduces new MAS instruction types** (e.g., dialogue tree data).
3. **It expands state beyond Tier0/Tier1/Tier2 primitives**.
4. **It reduces stability of deterministic narrative**.
5. **It adds more than one week of development overhead**.

If a feature touches more than **two architectures** (Compiler, Engine, MAS) simultaneously, it is automatically deferred to Phase 2 unless approved.

---

# 10. Risk Map

### High Risk (Do Not Add to MVP)
* Factions system
* Inventory system
* Dialogue tree branching

### Medium Risk (Maybe Later in MVP+)
* Quest flags
* Money system
* Expanded combat

### Low Risk (Safe for MVP if needed)
* More rulesets (tone, social behaviors)
* More worlds
* More lore

---

# 11. Success Criteria for MVP

The MVP is successful when:

> * ✓ A player completes a story with minimal errors
> * ✓ MAS-1 correctly parses 95% of actions
> * ✓ MAS-2 produces stable narrative with no contradictions
> * ✓ State evolution remains consistent and debuggable
> * ✓ Authors can create/compile worlds without engineering support
> * ✓ No critical security or RLS failures

These criteria ensure foundational viability before expanding the system.

---

# 12. Summary

This Roadmap & Cutlines document defines the **strategic boundaries** of the StoneCaster MVP.
It ensures:

* Focus
* Predictability
* Feasibility
* Room for future expansion without rewriting the core

Use this as the **guiding document** to prevent feature creep and maintain clear development priorities.
