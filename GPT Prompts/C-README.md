# RPG Storyteller Prompt System Analysis

## Overview

The GPT Prompts folder contains a sophisticated, modular prompt engineering system designed for an AI-driven RPG storytelling platform. The system uses a **strict load order** and **authority precedence** to ensure consistent behavior across different worlds and adventures.

## Core Architecture

### 1. **Strict Load Order System**

The prompts are designed to be loaded in a specific sequence that establishes a hierarchy of authority:

```
1. world-codex-<world>-logic.json     (World rules & constraints)
2. systems.unified.json               (Core game mechanics)
3. style.ui-global.json               (Global presentation)
4. style.<world>.md                   (World-specific styling)
5. core.rpg-storyteller.json          (Narrative protocols)
6. agency.presence-and-guardrails.json (AI behavior controls)
7. save.instructions.json             (Persistence rules)
8. validation.save.json               (Data validation)
9. validation.assets.json             (Asset validation)
10. adventure.<name>.json             (Story content)
11. (Save structure defined in save.instructions.json)
12. world-codex-<world>-lore.md       (Optional flavor)
```

### 2. **Authority Precedence**

Each layer has specific authority over different aspects:

- **Core & Agency**: Phase/lock safety, choice gating, ambient scheduling
- **Systems Unified**: Schemas, policies, perspective guards, beats
- **Style**: Presentation only (headers, chips, templates)
- **Save**: Persistence & merge rules (never drives UI)
- **Validation**: Guardrails that validate if present
- **Adventure**: Content (factions, scenes, locations, triggers)

## Key Components Analysis

### **AWF v1 Output Contract**

The system enforces a strict JSON output format called "Action Wire Format v1":

```json
{
  "scn": { "id": "string", "ph": "string" },
  "txt": "string",
  "choices": [{ "id": "string", "label": "string", "gated?": boolean }],
  "acts": [{ "eid": "string", "t": "action_type", "payload": {} }],
  "val": { "ok": boolean, "errors": [], "repairs": [] }
}
```

**How AI interprets this**: The AI must return ONLY this JSON structure, with no markdown, commentary, or additional keys. This creates a predictable, parseable output that the game engine can process.

### **Phase-Based Rendering System**

The system uses a sophisticated phase-based approach:

```json
{
  "phases": [
    "scene_preamble", // Ambient allowed
    "scene_body", // Ambient allowed
    "outcome_render", // NO ambient, NO inserts
    "post_outcome_reflection", // Ambient allowed
    "choice_menu_render" // NO ambient, NO inserts
  ]
}
```

**How AI interprets this**: The AI must respect phase locks - no ambient narration during outcome rendering or choice menu rendering. This prevents narrative contamination of critical game moments.

### **Buffered Commit Pattern**

The system implements atomic state changes:

1. Snapshot buffer before outcome render
2. Render outcome into snapshot
3. Commit as one atomic block
4. Release locks
5. Append deferred ambient beats

**How AI interprets this**: State changes must be atomic and reversible. The AI should not make irreversible changes until the outcome is fully committed.

## World-Agnostic Design

### **Modular World System**

Each world consists of:

- **Logic file**: Time rules, tech bans, anachronisms, difficulty bands
- **Style file**: World-specific tone, diction, visual elements
- **Lore file**: Optional flavor text (non-binding)
- **Adventure file**: Story content, NPCs, locations, triggers

**How AI interprets this**: The AI can switch between worlds by loading different bundles while maintaining the same core engine behavior.

### **Graceful Degradation**

The system is designed to continue functioning even when files are missing:

```json
{
  "graceful_degradation": {
    "missing_templates": "fall back to plain text",
    "missing_derived_fields": "treat as empty strings",
    "missing_assets": "continue with best effort"
  }
}
```

**How AI interprets this**: If a required file is missing, the AI should log the absence but continue with available functionality rather than failing completely.

## AI Behavior Controls

### **Agency & Presence System**

The `agency.presence-and-guardrails.json` file controls AI behavior:

```json
{
  "policy": {
    "player_speaker_guard": true,
    "actions_player_only": true,
    "pause_on_out_of_character": true,
    "name_lock_enabled": true
  }
}
```

**How AI interprets this**:

- Only the player can initiate actions
- NPCs cannot speak as the player
- The AI should pause if the user goes out of character
- NPCs cannot use the player's name until it's been shared

### **NPC Social Beats**

The system includes sophisticated NPC interaction rules:

```json
{
  "channels": {
    "npc_social": {
      "max_per_scene": 1,
      "eligible_phases": ["scene_body", "post_outcome_reflection"],
      "ineligible_phases": ["outcome_render", "choice_menu_render"]
    }
  }
}
```

**How AI interprets this**: NPCs can have social interactions (romance, rivalry, cooperation) but only during appropriate phases and with strict limits.

## Validation & Safety

### **Multi-Layer Validation**

The system includes comprehensive validation:

1. **Save validation**: Ensures save files are valid and complete
2. **Asset validation**: Verifies required templates and assets exist
3. **Runtime validation**: Checks for missing canon, invalid states

**How AI interprets this**: The AI should validate its outputs and include validation errors in the response when issues are detected.

### **Safety Overrides**

Built-in safety mechanisms:

```json
{
  "safety_overrides": {
    "children_in_party_blocks_offense": true,
    "severe_wounded_blocks_offense": true,
    "recent_alarm_raises_stealth_dc": true
  }
}
```

**How AI interprets this**: The AI should automatically adjust difficulty and available choices based on safety conditions.

## Content Management

### **First-Meet Rule**

Critical for maintaining mystery and discovery:

```json
{
  "first_meet_policy": {
    "observed_only": true,
    "forbidden_fields": ["backstory", "hidden_traits", "private_goals"]
  }
}
```

**How AI interprets this**: When introducing new NPCs, the AI should only reveal what the player can observe, not internal facts or secrets.

### **Relationship System**

Complex relationship tracking:

```json
{
  "relationships": {
    "with_player": {
      "trust": "number -3..+3",
      "warmth": "number -3..+3",
      "energy": "number -3..+3"
    }
  }
}
```

**How AI interprets this**: The AI should track and evolve relationships based on player actions, with small incremental changes.

## Refinement Opportunities

Based on this analysis, here are areas where the prompt system could be refined:

### 1. **Clarity of Phase Transitions**

The phase system is sophisticated but could benefit from clearer transition rules and examples.

### 2. **Error Recovery Mechanisms**

While graceful degradation exists, more specific error recovery procedures could be added.

### 3. **Performance Optimization**

The system loads many files - consider bundling related configurations to reduce load time.

### 4. **Testing Framework**

Add specific test cases for each component to ensure the AI correctly interprets the rules.

### 5. **Documentation Enhancement**

The system would benefit from more examples showing how the AI should behave in edge cases.

This prompt system represents a sophisticated approach to AI-driven storytelling with strong emphasis on consistency, safety, and modularity. The strict load order and authority precedence ensure predictable behavior while the modular design allows for world-specific customization.
