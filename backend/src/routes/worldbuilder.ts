/**
 * Phase 20: WorldBuilder API
 * REST endpoints for programmatic CRUD + validation + preview assembly
 */

import { Router } from 'express';
import { z } from 'zod';
import { validatorsHub } from '../authoring/validators-hub.js';
import { previewAssembler } from '../authoring/preview-assembler.js';
import { publishPipeline } from '../authoring/publish-pipeline.js';
import { xrefService } from '../authoring/xref-service.js';

const router = Router();

// Middleware for RBAC
const requireRole = (roles: string[]) => {
  return (req: any, res: any, next: any) => {
    // This would integrate with Phase 7 auth system
    const userRole = req.user?.role || 'user';
    
    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required_roles: roles,
      });
    }
    
    next();
  };
};

// Middleware for audit logging
const auditLog = (action: string) => {
  return (req: any, res: any, next: any) => {
    // This would integrate with Phase 7 audit system
    console.log(`Audit: ${action} by ${req.user?.id} at ${new Date().toISOString()}`);
    next();
  };
};

// Schemas
const DocumentSchema = z.object({
  doc_type: z.string(),
  doc_ref: z.string(),
  payload: z.any(),
  format: z.enum(['json', 'yaml']).default('json'),
});

const ValidationRequestSchema = z.object({
  documents: z.record(z.string(), DocumentSchema),
  options: z.object({
    strict: z.boolean().default(false),
    includeWarnings: z.boolean().default(true),
    includeInfo: z.boolean().default(false),
    docTypes: z.array(z.string()).default([]),
  }).optional(),
});

