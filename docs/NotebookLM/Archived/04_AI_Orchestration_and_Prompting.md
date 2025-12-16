# 04 AI Orchestration and Prompting
*(StoneCaster / Chimera Engine – MVP)*

This document defines the **Runtime Intelligence** of the system. It covers **how prompts are built** (Chimera Assembly) and **how the narrative reads** (Style & Tone Guide).

---

# PART 1: PROMPT ASSEMBLY (CHIMERA)

## 1. Purpose
The Chimera Engine ensures **deterministic structure** and **strict guardrails**. Prompts for MAS-1 and MAS-2 are **fully constructed at runtime** using:
* The compiled story’s instruction bundles
* Current game state
* Retrieved lore fragments
* Rule-derived constraints

**Rule:** No prompt string may ever contain ad-hoc or developer-written logic. All logic comes from the Compiler.

## 2. Prompt Assembly Pipeline

    Compiler → CompiledStory.instructions → Runtime Prompt Builder
         ↓                                         ↓
      MAS-1 Input → MAS-1 Output → Engine → MAS-2 Input → MAS-2 Output

## 3. State Summary Generation
State summaries condense Tier0/Tier1/Tier2 into a short form for LLM context.

**Example Summary:**
> Deep Night; stamina 88 (Winded); hunger: Hungry;
> NPC Arven: mood cautious, quirk finger-tapping active;
> Relationship spotlight: Old Debt.

## 4. MAS-1 Prompt Template (Action Interpreter)
MAS-1 converts free text into structured intent. It never produces prose.

**System Prompt Structure:**
1.  **Role**: Chimera Action Interpreter.
2.  **Instructions**: derived from `compiled_story.instructions.mas1`.
    * Intent Keywords (e.g., "attack", "sneak")
    * Hard Gates (e.g., "collapsed" blocks "travel")
    * Skill Routing
3.  **Context**: State Summary + Player Text.

**Target Output:**

    {
      "intent": "attempt_action",
      "skill_id": "root_finesse",
      "difficulty_mod": -20,
      "duration_tag": "scene",
      "blocked_reason": null
    }

## 5. MAS-2 Prompt Template (Narrative Engine)
MAS-2 generates narrative, constrained by the Engine's resolution.

**System Prompt Structure:**
1.  **Role**: Chimera Narrative Engine.
2.  **Inputs**:
    * `resolution_summary`: The engine's mechanical result.
    * `style_injections`: Tone rules from active rulesets.
    * `state_readouts`: Mandatory values to narrate (e.g., Stamina).
    * `narrative_restrictions`: What NOT to do.
    * `lore_fragments`: RAG-retrieved context.

**Target Output:**

    {
      "narration": "The lock gives a reluctant click...",
      "hints": ["Your stomach tightens with hunger."]
    }

## 6. Instruction Bundle Merging
The compiler merges instructions from all selected rulesets.
* **MAS-1**: Union of all intent keywords and hard gates.
* **MAS-2**: Append style injections; Union of narrative restrictions.
* **Conflict**: If two rulesets modify the same path without namespacing, the compiler raises an error.

## 7. Lore Retrieval
* **Algorithm**: Query vector DB using player intent + context.
* **Limit**: Inject top `k` fragments (budget constrained).
* **Usage**: MAS-2 uses lore only if it reinforces the scene and does not contradict state.

## 8. Token Budget Governance
Defined at compile-time to ensure performance and cost control.
* **MAS-1 Budget**: ~800 tokens.
* **MAS-2 Budget**: ~1300 tokens.
* **State Summary Limit**: ~250 tokens.

## 9. Error Handling
* **MAS-1 Gating**: If action is blocked, return `blocked_reason`. The runtime displays this as a diegetic warning (e.g., "You are too exhausted.").
* **MAS-2 Validation**: If output is invalid JSON or violates constraints, regenerate with **stricter instructions**.

---

# PART 2: CONTENT STYLE AND TONE GUIDE

## 1. Core Tone Philosophy
* **Cinematic Minimalism**: Short, evocative, sensory-driven lines.
* **State-Reflective**: Prose mirrors stamina, hunger, and mood.
* **No Meta-Narration**: Never mention dice, stats, AI, or mechanics.
* **Environment as Character**: Time-bands subtly color every paragraph.

## 2. Global Tone Rules (MAS-2 Constraints)
* **Length**: 2–6 sentences per turn.
* **POV**: Third-person limited.
* **Sensory Hierarchy**: Visual > Auditory > Tactile > Kinesthetic.
* **Immutability**: Never improvise irreversible world facts (only the Engine changes state).

## 3. Emotional Expression
MAS-2 must reflect:
* **Valence/Mood**: (e.g., *Anxious* = darting glances, tension).
* **Relationship Spotlight**: Subtle references to the active memory (e.g., "The weight of the old debt is visible in his expression").
* **Quirks**: Activate specific behaviors if the quirk map matches the current mood.

## 4. Environmental Tone Guide (Time Bands)
MAS-2 must inject one subtle cue tied to the current time band.

* **Early Morning**: Pale light, quiet awakening.
* **Midday**: Clarity, bustle, heat.
* **High Noon**: Tension, harsh contrast.
* **Dusk**: Transition, secrecy, long shadows.
* **Deep Night**: Danger, whispers, silhouettes.

## 5. Forbidden Narrative Elements
MAS-2 must never:
* Break POV.
* Use modern slang (unless setting allows).
* Generate explicit content beyond safety filters.
* Decide plot outcomes on its own (Engine determines outcomes).

## 6. Example Output (Exploration Turn)

    A faint glimmer reflects off the damp stone as you step forward.
    Arven shifts beside you, the tension in his stance sharpening in the Deep Night hush.
    Your breath clouds lightly in the cool air.