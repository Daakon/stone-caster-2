// Phase 26: Moderation Service
// Handles reports, takedowns, and moderation workflows

import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validation schemas
const ReportSchema = z.object({
  namespace: z.string(),
  version: z.string().optional(),
  reporter_hash: z.string(),
  reason: z.enum(['spam', 'inappropriate', 'malware', 'copyright', 'other']),
  details: z.object({
    description: z.string().min(10).max(1000),
    evidence_urls: z.array(z.string().url()).optional(),
    additional_info: z.string().max(500).optional()
  })
});

const ModerationActionSchema = z.object({
  report_id: z.string().uuid(),
  action: z.enum(['warn', 'delist', 'decertify', 'dismiss']),
  moderator_id: z.string().uuid(),
  resolution_notes: z.string().min(10).max(1000),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional()
});

const TakedownSchema = z.object({
  namespace: z.string(),
  version: z.string().optional(),
  reason: z.string().min(10).max(500),
  takedown_type: z.enum(['delist', 'decertify', 'full_removal']),
  moderator_id: z.string().uuid(),
  notify_creator: z.boolean().default(true)
});

export interface ModReport {
  report_id: string;
  namespace: string;
  version?: string;
  reporter_hash: string;
  reason: string;
  details: {
    description: string;
    evidence_urls?: string[];
    additional_info?: string;
  };
  status: 'open' | 'triage' | 'resolved' | 'rejected';
  action: 'none' | 'warn' | 'delist' | 'decertify';
  assigned_to?: string;
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

export interface ModerationAction {
  action_id: string;
  report_id: string;
  action: string;
  moderator_id: string;
  resolution_notes: string;
  severity?: string;
  created_at: string;
}

export interface TakedownAction {
  takedown_id: string;
  namespace: string;
  version?: string;
  reason: string;
  takedown_type: string;
  moderator_id: string;
  creator_notified: boolean;
  created_at: string;
}

export interface ModerationStats {
  total_reports: number;
  open_reports: number;
  resolved_reports: number;
  rejected_reports: number;
  actions_taken: {
    warn: number;
    delist: number;
    decertify: number;
  };
  avg_resolution_time_hours: number;
}

export class ModerationService {
  private supabase: any;

  constructor() {
    this.supabase = supabase;
  }

