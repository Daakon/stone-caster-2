// Phase 26: Marketplace API Routes
// Admin and creator endpoints for mod marketplace functionality

import { Router } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { creatorService } from '../marketplace/creator-service';
import { packPipelineService } from '../marketplace/pack-pipeline';
import { dependencySolverService } from '../marketplace/dep-solver';
import { distributionService } from '../marketplace/distribution';
import { moderationService } from '../marketplace/moderation';
import { metricsSummariesService } from '../marketplace/metrics-summaries';

const router = Router();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Middleware for authentication
const authenticateUser = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
};

// Middleware for admin authorization
const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const { data: creator, error } = await supabase
      .from('creators')
      .select('verified')
      .eq('creator_id', req.user.id)
      .single();

    if (error || !creator || !creator.verified) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    next();
  } catch (error) {
    res.status(403).json({ success: false, error: 'Authorization failed' });
  }
};

// Request schemas
const CreatorOnboardSchema = z.object({
  display_name: z.string().min(1).max(100),
  email: z.string().email(),
  terms_accepted: z.boolean(),
  content_policy_accepted: z.boolean()
});

const NamespaceClaimSchema = z.object({
  namespace: z.string().min(3).max(50),
  description: z.string().min(10).max(500).optional()
});

const PackUploadSchema = z.object({
  namespace: z.string(),
  version: z.string(),
  zip_data: z.string(),
  creator_id: z.string().uuid()
});

const PackReviewSchema = z.object({
  namespace: z.string(),
  version: z.string(),
  action: z.enum(['approve', 'reject']),
  review_notes: z.string().optional(),
  reviewer_id: z.string().uuid()
});

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

const RatingSchema = z.object({
  namespace: z.string(),
  version: z.string(),
  user_hash: z.string(),
  stars: z.number().min(1).max(5),
  tags: z.array(z.string()).optional(),
  comment: z.string().max(500).optional()
});

// CREATOR ENDPOINTS

/**
 * POST /creator/onboard
 * Onboard a new creator
 */
router.post('/creator/onboard', async (req, res) => {
  try {
    const validated = CreatorOnboardSchema.parse(req.body);
    const result = await creatorService.onboardCreator(validated);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Creator onboarding failed:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid request data'
    });
  }
});

/**
 * POST /namespace/claim
 * Claim a namespace
 */
router.post('/namespace/claim', authenticateUser, async (req, res) => {
  try {
    const validated = NamespaceClaimSchema.parse(req.body);
    const result = await creatorService.claimNamespace(req.user.id, validated);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Namespace claim failed:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid request data'
    });
  }
});

/**
 * GET /my/packs
 * Get creator's packs
 */
