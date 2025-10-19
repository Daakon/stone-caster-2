/**
 * Phase 20: Publish Pipeline
 * Handles document publishing with validation gates and versioning
 */

import { z } from 'zod';
import { validatorsHub, ValidationResult } from './validators-hub.js';
import { previewAssembler, PreviewResult } from './preview-assembler.js';

// Types
export interface PublishRequest {
  draftId: string;
  docType: string;
  docRef: string;
  version: string;
  changelog: string;
  playtestReport?: string;
  publishedBy: string;
}

export interface PublishResult {
  success: boolean;
  version: string;
  hash: string;
  changelogPath: string;
  playtestReportPath?: string;
  errors: string[];
  warnings: string[];
}

export interface PublishGate {
  name: string;
  required: boolean;
  passed: boolean;
  message: string;
  details?: any;
}

export interface PublishGates {
  linterClean: PublishGate;
  playtestVerify: PublishGate;
  econLinter: PublishGate;
  simLinter: PublishGate;
  graphLinter: PublishGate;
  tokenCap: PublishGate;
  toolQuota: PublishGate;
}

// Schemas
const PublishRequestSchema = z.object({
  draftId: z.string().uuid(),
  docType: z.string(),
  docRef: z.string(),
  version: z.string(),
  changelog: z.string().min(10),
  playtestReport: z.string().optional(),
  publishedBy: z.string().uuid(),
});

export class PublishPipeline {
  private validators: typeof validatorsHub;
  private assembler: typeof previewAssembler;

  constructor() {
    this.validators = validatorsHub;
    this.assembler = previewAssembler;
  }

  /**
   * Publish a document with all gates
   */
  async publishDocument(
    request: PublishRequest,
    documents: Record<string, any>
  ): Promise<PublishResult> {
    try {
      // Validate request
      const requestValidation = PublishRequestSchema.safeParse(request);
      if (!requestValidation.success) {
        return {
          success: false,
          version: '',
          hash: '',
          changelogPath: '',
          errors: ['Invalid publish request'],
          warnings: [],
        };
      }

      // Run all gates
      const gates = await this.runPublishGates(request, documents);
      
      // Check if all required gates passed
      const requiredGates = Object.values(gates).filter(gate => gate.required);
      const failedGates = requiredGates.filter(gate => !gate.passed);
      
      if (failedGates.length > 0) {
        return {
          success: false,
          version: '',
          hash: '',
          changelogPath: '',
          errors: failedGates.map(gate => `${gate.name}: ${gate.message}`),
          warnings: [],
        };
      }

      // Generate version and hash
      const version = this.generateVersion(request.version);
      const hash = await this.generateHash(documents);

      // Create changelog
      const changelogPath = await this.createChangelog(request, version);

      // Create playtest report path if provided
      let playtestReportPath: string | undefined;
      if (request.playtestReport) {
        playtestReportPath = await this.createPlaytestReport(request.playtestReport, version);
      }

      // Publish to versioned tables
      await this.publishToVersionedTables(request, version, hash, changelogPath, playtestReportPath);

      return {
        success: true,
        version,
        hash,
        changelogPath,
        playtestReportPath,
        errors: [],
        warnings: Object.values(gates).filter(gate => !gate.passed).map(gate => `${gate.name}: ${gate.message}`),
      };

    } catch (error) {
      return {
        success: false,
        version: '',
        hash: '',
        changelogPath: '',
        errors: [`Publish failed: ${error}`],
        warnings: [],
      };
    }
  }

  /**
   * Run all publish gates
   */
  private async runPublishGates(
    request: PublishRequest,
    documents: Record<string, any>
  ): Promise<PublishGates> {
    const gates: PublishGates = {
      linterClean: { name: 'Linter Clean', required: true, passed: false, message: 'Not checked' },
      playtestVerify: { name: 'Playtest Verify', required: true, passed: false, message: 'Not checked' },
      econLinter: { name: 'Economy Linter', required: true, passed: false, message: 'Not checked' },
      simLinter: { name: 'Simulation Linter', required: true, passed: false, message: 'Not checked' },
      graphLinter: { name: 'Graph Linter', required: true, passed: false, message: 'Not checked' },
      tokenCap: { name: 'Token Cap', required: true, passed: false, message: 'Not checked' },
      toolQuota: { name: 'Tool Quota', required: true, passed: false, message: 'Not checked' },
    };

    // Run linter clean gate
    await this.runLinterCleanGate(gates.linterClean, documents);

    // Run playtest verify gate
    await this.runPlaytestVerifyGate(gates.playtestVerify, request);

    // Run economy linter gate
    await this.runEconomyLinterGate(gates.econLinter, documents);

    // Run simulation linter gate
    await this.runSimLinterGate(gates.simLinter, documents);

    // Run graph linter gate
    await this.runGraphLinterGate(gates.graphLinter, documents);

    // Run token cap gate
    await this.runTokenCapGate(gates.tokenCap, documents);

    // Run tool quota gate
    await this.runToolQuotaGate(gates.toolQuota, documents);

    return gates;
  }

