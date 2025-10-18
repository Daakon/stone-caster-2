// Phase 25: Quota System
// Decrementing tokens per feature bucket with admin overrides

import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Quota configuration schemas
const QuotaConfigSchema = z.object({
  user_hash: z.string().optional(),
  session_id: z.string().optional(),
  daily_turn_cap: z.number().min(1),
  tool_cap: z.number().min(1),
  bytes_cap: z.number().min(1),
});

const QuotaCheckSchema = z.object({
  quota_type: z.enum(['turns', 'tools', 'bytes']),
  amount: z.number().min(1),
});

const QuotaResultSchema = z.object({
  allowed: z.boolean(),
  remaining: z.number(),
  reset_time: z.number(),
  quota_type: z.string(),
});

export class QuotaManager {
  private static instance: QuotaManager;
  private defaultQuotas: Record<string, number> = {
    daily_turn_cap: parseInt(process.env.OPS_DAILY_TURN_CAP || '1000'),
    tool_cap: parseInt(process.env.OPS_TOOL_CAP || '100'),
    bytes_cap: parseInt(process.env.OPS_BYTES_CAP || '10485760'), // 10MB
  };

  constructor() {
    this.loadDefaultQuotas();
  }

  static getInstance(): QuotaManager {
    if (!QuotaManager.instance) {
      QuotaManager.instance = new QuotaManager();
    }
    return QuotaManager.instance;
  }

  private loadDefaultQuotas(): void {
    // Load from environment variables
    if (process.env.OPS_DAILY_TURN_CAP) {
      this.defaultQuotas.daily_turn_cap = parseInt(process.env.OPS_DAILY_TURN_CAP);
    }
    if (process.env.OPS_TOOL_CAP) {
      this.defaultQuotas.tool_cap = parseInt(process.env.OPS_TOOL_CAP);
    }
    if (process.env.OPS_BYTES_CAP) {
      this.defaultQuotas.bytes_cap = parseInt(process.env.OPS_BYTES_CAP);
    }
  }

  /**
   * Check if quota allows the requested amount
   */
  async checkQuota(
    user_hash: string | null,
    session_id: string | null,
    quota_type: 'turns' | 'tools' | 'bytes',
    amount: number
  ): Promise<z.infer<typeof QuotaResultSchema>> {
    try {
      if (!user_hash && !session_id) {
        throw new Error('Either user_hash or session_id must be provided');
      }

      // Use database function for quota checking
      const { data, error } = await supabase.rpc('check_quota', {
        p_user_hash: user_hash,
        p_session_id: session_id,
        p_quota_type: quota_type,
        p_amount: amount,
      });

      if (error) throw error;

      const allowed = data as boolean;
      
      // Get current quota status
      const quotaStatus = await this.getQuotaStatus(user_hash, session_id);
      const remaining = quotaStatus ? quotaStatus[`remaining_${quota_type}`] : 0;
      const reset_time = quotaStatus ? new Date(quotaStatus.resets_at).getTime() : Date.now() + 24 * 60 * 60 * 1000;

      return {
        allowed,
        remaining,
        reset_time,
        quota_type,
      };
    } catch (error) {
      console.error('Quota check failed:', error);
      // Fail open - allow request if quota checking fails
      return {
        allowed: true,
        remaining: 999,
        reset_time: Date.now() + 24 * 60 * 60 * 1000,
        quota_type,
      };
    }
  }

  /**
   * Check multiple quotas simultaneously
   */
  async checkMultipleQuotas(
    user_hash: string | null,
    session_id: string | null,
    checks: Array<{ quota_type: 'turns' | 'tools' | 'bytes'; amount: number }>
  ): Promise<Array<z.infer<typeof QuotaResultSchema>>> {
    const promises = checks.map(check => 
      this.checkQuota(user_hash, session_id, check.quota_type, check.amount)
    );
    
    return Promise.all(promises);
  }

  /**
   * Get current quota status
   */
  async getQuotaStatus(
    user_hash: string | null,
    session_id: string | null
  ): Promise<{
    daily_turn_cap: number;
    tool_cap: number;
    bytes_cap: number;
    current_turns: number;
    current_tools: number;
    current_bytes: number;
    remaining_turns: number;
    remaining_tools: number;
    remaining_bytes: number;
    resets_at: string;
  } | null> {
    try {
      const { data, error } = await supabase
        .from('awf_quotas')
        .select('*')
        .or(`user_hash.eq.${user_hash},session_id.eq.${session_id}`)
        .single();

      if (error) throw error;
      if (!data) return null;

      return {
        daily_turn_cap: data.daily_turn_cap,
        tool_cap: data.tool_cap,
        bytes_cap: data.bytes_cap,
        current_turns: data.current_turns,
        current_tools: data.current_tools,
        current_bytes: data.current_bytes,
        remaining_turns: Math.max(0, data.daily_turn_cap - data.current_turns),
        remaining_tools: Math.max(0, data.tool_cap - data.current_tools),
        remaining_bytes: Math.max(0, data.bytes_cap - data.current_bytes),
        resets_at: data.resets_at,
      };
    } catch (error) {
      console.error('Failed to get quota status:', error);
      return null;
    }
  }

