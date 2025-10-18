/**
 * Phase 18: Party Admin Routes
 * Admin API for companions registry and party state management
 */

import { Router } from 'express';
import { z } from 'zod';
import { partyEngine } from '../party/party-engine.js';

const router = Router();

// Schemas
const CompanionSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  traits: z.array(z.string()),
  recruitment_conditions: z.object({
    trust_min: z.number().min(0),
    quests_completed: z.array(z.string()),
    world_events: z.array(z.string()),
  }),
  join_banter: z.string(),
  leave_banter: z.string(),
  party_rules: z.object({
    refuses_hard_difficulty: z.boolean(),
    trust_threshold: z.number().min(0),
    preferred_intent: z.string(),
  }),
  equipment_slots: z.record(z.string(), z.string().nullable()),
  skill_baselines: z.record(z.string(), z.number().min(0).max(100)),
});

const PartyStateSchema = z.object({
  leader: z.string(),
  companions: z.array(z.string()),
  reserve: z.array(z.string()),
  marching_order: z.array(z.string()),
  intents: z.record(z.string(), z.string()),
});

// GET /api/admin/awf/companions - List all companions
router.get('/companions', async (req, res) => {
  try {
    const companions = partyEngine.getAllCompanions();
    res.json({
      success: true,
      data: companions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch companions',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/admin/awf/companions/:id - Get specific companion
router.get('/companions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const companion = partyEngine.getCompanion(id);
    
    if (!companion) {
      return res.status(404).json({
        success: false,
        error: 'Companion not found',
      });
    }

    res.json({
      success: true,
      data: companion,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch companion',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/admin/awf/companions - Create new companion
router.post('/companions', async (req, res) => {
  try {
    const companionData = CompanionSchema.parse(req.body);
    
    // This would integrate with database
    // For now, just validate the data
    res.json({
      success: true,
      data: companionData,
      message: 'Companion created successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid companion data',
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create companion',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// PUT /api/admin/awf/companions/:id - Update companion
router.put('/companions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const companionData = CompanionSchema.parse(req.body);
    
    // This would integrate with database
    // For now, just validate the data
    res.json({
      success: true,
      data: companionData,
      message: 'Companion updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid companion data',
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update companion',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// DELETE /api/admin/awf/companions/:id - Delete companion
router.delete('/companions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // This would integrate with database
    // For now, just return success
    res.json({
      success: true,
      message: 'Companion deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete companion',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/admin/awf/party/:gameStateId - Get party state
router.get('/party/:gameStateId', async (req, res) => {
  try {
    const { gameStateId } = req.params;
    
    // This would fetch from database
    // For now, return a mock party state
    const mockPartyState = {
      leader: 'player',
      companions: ['npc.kiera', 'npc.talan'],
      reserve: [],
      marching_order: ['player', 'npc.kiera', 'npc.talan'],
      intents: {
        'npc.kiera': 'support',
        'npc.talan': 'scout',
      },
    };

    res.json({
      success: true,
      data: mockPartyState,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch party state',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// PUT /api/admin/awf/party/:gameStateId - Update party state
router.put('/party/:gameStateId', async (req, res) => {
  try {
    const { gameStateId } = req.params;
    const partyState = PartyStateSchema.parse(req.body);
    
    // Validate party state
    const validation = partyEngine.validatePartyState(partyState);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid party state',
        details: validation.errors,
      });
    }

    // This would update database
    // For now, just return success
    res.json({
      success: true,
      data: partyState,
      message: 'Party state updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid party state data',
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update party state',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/admin/awf/party/:gameStateId/recruit - Recruit companion
router.post('/party/:gameStateId/recruit', async (req, res) => {
  try {
    const { gameStateId } = req.params;
    const { npcId, trustLevel = 0, completedQuests = [], worldEvents = [] } = req.body;
    
    if (!npcId) {
      return res.status(400).json({
        success: false,
        error: 'Missing npcId',
      });
    }

    // This would fetch party state from database
    const mockPartyState = {
      leader: 'player',
      companions: [],
      reserve: [],
      marching_order: ['player'],
      intents: {},
    };

    const result = partyEngine.recruitCompanion(
      mockPartyState,
      npcId,
      trustLevel,
      completedQuests,
      worldEvents
    );

    if (result.success) {
      res.json({
        success: true,
        data: result,
        message: result.moved_to_reserve 
          ? 'Companion recruited to reserve'
          : 'Companion recruited to party',
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Recruitment failed',
        details: result.errors,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to recruit companion',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/admin/awf/party/:gameStateId/dismiss - Dismiss companion
router.post('/party/:gameStateId/dismiss', async (req, res) => {
  try {
    const { gameStateId } = req.params;
    const { npcId } = req.body;
    
    if (!npcId) {
      return res.status(400).json({
        success: false,
        error: 'Missing npcId',
      });
    }

    // This would fetch party state from database
    const mockPartyState = {
      leader: 'player',
      companions: ['npc.kiera'],
      reserve: [],
      marching_order: ['player', 'npc.kiera'],
      intents: { 'npc.kiera': 'support' },
    };

    const result = partyEngine.dismissCompanion(mockPartyState, npcId);

    if (result.success) {
      res.json({
        success: true,
        data: result,
        message: 'Companion dismissed from party',
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Dismissal failed',
        details: result.errors,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to dismiss companion',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/admin/awf/party/:gameStateId/formation - Set formation
router.post('/party/:gameStateId/formation', async (req, res) => {
  try {
    const { gameStateId } = req.params;
    const { order } = req.body;
    
    if (!order || !Array.isArray(order)) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid order array',
      });
    }

    // This would fetch party state from database
    const mockPartyState = {
      leader: 'player',
      companions: ['npc.kiera', 'npc.talan'],
      reserve: [],
      marching_order: ['player', 'npc.kiera', 'npc.talan'],
      intents: {
        'npc.kiera': 'support',
        'npc.talan': 'scout',
      },
    };

    const result = partyEngine.setFormation(mockPartyState, order);

    if (result.success) {
      res.json({
        success: true,
        data: result,
        message: 'Formation updated successfully',
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Formation update failed',
        details: result.errors,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update formation',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/admin/awf/party/config - Get party configuration
router.get('/party/config', async (req, res) => {
  try {
    // This would fetch from database
    const mockConfig = {
      max_active: 4,
      max_reserve: 6,
      max_acts_per_turn: 3,
      default_intent: 'support',
      module_mode: 'full',
    };

    res.json({
      success: true,
      data: mockConfig,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch party configuration',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// PUT /api/admin/awf/party/config - Update party configuration
router.put('/party/config', async (req, res) => {
  try {
    const configData = z.object({
      max_active: z.number().int().min(1).max(10),
      max_reserve: z.number().int().min(0).max(20),
      max_acts_per_turn: z.number().int().min(1).max(10),
      default_intent: z.string(),
      module_mode: z.enum(['off', 'readonly', 'full']),
    }).parse(req.body);

    // This would update database
    res.json({
      success: true,
      data: configData,
      message: 'Party configuration updated successfully',
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
      error: 'Failed to update party configuration',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;


