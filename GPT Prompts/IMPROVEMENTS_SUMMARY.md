# RPG Storyteller GPT Prompts - Improvements Summary

## Overview

This document summarizes the improvements made to the RPG Storyteller GPT prompts based on user feedback, suggestions, and developer instructions. The goal was to maintain desired functionality while improving prompt consistency, user experience, and system robustness.

## Implemented Improvements

### 1. Character Creation Flow ✅ COMPLETE

**Issue:** Character creation felt disconnected from main game flow
**Solution:** Added completion scene and improved transition

- **Implementation:** Added `character_creation/complete` scene with character summary and transition choices
- **Benefits:** Smooth flow from creation to gameplay, better character establishment

### 2. Baseline Save Timing ✅ COMPLETE

**Issue:** Baseline save generation happened too early
**Solution:** Changed trigger to ensure character completion

- **Implementation:** Changed trigger from "first_transition_creation_to_play" to "character_creation_complete"
- **Benefits:** Ensures character is fully established before save generation

### 3. Contradiction Detection Refinement ✅ COMPLETE

**Issue:** Contradiction heuristics were too broad and restrictive
**Solution:** Added temporal context and more nuanced detection

- **Implementation:**
  - `item_missing_recently` vs `item_missing`
  - `npc_absent_this_scene` vs `npc_absent_session`
  - Added `entity_not_established` heuristic
- **Benefits:** Allows legitimate narrative developments while preventing true contradictions

### 4. Dynamic Entity Persistence ✅ COMPLETE

**Issue:** Newly created entities disappeared between sessions
**Solution:** Added persistence rules to save/load system

- **Implementation:** Added persistence rules with save/restore, relationship maintenance, location preservation
- **Benefits:** Entities persist across sessions, maintaining world continuity

### 5. Nudge Frequency Reduction ✅ COMPLETE

**Issue:** Nudges appeared too frequently and felt forced
**Solution:** Reduced frequency and added fatigue tracking

- **Implementation:**
  - Reduced frequency from 15% to 10%
  - Increased threshold from 0.6 to 0.7
  - Reduced max nudges from 2 to 1
  - Added nudge fatigue tracking with decay
- **Benefits:** Less intrusive nudges that feel more natural

### 6. Random Spice Contextualization ✅ COMPLETE

**Issue:** Random spice felt disconnected from main narrative
**Solution:** Made it context-aware and tied to narrative elements

- **Implementation:**
  - Added contextual triggers (scene, NPCs, recent events, weather, time)
  - Added narrative integration rules
  - Reduced frequency from 15% to 10%
- **Benefits:** Random spice now enhances rather than distracts from the story

### 7. Role-Location Creative Exceptions ✅ COMPLETE

**Issue:** Role-location ontology was too restrictive
**Solution:** Added creative exception rules with narrative justification

- **Implementation:**
  - Added `ONTOLOGY_CREATIVE_EXCEPTION` repair code
  - Added creative exception validation rules
  - Provided examples of justified violations
- **Benefits:** Allows creative storytelling while maintaining plausibility

### 8. NPC-NPC Relationship Visibility ✅ COMPLETE

**Issue:** NPC relationships were too hidden from players
**Solution:** Increased visibility and added rumor system

- **Implementation:**
  - Increased public interaction frequency to 40%
  - Added rumor spreading with credibility thresholds
  - Added relationship rumor triggers
- **Benefits:** More visible NPC interactions that enhance storytelling

### 9. Error Recovery Contextualization ✅ COMPLETE

**Issue:** Error recovery choices were too generic
**Solution:** Made recovery options context-aware and story-advancing

- **Implementation:**
  - Added context-based recovery generation
  - Provided specific examples for different error types
  - Made recovery choices consider current scene, NPCs, goals, and events
- **Benefits:** More meaningful recovery options that advance the story

### 10. Relationship Progression Formulas ❌ NOT CHANGED

**Issue:** Relationship changes felt too mechanical
**Decision:** Keep mathematical approach for consistency
**Reasoning:** The current compatibility calculation provides reliable, predictable progression that prevents unrealistic instant romance while maintaining player agency

## New Developer Instructions Implementation

### 11. Timekeeper & Routine Scheduler ✅ COMPLETE

**Implementation:**

- **Mandatory time advancement:** Every turn includes exactly one `TIME_ADVANCE` ≥ 1 minute
- **Band transitions:** Morning/afternoon/evening/night transitions with in-world cues
- **Off-screen world simulation:** Schedule resolution, NPC interactions, world trickles
- **Benefits:** Consistent time flow, living world simulation, realistic NPC schedules

### 12. Time-Aware Content Depth ✅ COMPLETE

**Implementation:**

- **Content depth guidelines:** Quiet/observe (5-20m), tasks (10-45m), travel (15-120m), dialog (1-5m per exchange)
- **Dialog pressure:** Interruptions after ~3 exchanges, time pressure mechanics
- **Override rules:** Context-sensitive time adjustments with reasons
- **Benefits:** Realistic time investment, engaging dialog flow, natural interruptions

### 13. Skills & Difficulty Mechanics ✅ COMPLETE

**Implementation:**

- **Comprehensive skill sets:** Physical, social, mental, survival/craft categories
- **Skill specialization limits:** ≤3 skills at rank ≥4, ≤5 skills at rank ≥3, others ≤2
- **DC recipe:** Trivial (8) to Heroic (23) with context adjustments
- **Tick coupling:** Social (1-5m), athletics/stealth/craft (15-60m), investigate (10-45m)
- **Benefits:** Balanced character progression, context-sensitive challenges, realistic time investment

