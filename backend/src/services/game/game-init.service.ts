
import { normalizeStarEntity } from './genesis/star-entity.js';
import { applyFrozenStateDefaults } from './frozen-state-initializer.js';
import { StoriesRepository } from '../../db/repos/stories.repo.js';
import { GameStateFactory } from './factory/game-state.factory.js';
import { RulesetHarvester } from './factory/ruleset.harvester.js';
import { EntityProjector } from './factory/entity.projector.js';
import { supabaseAdmin } from '../supabase.js';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import { IGameStateRepository } from './state.repository.interface.js';

export interface PlayerInputDto {
  // Legacy fields - kept for compatibility but preferred source is DB
  [key: string]: unknown;
}

import { NarrativeService } from './narrative.service.js';

export class GameInitService {
  private factory: GameStateFactory;
  private narrativeService: NarrativeService;

  constructor(
    private storiesRepo: StoriesRepository,
    private stateRepo: IGameStateRepository,
    narrativeService?: NarrativeService,
  ) {
    // Initialize Factory with dependencies
    this.factory = new GameStateFactory(
      new RulesetHarvester(),
      new EntityProjector()
    );
    this.narrativeService = narrativeService || new NarrativeService();
  }

  /**
   * Initialize a new game from a compiled story
   * @param storyId - The ID of the frozen compiled story
   * @param playerInput - (Optional) Overrides
   * @param playerId - The player's user ID (owner)
   * @returns The ID of the created game state
   */
  async initializeGame(
    storyId: string,
    playerInput: PlayerInputDto,
    playerId: string,
    explicitCharacterId?: string
  ): Promise<string> {
    const compiled = await this.storiesRepo.getCompiledStoryById(storyId);
    if (!compiled) {
      throw new Error(`Compiled story not found: ${storyId}`);
    }
    const protagonistId = explicitCharacterId;
    if (!protagonistId) throw new Error('A player-owned character ID is required to start a frozen story.');

    const { data: charTemplate, error: charError } = await supabaseAdmin
      .from('chimera_player_characters')
      .select('*')
      .eq('id', protagonistId)
      .eq('user_id', playerId)
      .single();

    if (charError || !charTemplate) {
      throw new Error('Selected character was not found for this player.');
    }

    // The compiled payload is the only source of world, cast, rules and prompts.
    const bundle = this.factory.createBundle(
      storyId,
      charTemplate as any,
      []
    );
    const snapshotEntities = compiled.snapshot_entities;
    if (!Array.isArray(snapshotEntities)) throw new Error('Frozen compile has an invalid entity snapshot');
    const resolvedStars = snapshotEntities.map((item: any) => {
      if (!item || typeof item.key !== 'string') throw new Error('Frozen compile contains an entity without a stable key');
      return normalizeStarEntity({...item, id:uuidv5(`first_party:entity:${item.key}`, uuidv5.URL)});
    });

    // [GENESIS] Inject Director's Slate into Runtime Globals & Narrative Context
    const genesisConfig = (compiled.genesis_config && typeof compiled.genesis_config === 'object') ? compiled.genesis_config as Record<string, any> : {};

    // 1. Populate Narrative Context (Director Instructions)
    if (bundle.narrative) {
      bundle.narrative.director_instructions = {
        tone: genesisConfig.narrator_tone || 'Standard',
        pacing: genesisConfig.pacing || 'Balanced',
        perspective: genesisConfig.perspective || 'Second Person'
      };

      // Ensure scene context has the initial set design and metadata
      bundle.narrative.scene_context.name = typeof compiled.frozen_title === 'string' ? compiled.frozen_title : String(compiled.snapshot_world.name ?? 'Untitled Story');
      bundle.narrative.scene_context.atmosphere = genesisConfig.narrator_tone || "Anticipation";
      bundle.narrative.scene_context.time = "Night"; // Default start time

      // Heuristic: Use location field if exists, else first line of set_design, else default
      bundle.narrative.scene_context.location = genesisConfig.location ||
        (genesisConfig.set_design ? genesisConfig.set_design.split('.')[0].substring(0, 30) : "The Beginning");

      if (genesisConfig.set_design) {
        bundle.narrative.scene_context.description = genesisConfig.set_design;
      }
    }

    // [GENESIS] PHASE 7: Compile The Master Prompt (Snapshot)
    // We aggregate Rules, Tone, and Schema into a single instruction block.
    console.log('[GameInit] Compiling Master System Prompt...');

    const rulesData = {
      mas1: compiled.prompt_interpreter_logic ?? '',
      mas2: compiled.prompt_narrator_style ?? '',
    };

    const toneText = genesisConfig.narrator_tone || 'Standard';
    const pacingText = genesisConfig.pacing || 'Balanced';

    // Hardcode the schema for now to avoid extensive import chains/runtime schema generation dependencies,
    // ensuring self-contained reliability.
    const schemaDefinition = `{
  "narrative": "string (The prose)",
  "thought_chain": "string (Reasoning)",
  "scene_context": { "location": "string?", "time": "string?", "atmosphere": "string?" },
  "state_updates": {
    "player_hp_change": "number?",
    "player_stamina_change": "number?",
    "entity_updates": [ { "id": "string", "status_effect": "string?", "relationship_delta": "number?" } ]
  }
}`;

    const compiledPrompt = `
[PRIME DIRECTIVE]
You are the Game Master. You output strictly structured JSON.

[OUTPUT SCHEMA]
${schemaDefinition}

[NARRATIVE STYLE]
Tone: ${toneText}
Pacing: ${pacingText}

[MAS-1: ACTION DISCERNMENT]
(Applies to Intent Analysis)
${rulesData.mas1}

[MAS-2: NARRATIVE ENGINE]
(Applies to World Simulation & Prose)
${rulesData.mas2}
`.trim();

    // Store in bundle for persistence
    bundle.compiled_system_prompt = compiledPrompt;

    // [GENESIS] Apply Genesis Entities (The Bridge)
    // We execute this BEFORE narrative generation so the Narrative Service can see the cast.

    // 1. Resolve Extras from Config
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const genesisExtras = (genesisConfig.cast_extras || []) as any[];
    const processedExtras: any[] = [];

    if (genesisExtras.length > 0) {
      console.log(`[GameInit] Processing ${genesisExtras.length} extras for genesis.`);

      genesisExtras.forEach((extra) => {
        // Fallback Naming Logic
        let displayName = extra.visual_alias;
        if (!displayName) {
          const race = extra.race || "Unknown";
          const role = extra.archetype || "Figure"; // Default fallback if archetype missing
          displayName = `${race} ${role}`;
        }

        // Generate ID if missing (though strictly they should have one, we safeguard)
        const npcId = extra.id || uuidv4();

        const npcEntity = {
          id: npcId,
          type: 'NPC',
          status: 'active',
          properties: {
            name: extra.name || displayName, // Internal name
            display_name: displayName, // Public name
            race: extra.race,
            description: extra.description,
            archetype: extra.archetype,
            tags: ['extra', 'genesis_spawn', ...(extra.tags || [])]
          }
        };
        processedExtras.push(npcEntity);
      });
    }

    // 2. Merge Extras and Stars into Mechanical State
    const allGenesisEntities = [...processedExtras, ...resolvedStars];

    if (allGenesisEntities.length > 0) {
      if (!bundle.mechanical.entities) {
        bundle.mechanical.entities = {};
      }

      const entitiesRecord = bundle.mechanical.entities;

      // Add processed items
      allGenesisEntities.forEach(entity => {
        // Ensure status is active
        const instance = { ...entity, status: 'active' };
        if (!entitiesRecord[instance.id]) {
          entitiesRecord[instance.id] = instance;
        }
      });

      // 3. Add to scene registry (place in start_node)
      if (bundle.registry && bundle.registry.entity_locations) {
        allGenesisEntities.forEach(ent => {
          bundle.registry.entity_locations[ent.id] = 'start_node';
        });
      }
    }

    // Step 5: Persistence - PHASE A (Initial Save)
    // We save BEFORE generating narrative so we have a valid Game ID for the Audit Logs.
    console.log('[GameInit] Creating initial game state (Pre-Genesis)...');

    // Create state without narrative description first
    // REFACTORED: Use StoriesRepository for sharded persistence
    const originStoryId = compiled.story_key && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(compiled.story_key)
      ? compiled.story_key
      : null;
    applyFrozenStateDefaults(bundle, compiled);
    const gameStateId = await this.storiesRepo.createGameState(originStoryId, bundle, playerId, compiled.id!, protagonistId);

    // Inject ID into bundle for downstream services (Narrative/Audit)
    bundle.id = gameStateId;

    // [GENESIS] Generate Opening Narrative (Server-Side Turn 0)
    // We call the NarrativeService to generate the prose based on the Director's instructions.
    console.log('[GameInit] Generating Turn 0 narrative...');

    // Now this call can safely log to ai_audit_logs because bundle.id is set and row exists
    // Phase 7: Pass the newly compiled system prompt
    const openingText = await this.narrativeService.generateOpeningNarrative(bundle, bundle.compiled_system_prompt);

    // Apply Genesis Text to Bundle
    if (bundle.narrative) {
      bundle.narrative.scene_context.description = openingText;

      // Initialize History with Turn 0
      bundle.narrative.dialogue_history = [{
        role: 'narrator',
        content: openingText,
        timestamp: new Date().toISOString()
      }];
    }

    // Step 5: Persistence - PHASE B (Update with Narrative)
    console.log('[GameInit] Updating game state with Genesis narrative...', bundle.narrative.scene_context);

    // REFACTORED: Use StoriesRepository for partial updates
    await this.storiesRepo.updateGameState(gameStateId, {
      narrative_focus: bundle.narrative
    });

    // [GENESIS] PHASE C: Record Turn 0 (The History Log)
    // This ensures the frontend has a log to display immediately.
    console.log('[GameInit] Recording Genesis Turn (Index 0)...');
    await this.storiesRepo.recordTurn({
      gameStateId,
      turnIndex: 0,
      playerInput: "Game Start",
      directorIntent: { type: "GENESIS" },
      mechanicalDelta: {},
      narratorOutput: {
        narration: openingText,
        thought_chain: "Genesis construction complete."
      }
    });

    return gameStateId;
  }
}



