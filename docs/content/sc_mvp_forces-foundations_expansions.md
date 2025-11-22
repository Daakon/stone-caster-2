# StoneCaster MVP Foundations and Expansions

This document defines the complete blueprint for StoneCaster's MVP systems using the Foundations + Expansions model. It is written for content managers who will configure rulesets inside the app and for designers who need to understand how each system functions, how they interact, and how they are extended by expansions. The goal of this plan is clarity, modularity, and low token cost during play, while still enabling rich narrative and social dynamics.

---

## Foundations
Foundations are the core building blocks of any story dimension. They are self-contained, lightweight systems that require no additional rulesets to function. They provide essential mechanics, state structures, and narrative cues. Expansions build on these foundations to add depth or genre-specific behaviors.

### 1. D100 Skill Framework (Foundation)
The D100 Skill Framework provides the universal skill chassis for StoneCaster. It defines how skills are represented, rolled, and interpreted. The system is intentionally simple, allowing worlds and expansions to layer complexity only where needed.

It includes:
- A standardized numeric skill value (1–100).
- Tag-based skill classification (e.g., social, survival, performance).
- A consistent roll structure used by MAS1 for evaluating outcomes.
- Success tiers: critical success, success, partial success, fail, critical fail.

This foundation does not dictate which skills exist. Instead, each world or expansion contributes its own list, with tags that the compiler uses to bind behavior or narrative rules. Skills are used by both players and NPCs, and expansions like Social Skills or Skills → Behavior draw directly from these definitions.

### 2. Relationship Framework (Foundation)
The Relationship Framework manages the emotional and social ties between characters, both player ↔ NPC and NPC ↔ NPC. It is lean, deterministic, and purposefully minimal, ensuring stable behavior and clear engine-side rules.

The framework tracks four primary numeric attributes, each from 0–100:
- **Affection**: General warmth or liking.
- **Trust**: Confidence in honesty, reliability, and integrity.
- **Respect**: Perceived competence, capability, or authority.
- **Attraction**: Romantic or physical interest.

These four values are the only persistent relationship metrics. Everything else derives from them.

Instead of a rivalry stat, the system uses **threshold-driven relationship tags**, which the engine recalculates whenever Affection, Trust, Respect, or Attraction changes. These tags unlock narrative or behavioral affordances.

Example core tags used in MVP:
- **friend** → Affection > 70 and Trust > 60
- **rival** → Respect > 80 and Affection < 40
- **romantic_interest** → Affection > 80 and Attraction > 70
- **estranged** → Trust < 20 (and previously held a positive tag)

Tags are deterministic reflections of the numeric stats. Content managers can add or modify tag definitions per story, and expansions can add world-specific tags.

The Relationship Framework provides the foundational social state for all expansions, including social skills, NPC behaviors, threshold tags, and emotional weighting.

### 3. Status Framework (Foundation)
The Status Framework provides a lightweight but flexible system for temporary or persistent states that influence narrative and behavior. This includes emotional, mental, and environmental conditions.

Statuses include:
- Emotional: anxious, confident, irritated, inspired.
- Cognitive: focused, distracted.
- Environmental: soaked, cold, overheated.

Each status has:
- A severity level (e.g., 1–5).
- A duration type (turn, scene, long, or until cleared).

Statuses do not rely on health, HP, or injuries. Instead, they influence skill rolls, dialogue tone, and NPC intent scoring. Expansions may add their own statuses, and worlds can configure custom ones.

### 4. Fatigue/Stamina Framework (Foundation)
This system handles character exhaustion and natural resource cycles like rest, hunger, and overexertion. It grounds stories in realism without requiring survival mechanics or health systems.

Key features:
- A simple fatigue value from 0–100.
- Thresholds that trigger status effects (e.g., "tired" or "exhausted").
- Natural recovery through rest, food, or calm scenes.

The system allows AI-driven, context-aware decisions during narrative play. For example, if fatigue is high, MAS1 may suggest rest, adjust tone ("your limbs feel heavy"), or color skill rolls. Expansions can convert fatigue into hunger or sleep pressure without increasing complexity.

