
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateSessionIntegrity } from './sessionValidator';

// Mock Supabase Client
const createMockSupabase = (
    storyResponse: any = { data: null, error: null },
    playerResponse: any = { data: null, error: null },
    turnsResponse: any = { count: 0, error: null }
) => {
    return {
        from: vi.fn((table: string) => {
            if (table === 'chimera_stories') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            single: vi.fn().mockResolvedValue(storyResponse)
                        }))
                    }))
                };
            }
            if (table === 'chimera_entities') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn((col, val) => ({
                            eq: vi.fn(() => ({
                                maybeSingle: vi.fn().mockResolvedValue(playerResponse)
                            }))
                        }))
                    }))
                };
            }
            if (table === 'chimera_turns') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn().mockResolvedValue(turnsResponse)
                    }))
                };
            }
            return {
                select: vi.fn(() => ({ eq: vi.fn() }))
            };
        })
    } as any;
};

describe('validateSessionIntegrity', () => {
    const validStory = {
        data: {
            id: 's1',
            title: 'Test Story',
            world_id: 'w1',
            world: { id: 'w1', name: 'Test World' }
        },
        error: null
    };

    const validPlayer = {
        data: { id: 'p1', name: 'Hero' },
        error: null
    };

    it('returns error if story not found', async () => {
        const mockSupabase = createMockSupabase(
            { data: null, error: { message: 'Not found' } },
            validPlayer,
            { count: 0, error: null }
        );

        const result = await validateSessionIntegrity(mockSupabase, 's1');
        expect(result.status).toBe('error');
        expect(result.error).toContain('Not found');
    });

    it('returns error if linked world missing', async () => {
        const storyNoWorld = {
            data: { id: 's1', world_id: 'w1', world: null },
            error: null
        };
        const mockSupabase = createMockSupabase(storyNoWorld, validPlayer, { count: 0 });

        const result = await validateSessionIntegrity(mockSupabase, 's1');
        expect(result.status).toBe('error');
        expect(result.error).toContain('World not found');
    });

    it('returns error if player missing', async () => {
        const mockSupabase = createMockSupabase(
            validStory,
            { data: null, error: null }, // Player missing
            { count: 0 }
        );

        const result = await validateSessionIntegrity(mockSupabase, 's1');
        expect(result.status).toBe('error');
        expect(result.error).toContain('Player Character missing');
    });

    it('returns needs_genesis if turns count is 0', async () => {
        const mockSupabase = createMockSupabase(
            validStory,
            validPlayer,
            { count: 0, error: null }
        );

        const result = await validateSessionIntegrity(mockSupabase, 's1');
        expect(result.status).toBe('needs_genesis');
        expect(result.context?.story.id).toBe('s1');
        expect(result.context?.player.id).toBe('p1');
    });

    it('returns ready if turns count > 0', async () => {
        const mockSupabase = createMockSupabase(
            validStory,
            validPlayer,
            { count: 5, error: null }
        );

        const result = await validateSessionIntegrity(mockSupabase, 's1');
        expect(result.status).toBe('ready');
        expect(result.context).toBeDefined();
    });
});
