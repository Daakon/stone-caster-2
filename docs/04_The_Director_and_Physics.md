# 04_The_Director_Manifesto
*(StoneCaster / Chimera Engine – Reset v1.0)*

## 1. Role & Primary Objective
The **Director** is the Strategic Lead of the Chimera Engine. Its objective is to convert raw player input into a **Unified Intent DTO** that defines the social, emotional, and tactical reality of the turn. It does not narrate; it architects the "unresolved" state of the world by setting the stakes before the Engine resolves the math.

## 2. Decision Logic: The Bifurcation Rule
The Director must determine the `resolution_mode` for the turn:
* **"Engine" Mode**: Required if any intent in the queue involves a **Skill Check**, **Stamina Cost**, **Physical Conflict**, or **Resource Usage**.
* **"Narrative" Mode**: Used only for low-stakes social flavor, simple exploration, or atmospheric interaction where failure is impossible or uninteresting.

## 3. The Internal Ripple Protocol (Unseen)
The Director identifies immediate internal shifts that occur the moment an action is declared, prior to physical resolution.
* **Lore-Driven Reactions (RAG)**: Use Lore fragments to determine NPC reactions to the player's intent.
* **Tiered Magnitudes**: All ripples must be assigned a magnitude: **Minor**, **Moderate**, **Major**, or **Severe**.
* **Immediate Application**: Relationship (Affinity/Resentment) and Emotional (Mood/Valence) changes are written to the state **BEFORE** the Engine processes physical actions.

## 4. Reactive Intent & Proximity Logic
The Director populates the `intent_queue` with the player's action and NPC counter-actions.
* **Priority Queue**: The Director orders intents based on tactical logic (e.g., a Guard may preemptively block an attack).
* **Proximity Mapping**: For every high-stakes action, the Director identifies a `proximity_cluster` of entities standing near the target to account for collateral damage.

---

# 05_The_Physics_Ladder
*(StoneCaster / Chimera Engine – Reset v1.0)*

## 1. The Resolution Arbiter
The Engine serves as the "Physics Engine" of the world, resolving the Director's `intent_queue` using deterministic math.

## 2. The Tiered Impact Scale
The Engine converts the Director's **Textual Tiers** into numerical state deltas.
* **Minor**: 5% of attribute/resource.
* **Moderate**: 15% of attribute/resource.
* **Major**: 30% of attribute/resource.
* **Severe**: 50%+ of attribute/resource or permanent status application.

## 3. The Resolution Ladder (4-Tier Logic)
For every intent in the queue, the Engine calculates a Success Target ($T$):
$$T = \text{Base Stat} + \text{Tier 1 (Comparative)} + \text{Tier 2 (Situational)} + \text{Tier 3 (Difficulty)} + \text{Tier 4 (Tactic)}$$
* **Fumble (Roll > 95)**: Triggers the **Proximity Cascade**.
* **Critical (Roll < 5)**: Upgrades the `impact_tier` by one level (e.g., Moderate → Major).



## 4. The Proximity-Based Cascade
If a resolution results in a Fumble or unintended redirection, the Engine shifts the target:
1. **Identify Intended**: Refers to the Director's `intended_targets`.
2. **Execute Shift**: On failure/fumble, the Engine selects a target from the `proximity_cluster` defined by the Director.
3. **Log Result**: The final delta explicitly lists `intended_targets` vs `actual_targets` for the Narrator.

## 5. State Hardening
* **Stamina Drain**: Every combat or strenuous intent subtracts 5-10 Stamina regardless of success.
* **Status Tags**: Failures apply physical status tags (e.g., `[OFF_BALANCE]`) to the actor's Tier 1 properties.