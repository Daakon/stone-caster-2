// Phase 26: Pack Pipeline Service
// Handles pack upload, linting, playtesting, security scanning, and certification

import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import AdmZip from 'adm-zip';

const execAsync = promisify(exec);
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validation schemas
const PackUploadSchema = z.object({
  namespace: z.string().min(3).max(50),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Version must be semantic (e.g., 1.0.0)"),
  zip_data: z.string(), // Base64 encoded ZIP
  creator_id: z.string().uuid()
});

const PackReviewSchema = z.object({
  namespace: z.string(),
  version: z.string(),
  action: z.enum(['approve', 'reject']),
  review_notes: z.string().optional(),
  reviewer_id: z.string().uuid()
});

export interface PackManifest {
  namespace: string;
  version: string;
  name: string;
  description: string;
  author: string;
  awf_core_range: string;
  dependencies: Array<{
    namespace: string;
    version_range: string;
    type: 'required' | 'optional' | 'conflicts';
  }>;
  capabilities: Array<{
    hook_name: string;
    hook_type: string;
    description: string;
  }>;
  tags: string[];
  license: string;
  homepage?: string;
  repository?: string;
}

export interface PackSBOM {
  namespace: string;
  version: string;
  files: Array<{
    path: string;
    hash: string;
    size: number;
    type: string;
  }>;
  total_size: number;
  created_at: string;
}

export interface PackPipelineResult {
  success: boolean;
  data?: {
    namespace: string;
    version: string;
    status: string;
    manifest: PackManifest;
    sbom: PackSBOM;
    hash: string;
    signature?: string;
    lint_results: any;
    playtest_results: any;
    security_scan_results: any;
  };
  error?: string;
}

export interface PackReviewResult {
  success: boolean;
  data?: {
    namespace: string;
    version: string;
    status: string;
    review_notes?: string;
    certified_at?: string;
  };
  error?: string;
}

export class PackPipelineService {
  private supabase: any;
  private signingKey: string;
  private maxUploadSize: number;

  constructor() {
    this.supabase = supabase;
    this.signingKey = process.env.MARKETPLACE_SIGNING_KEY_PATH || '/secrets/marketplace_signing.pem';
    this.maxUploadSize = parseInt(process.env.MARKETPLACE_MAX_UPLOAD_MB || '50') * 1024 * 1024; // Convert to bytes
  }

