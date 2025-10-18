/**
 * Phase 23: Privacy Operations
 * Handles export and delete operations for GDPR compliance
 */

import { z } from 'zod';
import { createHash } from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';
import { createArchiver } from 'archiver';

// Types
export interface ExportRequest {
  save_id: string;
  user_id_hash: string;
  format: 'jsonl' | 'json' | 'zip';
  include_metadata: boolean;
  include_audit_logs: boolean;
}

export interface ExportResult {
  success: boolean;
  export_id?: string;
  download_url?: string;
  file_size?: number;
  error?: string;
}

export interface DeleteRequest {
  save_id: string;
  user_id_hash: string;
  reason: string;
  redact_pii: boolean;
  create_tombstone: boolean;
}

export interface DeleteResult {
  success: boolean;
  deleted_items: number;
  tombstone_id?: string;
  error?: string;
}

export interface RetentionPolicy {
  retention_days: number;
  auto_delete: boolean;
  archive_before_delete: boolean;
  notify_before_delete: boolean;
}

export interface QuotaInfo {
  user_id_hash: string;
  used_bytes: number;
  quota_bytes: number;
  percentage_used: number;
  oldest_save: string;
  newest_save: string;
}

// Schemas
const ExportRequestSchema = z.object({
  save_id: z.string().uuid(),
  user_id_hash: z.string(),
  format: z.enum(['jsonl', 'json', 'zip']),
  include_metadata: z.boolean().default(true),
  include_audit_logs: z.boolean().default(true),
});

const DeleteRequestSchema = z.object({
  save_id: z.string().uuid(),
  user_id_hash: z.string(),
  reason: z.string(),
  redact_pii: z.boolean().default(true),
  create_tombstone: z.boolean().default(true),
});

export class PrivacyOps {
  private supabase: any;
  private config: any;

  constructor(supabase: any, config: any) {
    this.supabase = supabase;
    this.config = config;
  }

  /**
   * Export save data for user
   */
  async exportSave(request: ExportRequest): Promise<ExportResult> {
    try {
      const validation = ExportRequestSchema.safeParse(request);
      if (!validation.success) {
        return {
          success: false,
          error: `Invalid request: ${validation.error.message}`,
        };
      }

      const { save_id, user_id_hash, format, include_metadata, include_audit_logs } = request;

      // Verify user owns the save
      const { data: save } = await this.supabase
        .from('awf_saves')
        .select('*')
        .eq('save_id', save_id)
        .eq('user_id_hash', user_id_hash)
        .single();

      if (!save) {
        return {
          success: false,
          error: 'Save not found or access denied',
        };
      }

      // Generate export ID
      const exportId = this.generateExportId();
      
      // Create export data
      const exportData = await this.createExportData(save_id, include_metadata, include_audit_logs);
      
      // Generate file based on format
      const { filePath, fileSize } = await this.generateExportFile(exportData, format, exportId);
      
      // Create download URL (in production, upload to S3 or similar)
      const downloadUrl = await this.createDownloadUrl(filePath, exportId);
      
      // Log export operation
      await this.logPrivacyOperation('export', save_id, user_id_hash, {
        export_id: exportId,
        format,
        file_size: fileSize,
        include_metadata,
        include_audit_logs,
      });

      return {
        success: true,
        export_id: exportId,
        download_url: downloadUrl,
        file_size: fileSize,
      };

    } catch (error) {
      return {
        success: false,
        error: `Export failed: ${error}`,
      };
    }
  }

