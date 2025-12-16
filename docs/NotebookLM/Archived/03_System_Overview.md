# 03 System Overview  
*(StoneCaster / Chimera Engine – MVP)*

## 1. High-Level Architecture
StoneCaster is structured as a **three-layer system**:

1. **Authoring Layer (Frontend)**  
   Tools for creating Worlds, Entities, Rulesets (predefined), and Lore.  
   Output → Author Input Bundle.

2. **Compilation Layer (Chimera Compiler)**  
   Validates, merges, and transforms author data + rulesets into a playable **Chimera Story Bundle**.  
   Output → CompiledStory (the canonical state + instructions package).

3. **Runtime Layer (Play Engine)**  
   Executes the interactive loop:  
   **MAS-1 → Engine → MAS-2**, maintaining deterministic world state and constrained narration.

These layers are connected by strict JSON schemas and a hybrid data model ensuring reproducibility and clear separation of concerns.

---

## 2. Core System Components

### 2.1 Authoring Interface (Casting Circle Wizard)
A guided UI enabling authors to:

- Select rulesets (e.g., D100 Pillars, Personality, Relationships, Values, Stamina, Hunger, Combat Lite, Time Bands, etc.).  
- Create Entities and NPCs with personality, values, quirks, agendas, phobias, roles, stats, and world-specific metadata.  
- Add Lore entries for world context (later embedded for MAS-2 retrieval).  
- Configure world metadata (tone, genre, tags, safety filters).

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

**Compiler Output → CompiledStory**  
A structured bundle containing:

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

1. **MAS-1 (Action Interpreter)**  
   - Converts free-text player input into:  
     - intent  
     - parameters (targets, difficulty cues, tactic tags)  
     - duration tags  
     - emotion/relational hints  
   - Enforces ruleset constraints (e.g., collapse prevents travel/fight).

2. **Engine (Deterministic State Machine)**  
   Applies all mechanics defined by active rulesets:
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

3. **MAS-2 (Narrative Composer)**  
   Using the updated state + ruleset instructions, MAS-2 generates constrained narrative that respects:  
   - Personality, moods, values, quirks, agendas, phobias  
   - Relationship memory  
   - Hunger, stamina, combat condition  
   - Wealth capability constraints  
   - Active skill being resolved  
   - Time band sensory framing  
   - RAG-fed lore context

MAS-2 **cannot contradict state**. All narrative conditions must come from the compiled ruleset instructions or live state.

4. **State Writeback**  
State updates are persisted and exposed to the UI.

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
- Casting Circle Wizard (multi-step setup)  
- Entity editor with rule-driven fields  
- Lore editor  
- Rule selection UI showing dependencies & exclusions  
- Compile button → Calls compiler API  
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
