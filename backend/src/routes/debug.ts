import { Router } from 'express';
import { debugService } from '../services/debug.service.js';
import { gameStateService } from '../services/game-state.service.js';
import { z } from 'zod';

const router = Router();

// Validation schemas
const GameIdSchema = z.object({
  gameId: z.string().uuid(),
});

const TurnSchema = z.object({
  gameId: z.string().uuid(),
  turnIndex: z.coerce.number().int().min(0),
});

/**
 * GET /api/debug/stats
 * Get debug statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = debugService.getDebugStats();
    res.json({ ok: true, data: stats });
  } catch (error) {
    console.error('Error getting debug stats:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to get debug stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/debug/game/:gameId
 * Get debug data for a specific game
 */
router.get('/game/:gameId', async (req, res) => {
  try {
    const { gameId } = GameIdSchema.parse(req.params);
    const debugData = debugService.getGameDebugData(gameId);
    res.json({ ok: true, data: debugData });
  } catch (error) {
    console.error('Error getting game debug data:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ 
        ok: false, 
        error: 'Invalid game ID',
        details: error.errors
      });
    } else {
      res.status(500).json({ 
        ok: false, 
        error: 'Failed to get game debug data',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

/**
 * GET /api/debug/game/:gameId/turn/:turnIndex
 * Get debug data for a specific turn
 */
router.get('/game/:gameId/turn/:turnIndex', async (req, res) => {
  try {
    const { gameId, turnIndex } = TurnSchema.parse(req.params);
    const debugData = debugService.getTurnDebugData(gameId, turnIndex);
    res.json({ ok: true, data: debugData });
  } catch (error) {
    console.error('Error getting turn debug data:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ 
        ok: false, 
        error: 'Invalid parameters',
        details: error.errors
      });
    } else {
      res.status(500).json({ 
        ok: false, 
        error: 'Failed to get turn debug data',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

/**
 * GET /api/debug/prompts
 * Get all prompt debug data
 */
router.get('/prompts', async (req, res) => {
  try {
    const allData = debugService.getAllDebugData();
    res.json({ ok: true, data: allData.prompts });
  } catch (error) {
    console.error('Error getting prompt debug data:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to get prompt debug data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/debug/responses
 * Get all AI response debug data
 */
router.get('/responses', async (req, res) => {
  try {
    const allData = debugService.getAllDebugData();
    res.json({ ok: true, data: allData.aiResponses });
  } catch (error) {
    console.error('Error getting AI response debug data:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to get AI response debug data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/debug/state-changes
 * Get all state change debug data
 */
router.get('/state-changes', async (req, res) => {
  try {
    const allData = debugService.getAllDebugData();
    res.json({ ok: true, data: allData.stateChanges });
  } catch (error) {
    console.error('Error getting state change debug data:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to get state change debug data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/debug/clear
 * Clear all debug data
 */
router.delete('/clear', async (req, res) => {
  try {
    debugService.clearDebugData();
    res.json({ ok: true, message: 'Debug data cleared' });
  } catch (error) {
    console.error('Error clearing debug data:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to clear debug data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/debug/game-state/:gameId
 * Get current game state
 */
router.get('/game-state/:gameId', async (req, res) => {
  try {
    const { gameId } = GameIdSchema.parse(req.params);
    const gameState = await gameStateService.loadGameState(gameId);
    
    if (!gameState) {
      res.status(404).json({ 
        ok: false, 
        error: 'Game state not found' 
      });
      return;
    }

    res.json({ ok: true, data: gameState });
  } catch (error) {
    console.error('Error getting game state:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ 
        ok: false, 
        error: 'Invalid game ID',
        details: error.errors
      });
    } else {
      res.status(500).json({ 
        ok: false, 
        error: 'Failed to get game state',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

export default router;






























