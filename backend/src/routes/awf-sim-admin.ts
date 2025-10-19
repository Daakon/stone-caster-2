/**
 * Phase 19: Sim Admin Routes
 * Admin API for world simulation fast-forward and preview
 */

import { Router } from 'express';
import { z } from 'zod';
import { worldTickEngine } from '../sim/world-tick-engine.js';
import { simAssemblerIntegration } from '../sim/sim-assembler-integration.js';

const router = Router();

// Schemas
const FastForwardRequestSchema = z.object({
  bands: z.number().int().min(1).max(100),
  dry: z.boolean().default(false),
  sessionId: z.string().optional(),
});

const PreviewRequestSchema = z.object({
  day: z.number().int().min(0),
  band: z.string(),
  worldRef: z.string(),
});

const SimBlockSchema = z.object({
  time: z.object({
    band: z.string(),
    day_index: z.number().int().min(0),
  }),
  weather: z.object({
    current: z.string(),
    forecast: z.string(),
  }),
  regions: z.array(z.object({
    id: z.string(),
    name: z.string(),
    prosperity: z.number().min(0).max(100),
    threat: z.number().min(0).max(100),
    status: z.string(),
  })),
  npcs: z.array(z.object({
    id: z.string(),
    location: z.string(),
    intent: z.string(),
  })),
});

