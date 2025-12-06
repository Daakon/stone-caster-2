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
1. **Fast World Creation**  
   Authors can produce a fully playable interactive story in minutes using the Casting Circle Wizard rather than constructing state machines, quest flows, or dialogue trees manually.

2. **Modular Ruleset Ecosystem**  
   The system lets authors shape the physics, emotions, combat, survival, and social logic of their world simply by selecting rulesets.  
   This leverages the rich foundations already present in your database (e.g., D100 Pillars, Vitality/Stamina, NPC Values, Personality, Quirks, Combat Lite, etc.).

3. **Narrative Consistency with Zero Micromanagement**  
   MAS-2 ensures tone, behavior, emotions, survival needs, time-of-day, and relationships remain coherent across all scenes without the author needing to script every scenario.

4. **Deterministic Simulation Backbone**  
   Authors retain total control over how the world works because underlying mechanics (stamina, hunger, relationship scoring, contests, etc.) are deterministic, readable, and inspectable.

5. **Separation of Creative and Technical Complexity**  
   Authors focus on lore and worldbuilding while the system handles:  
   - State updates  
   - Time advancement  
   - Skill resolution  
   - Emotional state propagation  
   - Relationship memory surfacing  
   - Behavioral triggers

---

### B. **For Players**
1. **Stories That React and Remember**  
   NPCs have personalities, values, quirks, phobias, agendas, and relational memory—allowing the story to feel alive, dynamic, and deeply personal.

2. **Fair, Understandable Mechanics**  
   Clear deterministic rules (e.g., D100 roll-under, stamina thresholds, hunger states) reinforce transparency and fairness.

3. **Narrative That Honors Player Decisions**  
   Every action updates world state and NPC attitudes, and MAS-2 narration strictly follows these updates—never contradicting the underlying mechanics.

4. **Replayability**  
   Changing rulesets, entities, or lore produces dramatically different worlds and outcomes.

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
- **Story Creation Time**  
  Authors should be able to create a playable world in **under 10 minutes**.
- **Compilation Reliability**  
  More than **95 percent of first attempts** should compile successfully without structural errors.  
- **Ruleset Compatibility Stability**  
  All selectable predefined rulesets must successfully pass dependency + exclusion validation.

### Category B — **Runtime Stability**
- **Action Loop Performance**  
  - MAS-1 + Engine + MAS-2 combined response time: **p95 < 4 seconds**.  
- **State Determinism**  
  - 100 percent of actions must produce reproducible state transitions given the same initial state and input.  
- **Narrative Coherence**  
  - MAS-2 must not contradict engine state or rule-defined constraints in **99 percent+** of responses.

### Category C — **Player Experience**
- **Emotional Reactivity**  
  NPCs update relational memories, values, and emotional states in at least **90 percent** of relevant interactions.  
- **Meaningful Consequence Rate**  
  At least **80 percent** of player actions should produce visible narrative or mechanical consequences (state change, tone shift, NPC behavior alteration, time advancement, etc.).  
- **Session Completion**  
  60 percent of players should complete a defined story arc or continue beyond the first 10 turns.

### Category D — **Content Quality / Consistency**
- **Ruleset-Driven Narrative Fidelity**  
  MAS-2 must incorporate at least **one active state_readout or style_injection** from active rulesets in **80 percent** of responses.  
- **Tone & Style Enforcement**  
  Rich rulesets (personality, quirks, values, agendas, hunger, stamina, combat condition, wealth/capability, etc.) must appear naturally in narration.

---

## 5. Guardrail Metrics (Quality Gates)

These prevent regressions during MVP development:

1. **Zero Contradictions Rule**  
   No MAS-2 output may contradict state fields such as  
   stamina level, hunger state, emotional valence, relationship tags, combat condition, time band, or any rule-defined constraints.

2. **Deterministic Rule Execution**  
   Engine logic must produce identical results given identical inputs (no random number drift, no hidden state).

3. **Ruleset Safety Guarantee**  
   No rule may mutate a field outside of its allowed Tier or schema.

4. **Author Safety Guarantees**  
   The compiler must prevent:  
   - cyclic dependencies,  
   - ruleset-exclusion conflicts,  
   - undefined fields or missing definitions.

---

## 6. Long-Term KPIs (Post-MVP Indicators)
Although not required for MVP launch, these shape future planning:

- **Number of published stories**  
- **Player retention & replay rate**  
- **Average story completion time**  
- **Conversion to premium ruleset packs**  
- **AI system stability & cost efficiency**

---

## 7. Summary Statement
The MVP succeeds if **authors can rapidly build a world**, **the system compiles it into a coherent rules-driven story**, and **players experience believable, reactive, mechanically consistent interactive fiction**—all within predictable performance and quality guarantees.

StoneCaster’s unique value lies at the intersection of **deterministic systems** and **adaptive narrative**, producing experiences no traditional narrative engine or sandbox RPG system can replicate at scale.
