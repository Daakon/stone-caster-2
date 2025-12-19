import { describe, it, expect } from 'vitest';
import { WorldPresetService } from './world-preset.service.js';

describe('WorldPresetService', () => {
    const service = WorldPresetService.getInstance();

    describe('getAvailableGenres', () => {
        it('should return a list of genres', () => {
            const genres = service.getAvailableGenres();
            expect(genres.length).toBeGreaterThan(0);
            expect(genres[0]).toHaveProperty('id');
            expect(genres[0]).toHaveProperty('name');
            expect(genres[0]).toHaveProperty('defaultRulesetKeys');
        });

        it('should include required genres', () => {
            const genres = service.getAvailableGenres();
            const names = genres.map(g => g.name);
            expect(names).toContain('High Fantasy');
            expect(names).toContain('Low Fantasy / Gritty');
            expect(names).toContain('Narrative / Cozy');
        });
    });

    describe('getPresetsForGenre', () => {
        it('should return correct defaults for High Fantasy', () => {
            const keys = service.getPresetsForGenre('High Fantasy');
            expect(keys).toEqual([
                'd100-5-pillars',
                'stamina-based-magic',
                'vitality-stamina-system',
                'world-cycle-time-bands',
                'cinematic-combat-lite',
                'wealth-capability-lite'
            ]);
        });

        it('should return correct answer for mapped ID (high-fantasy)', () => {
            const keys = service.getPresetsForGenre('high-fantasy');
            expect(keys).toEqual([
                'd100-5-pillars',
                'stamina-based-magic',
                'vitality-stamina-system',
                'world-cycle-time-bands',
                'cinematic-combat-lite',
                'wealth-capability-lite'
            ]);
        });

        it('should return correct defaults for Low Fantasy / Gritty', () => {
            const keys = service.getPresetsForGenre('Low Fantasy / Gritty');
            expect(keys).toEqual([
                'd100-5-pillars',
                'vitality-stamina-system',
                'needs-survival-basic',
                'world-cycle-time-bands',
                'cinematic-combat-lite'
            ]);
        });

        it('should return correct answer for mapped ID (low-fantasy-gritty)', () => {
            const keys = service.getPresetsForGenre('low-fantasy-gritty');
            expect(keys).toEqual([
                'd100-5-pillars',
                'vitality-stamina-system',
                'needs-survival-basic',
                'world-cycle-time-bands',
                'cinematic-combat-lite'
            ]);
        });

        it('should return correct defaults for Narrative / Cozy', () => {
            const keys = service.getPresetsForGenre('Narrative / Cozy');
            expect(keys).toEqual([
                'npc-personalities',
                'npc-relationships',
                'npc-quirks-habits',
                'npc-roles-background',
                'world-cycle-time-bands'
            ]);
        });

        it('should handle case insensitivity', () => {
            const keys = service.getPresetsForGenre('high fantasy');
            expect(keys).toEqual(service.getPresetsForGenre('High Fantasy'));
        });

        it('should return empty array for unknown genre', () => {
            const keys = service.getPresetsForGenre('Unknown Genre 123');
            expect(keys).toEqual([]);
        });
    });
});
