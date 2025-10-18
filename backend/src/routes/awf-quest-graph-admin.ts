/**
 * AWF Quest Graph Admin Routes
 * CRUD operations for quest graph management
 */

import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { questGraphsRepo } from '../repos/quest-graphs-repo.js';
import { QuestGraph } from '../graph/quest-graph-engine.js';

const router = Router();

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validation schemas
const QuestGraphCreateSchema = z.object({
  adventureRef: z.string().min(1).max(100),
  version: z.string().min(1).max(50),
  graph: z.object({
    graphId: z.string().min(1).max(100),
    start: z.string().min(1),
    nodes: z.array(z.object({
      id: z.string().min(1).max(50),
      type: z.enum(['beat', 'objective', 'gate', 'setpiece']),
      synopsis: z.string().min(1).max(160),
      enterIf: z.array(z.object({
        flag: z.string().optional(),
        objective: z.string().optional(),
        resource: z.string().optional(),
        op: z.enum(['eq', 'ne', 'gt', 'lt', 'gte', 'lte']),
        val: z.any(),
      })).optional(),
      onSuccess: z.array(z.object({
        act: z.string(),
        id: z.string().optional(),
        key: z.string().optional(),
        val: z.any().optional(),
        status: z.string().optional(),
      })).optional(),
      onFail: z.array(z.object({
        act: z.string(),
        id: z.string().optional(),
        key: z.string().optional(),
        val: z.any().optional(),
        status: z.string().optional(),
      })).optional(),
      hint: z.string().max(120).optional(),
    })).min(1),
    edges: z.array(z.object({
      from: z.string().min(1),
      to: z.string().min(1),
      guard: z.array(z.object({
        objective: z.string().optional(),
        flag: z.string().optional(),
        resource: z.string().optional(),
        op: z.enum(['eq', 'ne', 'gt', 'lt', 'gte', 'lte']),
        val: z.any(),
      })).optional(),
    })).optional(),
  }),
});

// Middleware to check admin role
const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('auth_user_id', req.user?.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: 'Failed to verify admin access' });
  }
};

// Apply admin middleware to all routes
router.use(requireAdmin);

/**
 * GET /api/admin/awf/graphs
 * List all quest graphs
 */
router.get('/graphs', async (req, res) => {
  try {
    const { adventureRef } = req.query;
    
    const graphs = await questGraphsRepo.listGraphs(adventureRef as string);
    
    res.json({ graphs });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/awf/graphs/:id
 * Get quest graph by ID
 */
router.get('/graphs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: graph, error } = await supabase
      .from('quest_graphs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Quest graph not found' });
    }

    res.json({ graph });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/awf/graphs
 * Create new quest graph
 */
router.post('/graphs', async (req, res) => {
  try {
    const graphData = QuestGraphCreateSchema.parse(req.body);
    
    // Validate graph structure
    const validation = questGraphsRepo.validateGraph(graphData.graph);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Invalid graph structure', 
        details: validation.errors,
        warnings: validation.warnings 
      });
    }

    const graph = await questGraphsRepo.createGraph(
      graphData.adventureRef,
      graphData.version,
      graphData.graph
    );

    res.json({ graph });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid graph data', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/admin/awf/graphs/:id
 * Update quest graph
 */
router.put('/graphs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { graph } = req.body;
    
    // Validate graph structure
    const validation = questGraphsRepo.validateGraph(graph);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Invalid graph structure', 
        details: validation.errors,
        warnings: validation.warnings 
      });
    }

    const updatedGraph = await questGraphsRepo.updateGraph(id, graph);
    
    res.json({ graph: updatedGraph });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid graph data', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/awf/graphs/:id
 * Delete quest graph
 */
router.delete('/graphs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await questGraphsRepo.deleteGraph(id);
    
    res.json({ success: true, message: 'Quest graph deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/awf/graphs/import
 * Import quest graph from JSON/YAML
 */
router.post('/graphs/import', async (req, res) => {
  try {
    const { adventureRef, version, graphData } = req.body;
    
    if (!adventureRef || !version || !graphData) {
      return res.status(400).json({ error: 'Missing required fields: adventureRef, version, graphData' });
    }

    // Validate graph structure
    const validation = questGraphsRepo.validateGraph(graphData);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: 'Invalid graph structure', 
        details: validation.errors,
        warnings: validation.warnings 
      });
    }

    const graph = await questGraphsRepo.createGraph(adventureRef, version, graphData);
    
    res.json({ graph });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/awf/graphs/:id/export
 * Export quest graph as JSON
 */
router.get('/graphs/:id/export', async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'json' } = req.query;
    
    const { data: graph, error } = await supabase
      .from('quest_graphs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Quest graph not found' });
    }

    if (format === 'yaml') {
      // Convert to YAML format
      const yaml = require('js-yaml');
      const yamlString = yaml.dump(graph.doc);
      res.setHeader('Content-Type', 'text/yaml');
      res.setHeader('Content-Disposition', `attachment; filename="quest-graph-${id}.yaml"`);
      res.send(yamlString);
    } else {
      // Return as JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="quest-graph-${id}.json"`);
      res.json(graph.doc);
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/awf/graphs/:id/validate
 * Validate quest graph structure
 */
router.post('/graphs/:id/validate', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: graph, error } = await supabase
      .from('quest_graphs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Quest graph not found' });
    }

    const validation = questGraphsRepo.validateGraph(graph.doc);
    
    res.json({ 
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings 
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/awf/graphs/:id/nodes
 * Get graph nodes with dependencies
 */
router.get('/graphs/:id/nodes', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: nodes, error } = await supabase
      .from('quest_graph_indexes')
      .select('*')
      .eq('graph_id', id)
      .order('node_id');

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch graph nodes' });
    }

    res.json({ nodes: nodes || [] });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/awf/graphs/:id/analysis
 * Get graph analysis (cycles, reachability, etc.)
 */
router.get('/graphs/:id/analysis', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: graph, error } = await supabase
      .from('quest_graphs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Quest graph not found' });
    }

    const validation = questGraphsRepo.validateGraph(graph.doc);
    
    res.json({
      validation,
      nodeCount: graph.doc.nodes.length,
      edgeCount: graph.doc.edges?.length || 0,
      startNode: graph.doc.start,
      hash: graph.hash,
      version: graph.version,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


