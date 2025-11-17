StoneCaster MVP: Full Plan & System Architecture
Project: StoneCaster Modular Storytelling Platform Version: 1.1 (MVP) Owner: SC Architect Tech Stack: Supabase (DB/Auth), Fly.io (Hosting), Node.js/Express (Backend), React (Frontend)

1. 🏛️ Executive Summary & MVP Vision
The primary goal of this MVP is to build a player-centric, narrative-driven storytelling engine. This engine will prove our core architecture: a "headless" backend (Node/Express) that manages game state (Supabase) and integrates with AI services (MAS/RAG) to deliver an interactive story to a "thin" client (React).

Our MVP architecture is defined by two critical, scope-defining principles:

Player-Driven Mechanics: The player is the only entity who can initiate complex, rules-based "Processed" actions (e.g., skill checks). This simplifies the engine to a one-way "player-to-engine" workflow.

AI-Driven State: The AI (MAS) can mutate the "Tracked" narrative state of the world (e.g., Relationships, Psyche, Time) in response to player actions.

This hybrid model allows for a dynamic, living world (driven by AI state) without the massive complexity of an NPC-driven action loop for the MVP.

2. ⚙️ Core Architectural Principles (System Tiers)
All systems and features will be classified according to the following tiers. This classification defines our development priority and technical implementation.

Tier 0: "Tracked" (Raw State)

Description: Pure data for narrative context. The AI reads this data, and the AI can mutate this data. The core ActionResolver engine has no logic for it.

Implementation: Stored in Supabase (often in JSONB columns for flexibility).

Dev Cost: 🟢 Low

Tier 1: "Processed - Singular"

Description: A simple, single-value field that the ActionResolver mutates. This is an outcome of a player action, not an input to a check.

Implementation: Stored as a dedicated column (e.g., actors.health_current).

Dev Cost: 🟡 Medium

Tier 2: "Processed - Relational"

Description: A complex system with its own data tables, deeply interlinked with the core engine's logic. It serves as an input to the player's D100 checks.

Implementation: Requires dedicated tables (e.g., actor_skills) and complex queries.

Dev Cost: 🔴 High

3. 🗺️ MVP Domain Scope & Classification
This is the definitive list of systems to be built for the MVP.

Tier 0: "Tracked" Domains (AI Read/Write)
Psyche: An NPC's current mood, stress, emotional tags.

Relationships: An NPC's affinity and trust towards the player.

Factions: The player's standing with various groups.

Knowledge & Clues: (Definite Must) A list of "fact IDs" the player has learned, used to gate AI knowledge.

Events Memory ("Firsts"): (Definite Must) A log of key narrative moments (e.g., first_kiss_with_brynn) to ensure AI consistency.

Equipment: (Player-Managed) The React UI will manage equipping. The AI/engine only "tracks" what is equipped for narrative context.

Abilities Catalog: A simple list of learned abilities.

Inventory: The player's inventory. (Note: use_item is a Processed action, but the state of the inventory is "Tracked").

Tier 1: "Processed - Singular" Domains (Player-Driven)
Health: The health_current value on actors (player and NPCs).

Stamina/Energy: The stamina_current value, used as a cost for player actions.

Time & Tick Progression: The world_time on the game_sessions table. Can be mutated by player actions (e.g., "rest") or by AI narrative (e.g., "the conversation took an hour").

Quest Progression: Simple state management (e.g., quest.stage: 2).

Tier 2: "Processed - Relational" Domains (Player-Only)
Skills: (Player-Only) The player's skill levels, stored in actor_skills. This is the primary input for D100 checks.

Status Effects: (Player-Only) Timed conditions (poisoned, shaky_hands) that apply modifiers to the player's D100 checks.

4. ⚡ Backend Engine Architecture (Node.js/Express)
Our backend will be built as a set of services that communicate internally.

CharacterCreation Service

Role: Manages the "on-ramp" for a new player.

Responsibilities:

Fetches ruleset_player_templates for "pick a character."

Fetches ruleset_skills and ruleset_base_stats for "make your own."

Validates the new character build.

Orchestrates the first call to the StateManager to create the game_session, actors row, and initial actor_skills.

StateManager

Role: The single source of truth for database I/O.

Responsibilities: Provides simple "getter/setter" functions for all game state tables (e.g., getActor(id), updateActorHealth(id, value), createGameSession()).

ActionResolver (The "CPU")

Role: Processes all player-initiated Tier 1 and Tier 2 actions.

Responsibilities:

Receives an action request from the player (e.g., action: "pick_lock").

Fetches the player's Skills and Status Effects from the StateManager.

Runs the D100 check against the action's rules.

Generates an Outcome object (e.g., { success: true, mutations: [...] }).

Sends the mutations to the StateManager (e.g., door.is_locked = false).

Passes the result (e.g., "Player succeeded") to the MAS Context Provider.

MAS Context Provider

Role: The "prompt builder" for our AI.

Responsibilities:

Receives a player action or an engine result.

Fetches all relevant Tier 0 "Tracked" data (e.g., Psyche, Knowledge, Events Memory) from the StateManager.

Constructs the final, context-rich prompt and sends it to the MAS.

MAS Mutation Handler

Role: The "receiver" for all AI responses.

Responsibilities:

Receives the JSON response from the MAS (e.g., { narrative: "...", mutations: [...] }).

Sends the narrative string to the React client.

Passes the mutations array to the Mutation Validator.

Mutation Validator (Security)

Role: Our critical security and scope-control service.

Responsibilities:

Iterates through the mutations array from the AI.

Checks each mutation against a strict allow-list.

