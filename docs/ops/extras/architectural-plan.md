SC Architect: MVP 5-Sprint Development Plan
This is the full, spec-ready 5-sprint plan, architected to be efficient, secure, and data-driven.

🏛️ Architect's Foreword: The "Ideal" Architecture
This plan implements our complete "ideal" architecture. It is built on three core principles:

The "Smart" Pre-narrative Processor (MAS 1): MAS 1 is not just a parser. It is a "Pre-narrative" AI that receives the user's text and the full game state. It performs Coreference Resolution (finding "her" and "it"), Intent Parsing (the actionDto), and Sentiment Analysis (with an intensity level).

The "Secure" Narrative Processor (MAS 2): MAS 2 is the "Storyteller." It receives the results from MAS 1 and the Game Engine. It is architecturally forbidden from making decisions for the player. Its job is only to narrate the outcome and the world's reaction.

Compiler-Time Optimization: We have eliminated the "token-heavy" POC model. The Smart Compiler (Sprint 2) does all the heavy lifting once, pre-baking all rules, logic, and RAG vectors into a hyper-efficient CompiledStoryJson artifact.

📐 The Final, Spec-Ready Core DTOs
These are the updated data contracts that reflect all our architectural decisions.

1. RulesetDefinitionV1 (The "Force")
This DTO for the chimera_ruleset_templates.definition JSONB field is updated to include our explicit player-agency guardrail.

// DTO for chimera_ruleset_templates.definition export interface RulesetDefinitionV1 { /** * Part 1: How to sort data (for the Compiler) / key_definitions: { /* Keys for the Engine (e.g., "health", "mana", "skill_lockpicking") / state_keys: string[]; /* Keys for the AI (e.g., "backstory", "personality", "description") */ narrative_keys: string[]; };

/** * Part 2: How to build the state (for the Compiler) */ state_schema_contributions: { tier0_tracked_state: Record<string, any>; // e.g., { relationships: {}, psyche: {} } tier1_singular_state: Record<string, any>; // e.g., { actor_health: {} } tier2_relational_state: Record<string, any>; // e.g., { player_skills: {} } };

/** * Part 3: How to run the game (for the Engine) */ action_rules: { [action_name: string]: { type: 'skill_check' | 'time_update' | 'health_update'; // ...other properties (e.g., "skill", "dc", "max_value") } };

/** * Part 4: How to talk to the AI (for the Engine) / prompt_rules: { /* Instructions for MAS 1 (e.g., "Actions available: pick_lock, attack...") / parser_prompt_rules: string[]; /* Instructions for MAS 2 (e.g., "Essence alignment affects behavior...") / narrative_prompt_rules: string[]; /* 🚨 NEW 🚨 * Hard "DON'T" rules for MAS 2. * e.g., "NEVER narrate a new action, decision, or dialogue for the player." */ narrator_guardrails: string[]; };

/** * Part 5: How to build the UI (for the Client) */ ui_schema: Record<string, unknown>; }

2. ChimeraLoreEntry (A "Pure RAG" Fact)
This DTO is now simpler and more efficient. The unreliable, user-facing triggers field is removed in favor of Compiler-Time Vector Indexing.

export interface ChimeraLoreEntry { id: string; story_id: string; // Foreign key display_name: string;

/** The "fact sheet" text to be vectorized by the Compiler. */ entry_text: string;

// The 'triggers' field is GONE. }

3. CompiledStoryJson (The "Optimal Runtime Artifact")
This DTO is updated to reflect how it consumes the new RulesetDefinitionV1.

export interface CompiledStoryJson { /** 1. For the ActionResolver & EngineRequestProcessor (Sprint 4) */ action_context_json: { action_rules: Record<string, any>; elements: Record<string, any>; };

/** 2. For MAS 2 (Sprint 4)

Contains all merged AI instructions and the RAG index. / narrative_context_json: { /* Merged list of narrative_prompt_rules + narrator_guardrails / prompt_rules_with_guardrails: string[]; /* The vector index of all Lore + Entity narrative_keys */ rag_index: Record<string, any>; };

/** 3. For MAS 1 (Sprint 4) */ parser_context_json: { prompt_rules: string[]; available_actions: string[]; available_entities: string[]; };

/** 4. For Game State Initialization (Sprint 4) */ final_state_schema: Record<string, any>; }

4. Mas1ResponseDto (Output of MAS 1: Pre-narrative)
This DTO is expanded to include the new Sentiment + Intensity level.

// DTO output from MAS 1 (ActionParser Service) export interface Mas1ResponseDto { /** 1. For the Game Engine */ actionDto: ActionDto; // e.g., { action: "pick_lock", target: "chest" }

/** 2. For the RAG Search */ resolvedQuery: string; // e.g., "User asks Kiera about the Slaver Camp"

/** 3. For MAS 2 - UPDATED / detectedSentiment: { /* The primary emotion (e.g., "curious", "grudging", "sarcastic") / tone: string; /* The strength of that emotion (e.g., 1-10 scale) */ intensity: number; }; }

