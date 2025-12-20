import { createClient } from '@supabase/supabase-js';
import { STANDARD_LIBRARY_AllowList } from '../../engine/registry.js';
import { SnapshotManager } from './refiners/snapshot.manager.js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Compiler V2
 * "Bind Fate" Orchestrator
 */
export class Compiler {
    /**
     * Compile a Story ("Bind Fate")
     */
    static async compileStory(storyId: string): Promise<void> {
        console.log(`[Compiler V2] Binding Fate for Story: ${storyId}`);

        try {
            // 1. Fetch Data
            // Get Ruleset IDs from the Story (or World fallback)
            // Note: Prompt assumes we query all rulesets associated with storyId.
            // We reuse logic from previous service to resolve IDs.
            const { data: story, error: storyError } = await supabase
                .from('chimera_stories')
                .select('*')
                .eq('id', storyId)
                .single();

            if (storyError || !story) throw new Error(`Story not found: ${storyId}`);

            let rulesetIds: string[] = story.active_ruleset_ids || [];
            if (rulesetIds.length === 0) {
                const { data: world } = await supabase
                    .from('chimera_worlds')
                    .select('ruleset_template_ids')
                    .eq('id', story.world_id)
                    .single();
                if (world) rulesetIds = world.ruleset_template_ids || [];
            }

            if (rulesetIds.length === 0) {
                // If no rulesets, we might still want to compile emptiness? 
                // But prompt implies processing rulesets.
                console.warn('[Compiler V2] No rulesets found. Compiling empty cartridge.');
            }

            const { data: rulesets, error: rulesetsError } = await supabase
                .from('chimera_ruleset_templates')
                .select('*')
                .in('id', rulesetIds);

            if (rulesetsError) throw new Error(`Failed to load rulesets: ${rulesetsError.message}`);

            // 2. Initialize Containers
            let entitySchema: Record<string, any> = {};
            let worldSchema: Record<string, any> = {};
            let actionRegistry: Record<string, any> = {};
            let interpreterPrompts: string[] = [];
            let narratorPrompts: string[] = [];

            // 3. Iterate & Process Rulesets
            for (const ruleset of (rulesets || [])) {
                const def = ruleset.definition || {};
                const stateContrib = def.state_contributions || {};

                // State Contributions: Deep merge tier1_entity and tier1_world
                // We do a simple top-level merge for now as deep merge can be complex without lodash
                // Assuming tier1 structures are distinct enough or overwrite is acceptable behavior for "last ruleset wins"
                if (stateContrib.tier1_entity) {
                    entitySchema = { ...entitySchema, ...stateContrib.tier1_entity };
                }
                if (stateContrib.tier1_world) {
                    worldSchema = { ...worldSchema, ...stateContrib.tier1_world };
                }

                // Actions: Validate & Register
                if (def.actions) {
                    for (const [key, actionSteps] of Object.entries(def.actions)) {
                        if (Array.isArray(actionSteps)) {
                            (actionSteps as any[]).forEach((step, idx) => {
                                if (step.function && !STANDARD_LIBRARY_AllowList.includes(step.function)) {
                                    throw new Error(
                                        `Validation Error: Rule '${ruleset.name}' uses banned function '${step.function}' in action '${key}'.`
                                    );
                                }
                            });
                        }
                        actionRegistry[key] = actionSteps;
                    }
                }

                // AI Instructions
                if (def.ai_instructions) {
                    // Interpreter
                    if (def.ai_instructions.mas1_interpreter) {
                        const instr = def.ai_instructions.mas1_interpreter;
                        // Format logic? Prompt says "Push rules into interpreterPrompts"
                        // Refiner logic did structured string. Let's just stringify or push logic text.
                        // "Format the output... Join with newlines". So strings.
                        // We'll use a readable format.
                        interpreterPrompts.push(`[Rule: ${ruleset.name}] Logic: ${JSON.stringify(instr)}`);
                    }
                    if (def.ai_instructions.mas1_action_parser) { // Legacy/Alt key
                        interpreterPrompts.push(`[Rule: ${ruleset.name}] Parser: ${JSON.stringify(def.ai_instructions.mas1_action_parser)}`);
                    }

                    // Narrator
                    if (def.ai_instructions.mas2_narrator) {
                        const instr = def.ai_instructions.mas2_narrator;
                        narratorPrompts.push(`[Style: ${ruleset.name}] ${JSON.stringify(instr)}`);
                    }
                }
            }

            // 4. Format Output
            const prompt_interpreter_logic = interpreterPrompts.join('\n');
            const prompt_narrator_style = narratorPrompts.join('\n');
            const config_engine = actionRegistry; // "Wrap actionRegistry" - implied as the main object or property? 
            // Phase 1 schema has config_engine as JSONB. schema usually has { actions, state_schema }.
            // Prompt says "config_engine = Wrap actionRegistry". 
            // I'll stick to expected { actions: actionRegistry, state_schema: ... } to be safe/compatible with types.

            const finalEngineConfig = {
                actions: actionRegistry,
                state_schema: {
                    tier1_entity: entitySchema,
                    tier1_world: worldSchema
                }
            };

            // Snapshots
            // Snapshots
            const snapshotWorld = await SnapshotManager.fetchWorld(story.world_id);
            const snapshotEntities = await SnapshotManager.fetchEntities(story.cast_ids || []);

            // 5. Database Write
            // Calculate next version
            const { data: maxVerRoot } = await supabase
                .from('chimera_compiled_stories')
                .select('version')
                .eq('world_id', story.world_id)
                .order('version', { ascending: false })
                .limit(1)
                .single();

            const nextVersion = (maxVerRoot?.version || 0) + 1;

            // Upsert into chimera_compiled_stories where story_id matches
            let compiledId = story.current_compiled_id;

            if (compiledId) {
                // Update
                const { error: updateError } = await supabase
                    .from('chimera_compiled_stories')
                    .update({
                        version: nextVersion,
                        config_engine: finalEngineConfig,
                        prompt_interpreter_logic,
                        prompt_narrator_style,
                        snapshot_world: snapshotWorld,
                        snapshot_entities: snapshotEntities,
                        created_at: new Date().toISOString()
                    })
                    .eq('id', compiledId);

                if (updateError) throw new Error(`Upsert failed: ${updateError.message}`);
            } else {
                // Insert
                const { data: newRow, error: insertError } = await supabase
                    .from('chimera_compiled_stories')
                    .insert({
                        story_id: storyId,
                        world_id: story.world_id, // Ensure world_id is set
                        version: nextVersion,
                        config_engine: finalEngineConfig,
                        prompt_interpreter_logic,
                        prompt_narrator_style,
                        snapshot_world: snapshotWorld,
                        snapshot_entities: snapshotEntities
                    })
                    .select('id')
                    .single();

                if (insertError) throw new Error(`Insert failed: ${insertError.message}`);
                compiledId = newRow.id;
            }

            // Finalize Story Status
            await supabase
                .from('chimera_stories')
                .update({
                    compile_status: 'compiled',
                    current_compiled_id: compiledId,
                    status: 'bound'
                })
                .eq('id', storyId);

            console.log(`[Compiler V2] Success. Cartridge ID: ${compiledId}`);

        } catch (error: any) {
            console.error(`[Compiler V2] Compilation Failed:`, error);
            // Update Status to Error
            await supabase
                .from('chimera_stories')
                .update({ compile_status: 'error' })
                .eq('id', storyId);

            throw error; // Propagate to controller
        }
    }
}
