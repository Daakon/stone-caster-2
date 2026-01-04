import { createClient } from '@supabase/supabase-js';
import { EngineRefiner } from './refiners/engine.refiner';
import { InterpreterRefiner } from './refiners/interpreter.refiner';
import { NarratorRefiner } from './refiners/narrator.refiner';
import { CreationRefiner } from './refiners/creation.refiner';
import { SnapshotManager } from './refiners/snapshot.manager';
import { RulesetSchema } from './schemas';
import { EntitiesRepository } from '../../db/repos/entities.repo';

// Ensure we have environment variables
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Robust JSON Parser
 * Handles double-encoded strings or standard objects
 */
function ensureObject(input: any): any {
    if (!input) return null;
    if (typeof input === 'object') return input;
    if (typeof input === 'string') {
        try {
            const parsed = JSON.parse(input);
            // Handle double-stringification edge case
            if (typeof parsed === 'string') return JSON.parse(parsed);
            return parsed;
        } catch (e) {
            console.error("Failed to parse input:", input);
            return null;
        }
    }
    return input;
}

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
    static async compileStory(storyId: string, userId: string, entityOverrides?: string[]): Promise<{ success: boolean; compiledId: string }> {
        console.log(`[Compiler V3] 🚀 Starting Compilation for ${storyId} (User: ${userId})`);

        try {
            // 1. Status Update: 'compiling'
            await supabase
                .from('chimera_stories')
                .update({ compile_status: 'compiling' })
                .eq('id', storyId);

            // 2. Fetch Story Data & Ownership Verification
            const { data: story, error: storyError } = await supabase
                .from('chimera_stories')
                .select('*') // Select all fields including genesis_config
                .eq('id', storyId)
                .single();

            if (storyError || !story) {
                throw new Error(`Story not found or access denied: ${storyId}`);
            }

            if (story.owner_id && story.owner_id !== userId) {
                throw new Error(`User ${userId} does not own story ${storyId}`);
            }

            // 3. Fetch & Parse World Snapshot
            const rawWorld = await SnapshotManager.fetchWorld(story.world_id);
            const worldSnapshot = ensureObject(rawWorld); // Use helper at top of file
            const worldDef = ensureObject(worldSnapshot?.definition);

            console.log(`[Compiler V3] World Data Type: ${typeof rawWorld} -> Parsed Object Keys: ${worldDef ? Object.keys(worldDef).length : 0}`);


            // 4. Resolve Ruleset IDs
            let targetRulesetIds: string[] = [];

            if (Array.isArray(story.active_ruleset_ids) && story.active_ruleset_ids.length > 0) {
                console.log(`[Compiler V3] Strategy: Story Overrides (${story.active_ruleset_ids.length} IDs)`);
                targetRulesetIds = story.active_ruleset_ids;
            } else if (worldDef && Array.isArray(worldDef.ruleset_template_ids)) {
                console.log(`[Compiler V3] Strategy: World Defaults (${worldDef.ruleset_template_ids.length} IDs)`);
                targetRulesetIds = worldDef.ruleset_template_ids;
            } else {
                console.warn(`[Compiler V3] ⚠️ No IDs found in Story OR World Definition.`);
            }

            // 5. Fetch Rulesets
            let rulesets: any[] = [];
            if (targetRulesetIds.length === 0) {
                console.warn(`[Compiler V3] ❌ 0 IDs resolved. Skipping DB query.`);
            } else {
                console.log(`[Compiler V3] Querying for ${targetRulesetIds.length} ruleset IDs...`);
                const { data: mysFetchedRulesets, error: rulesError } = await supabase
                    .from('chimera_ruleset_templates')
                    .select('*')
                    .in('id', targetRulesetIds);

                if (rulesError) {
                    console.error(`[Compiler V3] DB Query Failed:`, rulesError);
                    throw rulesError;
                }

                const rawRulesets = mysFetchedRulesets || [];
                console.log(`[Compiler V3] Database returned ${rawRulesets.length} rulesets.`);

                // PARSING FIX & SCHEMA VALIDATION
                rulesets = rawRulesets.map(r => {
                    // Pre-process: ensure definition is an object if string (handled by Zod transform too, but being safe)
                    // Zod Schema handles JSON parsing via transform
                    const result = RulesetSchema.safeParse(r);
                    if (!result.success) {
                        console.warn(`[Compiler V3] ⚠️ Ruleset ${r.id} failed schema validation:`, result.error);
                        // Fallback: try manual ensureObject or return strict failure? 
                        // User instruction says "update to use schemas". failing fast might catch "Unknown Rule".
                        // Let's attempt to use the data we have but warn.
                        r.definition = ensureObject(r.definition) || {};
                        return r;
                    }
                    return result.data;
                });

                if (rulesets.length !== targetRulesetIds.length) {
                    const foundIds = rulesets.map(r => r.id);
                    const missingIds = targetRulesetIds.filter(id => !foundIds.includes(id));
                    console.warn(`[Compiler V3] ⚠️ Mismatch! Missing Rulesets:`, missingIds);
                }
            }

            if (targetRulesetIds.length > 0 && rulesets.length === 0) {
                throw new Error("Critical: Ruleset IDs exist but none were loaded from DB.");
            }

            // 6. Refine (The Pipeline)
            console.log(`[Compiler V3] Refining ${rulesets.length} rulesets...`);

            // A. Engine Config (Master Cartridge)
            const cartridge = EngineRefiner.refine(rulesets);
            // Attach source rulesets for UI hydration
            cartridge.active_rulesets = rulesets;

            // B. System Prompts
            const interpreterPrompt = InterpreterRefiner.process(rulesets);
            const narratorPrompt = NarratorRefiner.refine(rulesets);

            // C. Creation Manifest
            const creationManifest = CreationRefiner.refine(rulesets, 'player');

            // D. Snapshots
            // Resolve Entity IDs: Overrides > DB Column (entity_ids) > Config (Legacy) > cast_ids (Legacy)
            const configIds = ensureObject(story.configuration)?.entityIds;
            const dbEntityIds = (story as any).entity_ids; // New column

            const targetEntityIds: string[] = Array.isArray(entityOverrides) ? entityOverrides :
                (Array.isArray(dbEntityIds) ? dbEntityIds :
                    (Array.isArray(configIds) ? configIds : (story.cast_ids || [])));

            console.log(`[Compiler V3] Resolving Entities: Target Count = ${targetEntityIds.length}`);

            const entitiesRepo = new EntitiesRepository(supabase);
            // Fetch all requested entities
            const fetchedEntities = await entitiesRepo.findByIds(targetEntityIds);

            // Partial Failure Handling: Log missing IDs
            if (fetchedEntities.length !== targetEntityIds.length) {
                const foundIds = new Set(fetchedEntities.map(e => e.id));
                const missingIds = targetEntityIds.filter(id => !foundIds.has(id));
                console.warn(`[Compiler V3] ⚠️ Warning: ${missingIds.length} entities not found:`, missingIds);
            }

            // Map to generic structure for snapshot (Schema Compliance)
            const snapshotEntities = fetchedEntities.map(e => ({
                id: e.id,
                kind: e.kind,
                raw_data: e.raw_data
            }));

            console.log(`[Compiler V3] Snapshot Entities Prepared: ${snapshotEntities.length} entities.`);
            // snapshotWorld is already fetched

            // 7. Calculate Version & Manage Active State
            // Query max version for this story
            const { data: maxVerRow } = await supabase
                .from('chimera_compiled_stories')
                .select('version')
                .eq('story_id', storyId)
                .order('version', { ascending: false })
                .limit(1)
                .single();

            const nextVersion = (maxVerRow?.version || 0) + 1;

            // Deactivate previous versions (if any) - Semantic "latest is active"
            await supabase
                .from('chimera_compiled_stories')
                .update({ is_active: false } as any)
                .eq('story_id', storyId);

            // 8. Save Cartridge (V3 Schema - Split Columns)
            // Note: We use INSERT to create a new versioned record, not UPSERT.
            // Using created_at which is default, no updated_at column
            const { data: compiledStory, error: insertError } = await supabase
                .from('chimera_compiled_stories')
                .insert({
                    story_id: storyId,
                    version: nextVersion,
                    is_active: true,
                    ruleset_ids: targetRulesetIds,
                    entity_ids: snapshotEntities.map(e => e.id),
                    config_engine: cartridge,
                    prompt_interpreter_logic: interpreterPrompt,
                    prompt_narrator_style: narratorPrompt,
                    creation_manifest: creationManifest,
                    snapshot_world: worldSnapshot,
                    snapshot_entities: snapshotEntities,
                    genesis_config: story.genesis_config || {} // <-- Added Persistence Here
                })
                .select('id')
                .single();

            if (insertError) {
                console.error(`[Compiler V3] Failed to save to chimera_compiled_stories:`, insertError);
                throw new Error(`Failed to save compiled story: ${insertError?.message}`);
            }

            console.log(`[Compiler V3] Successfully saved compiled story. Key: ${storyId}, ID: ${compiledStory?.id}`);

            // 9. Finalize Schema
            await supabase
                .from('chimera_stories')
                .update({
                    compile_status: 'compiled',
                    current_compiled_id: compiledStory.id,
                    status: 'bound'
                })
                .eq('id', storyId);

            console.log(`[Compiler V3] ✅ Compilation Complete. Cartridge ID: ${compiledStory.id} (Version: ${nextVersion})`);

            return {
                success: true,
                compiledId: compiledStory.id
            };

        } catch (error: any) {
            console.error(`[Compiler V3] 💥 Fatal Error:`, error);
            await supabase
                .from('chimera_stories')
                .update({ compile_status: 'error' })
                .eq('id', storyId);
            throw error;
        }
    }
}

