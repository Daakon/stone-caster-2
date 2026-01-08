import { supabaseAdmin } from '../supabase.js';

interface RulesetDefinition {
    ai_instructions?: {
        mas1_interpreter?: any[];
        mas1_action_parser?: any[];
        mas2_narrator?: any[];
        [key: string]: any;
    };
    // Allow other fields
    [key: string]: any;
}

export class PromptAssemblyService {
    /**
   * Hydrates rulesets and segregates instructions for MAS-1 and MAS-2.
   * @param rulesetIds - List of UUIDs from the CompiledStory.
   * @returns Formatted prompt sections.
   */
    async getCompiledRules(rulesetIds: string[]): Promise<{ mas1: string; mas2: string }> {
        if (!rulesetIds || rulesetIds.length === 0) {
            return {
                mas1: "- No specific mechanical constraints.",
                mas2: "- Standard narrative physics apply."
            };
        }

        // 1. Fetch Definitions from DB
        // [FIX] Removed 'name' from selection as it doesn't exist on the table.
        // Logic: Name is strictly inside the JSON definition or fallback to 'key'.
        const { data: rulesets, error } = await supabaseAdmin
            .from('chimera_ruleset_templates')
            .select('id, key, definition')
            .in('id', rulesetIds);

        if (error) {
            console.error('[PromptAssembly] Failed to fetch rulesets:', error);
            return {
                mas1: `[ERROR] Failed to load rulesets: ${error.message}`,
                mas2: `[ERROR] Failed to load rulesets: ${error.message}`
            };
        }

        const mas1Parts: string[] = [];
        const mas2Parts: string[] = [];

        // 2. Iterate and Segregate
        for (const ruleset of rulesets || []) {
            let def: RulesetDefinition = {};
            let name = 'Unknown Ruleset';

            // [SAFETY] Safe JSON Parsing
            try {
                def = (typeof ruleset.definition === 'string'
                    ? JSON.parse(ruleset.definition)
                    : ruleset.definition) as RulesetDefinition;

                // Hierarchy: definition.name -> row.key -> row.id
                name = def.name || ruleset.key || ruleset.id;
            } catch (err) {
                console.warn(`[PromptAssembly] Failed to parse definition for ruleset ${ruleset.id}`, err);
                // Fallback to key or ID if parsing fails
                name = ruleset.key || ruleset.id;
            }

            const instructions = def.ai_instructions || {};

            // MAS-1: Interpreter & Action Parser
            const mas1Items = [
                ...this.forceArray(instructions.mas1_interpreter),
                ...this.forceArray(instructions.mas1_action_parser)
            ];

            if (mas1Items.length > 0) {
                mas1Parts.push(this.formatBlock(name, mas1Items));
            }

            // MAS-2: Narrator
            const mas2Items = this.forceArray(instructions.mas2_narrator);
            if (mas2Items.length > 0) {
                mas2Parts.push(this.formatBlock(name, mas2Items));
            }
        }

        // [OPTIMIZATION] Whitespace Compaction
        return {
            mas1: mas1Parts.length > 0 ? this.compactWhitespace(mas1Parts.join('\n\n')) : "- No active mechanical constraints.",
            mas2: mas2Parts.length > 0 ? this.compactWhitespace(mas2Parts.join('\n\n')) : "- Standard narrative flow."
        };
    }

    /**
     * Safely coercing input to an array.
     * - If array: returns it.
     * - If null/undefined: returns [].
     * - If single value (string/object): returns [value].
     */
    private forceArray(input: any): any[] {
        if (input === null || input === undefined) return [];
        if (Array.isArray(input)) return input;
        return [input];
    }

    private formatBlock(rulesetName: string, items: any[]): string {
        const lines = items.map(item => {
            // Handle both string strings and objects
            if (typeof item === 'string') return `- ${item}`;

            // If object, try to format intelligently based on keys
            // Example: { "constraint": "...", "condition": "..." }
            if (item.constraint) return `- Constraint: ${item.constraint}`;
            if (item.style) return `- Style: ${item.style}`;
            if (item.readout) return `- Readout: ${item.readout}`;
            if (item.rule) return `- Rule: ${item.rule}`;

            // Fallback
            return `- ${JSON.stringify(item)}`;
        });

        return `[RULESET: ${rulesetName}]\n${lines.join('\n')}`;
    }

    /**
     * Compresses vertical whitespace to optimize token usage.
     * Replaces 3+ newlines with 2.
     */
    private compactWhitespace(text: string): string {
        return text.replace(/\n{3,}/g, '\n\n').trim();
    }
}