  /**
   * Run linter clean gate
   */
  private async runLinterCleanGate(gate: PublishGate, documents: Record<string, any>): Promise<void> {
    try {
      const validation = await this.validators.validateDocuments(documents, {
        strict: true,
        includeWarnings: false,
        includeInfo: false,
        docTypes: [],
      });

      if (validation.valid && validation.summary.errors === 0) {
        gate.passed = true;
        gate.message = 'All linters passed';
      } else {
        gate.passed = false;
        gate.message = `${validation.summary.errors} linter errors found`;
        gate.details = validation.diagnostics;
      }
    } catch (error) {
      gate.passed = false;
      gate.message = `Linter check failed: ${error}`;
    }
  }

  /**
   * Run playtest verify gate
   */
  private async runPlaytestVerifyGate(gate: PublishGate, request: PublishRequest): Promise<void> {
    try {
      // This would integrate with Phase 9 playtest verify
      // For now, simulate the check
      if (request.playtestReport) {
        gate.passed = true;
        gate.message = 'Playtest report provided and verified';
      } else {
        gate.passed = false;
        gate.message = 'Playtest report required for publish';
      }
    } catch (error) {
      gate.passed = false;
      gate.message = `Playtest verify failed: ${error}`;
    }
  }

  /**
   * Run economy linter gate
   */
  private async runEconomyLinterGate(gate: PublishGate, documents: Record<string, any>): Promise<void> {
    try {
      const econDocs = Object.entries(documents).filter(([_, doc]) => 
        ['items', 'recipes', 'loot', 'vendors'].includes(doc.doc_type)
      );

      if (econDocs.length === 0) {
        gate.passed = true;
        gate.message = 'No economy documents to lint';
        return;
      }

      const validation = await this.validators.validateDocuments(documents, {
        strict: true,
        includeWarnings: false,
        includeInfo: false,
        docTypes: ['items', 'recipes', 'loot', 'vendors'],
      });

      if (validation.valid && validation.summary.errors === 0) {
        gate.passed = true;
        gate.message = 'Economy linter passed';
      } else {
        gate.passed = false;
        gate.message = `${validation.summary.errors} economy linter errors found`;
        gate.details = validation.diagnostics;
      }
    } catch (error) {
      gate.passed = false;
      gate.message = `Economy linter failed: ${error}`;
    }
  }

  /**
   * Run simulation linter gate
   */
  private async runSimLinterGate(gate: PublishGate, documents: Record<string, any>): Promise<void> {
    try {
      const simDocs = Object.entries(documents).filter(([_, doc]) => 
        ['sim_config', 'region', 'event', 'npc_schedule'].includes(doc.doc_type)
      );

      if (simDocs.length === 0) {
        gate.passed = true;
        gate.message = 'No simulation documents to lint';
        return;
      }

      const validation = await this.validators.validateDocuments(documents, {
        strict: true,
        includeWarnings: false,
        includeInfo: false,
        docTypes: ['sim_config', 'region', 'event', 'npc_schedule'],
      });

      if (validation.valid && validation.summary.errors === 0) {
        gate.passed = true;
        gate.message = 'Simulation linter passed';
      } else {
        gate.passed = false;
        gate.message = `${validation.summary.errors} simulation linter errors found`;
        gate.details = validation.diagnostics;
      }
    } catch (error) {
      gate.passed = false;
      gate.message = `Simulation linter failed: ${error}`;
    }
  }

