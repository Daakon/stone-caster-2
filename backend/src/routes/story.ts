import express from 'express';
import type { Request, Response } from 'express';
import { supabase } from '../services/supabase.js';
import { aiService } from '../services/ai.js';
import { diceService } from '../services/dice.js';
import { StoryActionSchema } from 'shared';

const router = express.Router();

// Process a story action
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const action = StoryActionSchema.parse(req.body);
    const { gameSaveId } = req.body;

    // Fetch game save
    const { data: gameSave, error: saveError } = await supabase
      .from('game_saves')
      .select('*')
      .eq('id', gameSaveId)
      .eq('userId', userId)
      .single();

    if (saveError || !gameSave) {
      return res.status(404).json({ error: 'Game save not found' });
    }

    // Fetch character
    const { data: character, error: charError } = await supabase
      .from('characters')
      .select('*')
      .eq('id', gameSave.characterId)
      .single();

    if (charError || !character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Handle skill checks if needed
    let skillCheckResult = null;
    if (action.skillCheck) {
      const roll = diceService.roll({
        type: 'd20',
        count: 1,
        modifier: 0,
      });
      
      const narration = await aiService.processSkillCheck(
        action.skillCheck.skill,
        action.skillCheck.difficulty,
        roll.finalResult,
        { gameSave, character, action }
      );

      skillCheckResult = {
        ...roll,
        narration,
        success: roll.finalResult >= action.skillCheck.difficulty,
      };
    }

    // Generate AI response
    const aiResponse = await aiService.generateStoryResponse({
      gameSave,
      character,
      action,
    });

    // Update game save with new history
    const updatedHistory = [
      ...gameSave.storyState.history,
      {
        role: 'player',
        content: action.content,
        timestamp: new Date().toISOString(),
      },
      {
        role: 'narrator',
        content: aiResponse.narrative,
        timestamp: new Date().toISOString(),
        emotion: aiResponse.emotion,
      },
    ];

    const updatedWorldState = {
      ...gameSave.storyState.worldState,
      ...aiResponse.worldStateChanges,
    };

    const { error: updateError } = await supabase
      .from('game_saves')
      .update({
        storyState: {
          ...gameSave.storyState,
          history: updatedHistory,
          worldState: updatedWorldState,
        },
        updatedAt: new Date().toISOString(),
        lastPlayedAt: new Date().toISOString(),
      })
      .eq('id', gameSaveId);

    if (updateError) throw updateError;

    res.json({
      aiResponse,
      skillCheckResult,
    });
  } catch (error) {
    console.error('Error processing story action:', error);
    res.status(500).json({ error: 'Failed to process story action' });
  }
});

export default router;
