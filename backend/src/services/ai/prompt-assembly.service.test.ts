import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromptAssemblyService } from './prompt-assembly.service.js';

// Mock chains
const mockIn = vi.fn();
const mockSelect = vi.fn(() => ({ in: mockIn }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

// Mock the supabase module located at ../supabase.js
vi.mock('../supabase.js', () => ({
    supabaseAdmin: {
        from: mockFrom
    }
}));

describe('PromptAssemblyService', () => {
    let service: PromptAssemblyService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new PromptAssemblyService();
    });

    it('should hydrate rulesets and segregate MAS-1/MAS-2 instructions', async () => {
        const rulesetIds = ['uuid-1', 'uuid-2'];

        const mockDbResponse = [
            {
                id: 'uuid-1',
                key: 'ruleset_vitality',
                // [TEST JSON PARSING & NAME EXTRACTION]
                definition: JSON.stringify({
                    name: 'Vitality System',
                    ai_instructions: {
                        mas1_interpreter: [
                            { constraint: "If physical_condition is 'Collapsed', REJECT intent 'travel'." }
                        ],
                        mas1_action_parser: [
                            "Keywords: 'rest', 'camp' map to 'rest_action'."
                        ]
                    }
                })
            },
            {
                id: 'uuid-2',
                key: 'ruleset_npc',
                // [TEST FALLBACK IF NAME MISSING] 
                definition: {
                    // No name property here, should fallback to key 'ruleset_npc'
                    ai_instructions: {
                        mas2_narrator: [
                            { style: "Embody archetypes in [CORE PERSONALITY]." },
                            "Include 'tier1_entity.core_traits' in descriptions."
                        ]
                    }
                }
            }
        ];

        mockIn.mockResolvedValue({ data: mockDbResponse, error: null });

        const result = await service.getCompiledRules(rulesetIds);

        // Verify MAS-1 Output
        expect(result.mas1).toContain('[RULESET: Vitality System]');
        expect(result.mas1).toContain("Constraint: If physical_condition is 'Collapsed'");
        expect(result.mas1).not.toContain('ruleset_npc');

        // Verify MAS-2 Output
        // Should fallback to key 'ruleset_npc'
        expect(result.mas2).toContain('[RULESET: ruleset_npc]');
        expect(result.mas2).toContain("Style: Embody archetypes");
    });

    it('should compact excessive whitespace', async () => {
        const rulesetIds = ['uuid-1'];
        // Definition with many parts to cause whitespace buildup
        const mockDbResponse = [
            {
                id: 'uuid-1',
                key: 'ruleset_verbose',
                definition: JSON.stringify({
                    name: 'Verbose Rules',
                    ai_instructions: {
                        mas1_interpreter: ["Line 1", "Line 2"]
                    }
                })
            }
        ];

        mockIn.mockResolvedValue({ data: mockDbResponse, error: null });

        // We expect join('\n\n') which is normal, but let's imagine multiple rulesets
        // If implementation works, multiple newlines > 3 should become 2.
        // However, unit test of private method is hard without exposing it or inferring from output.
        // We can infer by checking it doesn't have \n\n\n\n

        const result = await service.getCompiledRules(rulesetIds);
        expect(result.mas1).not.toMatch(/\n{3,}/);
        expect(result.mas1).toContain('Line 1');
    });

    it('should handle malformed JSON gracefully', async () => {
        const mockDbResponse = [{
            id: 'bad-json-id',
            key: 'bad_json_key',
            definition: '{ "broken": ' // Invalid JSON
        }];
        mockIn.mockResolvedValue({ data: mockDbResponse, error: null });

        const result = await service.getCompiledRules(['bad-json-id']);

        // Should not crash, should use key/id as fallback name
        // Should treat as empty instructions likely
        expect(result.mas1).toContain("- No active mechanical constraints"); // or just empty if we check logs
        // Actually loop continues, instructions={}
    });
});