### 5. Scene & Context Framework (Foundation)
This framework provides spatial, temporal, and environmental grounding for the narrative. It ensures continuity and allows expansions to determine whether an action is appropriate.

It tracks:
- The current location.
- Entities present in the scene.
- The time band (morning, midday, evening, night).
- Broad environmental context (quiet market, stormy forest, dimly lit room).

This information is used by MAS1 and MAS2 to shape behavior and narrative. For example, certain intents (like flirtation) may require privacy; negotiation may require a formal environment; travel fatigue may accumulate only during movement scenes.

---

## Expansions (MVP Optional)
Expansions extend the foundations with additional capabilities, rules, or dynamic behaviors. Each expansion depends on one or more foundations and should be able to run lightly without inflating token footprint.

### Social Threshold Tags Expansion
This expansion defines the rules for deriving social tags from Tier 1 stats (Affection, Trust, Respect, Attraction). The engine recalculates tags automatically based on thresholds.

Examples included in MVP:
- **friend** → Unlocks helpful actions.
- **rival** → Unlocks challenge-oriented behaviors.
- **romantic_interest** → Enables romance arcs.
- **estranged** → Locks previous social perks and shifts tone.

Content managers can extend this list with story-specific tags.

### Social Skills Expansion
Adds core social skills (e.g., persuasion, empathy, deception) and integrates them into narrative and mechanical systems. Depends on the Skills and Relationship Foundations.

### Skills → Behavior Expansion
Maps installed skills to NPC behavior intents and activates skill-driven decision-making. Uses the new Behavior Intent Framework and Relationship Framework to guide when NPCs act and how.

### Fatigue → Needs Expansion
Adds hunger, sleep pressure, and travel strain. Converts fatigue into lightweight status effects that influence behavior and narrative tone.

### Emotional Weighting Expansion
Enables emotional memory and lingering emotional states, influencing dialogue and reactions over time. Depends on Status + Relationship Foundations.

---

## Not Included in MVP (MVP Optional)
Expansions extend the functionality of foundations. They can depend on one or more foundations and add new capabilities, narrative behaviors, or dynamic interactions. Each expansion contributes schema, gates, rules, and narrative constraints.

### 1. Social Skills Expansion
This expansion introduces core social skills such as persuasion, empathy, deception, and intimidation. These skills derive from the D100 Skills Foundation but define their own meaning and tags.

The expansion:
- Integrates skill checks into dialogue and social scenes.
- Uses the Relationship Framework to influence success chance or tone.
- Allows players and NPCs to engage in structured social actions.

Content managers can customize the skill list based on genre or world tone.

### 2. Skills → Behavior Expansion
This expansion gives NPCs the ability to make autonomous decisions based on skills, relationships, statuses, and scene context. It creates "behavior intents" such as flirt, comfort, negotiate, or deceive.

The system:
- Scores each potential intent using a small utility formula.
- Uses skill tags to map skills dynamically (no hardcoded lists).
- Allows NPC ↔ NPC interactions that feel alive and personal.
- Introduces cooldowns and gates to prevent excessive NPC activity.

This is one of the expansions that adds the most narrative depth without bloating tokens.

### 3. Fatigue → Needs Expansion
This expansion ties fatigue into light survival-style needs. Hunger, sleep pressure, or travel fatigue appear naturally through story context.

It:
- Converts fatigue thresholds into status effects.
- Allows scenes to automatically suggest rest or nourishment.
- Adds realism without requiring complex survival mechanics.

Worlds can modify how quickly fatigue accumulates or recovers.

### 4. Emotional Weighting Expansion
This expansion deepens emotional resonance within the narrative. It allows emotional statuses to linger and influence reactions or skill checks.

It:
- Enhances Relationship Framework behaviors.
- Modifies dialogue or tone in MAS2.
- Allows events to leave emotional impact that fades gradually.

Content managers can define custom emotional weights for each story.

---

## Not Included in MVP
The following systems are intentionally omitted to keep the MVP lightweight and focused on social, narrative-driven storytelling:
- Combat systems
- HP or injuries
- Inventory or items
- Magic
- Economy or crafting
- Factions or species systems

