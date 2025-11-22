# Chimera V3 Social Physics & Personality Specification

**Version:** 1.0
**Status:** Draft
**Context:** Chimera RPG Engine (Tier 1 Engine / Tier 0 Narrative)

---

## 1. Executive Summary
This specification defines the "Social Engine"—a deterministic system for calculating character relationships and behavior. It separates **Social DNA** (Internal math) from **Narrative Output** (LLM generation) to ensure deep, consistent, and evolving character dynamics without AI hallucinations.

---

## 2. The Core Models

### 2.1 Personality DNA (The 6 Core Drives)
Every Entity (Player and NPC) is defined by **6 Core Drives** tracked on a **0–100 scale**. These values define the character's internal moral and social compass.

| Core Drive | 0 (Negative Pole) | 100 (Positive Pole) | Engine Tag | Narrative Adjectives (0 / 100) |
| :--- | :--- | :--- | :--- | :--- |
| **Honesty** | Deceptive, Cunning | Truthful, Direct | `honesty` | *Manipulative / Candid* |
| **Order** | Chaotic, Spontaneous | Disciplined, Lawful | `order` | *Wild / Rigid* |
| **Altruism** | Greedy, Selfish | Generous, Selfless | `altruism` | *Avaricious / Charitable* |
| **Aggression** | Peaceful, Serene | Violent, Wrathful | `aggression` | *Serene / Fierce* |
| **Sociability**| Reclusive, Quiet | Outgoing, Loud | `sociability` | *Reserved / Boisterous* |
| **Curiosity** | Traditional, Guarded | Open, Inquisitive | `curiosity` | *Conservative / Daring* |

### 2.2 Relationship State (The ATR Model)
Relationships are tracked per-entity using a **0–100 scale** where **50 is Neutral**.

1.  **Affection:** Emotional closeness.
    * *Range:* 0 (Loathing) <-> 100 (Love)
2.  **Trust:** Reliability and safety.
    * *Range:* 0 (Paranoia) <-> 100 (Faith)
3.  **Respect:** Competence and status perception.
    * *Range:* 0 (Contempt) <-> 100 (Reverence)
4.  **Attraction:** (Optional) Romantic or magnetic pull.
    * *Range:* 0 (None) <-> 100 (Deep Pull)

---

## 3. Data Structures (JSON Schema)

### 3.1 Entity Social Schema (Tier 1)
Add this structure to `BaseCharacter` or World Extensions. This data is managed strictly by the Engine.

```typescript
interface EntitySocialState {
  // The immutable personality core (mutable only via specific Growth Arcs)
  social_dna: {
    honesty: number;     // 0-100
    order: number;       // 0-100
    altruism: number;    // 0-100
    aggression: number;  // 0-100
    sociability: number; // 0-100
    curiosity: number;   // 0-100
  };

  // The dynamic relationship map
  // Key = Target Entity ID (e.g., "player_1", "npc_kiera")
  relationships: Record<string, {
    affection: number;
    trust: number;
    respect: number;
    attraction: number;
    tags: string[]; // Contextual flags: ["rival", "romantic_interest", "sibling_bond"]
  }>;
}
```

### 3.2 Action Schema (Rulesets)
Every Action in a Ruleset must define its **Social Signature**. This allows the Engine to judge the action mathematically.

```json
"actions": {
  "STEAL": {
    "kind": "mechanical",
    "logic": "...", 
    "social_signature": {
      "honesty": 10,      // Highly deceptive action
      "altruism": 10,     // Highly selfish action
      "aggression": 30    // Low-mid aggression (non-violent crime)
    }
  },
  "INTIMIDATE": {
    "kind": "mechanical",
    "logic": "...",
    "social_signature": {
      "aggression": 90,   // Highly aggressive
      "sociability": 70   // Requires interaction/loudness
    }
  }
}
```

---

## 4. Runtime Logic & Algorithms

### 4.1 The Compatibility Algorithm
This runs whenever an NPC witnesses an action. It determines how their opinion of the actor changes.

**Formula:**
`Delta = (100 - |WitnessValue - ActionValue|) * Weight`

**Example Scenario:**
* **Action:** Player uses `STEAL` (`Honesty: 10`).
* **Witness:** Kiera (`Honesty: 80`).
* **Calculation:**
    1.  Difference: `|80 - 10| = 70` (High friction).
    2.  Compatibility: `100 - 70 = 30` (Low score).
    3.  Result: Since Compatibility (30) is < Neutral (50), apply **Negative Delta** to Affection/Respect.

### 4.2 Threshold Triggers (Tags)
Tags are not added randomly; they are "earned" when stats cross thresholds.

| Tag | Prerequisites (Tier 1 Stats) | Effect |
| :--- | :--- | :--- |
| `friend` | Affection > 70, Trust > 60 | Unlocks "Help" actions. |
| `rival` | Respect > 80, Affection < 40 | Unlocks "Challenge" dialogues. |
| `romantic_interest` | Affection > 80, Attraction > 70 | Enables Romance Arc events. |
| `estranged` | Trust < 20 (was Friend) | Locks previous social perks. |

---

## 5. System Integration (MAS Pipeline)

### Step 1: MAS 1 (Input Interpreter)
**Role:** Extracts the "Social Vibe" from user text if no strict Action is triggered.
**Prompt Instruction:**
> "Analyze the user's tone. Assign values (0-100) to: Honesty, Aggression, Altruism. If the user is lying, Honesty = 10. If threatening, Aggression = 80."

### Step 2: Engine (Deterministic Processor)
**Role:** Updates the numbers.
1.  Receive `SocialSignature` from MAS 1 or Action Definition.
2.  Run **Compatibility Algorithm** against all witnesses.
3.  Update `relationships` map (Affection/Trust/Respect).
4.  Check **Threshold Triggers** (Add/Remove Tags).
5.  Output `numeric_deltas` and `outcome_summary`.

### Step 3: MAS 2 (Narrative renderer)
**Role:** Writes the reaction based on the new state.
**Prompt Instruction Injection:**
> **Acting Instructions for [NPC Name]:**
> * **Core Drive:** High [Drive Name] ([Value]). [Adjective describing behavior].
> * **Relationship State:** Affection is [Value] (High/Low). Trust is [Value] (High/Low).
> * **Recent Event:** The Player just performed a [Tag] action.
> * **Direction:** Write the NPC's reaction. Because they value [Drive], they should [Approve/Disapprove].

---

## 6. Implementation Steps for Engineering

1.  **Schema:** Update `BaseCharacter` in `shared/types` to include `EntitySocialState`.
2.  **Seed Data:** Update `seed-v3-granular.ts` to populate NPCs (e.g., Kiera) with specific `social_dna` values.
3.  **Engine Service:** Implement the `calculateSocialDelta(observer, actor, action)` function in `backend/services/runtime/social-engine.ts`.
4.  **MAS 2 Service:** Update the System Prompt generator to inject the "Acting Instructions" block dynamically based on the NPC's JSON data.