5. Mas2ResponseDto (Output of MAS 2: Narrative)
This DTO is unchanged. We are changing the behavior of MAS 2, not its data output format.

// DTO output from MAS 2 (MasContextProvider Service) export interface Mas2ResponseDto { /** The story text (narrated with player agency respected) */ ripple_narrative: string;

/** AI-driven narrative changes (Tier 0 only) */ mutations: MutationDto[];

/** AI-driven mechanical requests for the Engine */ engine_requests?: ActionDto[]; }

6. CastStoneResponseDto (Final API Response)
This DTO's debug_info is updated to show the new Mas1ResponseDto structure, so we can validate sentiment-level detection.

export interface CastStoneResponseDto { ripple_narrative: string;

/** Optional debug info, only sent if ENV toggle is on / debug_info?: { mas_1_input: string; /* UPDATED: This DTO now shows the full sentiment object */ mas_1_output: Mas1ResponseDto; engine_outcome: OutcomeDto; mas_2_prompt: string; mas_2_response: Mas2ResponseDto; final_mutations: MutationDto[]; } }

🚀 The 5-Sprint Plan (Full Spec)
Sprint 1: The Creator UI & Data Foundation
Goal: Build the UIs and APIs to populate our new, ideal database tables (Forces, Entities, Lore).

Epics:

1.1: Build the Advanced Editor ("Casting Circle")

1.2: Build the Dynamic Creation Modals

Key Tasks:

Build the 3-section editor UI (/story/:id/edit).

Build the "New Element" modal (for Entities).

Build the "New Lore Entry" modal (for Lore). Spec: This modal will not have a triggers field. It only needs display_name and entry_text.

APIs:

chimera_stories CRUD

chimera_entity_templates CRUD (for "Hybrid" Entities)

chimera_lore_entries CRUD (for "Pure RAG" Lore)

Links APIs (for connecting data to a story)

Sprint 2: The "Smart Compiler" & Debugger
Goal: Build the rebuild endpoint that transforms our normalized DB data into the CompiledStoryJson.

Epics:

2.1: Implement the "Smart Compiler" Logic

2.2: Implement Compiler Logging

API: POST /api/v2/chimera/stories/:id/rebuild

Key Logic Specs:

Task 2.1.2 (Merge Forces): The RebuildService must merge all RulesetDefinitionV1 DTOs, explicitly combining all narrator_guardrails into one master list.

Task 2.1.5 (Vector Indexing): This task must vectorize the entry_text of all LoreEntry and the narrative_keys of all Entities. It stores these vectors in the narrative_context_json.rag_index.

Task 2.1.7 (Save): The compiler saves the final CompiledStoryJson, with the narrative_context_json.prompt_rules_with_guardrails field populated.

Sprint 3: The "Casting Circle" Wizard
Goal: Build the "happy path" UI that calls the robust APIs from Sprint 1.

Epics:

3.1: Implement the "Create-on-Start" Wizard Flow

API: POST /api/v2/ai/generate-premise

Sprint 4: The "Play Engine" - State & Core Services
Goal: Build the headless backend services for the full MAS 1 -> Game Engine -> MAS 2 loop.