  /**
   * Delete save data for user
   */
  async deleteSave(request: DeleteRequest): Promise<DeleteResult> {
    try {
      const validation = DeleteRequestSchema.safeParse(request);
      if (!validation.success) {
        return {
          success: false,
          error: `Invalid request: ${validation.error.message}`,
        };
      }

      const { save_id, user_id_hash, reason, redact_pii, create_tombstone } = request;

      // Verify user owns the save
      const { data: save } = await this.supabase
        .from('awf_saves')
        .select('*')
        .eq('save_id', save_id)
        .eq('user_id_hash', user_id_hash)
        .single();

      if (!save) {
        return {
          success: false,
          error: 'Save not found or access denied',
        };
      }

      let deletedItems = 0;
      let tombstoneId: string | undefined;

      // Create tombstone if requested
      if (create_tombstone) {
        tombstoneId = await this.createTombstone(save_id, reason);
      }

      // Delete save blobs
      const { data: blobs } = await this.supabase
        .from('awf_save_blobs')
        .select('blob_hash')
        .or(`blob_hash.eq.${save.base_snapshot_hash},blob_hash.in.(${await this.getDiffHashes(save_id)})`);

      if (blobs && blobs.length > 0) {
        await this.supabase
          .from('awf_save_blobs')
          .delete()
          .in('blob_hash', blobs.map(b => b.blob_hash));
        
        deletedItems += blobs.length;
      }

      // Delete save diffs
      const { count: diffsDeleted } = await this.supabase
        .from('awf_save_diffs')
        .delete()
        .eq('save_id', save_id);
      
      deletedItems += diffsDeleted || 0;

      // Delete save archives
      const { count: archivesDeleted } = await this.supabase
        .from('awf_save_archives')
        .delete()
        .eq('save_id', save_id);
      
      deletedItems += archivesDeleted || 0;

      // Delete sync audit logs
      const { count: auditDeleted } = await this.supabase
        .from('awf_sync_audit')
        .delete()
        .eq('save_id', save_id);
      
      deletedItems += auditDeleted || 0;

      // Delete main save record
      await this.supabase
        .from('awf_saves')
        .delete()
        .eq('save_id', save_id);
      
      deletedItems += 1;

      // Log deletion operation
      await this.logPrivacyOperation('delete', save_id, user_id_hash, {
        reason,
        redact_pii,
        create_tombstone,
        tombstone_id: tombstoneId,
        deleted_items: deletedItems,
      });

      return {
        success: true,
        deleted_items: deletedItems,
        tombstone_id: tombstoneId,
      };

    } catch (error) {
      return {
        success: false,
        deleted_items: 0,
        error: `Delete failed: ${error}`,
      };
    }
  }

  /**
   * Get user quota information
   */
  async getUserQuota(userIdHash: string): Promise<QuotaInfo> {
    try {
      // Get user's saves
      const { data: saves } = await this.supabase
        .from('awf_saves')
        .select('save_id, created_at, updated_at')
        .eq('user_id_hash', userIdHash)
        .order('created_at');

      if (!saves || saves.length === 0) {
        return {
          user_id_hash: userIdHash,
          used_bytes: 0,
          quota_bytes: this.config.user_quota_mb * 1024 * 1024,
          percentage_used: 0,
          oldest_save: '',
          newest_save: '',
        };
      }

      // Calculate used bytes
      let usedBytes = 0;
      for (const save of saves) {
        const saveBytes = await this.calculateSaveSize(save.save_id);
        usedBytes += saveBytes;
      }

      const quotaBytes = this.config.user_quota_mb * 1024 * 1024;
      const percentageUsed = (usedBytes / quotaBytes) * 100;

      return {
        user_id_hash: userIdHash,
        used_bytes: usedBytes,
        quota_bytes: quotaBytes,
        percentage_used: percentageUsed,
        oldest_save: saves[0].created_at,
        newest_save: saves[saves.length - 1].updated_at,
      };

    } catch (error) {
      console.error('Failed to get user quota:', error);
      return {
        user_id_hash: userIdHash,
        used_bytes: 0,
        quota_bytes: 0,
        percentage_used: 0,
        oldest_save: '',
        newest_save: '',
      };
    }
  }

