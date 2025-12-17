import { createClient } from '@supabase/supabase-js';
import { EngineRefiner } from './refiners/engine.refiner';
import { InterpreterRefiner } from './refiners/interpreter.refiner';
import { NarratorRefiner } from './refiners/narrator.refiner';
import { SnapshotManager } from './refiners/snapshot.manager';

// Ensure we have environment variables
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Story Compiler Service
 * Orchestrates the transformation of raw Story/World/Ruleset data into a deterministic "Cartridge".
 */
export class StoryCompilerService {

    /**
     * Compile a Story
     * 1. Fetches data
     * 2. Runs Refiners (Engine, Interpreter, Narrator)
     * 3. Creates Snapshots
     * 4. Saves to chimera_compiled_stories
     */
    static async compileStory(storyId: string, userId: string): Promise<{ success: boolean; compiledId: string }> {
        console.log(`[Compile] Starting compilation for Story ${storyId} (User: ${userId})`);

        try {
            // 1. Status Update: 'compiling'
            await supabase
                .from('chimera_stories')
                .update({ compile_status: 'compiling' })
                .eq('id', storyId);

            // 2. Fetch Story Data & Ownership Verification
            const { data: story, error: storyError } = await supabase
                .from('chimera_stories')
                .select('*')
                .eq('id', storyId)
                .single();

            if (storyError || !story) {
                throw new Error(`Story not found or access denied: ${storyId}`);
            }

            // TODO: strict owner check if needed, relying on Row Level Security or explicit check here if userId passed
            // For now, assuming service role bypasses or strict check is handled by caller/RLS, 
            // but prompt says "Verify ownership". 
            // Since we are using service role key in this file usually, we should manually check if we want enforcement.
            // Let's assume the route ensures userId requests it, but we can double check if story has owner_id.
            if (story.owner_id && story.owner_id !== userId) {
                throw new Error(`User ${userId} does not own story ${storyId}`);
            }

            // 3. Resolve Ruleset IDs
            // Priority: Story-specific rulesets -> World default rulesets
            let rulesetIds: string[] = story.active_ruleset_ids;

            if (!rulesetIds || rulesetIds.length === 0) {
                // Fallback to World
                const { data: world, error: worldError } = await supabase
                    .from('chimera_worlds')
                    .select('ruleset_template_ids')
                    .eq('id', story.world_id)
                    .single();

                if (!worldError && world) {
                    rulesetIds = world.ruleset_template_ids || [];
                }
            }

            if (!rulesetIds || rulesetIds.length === 0) {
                throw new Error("No rulesets defined for this story/world.");
            }

            // 4. Fetch Ruleset Definitions
            // We need the raw JSON definitions to pass to refiners
            const { data: rulesets, error: rulesetsError } = await supabase
                .from('chimera_ruleset_templates')
                .select('*')
                .in('id', rulesetIds);

            if (rulesetsError || !rulesets || rulesets.length === 0) {
                throw new Error("Failed to load ruleset definitions.");
            }

            // 5. Refine (The Pipeline)
            console.log(`[Compile] Refining ${rulesets.length} rulesets...`);

            // A. Engine Config (Validation happens here!)
            const engineConfig = EngineRefiner.refine(rulesets);

            // B. System Prompts
            const interpreterPrompt = InterpreterRefiner.refine(rulesets);
            const narratorPrompt = NarratorRefiner.refine(rulesets);

            // C. Snapshots
            const snapshotWorld = await SnapshotManager.fetchWorld(story.world_id);
            const snapshotEntities = await SnapshotManager.fetchEntities(story.cast_ids || []);

            // 6. Save Cartridge
            const { data: compiledStory, error: insertError } = await supabase
                .from('chimera_compiled_stories')
                .insert({
                    story_id: storyId,
                    version: 1, // Simple versioning for now, could query count + 1 later
                    config_engine: engineConfig,
                    prompt_interpreter_logic: interpreterPrompt,
                    prompt_narrator_style: narratorPrompt,
                    snapshot_world: snapshotWorld,
                    snapshot_entities: snapshotEntities,
                })
                .select('id')
                .single();

            if (insertError || !compiledStory) {
                throw new Error(`Failed to save compiled story: ${insertError?.message}`);
            }

            // 7. Finalize Schema
            await supabase
                .from('chimera_stories')
                .update({
                    compile_status: 'compiled',
                    current_compiled_id: compiledStory.id,
                    status: 'bound' // As per instructions "status = 'bound'"
                })
                .eq('id', storyId);

            console.log(`[Compile] Success! Computed ID: ${compiledStory.id}`);

            return {
                success: true,
                compiledId: compiledStory.id
            };

        } catch (error: any) {
            console.error(`[Compile] Error:`, error);

            // Error Handling: Update DB status
            await supabase
                .from('chimera_stories')
                .update({ compile_status: 'error' })
                .eq('id', storyId);

            // Rethrow so Controller can send 400
            throw error;
        }
    }
}
