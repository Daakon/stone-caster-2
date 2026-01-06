
import { StoriesRepository } from '../../db/repos/stories.repo.js';
import { GameStateFactory } from './factory/game-state.factory.js';
import { RulesetHarvester } from './factory/ruleset.harvester.js';
import { EntityProjector } from './factory/entity.projector.js';
import { supabaseAdmin } from '../supabase.js';
import { v4 as uuidv4 } from 'uuid';
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

    // [GENESIS] Generate Opening Narrative (Server-Side Turn 0)
    // We call the NarrativeService to generate the prose based on the Director's instructions we just set.
    console.log('[GameInit] Generating Turn 0 narrative...');
    const openingText = await this.narrativeService.generateOpeningNarrative(bundle);

    // Apply Genesis Text to Bundle
    if (bundle.narrative) {
      bundle.narrative.description = openingText;

      // Initialize History with Turn 0
      bundle.narrative.dialogue_history = [{
        role: 'narrator',
        content: openingText,
        timestamp: new Date().toISOString()
      }];
    }

    // Step 5: Persistence via IGameStateRepository
    const gameStateId = await this.stateRepo.createState(storyId, bundle, playerId);
    return gameStateId;
  }
}



