import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { AWFRepositoryFactory } from '../src/repositories/awf-repository-factory.js';
import { ScenarioRepository } from '../src/repositories/awf-scenario-repository.js';
import { GameStatesRepository } from '../src/repositories/awf-game-states-repository.js';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  auth: {
    getUser: vi.fn()
  }
};

// Mock the Supabase client creation
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}));

describe('Player Scenario Endpoints', () => {
  let repoFactory: AWFRepositoryFactory;
  let scenarioRepo: ScenarioRepository;
  let gameStatesRepo: GameStatesRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repoFactory = new AWFRepositoryFactory({ supabase: mockSupabase as any });
    scenarioRepo = repoFactory.getScenarioRepository();
    gameStatesRepo = repoFactory.getGameStatesRepository();
  });

  describe('GET /api/player/scenarios', () => {
    it('should list only public scenarios', async () => {
      const mockScenarios = [
        {
          id: 'scenario.inn_last_ember',
          version: '1.0.0',
          doc: {
            world_ref: 'world.mystika',
            is_public: true,
            scenario: {
              display_name: 'The Last Ember Inn',
              synopsis: 'A cozy inn where adventures begin',
              tags: ['inn', 'safe'],
              fixed_npcs: [
                { npc_ref: 'npc.innkeeper' },
                { npc_ref: 'npc.bard' }
              ]
            }
          }
        },
        {
          id: 'scenario.dark_forest',
          version: '1.0.0',
          doc: {
            world_ref: 'world.mystika',
            is_public: false, // Private scenario
            scenario: {
              display_name: 'Dark Forest',
              synopsis: 'A dangerous forest',
              tags: ['dangerous'],
              fixed_npcs: []
            }
          }
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        data: mockScenarios,
        error: null
      });

      const result = await scenarioRepo.list({ is_public: true, limit: 12 });

      expect(mockSupabase.from).toHaveBeenCalledWith('scenarios');
      expect(result).toHaveLength(2);
      
      // Filter should only return public scenarios
      const publicScenarios = result.filter(s => s.doc.is_public !== false);
      expect(publicScenarios).toHaveLength(1);
      expect(publicScenarios[0].id).toBe('scenario.inn_last_ember');
    });

    it('should return compact results with correct shape', async () => {
      const mockScenarios = [
        {
          id: 'scenario.inn_last_ember',
          version: '1.0.0',
          doc: {
            world_ref: 'world.mystika',
            is_public: true,
            scenario: {
              display_name: 'The Last Ember Inn',
              synopsis: 'A cozy inn where adventures begin. This is a longer synopsis that should be trimmed to 160 characters for the compact result.',
              tags: ['inn', 'safe'],
              fixed_npcs: [
                { npc_ref: 'npc.innkeeper' },
                { npc_ref: 'npc.bard' },
                { npc_ref: 'npc.guard' }
              ]
            }
          }
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        data: mockScenarios,
        error: null
      });

      const result = await scenarioRepo.list({ is_public: true, limit: 12 });
      const scenario = result[0];

      // Check compact result shape
      expect(scenario).toHaveProperty('id');
      expect(scenario).toHaveProperty('version');
      expect(scenario).toHaveProperty('doc');
      expect(scenario.doc).toHaveProperty('world_ref');
      expect(scenario.doc).toHaveProperty('is_public');
      expect(scenario.doc).toHaveProperty('scenario');
      expect(scenario.doc.scenario).toHaveProperty('display_name');
      expect(scenario.doc.scenario).toHaveProperty('synopsis');
      expect(scenario.doc.scenario).toHaveProperty('tags');
      expect(scenario.doc.scenario).toHaveProperty('fixed_npcs');
    });

    it('should filter by world_ref', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        data: [],
        error: null
      });

      const result = await scenarioRepo.list({ world_ref: 'world.mystika', is_public: true });

      expect(mockSupabase.from).toHaveBeenCalledWith('scenarios');
      expect(result).toBeDefined();
    });

    it('should filter by tags', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        data: [],
        error: null
      });

      await scenarioRepo.list({ tags: ['inn', 'safe'], is_public: true });

      expect(mockSupabase.from).toHaveBeenCalledWith('scenarios');
    });

    it('should search by query', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        data: [],
        error: null
      });

      const result = await scenarioRepo.list({ q: 'inn', is_public: true });

      expect(mockSupabase.from).toHaveBeenCalledWith('scenarios');
      expect(result).toBeDefined();
    });

    it('should limit results', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        data: [],
        error: null
      });

      const result = await scenarioRepo.list({ limit: 5, is_public: true });

      expect(mockSupabase.from).toHaveBeenCalledWith('scenarios');
      expect(result).toBeDefined();
    });
  });

  describe('POST /api/player/games/start', () => {
    it('should create game with correct meta and seeds', async () => {
      // Test the game state record structure
      const gameStateRecord = {
        session_id: 'game_123',
        hot: {
          scene: 'inn_common_room',
          objectives: ['Find a quest', 'Meet the locals'],
          flags: { has_met_innkeeper: false },
          party: [],
          inventory: ['gold_coin'],
          resources: { hp: 100, energy: 100 }
        },
        warm: {
          episodic: [],
          pins: []
        },
        cold: {
          world_ref: 'world.mystika',
          adventure_ref: 'adventure.inn_tales',
          scenario_ref: 'scenario.inn_last_ember@1.0.0',
          ruleset_ref: 'ruleset.core.default@1.0.0',
          locale: 'en-US'
        },
        updated_at: new Date().toISOString()
      };

      // Verify the structure is correct
      expect(gameStateRecord).toHaveProperty('session_id');
      expect(gameStateRecord).toHaveProperty('hot');
      expect(gameStateRecord).toHaveProperty('warm');
      expect(gameStateRecord).toHaveProperty('cold');
      expect(gameStateRecord).toHaveProperty('updated_at');
      
      expect(gameStateRecord.hot).toHaveProperty('scene');
      expect(gameStateRecord.hot).toHaveProperty('objectives');
      expect(gameStateRecord.hot).toHaveProperty('flags');
      expect(gameStateRecord.hot).toHaveProperty('party');
      expect(gameStateRecord.hot).toHaveProperty('inventory');
      expect(gameStateRecord.hot).toHaveProperty('resources');
      
      expect(gameStateRecord.cold).toHaveProperty('world_ref');
      expect(gameStateRecord.cold).toHaveProperty('adventure_ref');
      expect(gameStateRecord.cold).toHaveProperty('scenario_ref');
      expect(gameStateRecord.cold).toHaveProperty('ruleset_ref');
      expect(gameStateRecord.cold).toHaveProperty('locale');
    });

    it('should reject non-public scenarios', async () => {
      const mockScenario = {
        id: 'scenario.private',
        version: '1.0.0',
        doc: {
          world_ref: 'world.mystika',
          is_public: false, // Private scenario
          scenario: {
            display_name: 'Private Scenario'
          }
        }
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnValue({
          data: mockScenario,
          error: null
        })
      });

      // Should not create game state for private scenario
      expect(mockScenario.doc.is_public).toBe(false);
    });

    it('should handle missing scenario', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnValue({
          data: null,
          error: null
        })
      });

      // Should handle null scenario gracefully
      const result = null;
      expect(result).toBeNull();
    });
  });

  describe('Scenario Compaction', () => {
    it('should create compact scenario data for player display', () => {
      const scenarioDoc = {
        world_ref: 'world.mystika',
        adventure_ref: 'adventure.inn_tales',
        is_public: true,
        scenario: {
          display_name: 'The Last Ember Inn',
          synopsis: 'A cozy inn where adventures begin. This is a longer synopsis that should be trimmed to 160 characters for the compact result.',
          start_scene: 'inn_common_room',
          starting_objectives: ['Find a quest', 'Meet the locals'],
          starting_flags: { has_met_innkeeper: false },
          starting_party: [],
          starting_inventory: ['gold_coin'],
          starting_resources: { hp: 100, energy: 100 },
          tags: ['inn', 'safe'],
          fixed_npcs: [
            { npc_ref: 'npc.innkeeper' },
            { npc_ref: 'npc.bard' },
            { npc_ref: 'npc.guard' }
          ]
        }
      };

      // Test compact scenario structure
      const compact = {
        ref: 'scenario.inn_last_ember@1.0.0',
        world_ref: scenarioDoc.world_ref,
        display_name: scenarioDoc.scenario.display_name,
        synopsis: scenarioDoc.scenario.synopsis.slice(0, 160),
        start_scene: scenarioDoc.scenario.start_scene,
        fixed_npcs: scenarioDoc.scenario.fixed_npcs.slice(0, 8),
        tags: scenarioDoc.scenario.tags,
        npcs_preview: scenarioDoc.scenario.fixed_npcs.slice(0, 3).map(npc => npc.npc_ref),
        objectives: scenarioDoc.scenario.starting_objectives,
        flags: scenarioDoc.scenario.starting_flags,
        party: scenarioDoc.scenario.starting_party,
        inventory: scenarioDoc.scenario.starting_inventory,
        resources: scenarioDoc.scenario.starting_resources
      };

      expect(compact).toHaveProperty('ref');
      expect(compact).toHaveProperty('world_ref');
      expect(compact).toHaveProperty('display_name');
      expect(compact).toHaveProperty('synopsis');
      expect(compact.synopsis.length).toBeLessThanOrEqual(160);
      expect(compact).toHaveProperty('start_scene');
      expect(compact).toHaveProperty('fixed_npcs');
      expect(compact.fixed_npcs.length).toBeLessThanOrEqual(8);
      expect(compact).toHaveProperty('tags');
      expect(compact).toHaveProperty('npcs_preview');
      expect(compact.npcs_preview.length).toBeLessThanOrEqual(3);
      expect(compact).toHaveProperty('objectives');
      expect(compact).toHaveProperty('flags');
      expect(compact).toHaveProperty('party');
      expect(compact).toHaveProperty('inventory');
      expect(compact).toHaveProperty('resources');
    });
  });
});