  /**
   * Check retention policy and clean up old data
   */
  async enforceRetentionPolicy(): Promise<{
    deleted_saves: number;
    deleted_blobs: number;
    freed_bytes: number;
  }> {
    try {
      const retentionDays = this.config.retention_days;
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      
      let deletedSaves = 0;
      let deletedBlobs = 0;
      let freedBytes = 0;

      // Get old saves
      const { data: oldSaves } = await this.supabase
        .from('awf_saves')
        .select('save_id, user_id_hash')
        .lt('updated_at', cutoffDate.toISOString());

      if (oldSaves && oldSaves.length > 0) {
        for (const save of oldSaves) {
          // Calculate size before deletion
          const saveSize = await this.calculateSaveSize(save.save_id);
          freedBytes += saveSize;

          // Delete save and related data
          const deleteResult = await this.deleteSave({
            save_id: save.save_id,
            user_id_hash: save.user_id_hash,
            reason: 'retention_policy',
            redact_pii: true,
            create_tombstone: true,
          });

          if (deleteResult.success) {
            deletedSaves += 1;
            deletedBlobs += deleteResult.deleted_items - 1; // Subtract 1 for main save record
          }
        }
      }

      // Log retention enforcement
      await this.logPrivacyOperation('retention_enforcement', '', '', {
        deleted_saves: deletedSaves,
        deleted_blobs: deletedBlobs,
        freed_bytes: freedBytes,
        cutoff_date: cutoffDate.toISOString(),
      });

      return {
        deleted_saves: deletedSaves,
        deleted_blobs: deletedBlobs,
        freed_bytes: freedBytes,
      };

    } catch (error) {
      console.error('Retention policy enforcement failed:', error);
      return {
        deleted_saves: 0,
        deleted_blobs: 0,
        freed_bytes: 0,
      };
    }
  }

  /**
   * Create export data
   */
  private async createExportData(
    saveId: string,
    includeMetadata: boolean,
    includeAuditLogs: boolean
  ): Promise<any> {
    const exportData: any = {
      export_id: this.generateExportId(),
      created_at: new Date().toISOString(),
      save_id: saveId,
    };

    // Get save info
    const { data: save } = await this.supabase
      .from('awf_saves')
      .select('*')
      .eq('save_id', saveId)
      .single();

    if (save) {
      exportData.save_info = save;
    }

    // Get save blobs
    const { data: blobs } = await this.supabase
      .from('awf_save_blobs')
      .select('*')
      .or(`blob_hash.eq.${save.base_snapshot_hash},blob_hash.in.(${await this.getDiffHashes(saveId)})`);

    if (blobs) {
      exportData.blobs = blobs.map(blob => ({
        blob_hash: blob.blob_hash,
        blob_type: blob.blob_type,
        size: blob.size,
        enc: blob.enc,
        created_at: blob.created_at,
        // Don't include actual bytes in export for privacy
      }));
    }

    // Get save diffs
    const { data: diffs } = await this.supabase
      .from('awf_save_diffs')
      .select('*')
      .eq('save_id', saveId)
      .order('to_turn');

    if (diffs) {
      exportData.diffs = diffs;
    }

    // Get metadata if requested
    if (includeMetadata) {
      const { data: archives } = await this.supabase
        .from('awf_save_archives')
        .select('*')
        .eq('save_id', saveId);

      if (archives) {
        exportData.archives = archives;
      }
    }

    // Get audit logs if requested
    if (includeAuditLogs) {
      const { data: auditLogs } = await this.supabase
        .from('awf_sync_audit')
        .select('*')
        .eq('save_id', saveId)
        .order('created_at');

      if (auditLogs) {
        exportData.audit_logs = auditLogs;
      }
    }

    return exportData;
  }

  /**
   * Generate export file
   */
  private async generateExportFile(
    exportData: any,
    format: string,
    exportId: string
  ): Promise<{ filePath: string; fileSize: number }> {
    const fileName = `export_${exportId}.${format}`;
    const filePath = `/tmp/${fileName}`;

    if (format === 'json') {
      const jsonData = JSON.stringify(exportData, null, 2);
      await this.writeFile(filePath, jsonData);
    } else if (format === 'jsonl') {
      const jsonlData = Object.entries(exportData)
        .map(([key, value]) => JSON.stringify({ key, value }))
        .join('\n');
      await this.writeFile(filePath, jsonlData);
    } else if (format === 'zip') {
      await this.createZipFile(exportData, filePath);
    }

    const stats = await this.getFileStats(filePath);
    return { filePath, fileSize: stats.size };
  }

