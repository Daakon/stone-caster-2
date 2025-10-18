/**
 * Phase 20: Validators Hub
 * Unifies calls to all existing validators/linters for authoring IDE
 */

import { z } from 'zod';

// Types
export interface ValidationDiagnostic {
  level: 'error' | 'warning' | 'info';
  message: string;
  doc_ref: string;
  json_pointer: string;
  code?: string;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  diagnostics: ValidationDiagnostic[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
}

export interface ValidationOptions {
  strict: boolean;
  includeWarnings: boolean;
  includeInfo: boolean;
  docTypes: string[];
}

export interface DocumentBundle {
  [docRef: string]: {
    doc_type: string;
    payload: any;
    format: 'json' | 'yaml';
  };
}

// Schemas
const ValidationDiagnosticSchema = z.object({
  level: z.enum(['error', 'warning', 'info']),
  message: z.string(),
  doc_ref: z.string(),
  json_pointer: z.string(),
  code: z.string().optional(),
  suggestion: z.string().optional(),
});

const ValidationResultSchema = z.object({
  valid: z.boolean(),
  diagnostics: z.array(ValidationDiagnosticSchema),
  summary: z.object({
    errors: z.number().int().min(0),
    warnings: z.number().int().min(0),
    info: z.number().int().min(0),
  }),
});

export class ValidatorsHub {
  private validators: Map<string, any> = new Map();

  constructor() {
    this.initializeValidators();
  }

  /**
   * Validate a bundle of documents
   */
  async validateDocuments(
    documents: DocumentBundle,
    options: ValidationOptions = {
      strict: false,
      includeWarnings: true,
      includeInfo: false,
      docTypes: [],
    }
  ): Promise<ValidationResult> {
    const allDiagnostics: ValidationDiagnostic[] = [];

    for (const [docRef, doc] of Object.entries(documents)) {
      // Skip if doc type not in filter
      if (options.docTypes.length > 0 && !options.docTypes.includes(doc.doc_type)) {
        continue;
      }

      const docDiagnostics = await this.validateDocument(docRef, doc, options);
      allDiagnostics.push(...docDiagnostics);
    }

    // Filter diagnostics based on options
    const filteredDiagnostics = allDiagnostics.filter(diag => {
      if (diag.level === 'error') return true;
      if (diag.level === 'warning' && options.includeWarnings) return true;
      if (diag.level === 'info' && options.includeInfo) return true;
      return false;
    });

    // Calculate summary
    const summary = {
      errors: filteredDiagnostics.filter(d => d.level === 'error').length,
      warnings: filteredDiagnostics.filter(d => d.level === 'warning').length,
      info: filteredDiagnostics.filter(d => d.level === 'info').length,
    };

    return {
      valid: summary.errors === 0,
      diagnostics: filteredDiagnostics,
      summary,
    };
  }

  /**
   * Validate a single document
   */
  private async validateDocument(
    docRef: string,
    doc: { doc_type: string; payload: any; format: string },
    options: ValidationOptions
  ): Promise<ValidationDiagnostic[]> {
    const diagnostics: ValidationDiagnostic[] = [];

    try {
      // Schema validation (Phase 1)
      const schemaDiagnostics = await this.validateSchema(docRef, doc);
      diagnostics.push(...schemaDiagnostics);

      // Authoring validation (Phase 9)
      if (doc.doc_type === 'adventure' || doc.doc_type === 'world') {
        const authoringDiagnostics = await this.validateAuthoring(docRef, doc);
        diagnostics.push(...authoringDiagnostics);
      }

      // i18n validation (Phase 12)
      if (doc.doc_type === 'localization') {
        const i18nDiagnostics = await this.validateI18n(docRef, doc);
        diagnostics.push(...i18nDiagnostics);
      }

      // Graph validation (Phase 15)
      if (doc.doc_type === 'quest_graph') {
        const graphDiagnostics = await this.validateGraph(docRef, doc);
        diagnostics.push(...graphDiagnostics);
      }

      // Economy validation (Phase 17)
      if (['items', 'recipes', 'loot', 'vendors'].includes(doc.doc_type)) {
        const econDiagnostics = await this.validateEconomy(docRef, doc);
        diagnostics.push(...econDiagnostics);
      }

      // Simulation validation (Phase 19)
      if (['sim_config', 'region', 'event', 'npc_schedule'].includes(doc.doc_type)) {
        const simDiagnostics = await this.validateSimulation(docRef, doc);
        diagnostics.push(...simDiagnostics);
      }

      // Mechanics validation (Phase 16)
      if (doc.doc_type === 'core') {
        const mechanicsDiagnostics = await this.validateMechanics(docRef, doc);
        diagnostics.push(...mechanicsDiagnostics);
      }

    } catch (error) {
      diagnostics.push({
        level: 'error',
        message: `Validation failed: ${error}`,
        doc_ref: docRef,
        json_pointer: '',
        code: 'VALIDATION_ERROR',
      });
    }

    return diagnostics;
  }

