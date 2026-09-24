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

                // ===== DEBUG: Template Fetch =====
                console.log(`\n[DEBUG] ===== TEMPLATE FETCH DEBUG =====`);
                for (const rawRuleset of rawRulesets) {
                    console.log(`[DEBUG] Processing Ruleset ID: ${rawRuleset.id}`);
                    console.log(`[DEBUG] Ruleset Key: ${rawRuleset.key || 'N/A'}`);
                    console.log(`[DEBUG] Ruleset Name: ${rawRuleset.name || 'N/A'}`);
                    
                    // CRITICAL: Log raw definition from DB
                    const rawDefinition = rawRuleset.definition;
                    console.log(`[DEBUG] Raw definition type: ${typeof rawDefinition}`);
                    console.log(`[DEBUG] Raw definition (first 500 chars):`, 
                        typeof rawDefinition === 'string' 
                            ? rawDefinition.substring(0, 500) 
                            : JSON.stringify(rawDefinition).substring(0, 500));
                    
                    // Check if actions exist in raw definition
                    const parsedDef = ensureObject(rawDefinition);
                    if (parsedDef && parsedDef.actions) {
                        const actionKeys = Object.keys(parsedDef.actions);
                        console.log(`[DEBUG] ✅ Actions found in raw definition:`, actionKeys);
                        console.log(`[DEBUG] Action count: ${actionKeys.length}`);
                        
                        // Specifically check for npc-relationships actions
                        if (rawRuleset.key === 'npc-relationships' || rawRuleset.name?.includes('relationship')) {
                            console.log(`[DEBUG] 🔍 NPC-RELATIONSHIPS DETECTED! Checking for apply_relationship_delta...`);
                            if (actionKeys.includes('apply_relationship_delta')) {
                                console.log(`[DEBUG] ✅ apply_relationship_delta FOUND in raw definition!`);
                                console.log(`[DEBUG] Full action definition:`, JSON.stringify(parsedDef.actions.apply_relationship_delta, null, 2));
                            } else {
                                console.log(`[DEBUG] ❌ apply_relationship_delta NOT FOUND in raw definition!`);
                                console.log(`[DEBUG] Available action keys:`, actionKeys);
                            }
                        }
                    } else {
                        console.log(`[DEBUG] ⚠️ No actions found in raw definition`);
                        console.log(`[DEBUG] Definition keys:`, parsedDef ? Object.keys(parsedDef) : 'null/undefined');
                    }
                    console.log(`[DEBUG] ---`);
                }
                console.log(`[DEBUG] ===== END TEMPLATE FETCH DEBUG =====\n`);

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

                // ===== DEBUG: Post-Parse Verification =====
                console.log(`\n[DEBUG] ===== POST-PARSE VERIFICATION =====`);
                for (const ruleset of rulesets) {
                    const def = ruleset.definition || {};
                    if (def.actions) {
                        const actionKeys = Object.keys(def.actions);
                        console.log(`[DEBUG] Post-parse Ruleset ${ruleset.id} (${ruleset.key || ruleset.name}): ${actionKeys.length} actions`);
                        console.log(`[DEBUG] Action keys:`, actionKeys);
                    }
                }
                console.log(`[DEBUG] ===== END POST-PARSE VERIFICATION =====\n`);

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

            // ===== SPLIT CARTRIDGE INTO 4 SPECIALIZED COLUMNS =====
            // config_mechanics: Strictly logic and math for the Deterministic Engine
            const configMechanics = {
                runtime: {
                    actions: cartridge.runtime?.actions || {},
                    schema: cartridge.runtime?.schema || {},
                    logic: cartridge.runtime?.logic || {},
                    state_defaults: cartridge.runtime?.state_defaults || {}
                }
            };

            // config_interpreter: MAS-1 (Intent Parsing) configuration
            const interpreterConfig = InterpreterRefiner.extractConfig(rulesets);
            const configInterpreter = {
                runtime: {
                    logic: {
                        intents: interpreterConfig.intents,
                        constraints: interpreterConfig.constraints
                    }
                },
                active_rulesets: rulesets.map(r => ({
                    id: r.id,
                    key: r.key,
                    mas1_interpreter: r.definition?.ai_instructions?.mas1_interpreter,
                    mas1_action_parser: r.definition?.ai_instructions?.mas1_action_parser
                }))
            };

            // config_narrator: MAS-2 (Storytelling) configuration
            const configNarrator = {
                active_rulesets: rulesets.map(r => ({
                    id: r.id,
                    key: r.key,
                    ai_instructions: r.definition?.ai_instructions || {}
                }))
            };

            // config_ui: Frontend (Forms/Manifests) configuration
            const configUI = {
                creation_manifest: creationManifest,
                active_rulesets: rulesets.map(r => ({
                    id: r.id,
                    key: r.key,
                    description: r.definition?.description,
                    ui_category: r.ui_category,
                    name: r.definition?.name || r.name
                }))
            };

            // ===== DEBUG: Serialization (Before Save) =====
            console.log(`\n[DEBUG] ===== SERIALIZATION DEBUG (Before Save) =====`);
            console.log(`[DEBUG] Config Mechanics type:`, typeof configMechanics);
            console.log(`[DEBUG] Config Mechanics keys:`, Object.keys(configMechanics));
            
            if (configMechanics.runtime && configMechanics.runtime.actions) {
                const finalActions = configMechanics.runtime.actions;
                console.log(`[DEBUG] Final config_mechanics.runtime.actions count: ${Object.keys(finalActions).length}`);
                console.log(`[DEBUG] Final config_mechanics.runtime.actions keys:`, Object.keys(finalActions));
                
                // Check for specific actions
                if (finalActions.apply_relationship_delta) {
                    console.log(`[DEBUG] ✅ apply_relationship_delta present in final config_mechanics`);
                } else {
                    console.error(`[DEBUG] ❌ apply_relationship_delta MISSING from final config_mechanics!`);
                }
                if (finalActions.resolve_clash) {
                    console.log(`[DEBUG] ✅ resolve_clash present in final config_mechanics`);
                } else {
                    console.warn(`[DEBUG] ⚠️ resolve_clash not found (may not be in source)`);
                }
                
                // Log a sample of the serialized data
                const serializedSample = JSON.stringify(configMechanics).substring(0, 1000);
                console.log(`[DEBUG] Serialized config_mechanics (first 1000 chars):`, serializedSample);
            } else {
                console.error(`[DEBUG] ❌ config_mechanics.runtime.actions is missing!`);
                console.log(`[DEBUG] Config Mechanics structure:`, JSON.stringify(configMechanics, null, 2).substring(0, 500));
            }
            console.log(`[DEBUG] ===== END SERIALIZATION DEBUG =====\n`);

            const { data: compiledStory, error: insertError } = await supabase
                .from('chimera_compiled_stories')
                .insert({
                    story_id: storyId,
                    version: nextVersion,
                    is_active: true,
                    ruleset_ids: targetRulesetIds,
                    entity_ids: snapshotEntities.map(e => e.id),
                    // New specialized columns
                    config_mechanics: configMechanics,
                    config_interpreter: configInterpreter,
                    config_narrator: configNarrator,
                    config_ui: configUI,
                    // Legacy columns (deprecated, kept for compatibility)
                    config_engine: cartridge,
                    prompt_interpreter_logic: interpreterPrompt,
                    prompt_narrator_style: narratorPrompt,
                    creation_manifest: creationManifest,
                    snapshot_world: worldSnapshot,
                    snapshot_entities: snapshotEntities,
                    genesis_config: story.genesis_config || {}
                })
                .select('id')
                .single();

            if (insertError) {
                console.error(`[Compiler V3] Failed to save to chimera_compiled_stories:`, insertError);
                throw new Error(`Failed to save compiled story: ${insertError?.message}`);
            }

            if (!compiledStory?.id) {
                throw new Error(`Failed to save compiled story: No ID returned from insert`);
            }

            console.log(`[Compiler V3] Successfully saved compiled story. Key: ${storyId}, ID: ${compiledStory.id}`);

            // ===== CRITICAL: Read-After-Write Integrity Check =====
            console.log(`\n[INTEGRITY] ===== READ-AFTER-WRITE VERIFICATION =====`);
            console.log(`[INTEGRITY] Fetching saved record to verify persistence...`);
            
            // CRITICAL: Use a fresh query that bypasses any ORM cache
            // Use a direct query with a small delay to ensure DB commit
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay for DB commit
            
            const { data: fetchedRecord, error: fetchError } = await supabase
                .from('chimera_compiled_stories')
                .select('config_mechanics, id')
                .eq('id', compiledStory.id)
                .single();

            if (fetchError) {
                console.error(`[INTEGRITY] ❌ Failed to fetch saved record:`, fetchError);
                throw new Error(`CRITICAL: Cannot verify database integrity - fetch failed: ${fetchError.message}`);
            }

            if (!fetchedRecord) {
                throw new Error(`CRITICAL: Cannot verify database integrity - record not found after save`);
            }

            console.log(`[INTEGRITY] ✅ Record fetched successfully. Verifying data integrity...`);

            // Parse the saved config_mechanics
            const savedConfigMechanics = ensureObject(fetchedRecord.config_mechanics);
            const inputConfigMechanics = configMechanics;

            // Extract actions from both
            const inputActions = inputConfigMechanics?.runtime?.actions || {};
            const savedActions = savedConfigMechanics?.runtime?.actions || {};

            const inputActionKeys = Object.keys(inputActions);
            const savedActionKeys = Object.keys(savedActions);

            console.log(`[INTEGRITY] Input actions count: ${inputActionKeys.length}`);
            console.log(`[INTEGRITY] Input action keys:`, inputActionKeys);
            console.log(`[INTEGRITY] Saved actions count: ${savedActionKeys.length}`);
            console.log(`[INTEGRITY] Saved action keys:`, savedActionKeys);

            // Check for specific keys - CRITICAL: resolve_clash must be present
            const criticalKeys = ['resolve_clash', 'apply_relationship_delta', 'propose_relationship_arc'];
            const missingKeys: string[] = [];

            for (const key of criticalKeys) {
                if (inputActionKeys.includes(key) && !savedActionKeys.includes(key)) {
                    missingKeys.push(key);
                    console.error(`[INTEGRITY] ❌ CRITICAL: Key "${key}" present in input but MISSING from saved record!`);
                } else if (inputActionKeys.includes(key) && savedActionKeys.includes(key)) {
                    console.log(`[INTEGRITY] ✅ Key "${key}" verified in saved record`);
                } else if (key === 'resolve_clash' && !inputActionKeys.includes(key)) {
                    console.warn(`[INTEGRITY] ⚠️ Warning: Key "${key}" not found in input (may not be in source rulesets)`);
                }
            }

            // Compare counts
            if (inputActionKeys.length !== savedActionKeys.length) {
                const missingCount = inputActionKeys.length - savedActionKeys.length;
                console.error(`[INTEGRITY] ❌ Action count mismatch! Input: ${inputActionKeys.length}, Saved: ${savedActionKeys.length}`);
                console.error(`[INTEGRITY] Missing ${missingCount} action(s)`);

                // Find which keys are missing
                const missingActionKeys = inputActionKeys.filter(key => !savedActionKeys.includes(key));
                console.error(`[INTEGRITY] Missing action keys:`, missingActionKeys);
                missingKeys.push(...missingActionKeys);
            }

            // Log evidence for debugging
            const inputString = JSON.stringify(inputConfigMechanics);
            const savedString = JSON.stringify(savedConfigMechanics);
            const inputLength = inputString.length;
            const savedLength = savedString.length;

            console.log(`[INTEGRITY] Input config_mechanics string length: ${inputLength}`);
            console.log(`[INTEGRITY] Saved config_mechanics string length: ${savedLength}`);
            console.log(`[INTEGRITY] Length difference: ${inputLength - savedLength} bytes`);

            if (savedLength < inputLength) {
                console.error(`[INTEGRITY] ⚠️ WARNING: Saved data is ${inputLength - savedLength} bytes SHORTER than input!`);
                console.error(`[INTEGRITY] This suggests data truncation or loss during persistence.`);
            }

            // Throw on corruption
            if (missingKeys.length > 0 || inputActionKeys.length !== savedActionKeys.length) {
                const errorMessage = [
                    `CRITICAL PERSISTENCE FAILURE: Database dropped keys during save operation.`,
                    `Missing Keys: [${missingKeys.join(', ')}]`,
                    `Input Actions Count: ${inputActionKeys.length}`,
                    `Saved Actions Count: ${savedActionKeys.length}`,
                    `Input String Length: ${inputLength} bytes`,
                    `Saved String Length: ${savedLength} bytes`,
                    `Length Difference: ${inputLength - savedLength} bytes`,
                    `Compiled Story ID: ${compiledStory.id}`,
                    `Story ID: ${storyId}`,
                    `Version: ${nextVersion}`,
                    ``,
                    `This indicates a critical database integrity issue.`,
                    `The data was present before save but missing after save.`,
                    `Possible causes:`,
                    `  1. Database column size limit (JSONB truncation)`,
                    `  2. Database trigger or constraint dropping keys`,
                    `  3. ORM/Driver serialization issue`,
                    `  4. Database-level validation stripping unknown keys`
                ].join('\n');

                console.error(`\n[INTEGRITY] ===== CORRUPTION DETECTED =====`);
                console.error(errorMessage);
                console.error(`[INTEGRITY] Input action keys:`, inputActionKeys);
                console.error(`[INTEGRITY] Saved action keys:`, savedActionKeys);
                console.error(`[INTEGRITY] ===== END CORRUPTION REPORT =====\n`);

                throw new Error(errorMessage);
            }

            console.log(`[INTEGRITY] ✅ Integrity check passed! All actions verified.`);
            console.log(`[INTEGRITY] ===== END READ-AFTER-WRITE VERIFICATION =====\n`);

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

