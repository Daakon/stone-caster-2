// Phase 26: Distribution Service
// Handles signed package distribution, download tokens, and integrity validation

import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { promisify } from 'util';

const execAsync = promisify(require('child_process').exec);
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validation schemas
const DownloadTokenRequestSchema = z.object({
  namespace: z.string(),
  version: z.string(),
  requester_id: z.string(),
  scopes: z.array(z.string()).default(['download']),
  expires_in_seconds: z.number().min(60).max(3600).default(300) // 5 minutes default
});

const DownloadRequestSchema = z.object({
  token: z.string(),
  namespace: z.string(),
  version: z.string()
});

const IntegrityCheckSchema = z.object({
  namespace: z.string(),
  version: z.string(),
  hash: z.string(),
  signature: z.string()
});

export interface DownloadToken {
  token: string;
  namespace: string;
  version: string;
  expires_at: string;
  scopes: string[];
  issued_to: string;
  used: boolean;
  created_at: string;
}

export interface SignedDownloadURL {
  url: string;
  expires_at: string;
  signature: string;
  integrity_hash: string;
}

export interface IntegrityValidation {
  valid: boolean;
  hash_match: boolean;
  signature_valid: boolean;
  issues: string[];
}

export interface DistributionStats {
  namespace: string;
  version: string;
  download_count: number;
  unique_downloaders: number;
  last_downloaded: string;
  token_usage: number;
}

export class DistributionService {
  private supabase: any;
  private signingKey: string;
  private urlTTL: number;

  constructor() {
    this.supabase = supabase;
    this.signingKey = process.env.MARKETPLACE_SIGNING_KEY_PATH || '/secrets/marketplace_signing.pem';
    this.urlTTL = parseInt(process.env.MARKETPLACE_URL_TTL_SECONDS || '300');
  }

