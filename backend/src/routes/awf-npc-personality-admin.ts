/**
 * AWF NPC Personality Admin Routes
 * CRUD operations for NPC personality management
 */

import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { personalityEngine, PersonalityTraits } from '../personality/personality-engine.js';
import { npcBehaviorPolicy } from '../policies/npc-behavior-policy.js';

const router = Router();

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validation schemas
const PersonalityTraitsSchema = z.object({
  openness: z.number().min(0).max(100),
  loyalty: z.number().min(0).max(100),
  caution: z.number().min(0).max(100),
  empathy: z.number().min(0).max(100),
  patience: z.number().min(0).max(100),
  aggression: z.number().min(0).max(100),
  trust: z.number().min(0).max(100),
  curiosity: z.number().min(0).max(100),
  stubbornness: z.number().min(0).max(100),
  humor: z.number().min(0).max(100),
});

const NpcPersonalityUpdateSchema = z.object({
  npcRef: z.string().min(1),
  worldRef: z.string().min(1),
  adventureRef: z.string().optional(),
  traits: PersonalityTraitsSchema,
  summary: z.string().optional(),
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
 * GET /api/admin/awf/npcs/:npcRef/personality
 * Get NPC personality
 */
router.get('/npcs/:npcRef/personality', async (req, res) => {
  try {
    const { npcRef } = req.params;
    const { worldRef, adventureRef } = req.query;

    if (!worldRef) {
      return res.status(400).json({ error: 'worldRef is required' });
    }

    const personality = await personalityEngine.getPersonality(
      npcRef,
      worldRef as string,
      adventureRef as string || null
    );

    if (!personality) {
      return res.status(404).json({ error: 'Personality not found' });
    }

    res.json({ personality });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/admin/awf/npcs/:npcRef/personality
 * Update NPC personality
 */
router.put('/npcs/:npcRef/personality', async (req, res) => {
  try {
    const { npcRef } = req.params;
    const updateData = NpcPersonalityUpdateSchema.parse(req.body);

    // Validate traits are within bounds
    for (const [trait, value] of Object.entries(updateData.traits)) {
      if (value < 0 || value > 100) {
        return res.status(400).json({ 
          error: `Trait ${trait} must be between 0 and 100` 
        });
      }
    }

    // Update personality
    const { data, error } = await supabase.rpc('update_npc_personality', {
      p_npc_ref: npcRef,
      p_world_ref: updateData.worldRef,
      p_adventure_ref: updateData.adventureRef || null,
      p_traits: updateData.traits,
      p_summary: updateData.summary,
    });

    if (error) {
      return res.status(500).json({ error: 'Failed to update personality' });
    }

    res.json({ 
      success: true, 
      personalityId: data,
      message: 'Personality updated successfully' 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid personality data', details: error.errors });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/awf/npcs/:npcRef/personality/init
 * Initialize NPC personality
 */
router.post('/npcs/:npcRef/personality/init', async (req, res) => {
  try {
    const { npcRef } = req.params;
    const { worldRef, adventureRef, baseTraits } = req.body;

    if (!worldRef) {
      return res.status(400).json({ error: 'worldRef is required' });
    }

    const personality = await personalityEngine.initPersonality(
      npcRef,
      worldRef,
      adventureRef || null,
      baseTraits
    );

    res.json({ personality });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/awf/npcs/:npcRef/personality/merge
 * Merge cross-session personalities
 */
router.post('/npcs/:npcRef/personality/merge', async (req, res) => {
  try {
    const { npcRef } = req.params;
    const { worldRef, adventureRef } = req.body;

    if (!worldRef) {
      return res.status(400).json({ error: 'worldRef is required' });
    }

    const mergedPersonality = await personalityEngine.mergeCrossSession(
      npcRef,
      worldRef,
      adventureRef || null
    );

    res.json({ personality: mergedPersonality });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/awf/npcs/:npcRef/personality/history
 * Get personality history
 */
router.get('/npcs/:npcRef/personality/history', async (req, res) => {
  try {
    const { npcRef } = req.params;
    const { worldRef, adventureRef, limit = 10 } = req.query;

    if (!worldRef) {
      return res.status(400).json({ error: 'worldRef is required' });
    }

    const { data: history, error } = await supabase
      .from('npc_personalities')
      .select('*')
      .eq('npc_ref', npcRef)
      .eq('world_ref', worldRef)
      .eq('adventure_ref', adventureRef || null)
      .order('last_updated', { ascending: false })
      .limit(parseInt(limit as string));

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch personality history' });
    }

    res.json({ history: history || [] });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/awf/npcs/:npcRef/personality/behavior
 * Get behavior profile for NPC
 */
router.get('/npcs/:npcRef/personality/behavior', async (req, res) => {
  try {
    const { npcRef } = req.params;
    const { worldRef, adventureRef, sessionId } = req.query;

    if (!worldRef || !sessionId) {
      return res.status(400).json({ error: 'worldRef and sessionId are required' });
    }

    // Get current personality
    const personality = await personalityEngine.getPersonality(
      npcRef,
      worldRef as string,
      adventureRef as string || null
    );

    if (!personality) {
      return res.status(404).json({ error: 'Personality not found' });
    }

    // Create context for behavior policy
    const context = {
      npcRef,
      worldRef: worldRef as string,
      adventureRef: adventureRef as string,
      sessionId: sessionId as string,
      recentPlayerActs: [], // Would be populated from actual session data
      relationshipMatrix: {}, // Would be populated from actual relationship data
      worldMood: 'neutral', // Would be populated from world context
    };

    // Compute behavior profile
    const behaviorProfile = npcBehaviorPolicy.computeBehaviorProfile(
      personality.traits,
      context
    );

    res.json({ 
      personality,
      behaviorProfile,
      context: npcBehaviorPolicy.generateBehaviorContext(npcRef, behaviorProfile, context)
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/awf/npcs/personalities
 * List all NPC personalities
 */
router.get('/npcs/personalities', async (req, res) => {
  try {
    const { worldRef, adventureRef, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('npc_personalities')
      .select('*')
      .order('last_updated', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (worldRef) {
      query = query.eq('world_ref', worldRef);
    }

    if (adventureRef) {
      query = query.eq('adventure_ref', adventureRef);
    }

    const { data: personalities, error } = await query;

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch personalities' });
    }

    res.json({ personalities: personalities || [] });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/awf/npcs/:npcRef/personality
 * Delete NPC personality
 */
router.delete('/npcs/:npcRef/personality', async (req, res) => {
  try {
    const { npcRef } = req.params;
    const { worldRef, adventureRef } = req.query;

    if (!worldRef) {
      return res.status(400).json({ error: 'worldRef is required' });
    }

    const { error } = await supabase
      .from('npc_personalities')
      .delete()
      .eq('npc_ref', npcRef)
      .eq('world_ref', worldRef)
      .eq('adventure_ref', adventureRef || null);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete personality' });
    }

    res.json({ success: true, message: 'Personality deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


