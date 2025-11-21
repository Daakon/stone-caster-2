SC Architect: MVP 5-Sprint Development Plan (Final Complete Plan)
This is the final, definitive architectural plan, incorporating all feature requirements, security adjustments, and cost optimizations discussed.

1. 📐 Final, Spec-Ready Core DTOs (Code Contracts)
1.1. Mas1ResponseDto (Output of MAS 1: Pre-narrative)
This DTO includes the crucial sentiment analysis level.

TypeScript

// DTO output from MAS 1 (ActionParser Service)
export interface Mas1ResponseDto {
  actionDto: ActionDto;
  resolvedQuery: string; 
  detectedSentiment: {
    tone: string; // e.g., "curious", "grudging"
    intensity: number; // e.g., 1-10 scale
  };
}
1.2. Mas2ResponseDto (Output of MAS 2: Narrative)
This DTO includes the necessary structural elements for both narrative and mechanical requests.

TypeScript

// DTO output from MAS 2 (MasContextProvider Service)
export interface Mas2ResponseDto {
  ripple_narrative: string;
  mutations: MutationDto[]; // Tier 0 changes
  engine_requests?: ActionDto[]; // Tiers 1/2 requests for EngineProcessor
}
1.3. CompiledStoryJson (Optimal Artifact Structure)
The compiler artifact that the Play Engine consumes.

TypeScript

// Structure of the final compiled artifact
export interface CompiledStoryJson {
  action_context_json: object; // Merged action rules and state keys
  narrative_context_json: object; // Merged rules, guardrails, and RAG vector index
  parser_context_json: object; // Rules for MAS 1
  final_state_schema: object; // Structure for Game State initialization
}
2. 🚀 The 5-Sprint Plan (Full Implementation Status)
Phase 1, 2, 3: Creator Tools (Completed)
Status: Complete. All data model extensions (World Schema, Lore no triggers) are integrated. Compiler logic (Deep Merge, Vector Indexing) is fixed and functional. Frontend UIs (Advanced Editor, Modals) are built and linked.

Phase 4: The Play Engine Core (Completed)
Status: Complete. All core services are implemented and passed unit tests:

StateFactory: Creates initial chimera_game_states record.

ActionParser (MAS 1): Implements Coreference, Intent Parsing, and Sentiment Analysis.

ActionResolver (Engine): Implements deterministic calculation (D100 rolls, skill checks).

MasContextProvider (MAS 2): Implements RAG search and prompt building with guardrails.

Security (Validators): Enforces Tier 0/Tier 1-2 separation.

Phase 5: The Play Loop Orchestration (Final Integration Steps)
Status: Awaiting Final Frontend Logic.

📋 Step 5.10: Implement Modular Player Character Creation Screen
Goal: Implement the final screen that creates the Player's starting Entity based on the World's required schema (e.g., Essence, Race).

Backend Finalization Endpoint: POST /api/v2/play/:storyId/character/finalize

Logic: Creates the Player's ChimeraEntityTemplate (flagged as 'PlayerCharacter'), links it to the story, and calls the StateFactory to initialize the game state.

Frontend Screen: Build the CharacterCreationPage.tsx. This screen dynamically renders the form fields based on the schema extracted from the CompiledStoryJson.

📋 Step 5.11: Implement Player Entity Gateway (Routing Fix)
Goal: Implement the pre-play gate logic to redirect users to character creation if necessary, preventing unhandled game start failures.

Action: Implement the PlayerGatewayPage.tsx as the central hub (Create New, Select Existing, Quick Start).

Action: Update the initial "Play Story" button logic to check for a linked Player Entity. If MISSING, call the final fix endpoint (below) to return a 403 error for client-side redirection.

📋 Step 5.12: Implement Final Game Start Gateway (Fix Routing)
Goal: Complete the transition of the /my/stories page and ensure the application correctly switches between Editing, Character Creation, and Playing.

Action: Implement the logic in the POST /api/v2/play/:storyId/start endpoint handler to return a 403 Forbidden error if no Player Entity is linked, forcing the frontend to redirect to the Character Gateway.

Action: Update the frontend error handler for POST /start to catch the 403 Forbidden status and execute an immediate client-side redirect to the Player Gateway Screen (/player-gateway/:storyId).