  /**
   * Upload and process a pack
   */
  async uploadPack(data: z.infer<typeof PackUploadSchema>): Promise<PackPipelineResult> {
    try {
      const validated = PackUploadSchema.parse(data);
      
      // Verify creator owns the namespace
      const { data: namespaceData, error: namespaceError } = await this.supabase
        .from('creator_namespaces')
        .select('namespace, creator_id, verified')
        .eq('namespace', validated.namespace)
        .eq('creator_id', validated.creator_id)
        .single();

      if (namespaceError) {
        throw new Error(`Namespace not found or not owned by creator: ${namespaceError.message}`);
      }

      if (!namespaceData.verified) {
        throw new Error('Namespace must be verified before uploading packs');
      }

      // Decode and validate ZIP data
      const zipBuffer = Buffer.from(validated.zip_data, 'base64');
      
      if (zipBuffer.length > this.maxUploadSize) {
        throw new Error(`Pack size exceeds maximum allowed size of ${this.maxUploadSize / (1024 * 1024)}MB`);
      }

      // Extract and validate ZIP
      const zip = new AdmZip(zipBuffer);
      const manifestEntry = zip.getEntry('manifest.json');
      
      if (!manifestEntry) {
        throw new Error('Pack must contain a manifest.json file');
      }

      const manifestData = JSON.parse(manifestEntry.getData().toString('utf8'));
      const manifest = this.validateManifest(manifestData, validated.namespace, validated.version);

      // Run pipeline stages
      const pipelineResults = await this.runPipelineStages(zip, manifest);

      // Build SBOM
      const sbom = await this.buildSBOM(zip, validated.namespace, validated.version);

      // Compute hash
      const hash = crypto.createHash('sha256').update(zipBuffer).digest('hex');

      // Sign the pack
      const signature = await this.signPack(hash);

      // Store pack in registry
      const { data: packData, error: storeError } = await this.supabase
        .from('mod_pack_registry')
        .insert({
          namespace: validated.namespace,
          version: validated.version,
          status: 'draft',
          manifest: manifest,
          sbom: sbom,
          hash: hash,
          signature: signature,
          awf_core_range: manifest.awf_core_range,
          deps: manifest.dependencies
        })
        .select('*')
        .single();

      if (storeError) {
        throw new Error(`Failed to store pack: ${storeError.message}`);
      }

      // Store dependencies
      await this.storeDependencies(validated.namespace, validated.version, manifest.dependencies);

      // Store capabilities
      await this.storeCapabilities(validated.namespace, validated.version, manifest.capabilities);

      // Store tags
      await this.storeTags(validated.namespace, validated.version, manifest.tags);

      return {
        success: true,
        data: {
          namespace: validated.namespace,
          version: validated.version,
          status: 'draft',
          manifest: manifest,
          sbom: sbom,
          hash: hash,
          signature: signature,
          lint_results: pipelineResults.lint,
          playtest_results: pipelineResults.playtest,
          security_scan_results: pipelineResults.security
        }
      };
    } catch (error) {
      console.error('Pack upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Submit pack for review
   */
  async submitForReview(
    namespace: string, 
    version: string, 
    creatorId: string
  ): Promise<{
    success: boolean;
    data?: { status: string };
    error?: string;
  }> {
    try {
      // Verify pack exists and is owned by creator
      const { data: packData, error: packError } = await this.supabase
        .from('mod_pack_registry')
        .select(`
          namespace,
          version,
          status,
          creator_namespaces!inner(creator_id)
        `)
        .eq('namespace', namespace)
        .eq('version', version)
        .single();

      if (packError) {
        throw new Error(`Pack not found: ${packError.message}`);
      }

      if (packData.creator_namespaces.creator_id !== creatorId) {
        throw new Error('Pack not owned by creator');
      }

      if (packData.status !== 'draft') {
        throw new Error(`Pack cannot be submitted from status: ${packData.status}`);
      }

      // Update status to submitted
      const { error: updateError } = await this.supabase
        .from('mod_pack_registry')
        .update({ 
          status: 'submitted',
          updated_at: new Date().toISOString()
        })
        .eq('namespace', namespace)
        .eq('version', version);

      if (updateError) {
        throw new Error(`Failed to submit pack: ${updateError.message}`);
      }

      return {
        success: true,
        data: { status: 'submitted' }
      };
    } catch (error) {
      console.error('Pack submission failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Review pack (admin only)
   */
  async reviewPack(data: z.infer<typeof PackReviewSchema>): Promise<PackReviewResult> {
    try {
      const validated = PackReviewSchema.parse(data);
      
      // Get pack data
      const { data: packData, error: packError } = await this.supabase
        .from('mod_pack_registry')
        .select('*')
        .eq('namespace', validated.namespace)
        .eq('version', validated.version)
        .single();

      if (packError) {
        throw new Error(`Pack not found: ${packError.message}`);
      }

      if (packData.status !== 'submitted' && packData.status !== 'reviewing') {
        throw new Error(`Pack cannot be reviewed from status: ${packData.status}`);
      }

      let newStatus: string;
      let certifiedAt: string | undefined;

      if (validated.action === 'approve') {
        newStatus = 'certified';
        certifiedAt = new Date().toISOString();
      } else {
        newStatus = 'rejected';
      }

      // Update pack status
      const { error: updateError } = await this.supabase
        .from('mod_pack_registry')
        .update({
          status: newStatus,
          review_notes: validated.review_notes,
          updated_at: new Date().toISOString(),
          certified_at: certifiedAt
        })
        .eq('namespace', validated.namespace)
        .eq('version', validated.version);

      if (updateError) {
        throw new Error(`Failed to update pack status: ${updateError.message}`);
      }

      return {
        success: true,
        data: {
          namespace: validated.namespace,
          version: validated.version,
          status: newStatus,
          review_notes: validated.review_notes,
          certified_at: certifiedAt
        }
      };
    } catch (error) {
      console.error('Pack review failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List pack for public access
   */
  async listPack(
    namespace: string, 
    version: string
  ): Promise<{
    success: boolean;
    data?: { status: string; listed_at: string };
    error?: string;
  }> {
    try {
      // Verify pack is certified
      const { data: packData, error: packError } = await this.supabase
        .from('mod_pack_registry')
        .select('status')
        .eq('namespace', namespace)
        .eq('version', version)
        .single();

      if (packError) {
        throw new Error(`Pack not found: ${packError.message}`);
      }

      if (packData.status !== 'certified') {
        throw new Error(`Pack must be certified before listing: ${packData.status}`);
      }

      // Update status to listed
      const { error: updateError } = await this.supabase
        .from('mod_pack_registry')
        .update({
          status: 'listed',
          listed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('namespace', namespace)
        .eq('version', version);

      if (updateError) {
        throw new Error(`Failed to list pack: ${updateError.message}`);
      }

      return {
        success: true,
        data: {
          status: 'listed',
          listed_at: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Pack listing failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Run pipeline stages (lint, playtest, security scan)
   */
  private async runPipelineStages(zip: AdmZip, manifest: PackManifest): Promise<{
    lint: any;
    playtest: any;
    security: any;
  }> {
    const results = {
      lint: null,
      playtest: null,
      security: null
    };

    try {
      // Stage 1: Lint (using Phase 22 linter)
      results.lint = await this.runLinter(zip, manifest);

      // Stage 2: Playtest (using Phase 9 harness)
      results.playtest = await this.runPlaytest(zip, manifest);

      // Stage 3: Security scan
      results.security = await this.runSecurityScan(zip, manifest);

      return results;
    } catch (error) {
      console.error('Pipeline stages failed:', error);
      throw error;
    }
  }

  /**
   * Run linter on pack
   */
  private async runLinter(zip: AdmZip, manifest: PackManifest): Promise<any> {
    try {
      // Extract pack to temporary directory
      const tempDir = await fs.mkdtemp('/tmp/pack-lint-');
      
      try {
        // Extract ZIP contents
        zip.extractAllTo(tempDir, true);

        // Run linter (would integrate with Phase 22 linter)
        const { stdout, stderr } = await execAsync(
          `cd ${tempDir} && npm run lint -- --format json`,
          { timeout: 30000 }
        );

        return {
          success: true,
          results: JSON.parse(stdout),
          errors: stderr
        };
      } finally {
        // Cleanup
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error('Linter failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Run playtest on pack
   */
  private async runPlaytest(zip: AdmZip, manifest: PackManifest): Promise<any> {
    try {
      // Extract pack to temporary directory
      const tempDir = await fs.mkdtemp('/tmp/pack-playtest-');
      
      try {
        // Extract ZIP contents
        zip.extractAllTo(tempDir, true);

        // Run playtest (would integrate with Phase 9 harness)
        const { stdout, stderr } = await execAsync(
          `cd ${tempDir} && npm run playtest -- --format json`,
          { timeout: 60000 }
        );

        return {
          success: true,
          results: JSON.parse(stdout),
          errors: stderr
        };
      } finally {
        // Cleanup
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error('Playtest failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Run security scan on pack
   */
  private async runSecurityScan(zip: AdmZip, manifest: PackManifest): Promise<any> {
    try {
      const securityIssues: string[] = [];
      
      // Check for dangerous patterns
      const dangerousPatterns = [
        /eval\s*\(/,
        /Function\s*\(/,
        /setTimeout\s*\(/,
        /setInterval\s*\(/,
        /require\s*\(/,
        /import\s*\(/,
        /process\./,
        /fs\./,
        /child_process/,
        /exec\s*\(/,
        /spawn\s*\(/
      ];

      // Scan all files in the pack
      for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue;
        
        const content = entry.getData().toString('utf8');
        const fileName = entry.entryName;
        
        for (const pattern of dangerousPatterns) {
          if (pattern.test(content)) {
            securityIssues.push(`Dangerous pattern found in ${fileName}: ${pattern.source}`);
          }
        }
      }

      return {
        success: securityIssues.length === 0,
        issues: securityIssues,
        scanned_files: zip.getEntries().filter(e => !e.isDirectory).length
      };
    } catch (error) {
      console.error('Security scan failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Build SBOM (Software Bill of Materials)
   */
  private async buildSBOM(zip: AdmZip, namespace: string, version: string): Promise<PackSBOM> {
    const files: Array<{
      path: string;
      hash: string;
      size: number;
      type: string;
    }> = [];

    let totalSize = 0;

    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      
      const content = entry.getData();
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      const size = content.length;
      totalSize += size;

      files.push({
        path: entry.entryName,
        hash: hash,
        size: size,
        type: this.getFileType(entry.entryName)
      });
    }

    return {
      namespace,
      version,
      files,
      total_size: totalSize,
      created_at: new Date().toISOString()
    };
  }

  /**
   * Sign pack with server key
   */
  private async signPack(hash: string): Promise<string> {
    try {
      // In production, this would use a proper signing key
      // For now, we'll create a mock signature
      const signature = crypto.createHmac('sha256', this.signingKey)
        .update(hash)
        .digest('hex');
      
      return signature;
    } catch (error) {
      console.error('Pack signing failed:', error);
      throw new Error('Failed to sign pack');
    }
  }

  /**
   * Validate manifest
   */
  private validateManifest(manifestData: any, namespace: string, version: string): PackManifest {
    // Validate required fields
    const requiredFields = ['name', 'description', 'author', 'awf_core_range', 'license'];
    for (const field of requiredFields) {
      if (!manifestData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate namespace matches
    if (manifestData.namespace !== namespace) {
      throw new Error(`Manifest namespace (${manifestData.namespace}) does not match upload namespace (${namespace})`);
    }

    // Validate version matches
    if (manifestData.version !== version) {
      throw new Error(`Manifest version (${manifestData.version}) does not match upload version (${version})`);
    }

    // Validate semantic version
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      throw new Error('Version must be semantic (e.g., 1.0.0)');
    }

    return {
      namespace: manifestData.namespace,
      version: manifestData.version,
      name: manifestData.name,
      description: manifestData.description,
      author: manifestData.author,
      awf_core_range: manifestData.awf_core_range,
      dependencies: manifestData.dependencies || [],
      capabilities: manifestData.capabilities || [],
      tags: manifestData.tags || [],
      license: manifestData.license,
      homepage: manifestData.homepage,
      repository: manifestData.repository
    };
  }

  /**
   * Store dependencies
   */
  private async storeDependencies(
    namespace: string, 
    version: string, 
    dependencies: Array<{
      namespace: string;
      version_range: string;
      type: 'required' | 'optional' | 'conflicts';
    }>
  ): Promise<void> {
    if (dependencies.length === 0) return;

    const depData = dependencies.map(dep => ({
      namespace,
      version,
      dep_namespace: dep.namespace,
      dep_version_range: dep.version_range,
      dep_type: dep.type
    }));

    const { error } = await this.supabase
      .from('mod_pack_dependencies')
      .insert(depData);

    if (error) {
      throw new Error(`Failed to store dependencies: ${error.message}`);
    }
  }

  /**
   * Store capabilities
   */
  private async storeCapabilities(
    namespace: string, 
    version: string, 
    capabilities: Array<{
      hook_name: string;
      hook_type: string;
      description: string;
    }>
  ): Promise<void> {
    if (capabilities.length === 0) return;

    const capData = capabilities.map(cap => ({
      namespace,
      version,
      hook_name: cap.hook_name,
      hook_type: cap.hook_type,
      description: cap.description
    }));

    const { error } = await this.supabase
      .from('mod_pack_capabilities')
      .insert(capData);

    if (error) {
      throw new Error(`Failed to store capabilities: ${error.message}`);
    }
  }

  /**
   * Store tags
   */
  private async storeTags(
    namespace: string, 
    version: string, 
    tags: string[]
  ): Promise<void> {
    if (tags.length === 0) return;

    const tagData = tags.map(tag => ({
      namespace,
      version,
      tag
    }));

    const { error } = await this.supabase
      .from('mod_pack_tags')
      .insert(tagData);

    if (error) {
      throw new Error(`Failed to store tags: ${error.message}`);
    }
  }

  /**
   * Get file type from extension
   */
  private getFileType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    
    const typeMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.json': 'json',
      '.md': 'markdown',
      '.txt': 'text',
      '.png': 'image',
      '.jpg': 'image',
      '.jpeg': 'image',
      '.gif': 'image',
      '.svg': 'image',
      '.css': 'stylesheet',
      '.html': 'html',
      '.xml': 'xml',
      '.yml': 'yaml',
      '.yaml': 'yaml'
    };

    return typeMap[ext] || 'unknown';
  }
}

export const packPipelineService = new PackPipelineService();