Epic 4.1: Implement Game State Management

Tasks: Create chimera_game_states table; build POST /.../:storyId/start to initialize state from the final_state_schema.

APIs: Game State CRUD (POST /start, GET /:id, GET /my-games).

Epic 4.2: Build ActionParser (MAS 1: Pre-narrative) Service

Spec: This service takes text_input, parser_context_json, and the full GameStateTiers.

Task 4.2.1 (Prompt Spec): The prompt must instruct the AI to return a JSON object with three parts:

actionDto (Coreference Resolution + Intent Parsing)

resolvedQuery

detectedSentiment (with tone and numeric intensity 1-10).

Output: The service parses and validates this Mas1ResponseDto.

Logging: DEBUG_MAS_1=true logs the prompt and the full Mas1ResponseDto output.

Epic 4.3: Build ActionResolver (Game Engine) Service

Spec: Unchanged. This service remains simple and fast. It only receives the actionDto.

Output: { outcome: OutcomeDto, mutations: MutationDto[] } (for Tiers 1 & 2).

Logging: DEBUG_GAME_ENGINE=true.

Epic 4.4: Build MasContextProvider (MAS 2: Narrative) Service

Spec: This service builds the context for the "Storyteller" AI.

Task 4.4.1 (RAG Search): Performs a narrow vector search using the resolvedQuery from MAS 1.

Task 4.4.2 (Prompt Building Spec): The prompt-building logic must now:

Place all prompt_rules_with_guardrails (from narrative_context_json) at the top of the prompt as a hard rule.

Explicitly use the detectedSentiment.intensity level (e.g., "Narrate this event. The player's tone was grudging with an intensity of 9/10...").

Task 4.4.3 (Response Parsing): Parses the Mas2ResponseDto ({ ripple_narrative, mutations, engine_requests }).

Logging: DEBUG_MAS_2=true logs the full text prompt (so we can verify the guardrails and sentiment instructions).

Epic 4.5: Build MutationValidator (Security 1) Service

Spec: "The Narrative Guard." Takes MAS 2's mutations and allows Tier 0 only.

Epic 4.6: Build EngineRequestProcessor (Security 2) Service

Spec: "The AI Adjudicator." Takes MAS 2's engine_requests and validates them against the action_rules.

Output: A list of validated T1/T2 MutationDtos.

Sprint 5: The "Play Loop" - UI & Orchestration
Goal: Connect all services and build the free-text UI.

Epic 5.1: Build the cast-stone Orchestrator

API: POST /api/v2/play/:gameStateId/cast-stone

Orchestration Logic (Final):

Load game_state and compiled_ruleset.

Call ActionParser (MAS 1) -> get Mas1ResponseDto (with sentiment level).

Call ActionResolver (Engine) with mas1Response.actionDto -> get { outcome, engine_mutations }.

Call MasContextProvider (MAS 2) with outcome, state, and all parts of mas1Response -> get mas2Response.

Call MutationValidator (Security 1) with mas2Response.mutations -> get ai_t0_mutations.

Call EngineRequestProcessor (Security 2) with mas2Response.engine_requests -> get ai_t1_t2_mutations.

Combine final_mutations = [...engine_mutations, ...ai_t0_mutations, ...ai_t1_t2_mutations].

Apply final_mutations to game_state and save to DB.

Return CastStoneResponseDto to the client.

Epic 5.2: Build Play UI & Client Debugger

UI: Build the free-text input UI and chat log.

Client Debug Panel: Implement the ?debug=true panel.

CastStoneResponseDto (Final Spec): The debug_info object must be populated with the updated Mas1ResponseDto to show the intensity level.

// This is the DTO returned to the client export interface CastStoneResponseDto { ripple_narrative: string; debug_info?: { mas_1_input: string; mas_1_output: Mas1ResponseDto; // Shows sentiment { tone, intensity } engine_outcome: OutcomeDto; mas_2_prompt: string; mas_2_response: Mas2ResponseDto; final_mutations: MutationDto[]; } }