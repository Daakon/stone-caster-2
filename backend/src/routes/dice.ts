import express from 'express';
import type { Request, Response } from 'express';
import { diceService } from '../services/dice.js';
import { DiceRollSchema } from 'shared';

const router = express.Router();

// Roll dice
router.post('/', async (req: Request, res: Response) => {
  try {
    const diceRoll = DiceRollSchema.parse(req.body);
    const result = diceService.roll(diceRoll);
    res.json(result);
  } catch (error) {
    console.error('Error rolling dice:', error);
    res.status(500).json({ error: 'Failed to roll dice' });
  }
});

// Roll multiple dice
router.post('/multiple', async (req: Request, res: Response) => {
  try {
    const { rolls } = req.body;
    if (!Array.isArray(rolls)) {
      return res.status(400).json({ error: 'Rolls must be an array' });
    }

    const parsedRolls = rolls.map(roll => DiceRollSchema.parse(roll));
    const results = diceService.rollMultiple(parsedRolls);
    res.json(results);
  } catch (error) {
    console.error('Error rolling multiple dice:', error);
    res.status(500).json({ error: 'Failed to roll multiple dice' });
  }
});

export default router;
