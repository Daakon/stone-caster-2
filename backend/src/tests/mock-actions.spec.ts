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
                    deltas: { [`entities.${PLAYER_ID}.properties.current_stamina`]: 10 }
                },
                navigate: {
                    logic: 'none',
                    deltas: { [`entities.${PLAYER_ID}.properties.current_stamina`]: -10 }
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

    // A turn only counts when it lands in the DB: grab the payload of the last
    // updateGameState call so tests can assert the PERSISTED snapshot matches
    // the delta the client was told about.
    const getPersistedMechanicalState = (label: string) => {
        const updateMock = (gameTurnService as any).storiesRepo.updateGameState;
        expect(updateMock.mock.calls.length, `${label} state persisted`).toBeGreaterThan(0);
        const payload = updateMock.mock.calls[updateMock.mock.calls.length - 1][1];
        expect(payload.mechanical_state, `${label} persisted mechanical_state`).toBeDefined();
        return payload.mechanical_state;
    };

    it('should process test_combat and generate correct mechanical deltas for all targets and player', async () => {
        const result = await gameTurnService.processTurn(mockGameStateId, 'test_combat', PLAYER_ID);

        expect(result.success, 'test_combat success').toBe(true);
        expect(result.delta, 'test_combat delta').toBeDefined();

        // Engine dynamically scales damage based on target HP and impact tier (Moderate is ~15%)
        expect(result.delta?.entities?.[TARGET_GUARD_ID]?.properties?.hp, 'test_combat guard hp').toBeLessThan(0);
        expect(result.delta?.entities?.[TARGET_KIERA_ID]?.properties?.hp, 'test_combat kiera hp').toBeLessThan(0);

        // Engine applies stamina cost to the actor's LIVE resource (current_stamina)
        const staminaDelta = result.delta?.entities?.[PLAYER_ID]?.properties?.current_stamina;
        expect(staminaDelta, 'test_combat player current_stamina').toBeLessThan(0);

        // The persisted snapshot must reflect exactly what the delta claimed —
        // this is what the vitals HUD reads after a refresh.
        const persisted = getPersistedMechanicalState('test_combat');
        expect(persisted.entities[PLAYER_ID].properties.current_stamina, 'test_combat persisted stamina')
            .toBe(100 + staminaDelta);
        expect(persisted.entities[TARGET_GUARD_ID].properties.hp, 'test_combat persisted guard hp')
            .toBe(50 + result.delta.entities[TARGET_GUARD_ID].properties.hp);
        expect(persisted.entities[TARGET_KIERA_ID].properties.hp, 'test_combat persisted kiera hp')
            .toBe(60 + result.delta.entities[TARGET_KIERA_ID].properties.hp);

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

        // Director ripple: Minor emotional ripple builds desire (+1 on the 0-20 scale)
        const desireDelta = result.delta?.entities?.[TARGET_BARTENDER_ID]?.relationships?.desire;
        expect(desireDelta, 'test_social ripple desire delta').toBe(1);

        // Relationships persist ON the entity — the canonical location the
        // client merges into and reloads from. Baseline is 5, clamped 0-20.
        const persisted = getPersistedMechanicalState('test_social');
        const persistedRels = persisted.entities[TARGET_BARTENDER_ID].relationships;
        expect(persistedRels, 'test_social persisted relationships').toBeDefined();
        expect(persistedRels.trust, 'test_social persisted trust').toBe(5 + trustDelta);
        expect(persistedRels.desire, 'test_social persisted desire').toBe(5 + desireDelta);
        // No detached ledger copy — entity-level storage is the single source
        expect(persisted.ledgers?.relationships, 'test_social no legacy ledger writes').toBeUndefined();

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

        // Sequence aggregation: combat drains 5 (mocked roll), rest restores 10
        const staminaDelta = result.delta?.entities?.[PLAYER_ID]?.properties?.current_stamina;
        expect(staminaDelta, 'test_mixed net stamina').toBe(5);
        const persisted = getPersistedMechanicalState('test_mixed');
        expect(persisted.entities[PLAYER_ID].properties.current_stamina, 'test_mixed persisted stamina')
            .toBe(100 + staminaDelta);
    });

    it('should process test_travel successfully', async () => {
         const result = await gameTurnService.processTurn(mockGameStateId, 'test_travel', PLAYER_ID);

         expect(result.success, 'test_travel success').toBe(true);
         // Navigate applies to actor explicitly
         expect(result.delta?.entities?.[PLAYER_ID], 'test_travel player delta').toBeDefined();
         expect(result.delta?.entities?.[PLAYER_ID]?.properties?.current_stamina, 'test_travel stamina delta').toBe(-10);

         const persisted = getPersistedMechanicalState('test_travel');
         expect(persisted.entities[PLAYER_ID].properties.current_stamina, 'test_travel persisted stamina').toBe(90);

         expectCleanTurnOutput(result, 'test_travel');
    });

    it('should process test_drunk_combat successfully (INTOXICATED situational tag)', async () => {
        const result = await gameTurnService.processTurn(mockGameStateId, 'test_drunk_combat', PLAYER_ID);

        expect(result.success, 'test_drunk_combat success').toBe(true);
        expect(result.delta?.entities?.[TARGET_GUARD_ID]?.properties?.hp, 'test_drunk_combat guard hp').toBeLessThan(0);
        expect(result.delta?.entities?.[PLAYER_ID]?.properties?.current_stamina, 'test_drunk_combat player stamina').toBeLessThan(0);

        const newLogs = result.new_logs || [];
        const systemLog = newLogs.find(l => l.role === 'system' && l.content.includes('[Hp:'));
        expect(systemLog?.content, 'test_drunk_combat Garret in log').toContain('Garret');
        expect(systemLog?.content, 'test_drunk_combat Unknown Entity not in log').not.toContain('Unknown Entity');

        expectCleanTurnOutput(result, 'test_drunk_combat');
    });

    it('should mark a weakened hostile target as Surrendered after test_combat', async () => {
        // Guard is hostile and already badly hurt: 8/50 HP (16%). The Moderate
        // impact from test_combat drops him below the 25% surrender threshold.
        const weakenedState = getInitialGameState();
        (weakenedState.mechanical as any).entities[TARGET_GUARD_ID] = {
            id: TARGET_GUARD_ID,
            type: 'enemy',
            properties: { name: 'Garret', hp: 8, maxHp: 50 }
        };
        vi.spyOn(gameTurnService, 'loadState' as any).mockResolvedValue(weakenedState);

        const result = await gameTurnService.processTurn(mockGameStateId, 'test_combat', PLAYER_ID);

        expect(result.success, 'surrender scenario success').toBe(true);

        // The condition transition rides the client delta as HUD state
        const guardDelta = result.delta?.entities?.[TARGET_GUARD_ID]?.properties;
        expect(guardDelta?.hp, 'surrender scenario guard took damage').toBeLessThan(0);
        expect(guardDelta?.combat_condition, 'surrender scenario condition in delta').toBe('Surrendered');

        // And it persists on the entity for reloads
        const persisted = getPersistedMechanicalState('surrender scenario');
        expect(persisted.entities[TARGET_GUARD_ID].properties.combat_condition, 'surrender scenario persisted condition')
            .toBe('Surrendered');

        const newLogs = result.new_logs || [];

        // The system log must NEVER print the raw condition label — that is
        // the Narrator's material, not a game-result line.
        for (const log of newLogs.filter(l => l.role === 'system')) {
            expect(log.content, 'surrender scenario no condition labels in system log').not.toContain('Combat Condition');
            expect(log.content, 'surrender scenario no condition labels in system log').not.toContain('Physical Condition');
        }

        // The NARRATOR renders the surrender as prose, like a DM would
        const narratorLog = newLogs.find(l => l.role === 'narrator');
        expect(narratorLog?.content, 'surrender scenario narrated as fiction').toContain('surrender');
        expect(narratorLog?.content, 'surrender scenario names the NPC').toContain('Garret');

        expectCleanTurnOutput(result, 'surrender scenario');
    });

    it('should process test_protective_combat successfully (PROTECTING_ALLY situational tag)', async () => {
        const result = await gameTurnService.processTurn(mockGameStateId, 'test_protective_combat', PLAYER_ID);

        expect(result.success, 'test_protective_combat success').toBe(true);
        expect(result.delta?.entities?.[TARGET_GUARD_ID]?.properties?.hp, 'test_protective_combat guard hp').toBeLessThan(0);
        expect(result.delta?.entities?.[PLAYER_ID]?.properties?.current_stamina, 'test_protective_combat player stamina').toBeLessThan(0);

        const newLogs = result.new_logs || [];
        const systemLog = newLogs.find(l => l.role === 'system' && l.content.includes('[Hp:'));
        expect(systemLog?.content, 'test_protective_combat Garret in log').toContain('Garret');
        expect(systemLog?.content, 'test_protective_combat Unknown Entity not in log').not.toContain('Unknown Entity');

        expectCleanTurnOutput(result, 'test_protective_combat');
    });
});
