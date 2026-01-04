
import { StoriesRepository } from '../../db/repos/stories.repo.js';
import { GameStateFactory } from './factory/game-state.factory.js';
import { RulesetHarvester } from './factory/ruleset.harvester.js';
import { EntityProjector } from './factory/entity.projector.js';
import { supabaseAdmin } from '../supabase.js';
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
    private stateRepo: IGameStateRepository
  ) {
    // Initialize Factory with dependencies
    this.factory = new GameStateFactory(
      new RulesetHarvester(),
      new EntityProjector()
    );
    this.narrativeService = new NarrativeService();
  }

  /**
   * Initialize a new game from a compiled story
   * @param storyId - The ID of the compiled story (or draft ID)
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
    // Step 1: Fetch CompiledStory (for Rulesets)
    let compiled = await this.storiesRepo.getCompiledStoryById(storyId);
    if (!compiled) {
      compiled = await this.storiesRepo.getCompiledStoryByDraftId(storyId);
    }
    if (!compiled) {
      throw new Error(`Compiled story not found: ${storyId}`);
    }

    // Step 2: Fetch Linked Character (Protagonist)
    // We need to look up the Draft Story to see which character is bound
    // Use the story_key from the compiled story, which is the Draft ID.
    const draftId = compiled.story_key || storyId;

    console.log(`[GameInit] Looking up draft story for link. InputStoryId: ${storyId}, CompiledKey: ${compiled.story_key}, UsedDraftId: ${draftId}`);

    const { data: draftStory, error: draftError } = await supabaseAdmin
      .from('chimera_stories')
      .select('protagonist_id, active_ruleset_ids, genesis_config')
      .eq('id', draftId)
      .maybeSingle();

    console.log(`[GameInit] Draft lookup result:`, { draftId, draftStory, draftError, explicitCharacterId });

    // PRIORITY: Use explicit ID if provided (override), otherwise use DB bound ID
    const protagonistId = explicitCharacterId || draftStory?.protagonist_id;

    if (!protagonistId) {
      throw new Error(`No linked player character found for this story (DraftID: ${draftId}). Please bind a character first.`);
    }

    const { data: charTemplate, error: charError } = await supabaseAdmin
      .from('chimera_player_characters')
      .select('*')
      .eq('id', protagonistId)
      .single();

    if (charError || !charTemplate) {
      throw new Error('Linked character record not found.');
    }

    // Step 3: Extract Active Rulesets
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const configEngine = compiled.config_engine as any;
    const activeRulesets = configEngine?.active_rulesets || [];

    // Step 4: Factory Creation
    const bundle = this.factory.createBundle(
      storyId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      charTemplate as any,
      activeRulesets
    );

    // [GENESIS] Resolve Stars (Cast Members)
    // Fetch full entity records for selected Cast Members
    const starIds = draftStory?.genesis_config?.cast_members || [];
    let resolvedStars: any[] = [];

    if (starIds.length > 0) {
      console.log(`[GameInit] Resolving ${starIds.length} stars for genesis.`);
      const { data: stars, error: starsError } = await supabaseAdmin
        .from('chimera_entities')
        .select('*')
        .in('id', starIds);

      if (!starsError && stars) {
        resolvedStars = stars;
      } else {
        console.warn(`[GameInit] Failed to resolve stars:`, starsError);
      }
    }

    // [GENESIS] Inject Director's Slate into Runtime Globals & Narrative Context
    const genesisConfig = draftStory?.genesis_config || {};

    // 1. Populate Narrative Context (Director Instructions)
    if (bundle.narrative) {
      bundle.narrative.director_instructions = {
        tone: genesisConfig.narrator_tone || 'Standard',
        pacing: genesisConfig.pacing || 'Balanced',
        perspective: genesisConfig.perspective || 'Second Person'
      };

      // Ensure scene context has the initial set design
      if (genesisConfig.set_design) {
        bundle.narrative.scene_context.description = genesisConfig.set_design;
      }
    }

    // [GENESIS] Generate Opening Narrative (Server-Side Turn 0)
    // We call the NarrativeService to generate the prose based on the Director's instructions we just set.
    console.log('[GameInit] Generating Turn 0 narrative...');
    const openingText = await this.narrativeService.generateOpeningNarrative(bundle);

    // Apply Genesis Text to Bundle
    if (bundle.narrative) {
      bundle.narrative.description = openingText;

      // Initialize History with Turn 0
      bundle.narrative.dialogue_history = [{
        speaker: 'Narrator',
        text: openingText,
        type: 'system' // or 'action' depending on frontend handling
      }];
    }

    // Note: NarrativeGenesisService usage removed in favor of serverside generation above.
    const genesisEntities = []; // Extras currently not generated by this step, unless we restore that logic later. For now, empty or mapped if needed.
    // TODO: If extras were generated by the old service, we need to decide if we keep that logic or move it.
    // For this specific task, we focus on the Text Generation.
    // Assuming 'cast_extras' in genesis_config might be used by EntityProjector or needs separate handling if strictly required. 
    // Checking previous code: 'genesisEntities' came from 'genesisService.generateOpening'. 
    // If we drop that service, we lose extras generation unless we re-implement it. 
    // For now, defining genesisEntities as empty array to prevent breakages below.

    // Apply Genesis Entities (The Bridge)
    // We need to merge both generated Extras and resolved Stars (if they need to be spawned)
    // Stars are already "existing", but they need to be placed in the scene.
    // Extras are "new" and need to be added to mechanical entities.

    const allGenesisEntities = [...(genesisEntities || [])];

    if (allGenesisEntities.length > 0) {
      // 1. Add Extras and Stars to mechanical entities
      if (!bundle.mechanical.entities) {
        bundle.mechanical.entities = {};
      }

      const entitiesRecord = bundle.mechanical.entities;

      // Add Extras
      genesisEntities.forEach(extra => {
        entitiesRecord[extra.id] = extra;
      });

      // Add Stars (Clone and Activate)
      if (resolvedStars.length > 0) {
        resolvedStars.forEach(star => {
          // Ensure they are treated as active instances
          const instance = { ...star, status: 'active' };
          // Avoid duplicates if star is somehow already in extras (unlikely)
          if (!entitiesRecord[instance.id]) {
            entitiesRecord[instance.id] = instance;
          }
        });
      }

      // 2. Add to scene registry (place in start_node)
      if (bundle.registry && bundle.registry.entity_locations) {
        genesisEntities.forEach(ent => {
          bundle.registry.entity_locations[ent.id] = 'start_node';
        });
        resolvedStars.forEach(star => {
          bundle.registry.entity_locations[star.id] = 'start_node';
        });
      }
    }

    // Step 5: Persistence via IGameStateRepository
    const gameStateId = await this.stateRepo.createState(storyId, bundle, playerId);
    return gameStateId;
  }
}