  /**
   * Schema validation (Phase 1)
   */
  private async validateSchema(
    docRef: string,
    doc: { doc_type: string; payload: any; format: string }
  ): Promise<ValidationDiagnostic[]> {
    const diagnostics: ValidationDiagnostic[] = [];

    try {
      // Basic JSON/YAML structure validation
      if (doc.format === 'json' && typeof doc.payload !== 'object') {
        diagnostics.push({
          level: 'error',
          message: 'Invalid JSON structure',
          doc_ref,
          json_pointer: '',
          code: 'INVALID_JSON',
        });
      }

      // Check required fields based on doc type
      const requiredFields = this.getRequiredFields(doc.doc_type);
      for (const field of requiredFields) {
        if (!doc.payload[field]) {
          diagnostics.push({
            level: 'error',
            message: `Missing required field: ${field}`,
            doc_ref,
            json_pointer: `/${field}`,
            code: 'MISSING_REQUIRED_FIELD',
          });
        }
      }

    } catch (error) {
      diagnostics.push({
        level: 'error',
        message: `Schema validation failed: ${error}`,
        doc_ref,
        json_pointer: '',
        code: 'SCHEMA_ERROR',
      });
    }

    return diagnostics;
  }

  /**
   * Authoring validation (Phase 9)
   */
  private async validateAuthoring(
    docRef: string,
    doc: { doc_type: string; payload: any; format: string }
  ): Promise<ValidationDiagnostic[]> {
    const diagnostics: ValidationDiagnostic[] = [];

    // This would integrate with Phase 9 authoring linter
    // For now, return mock diagnostics
    if (doc.doc_type === 'adventure') {
      if (!doc.payload.name || doc.payload.name.length < 3) {
        diagnostics.push({
          level: 'error',
          message: 'Adventure name must be at least 3 characters',
          doc_ref,
          json_pointer: '/name',
          code: 'INVALID_NAME_LENGTH',
        });
      }

      if (!doc.payload.description || doc.payload.description.length < 10) {
        diagnostics.push({
          level: 'warning',
          message: 'Adventure description should be at least 10 characters',
          doc_ref,
          json_pointer: '/description',
          code: 'SHORT_DESCRIPTION',
        });
      }
    }

    return diagnostics;
  }

  /**
   * i18n validation (Phase 12)
   */
  private async validateI18n(
    docRef: string,
    doc: { doc_type: string; payload: any; format: string }
  ): Promise<ValidationDiagnostic[]> {
    const diagnostics: ValidationDiagnostic[] = [];

    // This would integrate with Phase 12 i18n linter
    // For now, return mock diagnostics
    if (doc.doc_type === 'localization') {
      if (!doc.payload.locale) {
        diagnostics.push({
          level: 'error',
          message: 'Missing locale field',
          doc_ref,
          json_pointer: '/locale',
          code: 'MISSING_LOCALE',
        });
      }

      if (!doc.payload.translations || Object.keys(doc.payload.translations).length === 0) {
        diagnostics.push({
          level: 'warning',
          message: 'No translations provided',
          doc_ref,
          json_pointer: '/translations',
          code: 'NO_TRANSLATIONS',
        });
      }
    }

    return diagnostics;
  }

  /**
   * Graph validation (Phase 15)
   */
  private async validateGraph(
    docRef: string,
    doc: { doc_type: string; payload: any; format: string }
  ): Promise<ValidationDiagnostic[]> {
    const diagnostics: ValidationDiagnostic[] = [];

    // This would integrate with Phase 15 graph linter
    // For now, return mock diagnostics
    if (doc.doc_type === 'quest_graph') {
      if (!doc.payload.nodes || doc.payload.nodes.length === 0) {
        diagnostics.push({
          level: 'error',
          message: 'Quest graph must have at least one node',
          doc_ref,
          json_pointer: '/nodes',
          code: 'NO_NODES',
        });
      }

      if (!doc.payload.edges) {
        diagnostics.push({
          level: 'warning',
          message: 'Quest graph has no edges',
          doc_ref,
          json_pointer: '/edges',
          code: 'NO_EDGES',
        });
      }
    }

    return diagnostics;
  }