  /**
   * Create ZIP file
   */
  private async createZipFile(exportData: any, filePath: string): Promise<void> {
    // This would use a proper ZIP library in production
    const zipData = JSON.stringify(exportData, null, 2);
    await this.writeFile(filePath, zipData);
  }

  /**
   * Create download URL
   */
  private async createDownloadUrl(filePath: string, exportId: string): Promise<string> {
    // In production, upload to S3 or similar and return signed URL
    return `/downloads/export_${exportId}`;
  }

  /**
   * Create tombstone
   */
  private async createTombstone(saveId: string, reason: string): Promise<string> {
    const tombstoneId = this.generateTombstoneId();
    
    await this.supabase
      .from('awf_save_archives')
      .insert({
        save_id: saveId,
        reason: 'manual_restore',
        meta: {
          tombstone_id: tombstoneId,
          deletion_reason: reason,
          deleted_at: new Date().toISOString(),
        },
      });

    return tombstoneId;
  }

  /**
   * Calculate save size
   */
  private async calculateSaveSize(saveId: string): Promise<number> {
    const { data: blobs } = await this.supabase
      .from('awf_save_blobs')
      .select('size')
      .or(`blob_hash.eq.${await this.getBaseSnapshotHash(saveId)},blob_hash.in.(${await this.getDiffHashes(saveId)})`);

    if (!blobs) return 0;

    return blobs.reduce((total, blob) => total + blob.size, 0);
  }

  /**
   * Get diff hashes for save
   */
  private async getDiffHashes(saveId: string): Promise<string> {
    const { data: diffs } = await this.supabase
      .from('awf_save_diffs')
      .select('diff_hash')
      .eq('save_id', saveId);

    if (!diffs) return '';

    return diffs.map(d => d.diff_hash).join(',');
  }

  /**
   * Get base snapshot hash
   */
  private async getBaseSnapshotHash(saveId: string): Promise<string> {
    const { data: save } = await this.supabase
      .from('awf_saves')
      .select('base_snapshot_hash')
      .eq('save_id', saveId)
      .single();

    return save?.base_snapshot_hash || '';
  }

  /**
   * Log privacy operation
   */
  private async logPrivacyOperation(
    operation: string,
    saveId: string,
    userIdHash: string,
    details: any
  ): Promise<void> {
    await this.supabase
      .from('awf_sync_audit')
      .insert({
        save_id: saveId,
        operation: `privacy_${operation}`,
        details: {
          user_id_hash: userIdHash,
          ...details,
        },
      });
  }

  /**
   * Utility methods
   */
  private generateExportId(): string {
    return createHash('sha256')
      .update(`${Date.now()}:${Math.random()}`)
      .digest('hex')
      .substring(0, 16);
  }

  private generateTombstoneId(): string {
    return createHash('sha256')
      .update(`${Date.now()}:${Math.random()}`)
      .digest('hex')
      .substring(0, 16);
  }

  private async writeFile(filePath: string, data: string): Promise<void> {
    // Mock file write - in production, use proper file system operations
    console.log(`Writing to ${filePath}: ${data.length} bytes`);
  }

  private async getFileStats(filePath: string): Promise<{ size: number }> {
    // Mock file stats - in production, use proper file system operations
    return { size: 1024 };
  }
}

// Singleton instance
let privacyOps: PrivacyOps | null = null;

export function getPrivacyOps(supabase: any, config: any): PrivacyOps {
  if (!privacyOps) {
    privacyOps = new PrivacyOps(supabase, config);
  }
  return privacyOps;
}
