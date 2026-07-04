// [CHIMERA V3] Architecture: Greenfield | Layer: Backend
/**
 * Mock Actions Integration Test
 * Tests the specific mock actions (`test_combat`, `test_social`, etc.)
 * through the GameTurnService to ensure deltas and logs are correctly generated.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GameStateBundle } from '@shared/types/chimera-runtime';
import { GameTurnService } from '../services/game/game-turn.service.js';
import { EngineService } from '../services/runtime/engine.service.js';
import { Mas2Service } from '../services/runtime/mas2.service.js';
import { DirectorService } from '../services/runtime/director.service.js';
import { MockLlmProvider } from '../services/runtime/llm.provider.js';

// Setup Mock Environment
const mockGameStateId = '901d84d8-ec64-4c0e-86cf-796e10262b97';
const TARGET_GUARD_ID = '39757d45-2426-4377-a5d0-e99e9681d1ff'; // Garret
const TARGET_KIERA_ID = '789dbece-3bc9-4080-82ce-31b47139fbb5'; // Kiera
const TARGET_BARTENDER_ID = '00f2f66c-4ece-46df-ace9-af89a488c077'; // Bartender

// Represents Daakon's ID
const PLAYER_ID = '2bfccd8e-9d2a-4b72-9151-544eb249ccd4';

describe('Mock Actions Verification', () => {
    let mockSupabase: any;
    let mockLlmProvider: MockLlmProvider;
    let engineService: EngineService;
    let mas2Service: Mas2Service;
    let directorService: DirectorService;
    let gameTurnService: GameTurnService;

    // A mock representation of the initial state based on test requirements
    const getInitialGameState = (): GameStateBundle => ({
        id: mockGameStateId,
        story_id: 'test-story-draft-id',
        compiled_system_prompt: 'Action Interpreter... Narrator... Director...',
        mechanical: {
            index: { player_id: PLAYER_ID },
            entities: {
                [PLAYER_ID]: {
                    id: PLAYER_ID,
                    properties: { name: 'Daakon', hp: 100, maxHp: 100, current_stamina: 100 }
                },
                [TARGET_GUARD_ID]: {
                    id: TARGET_GUARD_ID,
                    properties: { name: 'Garret', hp: 50, maxHp: 50 }
                },
                [TARGET_KIERA_ID]: {
                    id: TARGET_KIERA_ID,
                    properties: { name: 'Kiera', hp: 60, maxHp: 60 }
                },
                [TARGET_BARTENDER_ID]: {
                    id: TARGET_BARTENDER_ID,
                    properties: { name: 'Bartender', hp: 40, maxHp: 40 }
                },
                '7a70ee42-101d-4dd3-8cee-2882fdd8a84e': {
                    id: '7a70ee42-101d-4dd3-8cee-2882fdd8a84e',
                    properties: { name: 'Bard', hp: 20, maxHp: 20 }
                }
            }
        },
        narrative: {
            dialogue_history: []
        },
        registry: {}
    });

    const mockCompiledStory = {
        meta: { source_ids: [] },
        master_schema: {
            tier1_allowlist: [],
            tier0_allowlist: [],
            actions_map: {
                combat_action: {
                    logic: '1d20',
                    deltas: { target: { hp: -15 }, actor: { current_stamina: -5 } }
                },
                social_action: {
                    logic: '1d20',
                    deltas: { actor: { current_stamina: -2 } }
                },
                rest_action: {
                    logic: 'none',
                    deltas: { [`entities.${PLAYER_ID}.properties.stamina`]: 10 }
                },
                navigate: {
                    logic: 'none',
                    deltas: { [`entities.${PLAYER_ID}.properties.stamina`]: -10 }
                }
            }
        },
        narrative_index: [],
        initial_state: {}
    };

    beforeEach(() => {
        // Mock Math.random to always succeed (roll 1) for deterministic Engine paths
        vi.spyOn(Math, 'random').mockReturnValue(0);
        
        // We mock Supabase client completely because GameTurnService uses repositories initialized internally
        mockSupabase = {};
        
        mockLlmProvider = new MockLlmProvider();
        engineService = new EngineService();
        mas2Service = new Mas2Service(mockLlmProvider);
        const mockLlmService = {
            generateJSON: vi.fn().mockImplementation((sys: string, user: string) => mockLlmProvider.generateJson(sys, user))
        };
        directorService = new DirectorService(mockLlmService as any);
        
        gameTurnService = new GameTurnService(
            mockSupabase,
            undefined, // narrativeService legacy
            directorService,
            engineService,
            mas2Service
        );

        // Mock database operations
        vi.spyOn(gameTurnService, 'loadState' as any).mockResolvedValue(getInitialGameState());
        vi.spyOn(gameTurnService, 'getStoryIdFromGameState' as any).mockResolvedValue('test-story-draft-id');
        
        // Mock the repos accessed inside gameTurnService
        (gameTurnService as any).storiesRepo = {
            getCompiledStoryByDraftId: vi.fn().mockResolvedValue(mockCompiledStory),
            getCompiledStoryById: vi.fn().mockResolvedValue(mockCompiledStory),
            getNextTurnIndex: vi.fn().mockResolvedValue(1),
            recordTurn: vi.fn().mockResolvedValue({ id: 'turn-id-123', turn_index: 1 }),
            linkAuditLogToTurn: vi.fn().mockResolvedValue(undefined),
            updateGameState: vi.fn().mockResolvedValue(undefined),
            loadGameState: vi.fn().mockResolvedValue(getInitialGameState()),
        };
    });

    // Shared hygiene assertions: the delta and logs the client receives must be
    // clean regardless of scenario.
    const expectCleanTurnOutput = (result: any, label: string) => {
        const newLogs = result.new_logs || [];
        for (const log of newLogs) {
            expect(log.content, `${label} no [THOUGHT] in player-facing logs`).not.toContain('[THOUGHT]');
        }
        // Entity-scoped changes must live under entities.<id>, never at a
        // top-level `relationships` key (breaks name resolution + client merge)
        expect(result.delta?.relationships, `${label} no top-level delta.relationships`).toBeUndefined();
    };

    it('should process test_combat and generate correct mechanical deltas for all targets and player', async () => {
        const result = await gameTurnService.processTurn(mockGameStateId, 'test_combat', PLAYER_ID);

        expect(result.success, 'test_combat success').toBe(true);
        expect(result.delta, 'test_combat delta').toBeDefined();

        // Engine dynamically scales damage based on target HP and impact tier (Moderate is ~15%)
        expect(result.delta?.entities?.[TARGET_GUARD_ID]?.properties?.hp, 'test_combat guard hp').toBeLessThan(0);
        expect(result.delta?.entities?.[TARGET_KIERA_ID]?.properties?.hp, 'test_combat kiera hp').toBeLessThan(0);

        // Engine applies stamina cost to the actor
        expect(result.delta?.entities?.[PLAYER_ID]?.properties?.stamina, 'test_combat player stamina').toBeLessThan(0);

        // Ensure "Unknown Entity" is not in the system log (find the mechanical delta log specifically)
        const newLogs = result.new_logs || [];
        const systemLog = newLogs.find(l => l.role === 'system' && (l.content.includes('[Hp:') || l.content.includes('[Stamina:')));
        expect(systemLog, 'test_combat systemLog').toBeDefined();

        expect(systemLog?.content, 'test_combat Kiera in log').toContain('Kiera');
        expect(systemLog?.content, 'test_combat Garret in log').toContain('Garret');
        expect(systemLog?.content, 'test_combat Unknown Entity not in log').not.toContain('Unknown Entity');

        expectCleanTurnOutput(result, 'test_combat');
    });

    it('should process test_social successfully', async () => {
        const result = await gameTurnService.processTurn(mockGameStateId, 'test_social', PLAYER_ID);

        expect(result.success, 'test_social success').toBe(true);
        expect(result.delta, 'test_social delta').toBeDefined();

        // MAS2 will create unseen ripples and relationship updates.
        // The delta must be a nonzero additive change, not a clamped absolute value.
        const trustDelta = result.delta?.entities?.[TARGET_BARTENDER_ID]?.relationships?.trust;
        expect(trustDelta, 'test_social bartender trust defined').toBeDefined();
        expect(trustDelta, 'test_social bartender trust nonzero').not.toBe(0);

        const newLogs = result.new_logs || [];
        const systemLog = newLogs.find(l => l.role === 'system' && l.content.includes('Bartender ['));

        // It should properly format the bartender's changes
        expect(systemLog?.content, 'test_social Bartender in log').toContain('Bartender');
        expect(systemLog?.content, 'test_social Unknown Entity not in log').not.toContain('Unknown Entity');

        expectCleanTurnOutput(result, 'test_social');
    });

    it('should process test_mixed successfully (combat + rest)', async () => {
        const result = await gameTurnService.processTurn(mockGameStateId, 'test_mixed', PLAYER_ID);
        
        expect(result.success, 'test_mixed success').toBe(true);
        expect(result.delta, 'test_mixed delta').toBeDefined();
        
        expect(result.delta?.entities?.[TARGET_GUARD_ID], 'test_mixed guard delta').toBeDefined();
        expect(result.delta?.entities?.[PLAYER_ID], 'test_mixed player delta').toBeDefined();
    });

    it('should process test_travel successfully', async () => {
         const result = await gameTurnService.processTurn(mockGameStateId, 'test_travel', PLAYER_ID);

         expect(result.success, 'test_travel success').toBe(true);
         // Navigate applies to actor explicitly
         expect(result.delta?.entities?.[PLAYER_ID], 'test_travel player delta').toBeDefined();

         expectCleanTurnOutput(result, 'test_travel');
    });

    it('should process test_drunk_combat successfully (INTOXICATED situational tag)', async () => {
        const result = await gameTurnService.processTurn(mockGameStateId, 'test_drunk_combat', PLAYER_ID);

        expect(result.success, 'test_drunk_combat success').toBe(true);
        expect(result.delta?.entities?.[TARGET_GUARD_ID]?.properties?.hp, 'test_drunk_combat guard hp').toBeLessThan(0);
        expect(result.delta?.entities?.[PLAYER_ID]?.properties?.stamina, 'test_drunk_combat player stamina').toBeLessThan(0);

        const newLogs = result.new_logs || [];
        const systemLog = newLogs.find(l => l.role === 'system' && l.content.includes('[Hp:'));
        expect(systemLog?.content, 'test_drunk_combat Garret in log').toContain('Garret');
        expect(systemLog?.content, 'test_drunk_combat Unknown Entity not in log').not.toContain('Unknown Entity');

        expectCleanTurnOutput(result, 'test_drunk_combat');
    });

    it('should process test_protective_combat successfully (PROTECTING_ALLY situational tag)', async () => {
        const result = await gameTurnService.processTurn(mockGameStateId, 'test_protective_combat', PLAYER_ID);

        expect(result.success, 'test_protective_combat success').toBe(true);
        expect(result.delta?.entities?.[TARGET_GUARD_ID]?.properties?.hp, 'test_protective_combat guard hp').toBeLessThan(0);
        expect(result.delta?.entities?.[PLAYER_ID]?.properties?.stamina, 'test_protective_combat player stamina').toBeLessThan(0);

        const newLogs = result.new_logs || [];
        const systemLog = newLogs.find(l => l.role === 'system' && l.content.includes('[Hp:'));
        expect(systemLog?.content, 'test_protective_combat Garret in log').toContain('Garret');
        expect(systemLog?.content, 'test_protective_combat Unknown Entity not in log').not.toContain('Unknown Entity');

        expectCleanTurnOutput(result, 'test_protective_combat');
    });
});