// POST /api/admin/awf/sim/fast-forward - Fast forward simulation
router.post('/fast-forward', async (req, res) => {
  try {
    const { bands, dry, sessionId } = FastForwardRequestSchema.parse(req.body);
    
    // This would fetch game state from database
    const mockGameState = {
      clock: { day_index: 0, band: 'Dawn' },
      weather: { region: 'region.forest_glade', state: 'clear', front: 'none' },
      regions: {
        'region.forest_glade': { prosperity: 60, threat: 20, travel_risk: 10 },
        'region.mountain_pass': { prosperity: 40, threat: 60, travel_risk: 30 },
      },
      npcs: {},
    };

    const results = [];
    let currentState = { ...mockGameState };

    // Simulate N bands
    for (let i = 0; i < bands; i++) {
      const result = await worldTickEngine.advance(
        'world.forest_glade',
        currentState,
        { dryRun: dry }
      );

      if (result.success) {
        results.push({
          band: currentState.clock.band,
          day: currentState.clock.day_index,
          summary: result.summary,
          newActs: result.newActs.length,
        });

        // Advance to next band
        currentState.clock = this.advanceToNextBand(currentState.clock);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Fast forward failed',
          details: result.errors,
        });
      }
    }

    res.json({
      success: true,
      data: {
        bands_advanced: bands,
        dry_run: dry,
        results,
        final_state: currentState,
      },
      message: `Fast forwarded ${bands} bands successfully`,
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
      error: 'Fast forward failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/admin/awf/sim/preview - Preview simulation state
router.get('/preview', async (req, res) => {
  try {
    const { day, band, worldRef } = PreviewRequestSchema.parse(req.query);
    
    // This would fetch game state from database
    const mockGameState = {
      clock: { day_index: day, band },
      weather: { region: 'region.forest_glade', state: 'clear', front: 'none' },
      regions: {
        'region.forest_glade': { prosperity: 60, threat: 20, travel_risk: 10 },
        'region.mountain_pass': { prosperity: 40, threat: 60, travel_risk: 30 },
      },
      npcs: {
        'npc.kiera': { current_location: 'herbal_garden', current_intent: 'gather_herbs', last_update: Date.now() },
        'npc.talan': { current_location: 'forest_edge', current_intent: 'scout', last_update: Date.now() },
      },
    };

    // Generate sim block
    const context = {
      sessionId: 'preview-session',
      turnId: 0,
      nodeId: 'node.forest',
      activeNodeType: 'exploration',
      playerLocation: 'region.forest_glade',
      nearbyRegions: ['region.forest_glade', 'region.mountain_pass'],
      nearbyNPCs: ['npc.kiera', 'npc.talan'],
      maxTokens: 260,
    };

    const simBlock = simAssemblerIntegration.assembleSimBlock(mockGameState, context);

    if (!simBlock) {
      return res.status(400).json({
        success: false,
        error: 'Failed to generate sim block',
      });
    }

    res.json({
      success: true,
      data: {
        day,
        band,
        worldRef,
        sim_block: simBlock,
        token_count: this.estimateTokenCount(simBlock),
      },
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
      error: 'Preview failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/admin/awf/sim/state/:gameStateId - Get current simulation state
router.get('/state/:gameStateId', async (req, res) => {
  try {
    const { gameStateId } = req.params;
    
    // This would fetch from database
    const mockSimState = {
      clock: { day_index: 5, band: 'Afternoon' },
      weather: { region: 'region.forest_glade', state: 'overcast', front: 'light' },
      regions: {
        'region.forest_glade': { prosperity: 65, threat: 25, travel_risk: 12, last_event: 'event.festival_herbal' },
        'region.mountain_pass': { prosperity: 35, threat: 70, travel_risk: 35 },
      },
      npcs: {
        'npc.kiera': { current_location: 'herbal_shop', current_intent: 'sell_herbs', last_update: Date.now() },
        'npc.talan': { current_location: 'forest_deep', current_intent: 'hunt', last_update: Date.now() },
      },
    };

    res.json({
      success: true,
      data: mockSimState,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch simulation state',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// PUT /api/admin/awf/sim/state/:gameStateId - Update simulation state
router.put('/state/:gameStateId', async (req, res) => {
  try {
    const { gameStateId } = req.params;
    const simState = req.body;
    
    // Validate simulation state
    const validation = this.validateSimState(simState);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid simulation state',
        details: validation.errors,
      });
    }

    // This would update database
    res.json({
      success: true,
      data: simState,
      message: 'Simulation state updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update simulation state',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/admin/awf/sim/config - Get simulation configuration
router.get('/config', async (req, res) => {
  try {
    // This would fetch from database
    const mockConfig = {
      max_sim_tokens: 260,
      max_nearby_npcs: 4,
      max_nearby_regions: 3,
      event_rate: 'normal',
      module_mode: 'full',
    };

    res.json({
      success: true,
      data: mockConfig,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch simulation configuration',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// PUT /api/admin/awf/sim/config - Update simulation configuration
router.put('/config', async (req, res) => {
  try {
    const configData = z.object({
      max_sim_tokens: z.number().int().min(100).max(500),
      max_nearby_npcs: z.number().int().min(1).max(10),
      max_nearby_regions: z.number().int().min(1).max(10),
      event_rate: z.enum(['low', 'normal', 'high']),
      module_mode: z.enum(['off', 'readonly', 'full']),
    }).parse(req.body);

    // This would update database
    res.json({
      success: true,
      data: configData,
      message: 'Simulation configuration updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid configuration data',
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update simulation configuration',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Helper methods
function advanceToNextBand(clock: { day_index: number; band: string }): { day_index: number; band: string } {
  const bands = ['Dawn', 'Morning', 'Afternoon', 'Evening', 'Night'];
  const currentIndex = bands.indexOf(clock.band);
  
  if (currentIndex === -1) {
    return { day_index: clock.day_index, band: 'Dawn' };
  }
  
  const nextIndex = (currentIndex + 1) % bands.length;
  const nextDay = nextIndex === 0 ? clock.day_index + 1 : clock.day_index;
  
  return {
    day_index: nextDay,
    band: bands[nextIndex],
  };
}

function estimateTokenCount(simBlock: any): number {
  let tokens = 0;
  
  // Simple token estimation
  const jsonString = JSON.stringify(simBlock);
  tokens = Math.ceil(jsonString.length / 4); // Rough estimate: 4 chars per token
  
  return tokens;
}

function validateSimState(simState: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required fields
  if (!simState.clock) {
    errors.push('Missing clock field');
  }
  
  if (!simState.weather) {
    errors.push('Missing weather field');
  }
  
  if (!simState.regions) {
    errors.push('Missing regions field');
  }
  
  if (!simState.npcs) {
    errors.push('Missing npcs field');
  }
  
  // Check clock structure
  if (simState.clock && (!simState.clock.day_index || !simState.clock.band)) {
    errors.push('Invalid clock structure');
  }
  
  // Check weather structure
  if (simState.weather && (!simState.weather.region || !simState.weather.state)) {
    errors.push('Invalid weather structure');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

export default router;


