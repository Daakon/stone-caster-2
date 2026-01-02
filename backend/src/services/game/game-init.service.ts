
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

export class GameInitService {
  private factory: GameStateFactory;

  constructor(
    private storiesRepo: StoriesRepository,
    private stateRepo: IGameStateRepository
  ) {
    // Initialize Factory with dependencies
    this.factory = new GameStateFactory(
      new RulesetHarvester(),
      new EntityProjector()
    );
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
      .select('protagonist_id, active_ruleset_ids')
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
    const configEngine = compiled.config_engine as any;
    const activeRulesets = configEngine?.active_rulesets || [];

    // Step 4: Factory Creation
    const bundle = this.factory.createBundle(
      storyId,
      charTemplate as any,
      activeRulesets
    );

    // Step 5: Persistence via IGameStateRepository
    // We need to return the ID. check IGameStateRepository signature.
    // Interface was: createState(storyId: string, state: GameStateBundle): Promise<void>;
    // It returns void. We might need the ID.
    // Let's update the interface/impl to return the ID? 
    // Or assume ID is not needed? 
    // The previous service returned "gameStateId".
    // The route returns { id: gameStateId }.
    // So we MUST return the ID.
    // I should update IGameStateRepository definition first!

    // START PATCH: Updating flow to support ID return.
    // SupabaseGameStateRepository insert returns metadata?
    // Let's assume IGameStateRepository returns Promise<string>.

    const gameStateId = await this.stateRepo.createState(storyId, bundle, playerId);
    return gameStateId;
  }
}