  /**
   * Economy validation (Phase 17)
   */
  private async validateEconomy(
    docRef: string,
    doc: { doc_type: string; payload: any; format: string }
  ): Promise<ValidationDiagnostic[]> {
    const diagnostics: ValidationDiagnostic[] = [];

    // This would integrate with Phase 17 economy linter
    // For now, return mock diagnostics
    if (doc.doc_type === 'items') {
      if (!doc.payload.id || !doc.payload.id.startsWith('itm.')) {
        diagnostics.push({
          level: 'error',
          message: 'Item ID must start with "itm."',
          doc_ref,
          json_pointer: '/id',
          code: 'INVALID_ITEM_ID',
        });
      }

      if (!doc.payload.name || doc.payload.name.length < 2) {
        diagnostics.push({
          level: 'error',
          message: 'Item name must be at least 2 characters',
          doc_ref,
          json_pointer: '/name',
          code: 'INVALID_ITEM_NAME',
        });
      }
    }

    return diagnostics;
  }

  /**
   * Simulation validation (Phase 19)
   */
  private async validateSimulation(
    docRef: string,
    doc: { doc_type: string; payload: any; format: string }
  ): Promise<ValidationDiagnostic[]> {
    const diagnostics: ValidationDiagnostic[] = [];

    // This would integrate with Phase 19 sim linter
    // For now, return mock diagnostics
    if (doc.doc_type === 'region') {
      if (!doc.payload.coords || !Array.isArray(doc.payload.coords) || doc.payload.coords.length !== 2) {
        diagnostics.push({
          level: 'error',
          message: 'Region must have valid coordinates [x, y]',
          doc_ref,
          json_pointer: '/coords',
          code: 'INVALID_COORDS',
        });
      }

      if (doc.payload.base_prosperity < 0 || doc.payload.base_prosperity > 100) {
        diagnostics.push({
          level: 'error',
          message: 'Base prosperity must be between 0 and 100',
          doc_ref,
          json_pointer: '/base_prosperity',
          code: 'INVALID_PROSPERITY',
        });
      }
    }

    return diagnostics;
  }

  /**
   * Mechanics validation (Phase 16)
   */
  private async validateMechanics(
    docRef: string,
    doc: { doc_type: string; payload: any; format: string }
  ): Promise<ValidationDiagnostic[]> {
    const diagnostics: ValidationDiagnostic[] = [];

    // This would integrate with Phase 16 mechanics linter
    // For now, return mock diagnostics
    if (doc.doc_type === 'core') {
      if (!doc.payload.version) {
        diagnostics.push({
          level: 'error',
          message: 'Core document must have a version',
          doc_ref,
          json_pointer: '/version',
          code: 'MISSING_VERSION',
        });
      }

      if (!doc.payload.settings) {
        diagnostics.push({
          level: 'warning',
          message: 'Core document should have settings',
          doc_ref,
          json_pointer: '/settings',
          code: 'MISSING_SETTINGS',
        });
      }
    }

    return diagnostics;
  }

  /**
   * Get required fields for a document type
   */
  private getRequiredFields(docType: string): string[] {
    const requiredFields: Record<string, string[]> = {
      world: ['id', 'name'],
      adventure: ['id', 'name', 'world_ref'],
      quest_graph: ['id', 'adventure_ref', 'nodes'],
      items: ['id', 'name'],
      recipes: ['id', 'inputs', 'outputs'],
      loot: ['id', 'items'],
      vendors: ['id', 'name', 'inventory'],
      npc_personality: ['npc_id', 'traits'],
      localization: ['locale', 'translations'],
      sim_config: ['id', 'settings'],
      region: ['id', 'name', 'coords'],
      event: ['id', 'name', 'type'],
      npc_schedule: ['npc_id', 'entries'],
    };

    return requiredFields[docType] || ['id'];
  }

  /**
   * Initialize validators
   */
  private initializeValidators(): void {
    // This would initialize all the validators from previous phases
    // For now, just set up the structure
    this.validators.set('schema', { validate: this.validateSchema });
    this.validators.set('authoring', { validate: this.validateAuthoring });
    this.validators.set('i18n', { validate: this.validateI18n });
    this.validators.set('graph', { validate: this.validateGraph });
    this.validators.set('economy', { validate: this.validateEconomy });
    this.validators.set('simulation', { validate: this.validateSimulation });
    this.validators.set('mechanics', { validate: this.validateMechanics });
  }

  /**
   * Get validator for a specific type
   */
  getValidator(type: string): any {
    return this.validators.get(type);
  }

  /**
   * Get all available validators
   */
  getAvailableValidators(): string[] {
    return Array.from(this.validators.keys());
  }
}

// Singleton instance
export const validatorsHub = new ValidatorsHub();