ALLOW: relationships, psyche, time, factions, knowledge, events_memory.

REJECT: skills, health, stamina, status_effects, quest_progression.

Passes all validated mutations to the StateManager to be saved.

5. 🗃️ Data Model (Supabase Schemas)
This model separates "definitions" (the rules of a story) from "state" (the save file).

A. Ruleset Definition Tables (The "Story Rules")
rulesets: The master table for a story.

ruleset_skills: Defines all available skills in a story (e.g., skill_key: "lockpicking", name: "Lockpicking").

ruleset_base_stats: Defines default player health/stamina for a ruleset.

ruleset_actor_templates: The "bestiary" for NPCs. Defines their template_key ("guard"), base_health, base_stamina, and default base_tracked_state (JSONB).

ruleset_player_templates: Pre-made, playable character archetypes. Defines name, base_health, base_skills (JSONB), base_tracked_state (JSONB).

B. Game State Tables (The "Save File")
game_sessions: The master "save file." Stores user_id, ruleset_id, and world_time.

actors: Stores all players and NPCs for a session_id.

health_current (INT)

health_max (INT)

stamina_current (INT)

stamina_max (INT)

scene_id (TEXT)

tracked_state (JSONB) - This is our flexible Tier 0 storage.

actor_skills: (Player-Only) A join table: actor_id, skill_key, level.

C. Tier 0 "Tracked" Data Structure (Example)
All Tier 0 data will be stored within the actors.tracked_state JSONB column.

Example tracked_state for an NPC:

JSON

{
  "psyche": {
    "mood": "angry",
    "stress": 15
  },
  "relationships": {
    "player_uuid": {
      "affinity": -10,
      "trust": 0
    }
  },
  "knowledge": [
    "knows_secret_passage",
    "is_loyal_to_king"
  ],
  "events_memory": [
    {
      "event": "player_insulted",
      "timestamp": "..."
    }
  ],
  "equipment": {
    "chest": "item_key_guard_cuirass",
    "main_hand": "item_key_guard_sword"
  }
}
6. 🔄 Core System Workflows
Workflow A: Player Tier 2 Skill Check (e.g., "Pick Lock")
React: Sends (action: "pick_lock", target: "door_1") to the backend.

Backend: The request hits the ActionResolver.

ActionResolver: a. Fetches player's skills from StateManager. Gets actor_skills.level = 25 for "lockpicking". b. Fetches Status Effects. Player has none. c. Runs D100 check against the door's difficulty (e.g., 50). d100(40) + 25 = 65. Success! d. Creates an Outcome: { success: true, mutations: [{ target: "door_1", prop: "is_locked", val: false }] }.

StateManager: Receives the mutation and updates the door's state in Supabase.

MAS Context Provider: Receives the result ({ action: "pick_lock", result: "success" }).

MAS: AI returns a narrative: "You skillfully work the tumblers, and the lock clicks open."

MAS Mutation Handler: Receives { narrative: "...", mutations: [] }.

React: Receives the narrative and updates the UI (the door is now shown as "unlocked").

Workflow B: AI Tier 0 State Mutation (e.g., "Insult Guard")
React: Sends (action: "insult", target: "guard_1") to the backend.

Backend: The request hits the MAS Context Provider.

MAS Context Provider: a. Fetches guard_1.tracked_state from StateManager. (e.g., psyche.mood: "calm"). b. Builds prompt: "Player insults Guard. Guard's mood is 'calm'. How do they react?"

MAS (AI): The AI decides this is a major insult. It returns a full JSON object:

JSON

{
  "narrative": "The guard's face flushes with rage. 'That's it, I'll remember this!', he snarls.",
  "mutations": [
    {
      "domain": "relationships",
      "target_actor": "guard_1",
      "property": "affinity",
      "operation": "decrement",
      "value": 20
    },
    {
      "domain": "psyche",
      "target_actor": "guard_1",
      "property": "mood",
      "operation": "set",
      "value": "furious"
    },
    { 
      "domain":"health", 
      "target_actor": "player_1",
      "operation": "decrement",
      "value": 10
    }
  ]
}
Backend: The response hits the MAS Mutation Handler.

Mutation Validator: a. relationship mutation -> OK. b. psyche mutation -> OK. c. health mutation -> REJECTED. (AI is not allowed to mutate health).

StateManager: Receives the two validated mutations and updates the guard_1.tracked_state JSONB.

React: Receives the narrative and displays it to the player.

7. ⛔ Phase 2 (MVP "Out of Scope")
The following features are explicitly postponed to maintain MVP scope.

NPC-Driven Actions: The entire "dual-loop" where an AI can queue a Processed (Tier 2) action (e.g., guard.attack()).

Tactical Positioning: All stance, facing, and proximity tracking.

Complex Processed Systems: Full-blown Magic, Combat (beyond simple player-driven damage), and Crafting systems.

"Processed" Equipment: A system where equipping items triggers Status Effects or unlocks Skills. For MVP, Equipment is purely narrative.

8. 🚀 Next Steps (Action Plan)
Approval: You (Product Owner) sign off on this document as our official blueprint.

DB Sprint (Supabase): Implement all schemas defined in Section 5.

Backend Sprint 1 (Node): Build the StateManager (getters/setters) and the CharacterCreation Service (endpoints and logic).

Backend Sprint 2 (Node): Build the MAS Context Provider (prompt builder) and the MAS Mutation Handler (including the Mutation Validator).

Backend Sprint 3 (Node): Build the player-facing ActionResolver with the D100 check logic for Skills (Player-Only).

Frontend Sprint (React): Build the Character Creation UI, the basic action/prompt UI, and render the returned narrative