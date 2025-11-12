import { supabase } from '@/lib/supabase';

export interface ContentReport {
  id: string;
  target_type: 'entry_point' | 'prompt_segment' | 'npc' | 'turn';
  target_id: string;
  reason: string;
  reporter_id: string;
  created_at: string;
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  notes?: any[];
}

export interface ReportFilters {
  state?: 'open' | 'resolved' | 'all';
  targetType?: string;
  since?: number; // days
  q?: string;
  limit?: number;
  cursor?: string;
}

export interface ReportListResponse {
  reports: ContentReport[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface ResolveReportData {
  resolvedBy: string;
  note?: string;
}

export interface BulkResolveData {
  ids: string[];
  resolvedBy: string;
  note?: string;
}

export class AdminReportsService {
  /**
   * List content reports with filtering and pagination
   */
  static async listReports(filters: ReportFilters = {}): Promise<ReportListResponse> {
    const {
      state = 'all',
      targetType,
      since,
      q,
      limit = 20,
      cursor
    } = filters;

    let query = supabase
      .from('content_reports')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (state === 'open') {
      query = query.eq('resolved', false);
    } else if (state === 'resolved') {
      query = query.eq('resolved', true);
    }

    if (targetType) {
      query = query.eq('target_type', targetType);
    }

    if (since) {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - since);
      query = query.gte('created_at', sinceDate.toISOString());
    }

    if (q) {
      query = query.or(`reason.ilike.%${q}%,target_id.ilike.%${q}%`);
    }

    // Pagination
    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    query = query.limit(limit + 1);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch reports: ${error.message}`);
    }

    const hasMore = data && data.length > limit;
    const reports = hasMore ? data.slice(0, limit) : data || [];
    const nextCursor = hasMore && reports.length > 0 ? reports[reports.length - 1].created_at : undefined;

    return {
      reports,
      hasMore,
      nextCursor
    };
  }

  /**
   * Get a single report by ID
   */
  static async getReport(id: string): Promise<ContentReport> {
    const { data, error } = await supabase
      .from('content_reports')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch report: ${error.message}`);
    }

    return data;
  }

  /**
   * Resolve a single report
   */
  static async resolveReport(id: string, data: ResolveReportData): Promise<ContentReport> {
    const { resolvedBy, note } = data;
    
    const updateData: any = {
      resolved: true,
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString()
    };

    // Add note to notes array if provided
    if (note) {
      const { data: currentReport } = await supabase
        .from('content_reports')
        .select('notes')
        .eq('id', id)
        .single();

      const currentNotes = currentReport?.notes || [];
      const newNote = {
        at: new Date().toISOString(),
        by: resolvedBy,
        text: note
      };

      updateData.notes = [...currentNotes, newNote];
    }

    const { data: updatedReport, error } = await supabase
      .from('content_reports')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to resolve report: ${error.message}`);
    }

    return updatedReport;
  }

  /**
   * Bulk resolve multiple reports
   */
  static async bulkResolve(data: BulkResolveData): Promise<ContentReport[]> {
    const { ids, resolvedBy, note } = data;
    
    const updateData: any = {
      resolved: true,
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString()
    };

    // Add note to notes array if provided
    if (note) {
      const { data: currentReports } = await supabase
        .from('content_reports')
        .select('id, notes')
        .in('id', ids);

      const newNote = {
        at: new Date().toISOString(),
        by: resolvedBy,
        text: note
      };

      // Update each report with the note
      const updates = currentReports?.map(report => ({
        id: report.id,
        notes: [...(report.notes || []), newNote]
      })) || [];

      // This is a simplified approach - in production you might want to use a transaction
      const results = [];
      for (const update of updates) {
        const { data: updatedReport, error } = await supabase
          .from('content_reports')
          .update({ ...updateData, notes: update.notes })
          .eq('id', update.id)
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to resolve report ${update.id}: ${error.message}`);
        }

        results.push(updatedReport);
      }

      return results;
    }

    // Simple bulk update without notes
    const { data: updatedReports, error } = await supabase
      .from('content_reports')
      .update(updateData)
      .in('id', ids)
      .select();

    if (error) {
      throw new Error(`Failed to bulk resolve reports: ${error.message}`);
    }

    return updatedReports || [];
  }

  /**
   * Get report statistics
   */
  static async getReportStats(): Promise<{
    total: number;
    open: number;
    resolved: number;
    byType: Record<string, number>;
  }> {
    const { data: totalData, error: totalError } = await supabase
      .from('content_reports')
      .select('id', { count: 'exact' });

    if (totalError) {
      throw new Error(`Failed to fetch total reports: ${totalError.message}`);
    }

    const { data: openData, error: openError } = await supabase
      .from('content_reports')
      .select('id', { count: 'exact' })
      .eq('resolved', false);

    if (openError) {
      throw new Error(`Failed to fetch open reports: ${openError.message}`);
    }

    const { data: typeData, error: typeError } = await supabase
      .from('content_reports')
      .select('target_type')
      .eq('resolved', false);

    if (typeError) {
      throw new Error(`Failed to fetch reports by type: ${typeError.message}`);
    }

    const byType = typeData?.reduce((acc, report) => {
      acc[report.target_type] = (acc[report.target_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    return {
      total: totalData?.length || 0,
      open: openData?.length || 0,
      resolved: (totalData?.length || 0) - (openData?.length || 0),
      byType
    };
  }
}

