  /**
   * Submit a report
   */
  async submitReport(
    data: z.infer<typeof ReportSchema>
  ): Promise<{
    success: boolean;
    data?: { report_id: string };
    error?: string;
  }> {
    try {
      const validated = ReportSchema.parse(data);
      
      // Check if pack exists
      if (validated.version) {
        const { data: packData, error: packError } = await this.supabase
          .from('mod_pack_registry')
          .select('namespace, version, status')
          .eq('namespace', validated.namespace)
          .eq('version', validated.version)
          .single();

        if (packError) {
          throw new Error(`Pack not found: ${packError.message}`);
        }
      } else {
        // Check if namespace exists
        const { data: namespaceData, error: namespaceError } = await this.supabase
          .from('creator_namespaces')
          .select('namespace')
          .eq('namespace', validated.namespace)
          .single();

        if (namespaceError) {
          throw new Error(`Namespace not found: ${namespaceError.message}`);
        }
      }

      // Create report
      const { data: reportData, error: reportError } = await this.supabase
        .from('mod_reports')
        .insert({
          namespace: validated.namespace,
          version: validated.version,
          reporter_hash: validated.reporter_hash,
          reason: validated.reason,
          details: validated.details,
          status: 'open'
        })
        .select('report_id')
        .single();

      if (reportError) {
        throw new Error(`Failed to create report: ${reportError.message}`);
      }

      // Log report creation
      await this.logModerationAction({
        action: 'report_created',
        report_id: reportData.report_id,
        moderator_id: 'system',
        resolution_notes: `Report created for ${validated.namespace}${validated.version ? `@${validated.version}` : ''}`
      });

      return {
        success: true,
        data: { report_id: reportData.report_id }
      };
    } catch (error) {
      console.error('Report submission failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get reports (admin only)
   */
  async getReports(
    status?: string,
    assigned_to?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    success: boolean;
    data?: ModReport[];
    error?: string;
  }> {
    try {
      let query = this.supabase
        .from('mod_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      if (assigned_to) {
        query = query.eq('assigned_to', assigned_to);
      }

      const { data: reports, error } = await query;

      if (error) {
        throw new Error(`Failed to get reports: ${error.message}`);
      }

      return {
        success: true,
        data: reports || []
      };
    } catch (error) {
      console.error('Failed to get reports:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Take moderation action
   */
  async takeModerationAction(
    data: z.infer<typeof ModerationActionSchema>
  ): Promise<{
    success: boolean;
    data?: ModerationAction;
    error?: string;
  }> {
    try {
      const validated = ModerationActionSchema.parse(data);
      
      // Get report details
      const { data: reportData, error: reportError } = await this.supabase
        .from('mod_reports')
        .select('*')
        .eq('report_id', validated.report_id)
        .single();

      if (reportError) {
        throw new Error(`Report not found: ${reportError.message}`);
      }

      if (reportData.status === 'resolved') {
        throw new Error('Report has already been resolved');
      }

      // Update report status
      const { error: updateError } = await this.supabase
        .from('mod_reports')
        .update({
          status: 'resolved',
          action: validated.action,
          assigned_to: validated.moderator_id,
          resolution_notes: validated.resolution_notes,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('report_id', validated.report_id);

      if (updateError) {
        throw new Error(`Failed to update report: ${updateError.message}`);
      }

      // Take action on pack if needed
      if (validated.action === 'delist' || validated.action === 'decertify') {
        await this.executePackAction(
          reportData.namespace,
          reportData.version,
          validated.action,
          validated.moderator_id,
          validated.resolution_notes
        );
      }

      // Log moderation action
      const actionId = crypto.randomUUID();
      await this.logModerationAction({
        action: validated.action,
        report_id: validated.report_id,
        moderator_id: validated.moderator_id,
        resolution_notes: validated.resolution_notes,
        severity: validated.severity
      });

      return {
        success: true,
        data: {
          action_id: actionId,
          report_id: validated.report_id,
          action: validated.action,
          moderator_id: validated.moderator_id,
          resolution_notes: validated.resolution_notes,
          severity: validated.severity,
          created_at: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Moderation action failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute takedown
   */
  async executeTakedown(
    data: z.infer<typeof TakedownSchema>
  ): Promise<{
    success: boolean;
    data?: TakedownAction;
    error?: string;
  }> {
    try {
      const validated = TakedownSchema.parse(data);
      
      const takedownId = crypto.randomUUID();
      
      // Execute pack action
      await this.executePackAction(
        validated.namespace,
        validated.version,
        validated.takedown_type,
        validated.moderator_id,
        validated.reason
      );

      // Notify creator if requested
      if (validated.notify_creator) {
        await this.notifyCreator(validated.namespace, validated.takedown_type, validated.reason);
      }

      // Log takedown action
      await this.logModerationAction({
        action: 'takedown',
        report_id: null,
        moderator_id: validated.moderator_id,
        resolution_notes: `Takedown executed: ${validated.takedown_type} for ${validated.namespace}${validated.version ? `@${validated.version}` : ''}`
      });

      return {
        success: true,
        data: {
          takedown_id: takedownId,
          namespace: validated.namespace,
          version: validated.version,
          reason: validated.reason,
          takedown_type: validated.takedown_type,
          moderator_id: validated.moderator_id,
          creator_notified: validated.notify_creator,
          created_at: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Takedown execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get moderation stats
   */
  async getModerationStats(): Promise<{
    success: boolean;
    data?: ModerationStats;
    error?: string;
  }> {
    try {
      // Get total reports
      const { data: totalReports, error: totalError } = await this.supabase
        .from('mod_reports')
        .select('report_id', { count: 'exact' });

      if (totalError) {
        throw new Error(`Failed to get total reports: ${totalError.message}`);
      }

      // Get reports by status
      const { data: statusReports, error: statusError } = await this.supabase
        .from('mod_reports')
        .select('status, action, created_at, resolved_at')
        .order('created_at', { ascending: false });

      if (statusError) {
        throw new Error(`Failed to get status reports: ${statusError.message}`);
      }

      const openReports = statusReports?.filter(r => r.status === 'open').length || 0;
      const resolvedReports = statusReports?.filter(r => r.status === 'resolved').length || 0;
      const rejectedReports = statusReports?.filter(r => r.status === 'rejected').length || 0;

      // Calculate actions taken
      const actionsTaken = {
        warn: statusReports?.filter(r => r.action === 'warn').length || 0,
        delist: statusReports?.filter(r => r.action === 'delist').length || 0,
        decertify: statusReports?.filter(r => r.action === 'decertify').length || 0
      };

      // Calculate average resolution time
      const resolvedWithTimes = statusReports?.filter(r => r.status === 'resolved' && r.resolved_at) || [];
      const avgResolutionTime = resolvedWithTimes.length > 0 
        ? resolvedWithTimes.reduce((sum, report) => {
            const created = new Date(report.created_at);
            const resolved = new Date(report.resolved_at!);
            return sum + (resolved.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
          }, 0) / resolvedWithTimes.length
        : 0;

      return {
        success: true,
        data: {
          total_reports: totalReports?.length || 0,
          open_reports: openReports,
          resolved_reports: resolvedReports,
          rejected_reports: rejectedReports,
          actions_taken: actionsTaken,
          avg_resolution_time_hours: avgResolutionTime
        }
      };
    } catch (error) {
      console.error('Failed to get moderation stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute pack action
   */
  private async executePackAction(
    namespace: string,
    version: string | undefined,
    action: string,
    moderatorId: string,
    reason: string
  ): Promise<void> {
    try {
      if (action === 'delist') {
        // Delist specific version or all versions
        let query = this.supabase
          .from('mod_pack_registry')
          .update({
            status: 'delisted',
            updated_at: new Date().toISOString()
          })
          .eq('namespace', namespace);

        if (version) {
          query = query.eq('version', version);
        }

        const { error: delistError } = await query;
        if (delistError) {
          throw new Error(`Failed to delist pack: ${delistError.message}`);
        }
      } else if (action === 'decertify') {
        // Decertify specific version or all versions
        let query = this.supabase
          .from('mod_pack_registry')
          .update({
            status: 'decertified',
            updated_at: new Date().toISOString()
          })
          .eq('namespace', namespace);

        if (version) {
          query = query.eq('version', version);
        }

        const { error: decertifyError } = await query;
        if (decertifyError) {
          throw new Error(`Failed to decertify pack: ${decertifyError.message}`);
        }
      } else if (action === 'full_removal') {
        // Remove from registry entirely
        let query = this.supabase
          .from('mod_pack_registry')
          .delete()
          .eq('namespace', namespace);

        if (version) {
          query = query.eq('version', version);
        }

        const { error: removeError } = await query;
        if (removeError) {
          throw new Error(`Failed to remove pack: ${removeError.message}`);
        }
      }

      // Revoke download tokens
      const { error: revokeError } = await this.supabase
        .from('mod_download_tokens')
        .update({ used: true })
        .eq('namespace', namespace);

      if (revokeError) {
        console.warn('Failed to revoke download tokens:', revokeError.message);
      }
    } catch (error) {
      console.error('Pack action execution failed:', error);
      throw error;
    }
  }

  /**
   * Notify creator of takedown
   */
  private async notifyCreator(
    namespace: string,
    takedownType: string,
    reason: string
  ): Promise<void> {
    try {
      // Get creator email (hashed)
      const { data: creatorData, error: creatorError } = await this.supabase
        .from('creator_namespaces')
        .select(`
          creator_id,
          creators!inner(email_hash, display_name)
        `)
        .eq('namespace', namespace)
        .single();

      if (creatorError) {
        console.warn('Failed to get creator for notification:', creatorError.message);
        return;
      }

      // In production, this would send an actual email
      console.log(`Takedown notification for ${namespace}:`, {
        creator: creatorData.creators.display_name,
        takedown_type: takedownType,
        reason: reason,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Creator notification failed:', error);
    }
  }

  /**
   * Log moderation action
   */
  private async logModerationAction(action: {
    action: string;
    report_id?: string;
    moderator_id: string;
    resolution_notes: string;
    severity?: string;
  }): Promise<void> {
    try {
      // In production, this would store in an audit log table
      console.log('Moderation action logged:', {
        action: action.action,
        report_id: action.report_id,
        moderator_id: action.moderator_id,
        resolution_notes: action.resolution_notes,
        severity: action.severity,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log moderation action:', error);
    }
  }
}

export const moderationService = new ModerationService();