  /**
   * Create or update quota for user/session
   */
  async setQuota(
    user_hash: string | null,
    session_id: string | null,
    quotas: {
      daily_turn_cap?: number;
      tool_cap?: number;
      bytes_cap?: number;
    }
  ): Promise<boolean> {
    try {
      if (!user_hash && !session_id) {
        throw new Error('Either user_hash or session_id must be provided');
      }

      const { error } = await supabase
        .from('awf_quotas')
        .upsert({
          user_hash,
          session_id,
          daily_turn_cap: quotas.daily_turn_cap || this.defaultQuotas.daily_turn_cap,
          tool_cap: quotas.tool_cap || this.defaultQuotas.tool_cap,
          bytes_cap: quotas.bytes_cap || this.defaultQuotas.bytes_cap,
          current_turns: 0,
          current_tools: 0,
          current_bytes: 0,
          resets_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }, {
          onConflict: 'user_hash,session_id'
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to set quota:', error);
      return false;
    }
  }

  /**
   * Reset quota for user/session
   */
  async resetQuota(
    user_hash: string | null,
    session_id: string | null
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('awf_quotas')
        .update({
          current_turns: 0,
          current_tools: 0,
          current_bytes: 0,
          resets_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .or(`user_hash.eq.${user_hash},session_id.eq.${session_id}`);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to reset quota:', error);
      return false;
    }
  }

  /**
   * Get quota statistics
   */
  async getQuotaStats(): Promise<{
    total_quotas: number;
    by_type: {
      turns: { total_cap: number; total_used: number; avg_usage: number };
      tools: { total_cap: number; total_used: number; avg_usage: number };
      bytes: { total_cap: number; total_used: number; avg_usage: number };
    };
    top_users: Array<{
      user_hash: string;
      session_id: string;
      turns_usage: number;
      tools_usage: number;
      bytes_usage: number;
    }>;
  }> {
    try {
      const { data: allQuotas, error } = await supabase
        .from('awf_quotas')
        .select('*');

      if (error) throw error;

      const by_type = {
        turns: { total_cap: 0, total_used: 0, avg_usage: 0 },
        tools: { total_cap: 0, total_used: 0, avg_usage: 0 },
        bytes: { total_cap: 0, total_used: 0, avg_usage: 0 },
      };

      const top_users: Array<{
        user_hash: string;
        session_id: string;
        turns_usage: number;
        tools_usage: number;
        bytes_usage: number;
      }> = [];

      for (const quota of allQuotas || []) {
        by_type.turns.total_cap += quota.daily_turn_cap;
        by_type.turns.total_used += quota.current_turns;
        by_type.tools.total_cap += quota.tool_cap;
        by_type.tools.total_used += quota.current_tools;
        by_type.bytes.total_cap += quota.bytes_cap;
        by_type.bytes.total_used += quota.current_bytes;

        const total_usage = quota.current_turns + quota.current_tools + (quota.current_bytes / 1024);
        if (total_usage > 0) {
          top_users.push({
            user_hash: quota.user_hash || '',
            session_id: quota.session_id || '',
            turns_usage: quota.current_turns,
            tools_usage: quota.current_tools,
            bytes_usage: quota.current_bytes,
          });
        }
      }

      // Calculate averages
      const quotaCount = allQuotas?.length || 1;
      by_type.turns.avg_usage = by_type.turns.total_used / quotaCount;
      by_type.tools.avg_usage = by_type.tools.total_used / quotaCount;
      by_type.bytes.avg_usage = by_type.bytes.total_used / quotaCount;

      return {
        total_quotas: allQuotas?.length || 0,
        by_type,
        top_users: top_users.sort((a, b) => (b.turns_usage + b.tools_usage + b.bytes_usage) - (a.turns_usage + a.tools_usage + a.bytes_usage)).slice(0, 10),
      };
    } catch (error) {
      console.error('Failed to get quota stats:', error);
      return {
        total_quotas: 0,
        by_type: {
          turns: { total_cap: 0, total_used: 0, avg_usage: 0 },
          tools: { total_cap: 0, total_used: 0, avg_usage: 0 },
          bytes: { total_cap: 0, total_used: 0, avg_usage: 0 },
        },
        top_users: [],
      };
    }
  }

  /**
   * Clean up expired quotas
   */
  async cleanupExpiredQuotas(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('awf_quotas')
        .delete()
        .lt('resets_at', new Date().toISOString())
        .select('id');

      if (error) throw error;
      return data?.length || 0;
    } catch (error) {
      console.error('Failed to cleanup expired quotas:', error);
      return 0;
    }
  }

  /**
   * Get default quota configuration
   */
  getDefaultQuotas(): Record<string, number> {
    return { ...this.defaultQuotas };
  }

  /**
   * Update default quota configuration
   */
  updateDefaultQuotas(quotas: Partial<Record<string, number>>): void {
    this.defaultQuotas = { ...this.defaultQuotas, ...quotas };
  }
}

export const quotaManager = QuotaManager.getInstance();
