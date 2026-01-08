
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../db/supabase-client.js';

export class AiAuditService {
    constructor(private supabase: SupabaseClient<Database>) { }

    async linkTurn(traceId: string, turnId: string) {
        if (!traceId || !turnId) return;

        // Link audit log to turn
        // Ensure you match the PK or a known unique field. 
        // If traceId corresponds to the 'id' column:
        const { error } = await this.supabase
            .from('ai_audit_logs')
            .update({ turn_id: turnId })
            .eq('id', traceId);

        if (error) {
            console.warn(`[Audit] Failed to link Turn ${turnId} to Audit ${traceId}: ${error.message}`);
        } else {
            console.log(`[Audit] Linked Turn ${turnId} to Audit ${traceId}`);
        }
    }
}