router.get('/my/packs', authenticateUser, async (req, res) => {
  try {
    const { data: packs, error } = await supabase
      .from('mod_pack_registry')
      .select(`
        namespace,
        version,
        status,
        manifest,
        created_at,
        updated_at,
        certified_at,
        listed_at,
        creator_namespaces!inner(creator_id)
      `)
      .eq('creator_namespaces.creator_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get packs: ${error.message}`);
    }

    res.json({
      success: true,
      data: packs || []
    });
  } catch (error) {
    console.error('Failed to get creator packs:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /pack/upload
 * Upload a pack
 */
router.post('/pack/upload', authenticateUser, async (req, res) => {
  try {
    const validated = PackUploadSchema.parse({
      ...req.body,
      creator_id: req.user.id
    });
    
    const result = await packPipelineService.uploadPack(validated);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Pack upload failed:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid request data'
    });
  }
});

/**
 * POST /pack/submit
 * Submit pack for review
 */
router.post('/pack/submit', authenticateUser, async (req, res) => {
  try {
    const { namespace, version } = req.body;
    
    if (!namespace || !version) {
      return res.status(400).json({
        success: false,
        error: 'Namespace and version are required'
      });
    }

    const result = await packPipelineService.submitForReview(namespace, version, req.user.id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Pack submission failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /pack/:ns/:ver/status
 * Get pack status
 */
router.get('/pack/:ns/:ver/status', async (req, res) => {
  try {
    const { ns: namespace, ver: version } = req.params;
    
    const { data: pack, error } = await supabase
      .from('mod_pack_registry')
      .select('namespace, version, status, created_at, updated_at, certified_at, listed_at, review_notes')
      .eq('namespace', namespace)
      .eq('version', version)
      .single();

    if (error) {
      throw new Error(`Pack not found: ${error.message}`);
    }

    res.json({
      success: true,
      data: pack
    });
  } catch (error) {
    console.error('Failed to get pack status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /pack/:ns/:ver/metrics
 * Get pack metrics
 */
router.get('/pack/:ns/:ver/metrics', async (req, res) => {
  try {
    const { ns: namespace, ver: version } = req.params;
    const daysBack = parseInt(req.query.days_back as string) || 30;
    
    const result = await metricsSummariesService.getPackMetrics({
      namespace,
      version,
      days_back: daysBack
    });
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Failed to get pack metrics:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /pack/:ns/:ver/delist
 * Delist a pack
 */
router.post('/pack/:ns/:ver/delist', authenticateUser, async (req, res) => {
  try {
    const { ns: namespace, ver: version } = req.params;
    
    // Verify pack ownership
    const { data: pack, error: packError } = await supabase
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

    if (pack.creator_namespaces.creator_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Pack not owned by creator'
      });
    }

    // Update status to delisted
    const { error: updateError } = await supabase
      .from('mod_pack_registry')
      .update({
        status: 'delisted',
        updated_at: new Date().toISOString()
      })
      .eq('namespace', namespace)
      .eq('version', version);

    if (updateError) {
      throw new Error(`Failed to delist pack: ${updateError.message}`);
    }

    res.json({
      success: true,
      message: 'Pack delisted successfully'
    });
  } catch (error) {
    console.error('Pack delisting failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ADMIN ENDPOINTS

/**
 * POST /pack/:ns/:ver/review
 * Review pack (admin only)
 */
router.post('/pack/:ns/:ver/review', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { ns: namespace, ver: version } = req.params;
    const validated = PackReviewSchema.parse({
      ...req.body,
      namespace,
      version,
      reviewer_id: req.user.id
    });
    
    const result = await packPipelineService.reviewPack(validated);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Pack review failed:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid request data'
    });
  }
});

/**
 * POST /pack/:ns/:ver/certify
 * Certify pack (admin only)
 */
router.post('/pack/:ns/:ver/certify', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { ns: namespace, ver: version } = req.params;
    
    const result = await packPipelineService.listPack(namespace, version);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Pack certification failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /pack/:ns/:ver/takedown
 * Execute takedown (admin only)
 */
router.post('/pack/:ns/:ver/takedown', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { ns: namespace, ver: version } = req.params;
    const { reason, takedown_type, notify_creator } = req.body;
    
    const result = await moderationService.executeTakedown({
      namespace,
      version,
      reason,
      takedown_type,
      moderator_id: req.user.id,
      notify_creator: notify_creator !== false
    });
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Takedown execution failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /token/issue
 * Issue download token (admin only)
 */
router.post('/token/issue', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { namespace, version, requester_id, scopes, expires_in_seconds } = req.body;
    
    const result = await distributionService.issueDownloadToken({
      namespace,
      version,
      requester_id,
      scopes: scopes || ['download'],
      expires_in_seconds: expires_in_seconds || 300
    });
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Token issuance failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /reports
 * Get reports (admin only)
 */
router.get('/reports', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { status, assigned_to, limit = 50, offset = 0 } = req.query;
    
    const result = await moderationService.getReports(
      status as string,
      assigned_to as string,
      parseInt(limit as string),
      parseInt(offset as string)
    );
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Failed to get reports:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /reports/:id/resolve
 * Resolve report (admin only)
 */
router.post('/reports/:id/resolve', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { id: reportId } = req.params;
    const { action, resolution_notes, severity } = req.body;
    
    const result = await moderationService.takeModerationAction({
      report_id: reportId,
      action,
      moderator_id: req.user.id,
      resolution_notes,
      severity
    });
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Report resolution failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
  }
});

// PUBLIC ENDPOINTS (metadata only)

/**
 * GET /registry
 * Get public registry
 */
router.get('/registry', async (req, res) => {
  try {
    const { 
      awf_core_version, 
      tags, 
      limit = 50, 
      offset = 0,
      sort = 'created_at',
      order = 'desc'
    } = req.query;

    let query = supabase
      .from('mod_pack_registry')
      .select(`
        namespace,
        version,
        manifest,
        awf_core_range,
        created_at,
        listed_at,
        mod_pack_tags(tag),
        mod_pack_capabilities(hook_name, hook_type)
      `)
      .eq('status', 'listed')
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (awf_core_version) {
      // Filter by AWF core compatibility
      query = query.like('awf_core_range', `%${awf_core_version}%`);
    }

    if (tags) {
      const tagArray = (tags as string).split(',');
      query = query.in('mod_pack_tags.tag', tagArray);
    }

    query = query.order(sort as string, { ascending: order === 'asc' });

    const { data: packs, error } = await query;

    if (error) {
      throw new Error(`Failed to get registry: ${error.message}`);
    }

    res.json({
      success: true,
      data: packs || []
    });
  } catch (error) {
    console.error('Failed to get registry:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /pack/:ns
 * Get pack versions
 */
router.get('/pack/:ns', async (req, res) => {
  try {
    const { ns: namespace } = req.params;
    
    const { data: packs, error } = await supabase
      .from('mod_pack_registry')
      .select('version, status, created_at, listed_at')
      .eq('namespace', namespace)
      .eq('status', 'listed')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get pack versions: ${error.message}`);
    }

    res.json({
      success: true,
      data: {
        namespace,
        versions: packs || []
      }
    });
  } catch (error) {
    console.error('Failed to get pack versions:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /pack/:ns/:ver
 * Get pack manifest (public)
 */
router.get('/pack/:ns/:ver', async (req, res) => {
  try {
    const { ns: namespace, ver: version } = req.params;
    
    const { data: pack, error } = await supabase
      .from('mod_pack_registry')
      .select(`
        namespace,
        version,
        manifest,
        awf_core_range,
        created_at,
        listed_at,
        mod_pack_tags(tag),
        mod_pack_capabilities(hook_name, hook_type, description)
      `)
      .eq('namespace', namespace)
      .eq('version', version)
      .eq('status', 'listed')
      .single();

    if (error) {
      throw new Error(`Pack not found: ${error.message}`);
    }

    res.json({
      success: true,
      data: pack
    });
  } catch (error) {
    console.error('Failed to get pack manifest:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /pack/:ns/:ver/metrics
 * Get public pack metrics
 */
router.get('/pack/:ns/:ver/metrics', async (req, res) => {
  try {
    const { ns: namespace, ver: version } = req.params;
    
    const result = await metricsSummariesService.getPublicMetrics(namespace, version);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Failed to get public pack metrics:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /pack/:ns/:ver/rate
 * Submit rating
 */
router.post('/pack/:ns/:ver/rate', async (req, res) => {
  try {
    const { ns: namespace, ver: version } = req.params;
    const validated = RatingSchema.parse({
      ...req.body,
      namespace,
      version
    });
    
    const result = await metricsSummariesService.submitRating(validated);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Rating submission failed:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid request data'
    });
  }
});

/**
 * GET /pack/:ns/:ver/ratings
 * Get pack ratings
 */
router.get('/pack/:ns/:ver/ratings', async (req, res) => {
  try {
    const { ns: namespace, ver: version } = req.params;
    
    const result = await metricsSummariesService.getRatingSummary(namespace, version);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Failed to get pack ratings:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /reports
 * Submit report
 */
router.post('/reports', async (req, res) => {
  try {
    const validated = ReportSchema.parse(req.body);
    
    const result = await moderationService.submitReport(validated);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Report submission failed:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid request data'
    });
  }
});

export default router;
