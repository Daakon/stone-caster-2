/**
 * Player-facing API routes
 * Phase 6: Player-Facing Scenario Picker
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { AWFRepositoryFactory } from '../repositories/awf-repository-factory.js';
import { compactScenario } from '../assemblers/load-scenario.js';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Initialize repository factory
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);
const repoFactory = new AWFRepositoryFactory({ supabase });

/**
 * GET /api/player/scenarios
 * List available scenarios for players with filtering
 */
router.get('/scenarios', authenticateToken, async (req, res) => {
  try {
    const { world_ref, tags, q, limit = 12 } = req.query;
    
    // Get scenario repository
    const scenarioRepo = repoFactory.getScenarioRepository();
    
    // Build filter criteria
    const filters: any = {};
    if (world_ref) {
      filters.world_ref = world_ref as string;
    }
    if (tags) {
      filters.tags = Array.isArray(tags) ? tags : [tags as string];
    }
    if (q) {
      filters.search = q as string;
    }
    
    // Fetch scenarios (only public ones)
    const scenarios = await scenarioRepo.list(filters);
    
    // Filter for public scenarios and compact results
    const publicScenarios = scenarios
      .filter(scenario => {
        // Check if scenario is public (either in doc.scenario.is_public or top-level is_public)
        const doc = scenario.doc as any;
        return doc.scenario?.is_public === true || doc.is_public === true;
      })
      .slice(0, parseInt(limit as string) || 12)
      .map(scenario => {
        const compact = compactScenario(scenario.doc);
        return {
          id: scenario.id,
          version: scenario.version,
          world_ref: compact.world_ref,
          display_name: compact.display_name,
          synopsis: compact.synopsis,
          tags: compact.tags || [],
          npcs_preview: compact.npcs_preview || []
        };
      });
    
    res.json(publicScenarios);
  } catch (error) {
    console.error('[Player] Error fetching scenarios:', error);
    res.status(500).json({ 
      error: 'Failed to fetch scenarios',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/player/games/start
 * Create a new game from a scenario
 */
router.post('/games/start', authenticateToken, async (req, res) => {
  try {
    const { scenario_ref, ruleset_ref = 'ruleset.core.default@1.0.0', locale = 'en-US' } = req.body;
    
    if (!scenario_ref) {
      return res.status(400).json({ error: 'scenario_ref is required' });
    }
    
    // Get repositories
    const scenarioRepo = repoFactory.getScenarioRepository();
    const gameStatesRepo = repoFactory.getGameStatesRepository();
    
    // Parse scenario reference
    const [scenarioId, scenarioVersion] = scenario_ref.split('@');
    if (!scenarioId || !scenarioVersion) {
      return res.status(400).json({ error: 'Invalid scenario_ref format' });
    }
    
    // Fetch scenario
    const scenario = await scenarioRepo.getByIdVersion(scenarioId, scenarioVersion);
    if (!scenario) {
      return res.status(404).json({ error: 'Scenario not found' });
    }
    
    // Check if scenario is public
    const doc = scenario.doc as any;
    if (doc.scenario?.is_public !== true && doc.is_public !== true) {
      return res.status(403).json({ error: 'Scenario is not available to players' });
    }
    
    // Build initial state snapshot
    const compact = compactScenario(scenario.doc);
    const initialState = {
      meta: {
        world_ref: compact.world_ref,
        adventure_ref: null,
        scenario_ref: scenario_ref,
        ruleset_ref: ruleset_ref,
        locale: locale,
        created_at: new Date().toISOString()
      },
      hot: {
        scene: compact.start_scene || 'default.start',
        objectives: compact.objectives || [],
        flags: compact.flags || {},
        party: compact.party || [],
        inventory: compact.inventory || [],
        resources: compact.resources || { hp: 100, energy: 100 }
      }
    };
    
    // Create new game state
    const gameStateRecord = {
      session_id: `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      hot: initialState.hot,
      warm: {
        episodic: [],
        pins: []
      },
      cold: initialState.meta,
      updated_at: new Date().toISOString()
    };
    
    const gameState = await gameStatesRepo.upsert(gameStateRecord);
    
    res.json({ 
      game_id: gameState.session_id,
      scenario: {
        id: scenario.id,
        version: scenario.version,
        display_name: compact.display_name
      }
    });
  } catch (error) {
    console.error('[Player] Error creating game:', error);
    res.status(500).json({ 
      error: 'Failed to create game',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
