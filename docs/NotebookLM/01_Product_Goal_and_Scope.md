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

### Authoring (Casting Circle Wizard)
The author should be able to complete a structured 3–5 minute setup to create a runnable story:

1. Define metadata (title, summary, tone).  
2. Choose a **World Foundation**:  
   - Time Bands  
   - D100 Skill System (or other root engines)  
   - Vitality/Stamina, Needs, Wealth/Capability, Combat (Lite)  
   - NPC Foundations: Personality, Relationships, Values, Behaviors  
   - **All rulesets in DB are selectable** and must resolve dependencies/exclusion groups.  
3. Add Entities/NPCs.  
4. Add Lore that will feed contextual retrieval.  
5. Compile.

Output: a fully validated **Chimera Story Bundle**.

---

### Compiler
The compiler will:

- Validate ruleset dependencies + exclusion groups.  
- Merge all ruleset actions, instructions, and state schema into a unified model.  
- Produce:
  - **Tier definitions**  
  - **State definitions**  
  - **AI instruction bundles** (MAS-1 & MAS-2)  
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
- Simple text interface for action input.  
- Game log (message history).  
- State sidebar (basic stats, conditions, time band).  
- Authoring interface sufficient to produce full Story Bundle.

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
