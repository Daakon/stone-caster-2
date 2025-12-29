import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../db/supabase-client.js';
import { CompiledStoriesRepository } from '../../db/repos/compiled-stories.repo.js';
import { EngineExecutor } from './engine/executor.js';

interface TurnResult {
    success: boolean;
    state?: any;
    output?: string;
    message?: string;
}

export class GameTurnService {
    private compiledStoriesRepo: CompiledStoriesRepository;

    constructor(private supabase: SupabaseClient<Database>) {
        this.compiledStoriesRepo = new CompiledStoriesRepository(supabase);
    }

    async processTurn(instanceId: string, userIntent: string): Promise<TurnResult> {
        // 1. Load Instance
        const { data: instance, error: instanceError } = await this.supabase
            .from('chimera_instances_v3' as any)
            .select('*')
            .eq('id', instanceId)
            .single();

        if (instanceError || !instance) {
            throw new Error(`Instance not found: ${instanceId}`);
        }

        if (instance.status !== 'active') {
            return { success: false, message: 'Game is not active' };
        }

        // 2. Load Cartridge
        const compiledStory = await this.compiledStoriesRepo.findById(instance.compiled_story_id);
        if (!compiledStory) {
            throw new Error('Compiled story not found');
        }
        const cartridge = compiledStory as any;
        const engineConfig = cartridge.config_engine || {};
        const logicConfig = engineConfig.runtime?.logic || {};

        // 3. Intent Resolution
        // Map userIntent (string from UI button) to a Trigger ID via intents map
        // If userIntent IS the trigger (or no map exists), we use it directly.
        // Assuming userIntent is the key like "rest" or "attack".

        let triggerId = userIntent;
        const intentMap = logicConfig.intents || {};

        // If intentMap has this key, it might map to a specific trigger or action ID.
        // For MVP, if the intent map exists, we check if it's there.
        // The prompt says: "Does userIntent match a key? If yes, get trigger_id".
        if (intentMap[userIntent]) {
            triggerId = intentMap[userIntent];
        } else {
            // If implicit intents are allowed, we proceed. Strict mode might reject.
            // Continuing for now.
        }

        // 4. Action Lookup
        const actions = engineConfig.actions || {};
        const actionDef = actions[triggerId];

        if (!actionDef) {
            return { success: false, message: `Unknown action: ${triggerId}` };
        }

        // 5. Constraint Check
        // (Skipped for MVP or very basic check could go here)
        // logicConfig.constraints iteration...

        // 6. Execution
        const currentState = instance.current_state;
        const schema = engineConfig.state_schema || {};

        let newState;
        try {
            newState = EngineExecutor.executeAction(currentState, actionDef, schema);
        } catch (execError: any) {
            console.error(`[TurnService] Execution failed:`, execError);
            return { success: false, message: `Execution error: ${execError.message}` };
        }

        // 7. Persist
        // Update turn count, event log, state
        const newTurnCount = (instance.turn_count || 0) + 1;

        // Append to event log
        // The event log update might be heavy if array is huge, ensuring we just append.
        // Supabase/Postgres specific logic might be better (jsonb_insert), but doing full update for now.
        const newEvent = {
            turn: newTurnCount,
            type: 'action',
            trigger: triggerId,
            text: `Executed ${triggerId}`, // Narrator would generate text here normally
            timestamp: new Date().toISOString()
        };

        // If event_log is an array object in JSONB
        const eventLog = Array.isArray(instance.event_log) ? [...instance.event_log, newEvent] : [newEvent];

        const { error: updateError } = await this.supabase
            .from('chimera_instances_v3' as any)
            .update({
                current_state: newState,
                turn_count: newTurnCount,
                event_log: eventLog,
                updated_at: new Date().toISOString()
            })
            .eq('id', instanceId);

        if (updateError) {
            throw new Error(`Failed to save turn: ${updateError.message}`);
        }

        return {
            success: true,
            state: newState,
            output: `Action ${triggerId} executed.`
        };
    }
}
