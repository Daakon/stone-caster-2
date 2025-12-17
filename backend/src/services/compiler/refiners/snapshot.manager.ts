import { createClient } from '@supabase/supabase-js';

// We need a server-side client. Usually this is available via a config or we create one.
// Assuming we can use the standard env vars or a shared client if available.
// For now, consistent with other services, we'll instantiate if needed or use a robust pattern.
// However, the prompt asks for specific methods.

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Snapshot Manager
 * Creates deep copies of World and Entity data for the compiled story.
 */
export class SnapshotManager {

    /**
     * Fetch the raw world row
     */
    static async fetchWorld(worldId: string): Promise<Record<string, any>> {
        if (!worldId) return {};

        const { data, error } = await supabase
            .from('chimera_worlds')
            .select('*')
            .eq('id', worldId)
            .single();

        if (error) {
            console.error('SnapshotManager Error fetching world:', error);
            throw new Error(`Failed to fetch world ${worldId}`);
        }

        return data || {};
    }

    /**
     * Fetch the array of entity rows
     */
    static async fetchEntities(castIds: string[]): Promise<Record<string, any>[]> {
        if (!castIds || castIds.length === 0) return [];

        const { data, error } = await supabase
            .from('chimera_entities')
            .select('*')
            .in('id', castIds);

        if (error) {
            console.error('SnapshotManager Error fetching entities:', error);
            throw new Error(`Failed to fetch entities`);
        }

        return data || [];
    }
}
