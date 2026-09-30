import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createSupabaseQueryBuilder} from '../../test-utils/supabase-mock.js';
import {supabaseAdmin} from '../supabase.js';
import {StoriesRepository} from '../../db/repos/stories.repo.js';
import {GameInitService} from './game-init.service.js';
import {GameTurnService} from './game-turn.service.js';
import {NarrativeService} from './narrative.service.js';
import {DirectorService} from '../runtime/director.service.js';
import {Mas2Service} from '../runtime/mas2.service.js';
import {LlmService} from '../llm/llm.service.js';

const playerId = '00000000-0000-4000-8000-00000000a001';
const characterId = '00000000-0000-4000-8000-00000000b001';
const compiledId = '00000000-0000-4000-8000-00000000c001';

describe('frozen session preconditions before any AI provider call', () => {
  const calls = vi.fn(async () => ({}));
  let textCalls:ReturnType<typeof vi.spyOn>;
  const provider = {generateJson:calls};
  const llm = new LlmService(provider as any);
  const narrative = new NarrativeService(llm);
  const compiled = {
    id:compiledId, snapshot_entities:[], snapshot_world:{key:'mystika', name:'Mystika'},
    prompt_interpreter_logic:'OLD PINNED PROMPT', prompt_narrator_style:'OLD PINNED STYLE',
    config_engine:{active_rulesets:[{key:'vitality', content_hash:'a'.repeat(64), definition:{state_contributions:{
      tier1_entity:{definitions:{current_stamina:{value:100}}},
    }}}]},
  };

  beforeEach(() => {
    calls.mockClear();
    textCalls = vi.spyOn(LlmService.prototype, 'generateText').mockResolvedValue('unused');
  });
  afterEach(() => vi.restoreAllMocks());

  const init = () => {
    const storiesRepo = {
      getCompiledStoryById:vi.fn().mockResolvedValue(compiled),
      createGameState:vi.fn(),
    };
    const service = new GameInitService(storiesRepo as any, {} as any, narrative);
    return {service, storiesRepo};
  };

  it('rejects a missing required state path without saving or calling the provider', async () => {
    const query = createSupabaseQueryBuilder();
    query.single.mockResolvedValue({data:{id:characterId, user_id:playerId, name:'Hero', state_snapshot:{}}, error:null});
    vi.mocked(supabaseAdmin.from).mockReturnValue(query as any);
    const {service, storiesRepo} = init();
    const bad = structuredClone(compiled);
    delete (bad.config_engine.active_rulesets[0].definition.state_contributions.tier1_entity.definitions.current_stamina as any).value;
    storiesRepo.getCompiledStoryById.mockResolvedValue(bad);
    await expect(service.initializeGame(compiledId, {}, playerId, characterId)).rejects.toThrow(/current_stamina has no starting value/);
    expect(storiesRepo.createGameState).not.toHaveBeenCalled();
    expect(calls).toHaveBeenCalledTimes(0);
    expect(textCalls).toHaveBeenCalledTimes(0);
  });

  it('rejects a foreign character without saving or calling the provider', async () => {
    const query = createSupabaseQueryBuilder();
    query.single.mockResolvedValue({data:null, error:{message:'not found'}});
    vi.mocked(supabaseAdmin.from).mockReturnValue(query as any);
    const {service, storiesRepo} = init();
    await expect(service.initializeGame(compiledId, {}, playerId, characterId)).rejects.toThrow(/not found for this player/);
    expect(query.eq).toHaveBeenCalledWith('user_id', playerId);
    expect(storiesRepo.createGameState).not.toHaveBeenCalled();
    expect(calls).toHaveBeenCalledTimes(0);
    expect(textCalls).toHaveBeenCalledTimes(0);
  });

  it('rejects a missing session pin before Director or Narrator can call the provider', async () => {
    vi.spyOn(StoriesRepository.prototype, 'loadGameState').mockResolvedValue({
      id:'00000000-0000-4000-8000-00000000d001', player_id:playerId,
      compiled_story_id:null, player_character_id:null, state_initialization_version:null,
      mechanical_state:{}, narrative_focus:{}, scene_registry:{}, action_queue:[],
    } as any);
    const service = new GameTurnService({} as any, narrative,
      new DirectorService(llm), undefined, new Mas2Service(llm));
    await expect(service.processTurn('00000000-0000-4000-8000-00000000d001', 'look around', playerId))
      .rejects.toThrow(/missing required frozen-session pins/);
    expect(calls).toHaveBeenCalledTimes(0);
    expect(textCalls).toHaveBeenCalledTimes(0);
  });
});