const UpsertRequestSchema = z.object({
  documents: z.record(z.string(), DocumentSchema),
  workspace_id: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const PreviewRequestSchema = z.object({
  documents: z.record(z.string(), DocumentSchema),
  session: z.object({
    sessionId: z.string(),
    turnId: z.number().int().min(0),
    nodeId: z.string(),
    worldRef: z.string(),
    adventureRef: z.string(),
    playerProfile: z.object({
      name: z.string(),
      level: z.number().int().min(1),
      skills: z.record(z.string(), z.number()),
      resources: z.record(z.string(), z.number()),
    }),
    gameState: z.object({
      hot: z.any(),
      cold: z.any(),
    }),
  }),
  options: z.object({
    includeWorld: z.boolean().default(true),
    includeAdventure: z.boolean().default(true),
    includeGraph: z.boolean().default(true),
    includeSim: z.boolean().default(true),
    includeParty: z.boolean().default(true),
    includeEconomy: z.boolean().default(true),
    includeLocalization: z.boolean().default(true),
    tokenCap: z.number().int().min(1000).max(50000).default(8000),
    toolQuota: z.number().int().min(1).max(100).default(10),
  }).optional(),
});

const PublishRequestSchema = z.object({
  draftId: z.string().uuid(),
  docType: z.string(),
  docRef: z.string(),
  version: z.string(),
  changelog: z.string().min(10),
  playtestReport: z.string().optional(),
});

const SearchRequestSchema = z.object({
  query: z.string().min(1),
  options: z.object({
    includeTypes: z.array(z.string()).default([]),
    excludeTypes: z.array(z.string()).default([]),
    maxResults: z.number().int().min(1).max(100).default(20),
    fuzzy: z.boolean().default(false),
  }).optional(),
});

// POST /api/worldbuilder/docs/validate - Validate documents
router.post('/docs/validate', 
  requireRole(['author', 'editor', 'admin']),
  auditLog('validate_documents'),
  async (req, res) => {
    try {
      const { documents, options } = ValidationRequestSchema.parse(req.body);
      
      const result = await validatorsHub.validateDocuments(documents, options);
      
      res.json({
        success: result.valid,
        data: {
          valid: result.valid,
          diagnostics: result.diagnostics,
          summary: result.summary,
        },
        message: result.valid ? 'All documents valid' : 'Validation failed',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: error.errors,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Validation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// POST /api/worldbuilder/docs/upsert - Upsert documents (drafts only)
router.post('/docs/upsert',
  requireRole(['author', 'editor', 'admin']),
  auditLog('upsert_documents'),
  async (req, res) => {
    try {
      const { documents, workspace_id, notes } = UpsertRequestSchema.parse(req.body);
      
      // This would integrate with database
      const results = [];
      
      for (const [docRef, doc] of Object.entries(documents)) {
        // Validate document before upsert
        const validation = await validatorsHub.validateDocuments(
          { [docRef]: doc },
          { strict: false, includeWarnings: true, includeInfo: false, docTypes: [] }
        );
        
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            error: 'Document validation failed',
            details: validation.diagnostics,
          });
        }
        
        // This would upsert to author_drafts table
        results.push({
          doc_ref: docRef,
          doc_type: doc.doc_type,
          status: 'upserted',
          validation: validation.summary,
        });
      }
      
      res.json({
        success: true,
        data: results,
        message: `Upserted ${results.length} documents successfully`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: error.errors,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Upsert failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// POST /api/worldbuilder/preview/assemble - Assemble preview bundle
router.post('/preview/assemble',
  requireRole(['author', 'editor', 'admin']),
  auditLog('assemble_preview'),
  async (req, res) => {
    try {
      const { documents, session, options } = PreviewRequestSchema.parse(req.body);
      
      const result = await previewAssembler.assemblePreview(documents, session, options);
      
      res.json({
        success: result.success,
        data: {
          bundle: result.bundle,
          tokenEstimate: result.tokenEstimate,
          tokenBreakdown: result.tokenBreakdown,
          slices: result.slices,
          warnings: result.warnings,
          errors: result.errors,
        },
        message: result.success ? 'Preview assembled successfully' : 'Preview assembly failed',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: error.errors,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Preview assembly failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// POST /api/worldbuilder/publish - Publish document
router.post('/publish',
  requireRole(['editor', 'admin']),
  auditLog('publish_document'),
  async (req, res) => {
    try {
      const publishRequest = PublishRequestSchema.parse(req.body);
      
      // This would fetch documents from database
      const documents = {}; // Mock documents
      
      const result = await publishPipeline.publishDocument(publishRequest, documents);
      
      res.json({
        success: result.success,
        data: {
          version: result.version,
          hash: result.hash,
          changelogPath: result.changelogPath,
          playtestReportPath: result.playtestReportPath,
          errors: result.errors,
          warnings: result.warnings,
        },
        message: result.success ? 'Document published successfully' : 'Publish failed',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: error.errors,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Publish failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// GET /api/worldbuilder/refs/search - Search references
router.get('/refs/search',
  requireRole(['author', 'editor', 'admin']),
  async (req, res) => {
    try {
      const { query, options } = SearchRequestSchema.parse({
        query: req.query.q as string,
        options: req.query.options ? JSON.parse(req.query.options as string) : {},
      });
      
      const results = await xrefService.searchReferences(query, options);
      
      res.json({
        success: true,
        data: results,
        message: `Found ${results.length} references`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request parameters',
          details: error.errors,
        });
      }

      res.status(500).json({
        success: false,
        error: 'Search failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// GET /api/worldbuilder/refs/:docId - Get references for document
router.get('/refs/:docId',
  requireRole(['author', 'editor', 'admin']),
  async (req, res) => {
    try {
      const { docId } = req.params;
      
      const references = xrefService.getReferences(docId);
      const referencing = xrefService.getReferencingDocuments(docId);
      
      res.json({
        success: true,
        data: {
          references,
          referencing,
        },
        message: `Found ${references.length} references and ${referencing.length} referencing documents`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get references',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// GET /api/worldbuilder/health - Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
    message: 'WorldBuilder API is healthy',
  });
});

// GET /api/worldbuilder/stats - Get API statistics
router.get('/stats',
  requireRole(['admin']),
  async (req, res) => {
    try {
      // This would fetch from database
      const stats = {
        total_documents: 0,
        total_drafts: 0,
        total_published: 0,
        validation_errors: 0,
        validation_warnings: 0,
        last_activity: new Date().toISOString(),
      };
      
      res.json({
        success: true,
        data: stats,
        message: 'Statistics retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;