  /**
   * Issue download token
   */
  async issueDownloadToken(
    data: z.infer<typeof DownloadTokenRequestSchema>
  ): Promise<{
    success: boolean;
    data?: DownloadToken;
    error?: string;
  }> {
    try {
      const validated = DownloadTokenRequestSchema.parse(data);
      
      // Verify pack exists and is listed
      const { data: packData, error: packError } = await this.supabase
        .from('mod_pack_registry')
        .select('namespace, version, status, hash, signature')
        .eq('namespace', validated.namespace)
        .eq('version', validated.version)
        .single();

      if (packError) {
        throw new Error(`Pack not found: ${packError.message}`);
      }

      if (packData.status !== 'listed') {
        throw new Error(`Pack is not available for download: ${packData.status}`);
      }

      // Generate secure token
      const token = this.generateSecureToken();
      const expiresAt = new Date(Date.now() + validated.expires_in_seconds * 1000);

      // Store token
      const { data: tokenData, error: tokenError } = await this.supabase
        .from('mod_download_tokens')
        .insert({
          token: token,
          namespace: validated.namespace,
          version: validated.version,
          expires_at: expiresAt.toISOString(),
          scopes: validated.scopes,
          issued_to: validated.requester_id
        })
        .select('*')
        .single();

      if (tokenError) {
        throw new Error(`Failed to create download token: ${tokenError.message}`);
      }

      return {
        success: true,
        data: {
          token: tokenData.token,
          namespace: tokenData.namespace,
          version: tokenData.version,
          expires_at: tokenData.expires_at,
          scopes: tokenData.scopes,
          issued_to: tokenData.issued_to,
          used: tokenData.used,
          created_at: tokenData.created_at
        }
      };
    } catch (error) {
      console.error('Download token issuance failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate signed download URL
   */
  async generateSignedDownloadURL(
    data: z.infer<typeof DownloadRequestSchema>
  ): Promise<{
    success: boolean;
    data?: SignedDownloadURL;
    error?: string;
  }> {
    try {
      const validated = DownloadRequestSchema.parse(data);
      
      // Verify token
      const { data: tokenData, error: tokenError } = await this.supabase
        .from('mod_download_tokens')
        .select('*')
        .eq('token', validated.token)
        .eq('namespace', validated.namespace)
        .eq('version', validated.version)
        .single();

      if (tokenError) {
        throw new Error(`Invalid download token: ${tokenError.message}`);
      }

      if (tokenData.used) {
        throw new Error('Download token has already been used');
      }

      if (new Date(tokenData.expires_at) < new Date()) {
        throw new Error('Download token has expired');
      }

      // Get pack data
      const { data: packData, error: packError } = await this.supabase
        .from('mod_pack_registry')
        .select('hash, signature, manifest')
        .eq('namespace', validated.namespace)
        .eq('version', validated.version)
        .single();

      if (packError) {
        throw new Error(`Pack not found: ${packError.message}`);
      }

      // Generate signed URL
      const baseURL = process.env.MARKETPLACE_BASE_URL || 'https://marketplace.stonecaster.com';
      const downloadPath = `/download/${validated.namespace}/${validated.version}`;
      const expiresAt = new Date(Date.now() + this.urlTTL * 1000);
      
      const urlData = {
        path: downloadPath,
        expires: Math.floor(expiresAt.getTime() / 1000),
        namespace: validated.namespace,
        version: validated.version,
        token: validated.token
      };

      const signature = this.signURLData(urlData);
      const signedURL = `${baseURL}${downloadPath}?token=${validated.token}&expires=${urlData.expires}&signature=${signature}`;

      // Mark token as used
      await this.supabase
        .from('mod_download_tokens')
        .update({ 
          used: true, 
          used_at: new Date().toISOString() 
        })
        .eq('token', validated.token);

      // Update download stats
      await this.updateDownloadStats(validated.namespace, validated.version);

      return {
        success: true,
        data: {
          url: signedURL,
          expires_at: expiresAt.toISOString(),
          signature: signature,
          integrity_hash: packData.hash
        }
      };
    } catch (error) {
      console.error('Signed URL generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate package integrity
   */
  async validateIntegrity(
    data: z.infer<typeof IntegrityCheckSchema>
  ): Promise<{
    success: boolean;
    data?: IntegrityValidation;
    error?: string;
  }> {
    try {
      const validated = IntegrityCheckSchema.parse(data);
      
      // Get pack data
      const { data: packData, error: packError } = await this.supabase
        .from('mod_pack_registry')
        .select('hash, signature')
        .eq('namespace', validated.namespace)
        .eq('version', validated.version)
        .single();

      if (packError) {
        throw new Error(`Pack not found: ${packError.message}`);
      }

      const issues: string[] = [];
      let hashMatch = false;
      let signatureValid = false;

      // Check hash
      if (packData.hash === validated.hash) {
        hashMatch = true;
      } else {
        issues.push('Hash mismatch - package may be corrupted');
      }

      // Check signature
      if (this.verifySignature(validated.hash, validated.signature)) {
        signatureValid = true;
      } else {
        issues.push('Invalid signature - package may be tampered with');
      }

      const valid = hashMatch && signatureValid;

      return {
        success: true,
        data: {
          valid,
          hash_match: hashMatch,
          signature_valid: signatureValid,
          issues
        }
      };
    } catch (error) {
      console.error('Integrity validation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Revoke download tokens (for takedowns)
   */
  async revokeTokens(
    namespace: string, 
    version?: string
  ): Promise<{
    success: boolean;
    data?: { revoked_count: number };
    error?: string;
  }> {
    try {
      let query = this.supabase
        .from('mod_download_tokens')
        .update({ used: true })
        .eq('namespace', namespace);

      if (version) {
        query = query.eq('version', version);
      }

      const { data, error } = await query.select('token');

      if (error) {
        throw new Error(`Failed to revoke tokens: ${error.message}`);
      }

      return {
        success: true,
        data: { revoked_count: data?.length || 0 }
      };
    } catch (error) {
      console.error('Token revocation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get distribution stats
   */
  async getDistributionStats(
    namespace: string, 
    version: string
  ): Promise<{
    success: boolean;
    data?: DistributionStats;
    error?: string;
  }> {
    try {
      // Get download count
      const { data: downloadData, error: downloadError } = await this.supabase
        .from('mod_download_tokens')
        .select('used_at, issued_to')
        .eq('namespace', namespace)
        .eq('version', version)
        .eq('used', true);

      if (downloadError) {
        throw new Error(`Failed to get download stats: ${downloadError.message}`);
      }

      const downloadCount = downloadData?.length || 0;
      const uniqueDownloaders = new Set(downloadData?.map(d => d.issued_to) || []).size;
      const lastDownloaded = downloadData?.sort((a, b) => 
        new Date(b.used_at).getTime() - new Date(a.used_at).getTime()
      )[0]?.used_at;

      // Get token usage from metrics
      const { data: metricsData, error: metricsError } = await this.supabase
        .from('mod_pack_metrics')
        .select('token_budget_usage')
        .eq('namespace', namespace)
        .eq('version', version)
        .order('metric_date', { ascending: false })
        .limit(1);

      const tokenUsage = metricsData?.[0]?.token_budget_usage || 0;

      return {
        success: true,
        data: {
          namespace,
          version,
          download_count: downloadCount,
          unique_downloaders: uniqueDownloaders,
          last_downloaded: lastDownloaded || 'Never',
          token_usage: tokenUsage
        }
      };
    } catch (error) {
      console.error('Distribution stats retrieval failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(): Promise<{
    success: boolean;
    data?: { cleaned_count: number };
    error?: string;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('mod_download_tokens')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('token');

      if (error) {
        throw new Error(`Failed to cleanup expired tokens: ${error.message}`);
      }

      return {
        success: true,
        data: { cleaned_count: data?.length || 0 }
      };
    } catch (error) {
      console.error('Token cleanup failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate secure token
   */
  private generateSecureToken(): string {
    const randomBytes = crypto.randomBytes(32);
    return crypto.createHash('sha256').update(randomBytes).digest('hex');
  }

  /**
   * Sign URL data
   */
  private signURLData(data: any): string {
    const dataString = JSON.stringify(data);
    return crypto.createHmac('sha256', this.signingKey)
      .update(dataString)
      .digest('hex');
  }

  /**
   * Verify signature
   */
  private verifySignature(hash: string, signature: string): boolean {
    try {
      // In production, this would use proper signature verification
      // For now, we'll use HMAC verification
      const expectedSignature = crypto.createHmac('sha256', this.signingKey)
        .update(hash)
        .digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Update download stats
   */
  private async updateDownloadStats(namespace: string, version: string): Promise<void> {
    try {
      // Update metrics table
      const today = new Date().toISOString().split('T')[0];
      
      const { data: existingMetrics, error: checkError } = await this.supabase
        .from('mod_pack_metrics')
        .select('download_count')
        .eq('namespace', namespace)
        .eq('version', version)
        .eq('metric_date', today)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.warn('Failed to check existing metrics:', checkError.message);
        return;
      }

      if (existingMetrics) {
        // Update existing record
        await this.supabase
          .from('mod_pack_metrics')
          .update({ 
            download_count: existingMetrics.download_count + 1,
            updated_at: new Date().toISOString()
          })
          .eq('namespace', namespace)
          .eq('version', version)
          .eq('metric_date', today);
      } else {
        // Create new record
        await this.supabase
          .from('mod_pack_metrics')
          .insert({
            namespace,
            version,
            metric_date: today,
            download_count: 1
          });
      }
    } catch (error) {
      console.error('Failed to update download stats:', error);
    }
  }
}

export const distributionService = new DistributionService();