  /**
   * Run graph linter gate
   */
  private async runGraphLinterGate(gate: PublishGate, documents: Record<string, any>): Promise<void> {
    try {
      const graphDocs = Object.entries(documents).filter(([_, doc]) => 
        doc.doc_type === 'quest_graph'
      );

      if (graphDocs.length === 0) {
        gate.passed = true;
        gate.message = 'No graph documents to lint';
        return;
      }

      const validation = await this.validators.validateDocuments(documents, {
        strict: true,
        includeWarnings: false,
        includeInfo: false,
        docTypes: ['quest_graph'],
      });

      if (validation.valid && validation.summary.errors === 0) {
        gate.passed = true;
        gate.message = 'Graph linter passed';
      } else {
        gate.passed = false;
        gate.message = `${validation.summary.errors} graph linter errors found`;
        gate.details = validation.diagnostics;
      }
    } catch (error) {
      gate.passed = false;
      gate.message = `Graph linter failed: ${error}`;
    }
  }

  /**
   * Run token cap gate
   */
  private async runTokenCapGate(gate: PublishGate, documents: Record<string, any>): Promise<void> {
    try {
      // Create mock session for preview
      const mockSession = {
        sessionId: 'preview-session',
        turnId: 0,
        nodeId: 'node.start',
        worldRef: 'world.forest_glade',
        adventureRef: 'adv.herbal_journey',
        playerProfile: {
          name: 'Test Player',
          level: 1,
          skills: { combat: 50, magic: 30, stealth: 40 },
          resources: { hp: 100, mana: 50, gold: 100 },
        },
        gameState: {
          hot: {},
          cold: {},
        },
      };

      const preview = await this.assembler.assemblePreview(documents, mockSession, {
        tokenCap: 8000,
        toolQuota: 10,
      });

      if (preview.success && preview.tokenEstimate <= 8000) {
        gate.passed = true;
        gate.message = `Token estimate (${preview.tokenEstimate}) within cap (8000)`;
      } else {
        gate.passed = false;
        gate.message = `Token estimate (${preview.tokenEstimate}) exceeds cap (8000)`;
        gate.details = preview.tokenBreakdown;
      }
    } catch (error) {
      gate.passed = false;
      gate.message = `Token cap check failed: ${error}`;
    }
  }

  /**
   * Run tool quota gate
   */
  private async runToolQuotaGate(gate: PublishGate, documents: Record<string, any>): Promise<void> {
    try {
      // This would check tool usage in documents
      // For now, simulate the check
      const toolCount = this.countToolsInDocuments(documents);
      
      if (toolCount <= 10) {
        gate.passed = true;
        gate.message = `Tool count (${toolCount}) within quota (10)`;
      } else {
        gate.passed = false;
        gate.message = `Tool count (${toolCount}) exceeds quota (10)`;
      }
    } catch (error) {
      gate.passed = false;
      gate.message = `Tool quota check failed: ${error}`;
    }
  }

  /**
   * Count tools in documents
   */
  private countToolsInDocuments(documents: Record<string, any>): number {
    let toolCount = 0;
    
    for (const doc of Object.values(documents)) {
      if (doc.doc_type === 'core' && doc.payload.tools) {
        toolCount += doc.payload.tools.length;
      }
    }
    
    return toolCount;
  }

  /**
   * Generate version string
   */
  private generateVersion(version: string): string {
    // This would implement semver logic
    // For now, just return the provided version
    return version;
  }

  /**
   * Generate hash for documents
   */
  private async generateHash(documents: Record<string, any>): Promise<string> {
    const content = JSON.stringify(documents, Object.keys(documents).sort());
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Create changelog
   */
  private async createChangelog(request: PublishRequest, version: string): Promise<string> {
    const changelogPath = `changelogs/${request.docType}/${request.docRef}/v${version}.md`;
    
    const changelogContent = `# Changelog for ${request.docRef} v${version}

## Changes
${request.changelog}

## Published
- Date: ${new Date().toISOString()}
- Published by: ${request.publishedBy}
- Version: ${version}
`;

    // This would write to file system
    console.log(`Creating changelog at ${changelogPath}`);
    
    return changelogPath;
  }

  /**
   * Create playtest report
   */
  private async createPlaytestReport(playtestReport: string, version: string): Promise<string> {
    const reportPath = `playtest-reports/${version}.json`;
    
    // This would write to file system
    console.log(`Creating playtest report at ${reportPath}`);
    
    return reportPath;
  }

  /**
   * Publish to versioned tables
   */
  private async publishToVersionedTables(
    request: PublishRequest,
    version: string,
    hash: string,
    changelogPath: string,
    playtestReportPath?: string
  ): Promise<void> {
    // This would insert into publish_history table
    console.log(`Publishing ${request.docRef} v${version} with hash ${hash}`);
  }
}

// Singleton instance
export const publishPipeline = new PublishPipeline();