### 14. Enhanced Relationship Model ✅ COMPLETE

**Implementation:**

- **Dynamic caps:** No hard-coded limits, derived from compatibility potentials
- **Hysteresis & cooldown:** Prevents ping-pong, romance proposal (5 turns), friendship (3 turns), conflict (10 turns)
- **Bidirectional compatibility:** Both directions must align for progression
- **Benefits:** Organic relationship development, realistic pacing, player agency preservation

### 15. Enhanced Dynamic Entities ✅ COMPLETE

**Implementation:**

- **Schedule structure:** Place references, shifts, days of week
- **Enhanced NPC schema:** Required default_location_ref, optional home_ref, work_ref, schedule
- **Entity links:** Works_at, visits, lives_in, owns, patrols, serves
- **Benefits:** Realistic NPC schedules, persistent world state, meaningful relationships

### 16. Expanded Role-Location Ontology ✅ COMPLETE

**Implementation:**

- **Comprehensive plausibility map:** 10+ role types with multiple valid locations
- **Repair system:** Move, remove, replace, creative exception codes
- **Creative exceptions:** Justified violations with narrative reasoning
- **Benefits:** Plausible world building, creative flexibility, consistent repairs

### 17. Improved Nudges & Random Spice ✅ COMPLETE

**Implementation:**

- **Enhanced nudge scoring:** `1.0*motive + 0.4*freshness - 0.6*repetition + 0.3*curiosity`
- **Deterministic random spice:** save seed + scene + turn, 15% probability
- **Phase restrictions:** Never during locked phases
- **Benefits:** More intelligent nudges, reproducible spice, better phase compliance

### 18. Social Graph & Rumors ✅ COMPLETE

**Implementation:**

- **Pair-based updates:** ≤2-3 pair updates per tick
- **Visibility rules:** Public (40%), private (60%), rumor spreading
- **Scene integration:** Don't hijack player scenes, discovery mechanics
- **Benefits:** Living NPC relationships, player discovery, narrative depth

### 19. Future Events & Scheduling ✅ COMPLETE

**Implementation:**

- **Event scheduling:** Automatic scheduling when plans are mentioned
- **Reminder system:** Multiple timing levels, various reminder methods
- **Consequence system:** Relationship damage, faction standing, reputation loss
- **Must-happen events:** Fallback options for critical events
- **Benefits:** Meaningful commitments, realistic consequences, living world

### 20. Enhanced Self-Checks ✅ COMPLETE

**Implementation:**

- **16 comprehensive checks:** Time advancement, band transitions, entity management, etc.
- **Acceptance criteria:** 7 specific quality metrics for system validation
- **Benefits:** Consistent quality, comprehensive validation, clear success metrics

## Technical Implementation Details

### Timekeeper System

```json
{
  "timekeeper_routine_scheduler": {
    "mandatory_time_advance": true,
    "minimum_minutes": 1,
    "band_transitions": true,
    "off_screen_world": true
  }
}
```

### Skill Mechanics

```json
{
  "skill_distribution": {
    "high_specialists": "≤3 skills at rank ≥4",
    "moderate_specialists": "≤5 skills at rank ≥3",
    "generalists": "others ≤2"
  }
}
```

### Event Scheduling

```json
{
  "event_scheduling": {
    "rule": "If anyone proposes/mentions a future plan, schedule it",
    "consequence_system": "REL_DELTA−, FACTION_DELTA, GOSSIP_ADD"
  }
}
```

## Files Updated

1. **`GPT Prompts/Core/engine.system.json`** - Core system rules and constraints
2. **`GPT Prompts/base-instructions.md`** - Runtime instructions and documentation
3. **`GPT Prompts/Core/core.rpg-storyteller.json`** - Core narrative protocols
4. **`GPT Prompts/Core/engine.fewshots.jsonl`** - Example outputs and patterns

## Benefits Achieved

- **Consistent Time Flow:** Every turn advances time, bands change visibly, off-screen world simulates
- **Realistic Dialog:** Short ticks, natural interruptions, time pressure mechanics
- **Balanced Skills:** Context-sensitive DCs, specialization limits, realistic time investment
- **Organic Relationships:** Dynamic caps, hysteresis, bidirectional compatibility
- **Living World:** NPC schedules, persistent entities, meaningful relationships
- **Intelligent Guidance:** Enhanced nudges, deterministic spice, better phase compliance
- **Meaningful Commitments:** Event scheduling, realistic consequences, living world
- **Comprehensive Quality:** 16 self-checks, 7 acceptance criteria, clear validation

## Implementation Completeness

All suggested improvements and developer instructions have been implemented except for the relationship progression formulas, which were intentionally kept unchanged to maintain the reliable mathematical foundation that prevents unrealistic outcomes.

The system is now **fully implementation-ready** with:

- **Comprehensive time management** with mandatory advancement and band transitions
- **Context-sensitive content depth** with realistic time investment
- **Balanced skill mechanics** with specialization limits and DC scaling
- **Enhanced relationship model** with dynamic caps and hysteresis
- **Persistent entity management** with schedules and relationships
- **Intelligent guidance systems** with improved nudges and deterministic spice
- **Living world simulation** with NPC interactions and rumor systems
- **Meaningful event scheduling** with consequences and reminders
- **Comprehensive quality assurance** with extensive self-checks and acceptance criteria

The RPG Storyteller system now provides a robust, living world experience with consistent mechanics, realistic time flow, and meaningful player choices.
