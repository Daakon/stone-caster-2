# 03 Universal Turn Protocol
*(StoneCaster / Chimera Engine – Reset v1.0)*

## 1. Core Philosophy
The StoneCaster turn is a **Tri-Phase Orchestration** that separates creative intent from mechanical resolution. It moves the system from a linear action-response model to a "Director-Led" simulation.

1.  **The Director**: Creative and Strategic Lead. Defines the "Social Reality" and queues tactical actions based on Player Input and RAG Lore.
2.  **The Engine**: Tactical Arbiter. Resolves physical "Physics" using the Resolution Ladder and applies hard state changes.
3.  **The Narrator**: Cinematic Lead. Synthesizes intended actions and actual results into cohesive prose.

---

## 2. Phase 1: The Director (Strategic Pre-Processing)
The Director analyzes the player's input against the **Mechanical State** and **Lore (RAG)**.

### 2.1 Unseen Ripples (Internal State)
The Director identifies immediate internal shifts that occur the moment an action is *attempted* or *witnessed*. These are applied to the state **BEFORE** the Engine resolves physical actions.
* **Relationship Shifts**: Direct changes to NPC `affinity` or `resentment` based on the player's perceived intent.
* **Emotional State**: Updates to NPC `mood` (e.g., Jovial → Terrified).
* **Impact Tiers**: The Director assigns a magnitude (**Minor, Moderate, Major, Severe**) rather than a raw number. The Engine converts these tiers into numerical deltas.

### 2.2 Scene Staging & Proximity
The Director manages the "Stage" to prepare for physical resolution:
* **Atmosphere**: Updates `narrative_focus.scene_context.atmosphere` (e.g., "Lighthearted" to "Tense").
* **Proximity Mapping**: For every action in the queue, the Director identifies a `proximity_cluster` (entities standing near the target) to account for collateral damage or accidents.

### 2.3 The Intent Queue
The Director generates an ordered list of **Actions** for the Player and reacting NPCs.
* **Format**: Every action includes the `actor_id`, `trigger_id`, `intended_targets`, and `proximity_cluster`.

---

## 3. Phase 2: The Engine (Deterministic Physics)
The Engine resolves the Director's queue using the **Resolution Ladder**.

### 3.1 The Resolution Ladder (4-Tier Priority)
For every action in the queue, the Engine determines success:
1.  **Tier 1 (Comparative)**: Actor Stats vs. Target Stats/Defense.
2.  **Tier 2 (Situational)**: Modifiers from `situational_tags` (e.g., INTOXICATED, PROTECTING_ALLY).
3.  **Tier 3 (Difficulty)**: Global modifiers from environment or Director assessment.
4.  **Tier 4 (Tactic)**: Bonuses/Penalties from the specific `tactic_tag` used.

### 3.2 The Accident & Multi-Target Logic
* **Success**: `actual_targets` matches `intended_targets`.
* **Fumble/Mistake**: The Engine programmatically shifts one or more targets from the `intended_targets` array to the `proximity_cluster` array.
* **Result**: The final delta includes both arrays so the Narrator can distinguish between "Who you tried to hit" and "Who you actually hit".

---

## 4. Phase 3: The Narrator (Cinematic Synthesis)
Narrator generates 1-3 paragraphs of prose. It is forbidden from revealing mechanics and must strictly adhere to the Engine's results.

### 4.1 Narrative Resonance Rules
* **Conflict Resolution**: If `intended_targets` != `actual_targets`, the Narrator must describe the physical reason for the accident (stumble, deflection, chaos).
* **Tiered Description**: A "Severe" impact must be described with higher sensory intensity than a "Minor" impact.

---

## 5. Master Director DTO (`director_intent`)
```json
{
  "turn_meta": {
    "resolution_mode": "engine | narrative",
    "atmosphere_shift": "string",
    "time_jump_minutes": 0
  },
  "unseen_ripples": [
    {
      "target_id": "uuid",
      "type": "relationship | emotional | status",
      "delta_tier": "Minor | Moderate | Major | Severe",
      "property_path": "string",
      "reason": "string"
    }
  ],
  "intent_queue": [
    {
      "actor_id": "uuid",
      "trigger_id": "string",
      "intended_targets": ["uuid"],
      "proximity_cluster": ["uuid"],
      "parameters": {
        "verb": "string",
        "impact_tier": "Low | Moderate | High | Severe",
        "tactic_tag": "string",
        "skill_id": "string"
      }
    }
  ]
}
```

## 6. Execution Timeline (System Level)

1.  **Input Received**: Player submits text.
2.  **Director Call**: Director generates the Unified DTO.
3.  **Soft State Write**: `atmosphere_shift` and `unseen_ripples` are written to `mechanical_state`.
4.  **Engine Cycle**: Engine iterates through `intent_queue` using Resolution Ladder.
5.  **Hard State Write**: Wounds, stamina, and `actual_targets` are persisted.
6.  **Narrator Call**: Narrator generates prose based on Intent vs. Result.
7.  **Final UX Delivery**: Narrative + Updated Sidebar are displayed to player.