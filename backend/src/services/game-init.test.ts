import { describe, it, expect, vi } from 'vitest';
import { GameStateService } from './game-state.service.js';
import type { CompiledStory } from './compile/compiler.service.js';
import type { Character } from '@shared';

describe('GameStateService: initializeActiveGame', () => {
    const service = new GameStateService();

    // Mock Data
    const mockGenesisConfig = {
        opening_action: {
            title: 'The Tavern Brawl',
            scene_id: 'scene_tavern_01',
            action: 'A fist flies past your face.',
            choices: []
        },
        set_design: {
            atmosphere: 'Smoky and loud.'
        },
        initial_cast: [
            {
                id: 'extra_barman',
                name: 'Barnaby',
                visual_alias: 'Short Barman',
                role: 'Vendor',
                visual_tags: ['Human', 'Apron'],
                description: 'Wiping a glass.'
            }
        ],
        narrative_style: {
            tone: 'gritty',
            pacing: 'fast',
            perspective: 'second_person'
        }
    };

    const mockSnapshotEntities = [
        {
            id: 'npc_boss',
            properties: {
                name: 'Big Boss',
                location_id: 'scene_backroom'
            }
        }
    ];

    const mockCompiledStory = {
        id: 'story_v1',
        genesis_config: mockGenesisConfig,
        snapshot_entities: mockSnapshotEntities,
        snapshot_world: {}
    } as unknown as CompiledStory;

    const mockPlayer: Character = {
        id: 'player_123',
        name: 'Hero Protagonist',
        description: 'A brave soul.',
        attributes: { str: 10 },
        // ... other required fields mocked as needed
    } as unknown as Character;

    it('should hydrate Extras and assign location from Start Scene', async () => {
        const bundle = await service.initializeActiveGame('game_1', mockCompiledStory, null, 'user_1');

        const extra = bundle.mechanical.entities['extra_barman'];
        expect(extra).toBeDefined();
        expect(extra.properties.visual_name).toBe('Short Barman');
        expect(extra.properties.is_known).toBe(false);
        expect(extra.properties.location_id).toBe('scene_tavern_01'); // Implicitly from opening_action.scene_id
        expect(extra.properties.tags).toContain('genesis_extra');
    });

    it('should include Player entity in the roster', async () => {
        const bundle = await service.initializeActiveGame('game_1', mockCompiledStory, mockPlayer, 'user_1');

        const player = bundle.mechanical.entities['player_123'];
        expect(player).toBeDefined();
        expect(player.type).toBe('PLAYER');
        expect(player.properties.name).toBe('Hero Protagonist');
        expect(player.properties.location_id).toBe('scene_tavern_01');
    });

    it('should merge Snapshot Entities (Stars)', async () => {
        const bundle = await service.initializeActiveGame('game_1', mockCompiledStory, null, 'user_1');

        const star = bundle.mechanical.entities['npc_boss'];
        expect(star).toBeDefined();
        expect(star.properties.name).toBe('Big Boss');
        // Should keep its own location if defined
        expect(star.properties.location_id).toBe('scene_backroom');
    });

    it('should prime Narrator instructions and inject Turn 0', async () => {
        const bundle = await service.initializeActiveGame('game_1', mockCompiledStory, null, 'user_1');

        expect(bundle.narrative.director_instructions).toEqual({
            tone: 'gritty',
            pacing: 'fast',
            perspective: 'second_person'
        });

        const turn0 = bundle.narrative.dialogue_history[0];
        expect(turn0).toBeDefined();
        expect(turn0.speaker).toBe('System');
        expect(turn0.text).toContain('Tone=gritty');
    });
});
