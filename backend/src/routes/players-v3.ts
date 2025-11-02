import express from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../services/supabase.js';
import { optionalAuth } from '../middleware/auth.js';
import { sendSuccess, sendErrorWithStatus } from '../utils/response.js';
import { ApiErrorCode } from '@shared';
import { 
  PlayerV3Schema, 
  CreatePlayerV3RequestSchema,
  type PlayerV3,
  type CreatePlayerV3Request 
} from '@shared';

const router = express.Router();

/**
 * Helper function to create a PlayerV3 character
 */
export async function createPlayerV3(
  worldSlug: string, 
  player: PlayerV3, 
  userId: string, 
  isGuest: boolean
): Promise<{ ok: boolean; data?: any; error?: any }> {
  try {
    // Validate player data
    const playerValidation = PlayerV3Schema.safeParse(player);
    if (!playerValidation.success) {
      return {
        ok: false,
        error: { message: 'Invalid player data', details: playerValidation.error.errors }
      };
    }

    const validatedPlayer = playerValidation.data;

    // Resolve world_id UUID from world_slug
    console.log('[PLAYERV3_CREATE] Resolving world_id for worldSlug:', worldSlug);
    const { data: worldMapping, error: mappingError } = await supabaseAdmin
      .from('world_id_mapping')
      .select('uuid_id')
      .eq('text_id', worldSlug)
      .single();
    
    if (mappingError || !worldMapping) {
      console.error('[PLAYERV3_CREATE] World mapping not found:', { worldSlug, error: mappingError });
      return {
        ok: false,
        error: { message: `World '${worldSlug}' not found in world_id_mapping` }
      };
    }

    console.log('[PLAYERV3_CREATE] Resolved world_id:', worldMapping.uuid_id);

    // Store PlayerV3 data in the existing characters table using world_data field
    const characterData = {
      id: validatedPlayer.id,
      name: validatedPlayer.name,
      world_slug: worldSlug, // TEXT identifier for display
      world_id: worldMapping.uuid_id, // UUID (source of truth)
      world_data: {
        playerV3: validatedPlayer,
        version: 3
      },
      // Legacy fields for compatibility
      race: validatedPlayer.race,
      class: validatedPlayer.role,
      level: 1, // Required for database schema but not used in skill-based system
      experience: 0,
      attributes: {
        strength: Math.floor((validatedPlayer.skills.combat || 50) / 10),
        dexterity: Math.floor((validatedPlayer.skills.stealth || 50) / 10),
        constitution: Math.floor((validatedPlayer.skills.survival || 50) / 10),
        intelligence: Math.floor((validatedPlayer.skills.lore || 50) / 10),
        wisdom: Math.floor((validatedPlayer.skills.medicine || 50) / 10),
        charisma: Math.floor((validatedPlayer.skills.social || 50) / 10)
      },
      skills: Object.keys(validatedPlayer.skills),
      inventory: validatedPlayer.inventory.map(item => ({
        id: uuidv4(),
        name: item,
        description: `Starting equipment: ${item}`,
        quantity: 1
      })),
      current_health: 100,
      max_health: 100,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Set owner based on user type - for guest users, use cookie_id, for real users use user_id
      ...(isGuest ? { cookie_id: userId } : { user_id: userId })
    };
    
    console.log('[PLAYERV3_CREATE_DATA] Character data being inserted:', {
      id: characterData.id,
      name: characterData.name,
      world_slug: characterData.world_slug,
      world_id: characterData.world_id
    });
    
    const { data: createdPlayer, error: createError } = await supabaseAdmin
      .from('characters')
      .insert([characterData])
      .select()
      .single();

    if (createError) {
      console.error('Error creating PlayerV3 character:', createError);
      return {
        ok: false,
        error: { message: `Failed to create character: ${createError.message}` }
      };
    }

    console.log('[PLAYERV3_CREATED_DB_ROW] Character created in DB:', {
      id: createdPlayer.id,
      name: createdPlayer.name,
      world_slug: createdPlayer.world_slug,
      world_id: createdPlayer.world_id
    });

    return {
      ok: true,
      data: {
        player: validatedPlayer,
        character: createdPlayer
      }
    };
  } catch (error) {
    console.error('Error in createPlayerV3 helper:', error);
    return {
      ok: false,
      error: { message: 'Internal server error' }
    };
  }
}

/**
 * Create a new PlayerV3 character
 */
router.post('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    console.log('[PLAYERS-V3] POST request received:', { body: req.body });
    const userId = req.ctx?.userId;
    const cookieId = req.cookies?.guest_id;
    // Check if this is a guest user - if the user object has isGuest: true, treat as guest
    const isGuest = req.ctx?.user?.isGuest === true;
    console.log('[PLAYERS-V3] Auth context:', { userId, isGuest, cookieId, userObject: req.ctx?.user });

    if (!userId && !cookieId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required',
        req
      );
    }

    // Validate request body
    const validationResult = CreatePlayerV3RequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid request data',
        req,
        validationResult.error.errors
      );
    }

    const { worldSlug, player } = validationResult.data;

    // Validate world slug exists (basic check)
    if (!worldSlug || worldSlug.length === 0) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'World slug is required',
        req
      );
    }

    // Validate player data
    const playerValidation = PlayerV3Schema.safeParse(player);
    if (!playerValidation.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid player data',
        req,
        playerValidation.error.errors
      );
    }

    const validatedPlayer = playerValidation.data;

    // Check for duplicate names in the same world
    const { data: existingPlayer, error: checkError } = await supabaseAdmin
      .from('players_v3')
      .select('id')
      .eq('name', validatedPlayer.name)
      .eq('world_slug', worldSlug)
      .or(`user_id.eq.${userId},cookie_id.eq.${cookieId}`)
      .single();

    if (existingPlayer) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.CONFLICT,
        'A character with this name already exists in this world',
        req
      );
    }

    // Create the player record
    const playerData = {
      id: validatedPlayer.id,
      user_id: userId,
      cookie_id: cookieId,
      world_slug: worldSlug,
      name: validatedPlayer.name,
      role: validatedPlayer.role,
      race: validatedPlayer.race,
      essence: validatedPlayer.essence,
      age: validatedPlayer.age,
      build: validatedPlayer.build,
      eyes: validatedPlayer.eyes,
      traits: validatedPlayer.traits,
      backstory: validatedPlayer.backstory,
      motivation: validatedPlayer.motivation,
      skills: validatedPlayer.skills,
      inventory: validatedPlayer.inventory,
      relationships: validatedPlayer.relationships,
      goals: validatedPlayer.goals,
      flags: validatedPlayer.flags,
      reputation: validatedPlayer.reputation
    };

    console.log('[PLAYERS-V3] Inserting player data into characters table:', playerData);
    
    // Store PlayerV3 data in the existing characters table using world_data field
    const characterData = {
      id: validatedPlayer.id,
      name: validatedPlayer.name,
      world_slug: worldSlug,
      world_data: {
        playerV3: validatedPlayer,
        version: 3
      },
      // Legacy fields for compatibility
      race: validatedPlayer.race,
      class: validatedPlayer.role,
      level: 1, // Required for database schema but not used in skill-based system
      experience: 0,
      attributes: {
        strength: Math.floor((validatedPlayer.skills.combat || 50) / 10),
        dexterity: Math.floor((validatedPlayer.skills.stealth || 50) / 10),
        constitution: Math.floor((validatedPlayer.skills.survival || 50) / 10),
        intelligence: Math.floor((validatedPlayer.skills.lore || 50) / 10),
        wisdom: Math.floor((validatedPlayer.skills.medicine || 50) / 10),
        charisma: Math.floor((validatedPlayer.skills.social || 50) / 10)
      },
      skills: Object.keys(validatedPlayer.skills),
      inventory: validatedPlayer.inventory.map(item => ({
        id: uuidv4(),
        name: item,
        description: `Starting equipment: ${item}`,
        quantity: 1
      })),
      current_health: 100,
      max_health: 100,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Set owner based on user type - for guest users, use cookie_id, for real users use user_id
      ...(isGuest ? { cookie_id: userId } : { user_id: userId })
    };
    
    const { data: createdPlayer, error: createError } = await supabaseAdmin
      .from('characters')
      .insert([characterData])
      .select()
      .single();

    if (createError) {
      console.error('[PLAYERS-V3] Database error:', createError);
      console.error('[PLAYERS-V3] Error details:', JSON.stringify(createError, null, 2));
      
      // Check if it's a table not found error
      if (createError.message && (createError.message.includes('relation "players_v3" does not exist') || createError.message.includes('Could not find the table'))) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          'Database table "players_v3" does not exist. Please apply the migration in supabase/migrations/20250107_create_players_v3.sql to your Supabase database.',
          req
        );
      }
      
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to create character: ${createError.message}`,
        req
      );
    }

    // Extract PlayerV3 data from the character's world_data
    const playerV3Data = createdPlayer.world_data?.playerV3 || validatedPlayer;
    
    sendSuccess(res, { player: playerV3Data }, req, 201);
  } catch (error) {
    console.error('Error in POST /players-v3:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

/**
 * Get a PlayerV3 character by ID
 */
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.ctx?.userId;
    const cookieId = req.cookies?.guest_id;

    if (!userId && !cookieId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required',
        req
      );
    }

    const { data: character, error } = await supabaseAdmin
      .from('characters')
      .select('*')
      .eq('id', id)
      .or(`user_id.eq.${userId},cookie_id.eq.${cookieId}`)
      .single();

    if (character && character.world_data?.playerV3) {
      const player = character.world_data.playerV3;
      sendSuccess(res, { player }, req);
      return;
    }

    if (error) {
      if (error.code === 'PGRST116') {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Character not found',
          req
        );
      }
      console.error('Error fetching PlayerV3:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch character',
        req
      );
    }

    // If we get here, the character exists but doesn't have PlayerV3 data
    return sendErrorWithStatus(
      res,
      ApiErrorCode.NOT_FOUND,
      'Character not found or not a PlayerV3 character',
      req
    );
  } catch (error) {
    console.error('Error in GET /players-v3/:id:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

/**
 * Update a PlayerV3 character
 */
router.patch('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.ctx?.userId;
    const cookieId = req.cookies?.guest_id;

    if (!userId && !cookieId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required',
        req
      );
    }

    // Validate update data
    const updateSchema = PlayerV3Schema.partial();
    const validationResult = updateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        'Invalid update data',
        req,
        validationResult.error.errors
      );
    }

    const updateData = validationResult.data;

    // Get the existing character first
    const { data: existingCharacter, error: fetchError } = await supabaseAdmin
      .from('characters')
      .select('*')
      .eq('id', id)
      .or(`user_id.eq.${userId},cookie_id.eq.${cookieId}`)
      .single();

    if (fetchError || !existingCharacter?.world_data?.playerV3) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        'PlayerV3 character not found',
        req
      );
    }

    // Update the PlayerV3 data within world_data
    const updatedPlayerV3 = { ...existingCharacter.world_data.playerV3, ...updateData };
    
    const { data: updatedCharacter, error } = await supabaseAdmin
      .from('characters')
      .update({
        world_data: {
          ...existingCharacter.world_data,
          playerV3: updatedPlayerV3
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .or(`user_id.eq.${userId},cookie_id.eq.${cookieId}`)
      .select()
      .single();

    const updatedPlayer = updatedCharacter?.world_data?.playerV3;

    if (error) {
      if (error.code === 'PGRST116') {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          'Character not found',
          req
        );
      }
      console.error('Error updating PlayerV3:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to update character',
        req
      );
    }

    sendSuccess(res, { player: updatedPlayer }, req);
  } catch (error) {
    console.error('Error in PATCH /players-v3/:id:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

/**
 * Get all PlayerV3 characters for a user in a world
 */
router.get('/world/:worldSlug', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { worldSlug } = req.params;
    const userId = req.ctx?.userId;
    const cookieId = req.cookies?.guest_id;

    if (!userId && !cookieId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required',
        req
      );
    }

    const { data: players, error } = await supabaseAdmin
      .from('players_v3')
      .select('*')
      .eq('world_slug', worldSlug)
      .or(`user_id.eq.${userId},cookie_id.eq.${cookieId}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching PlayerV3 characters:', error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to fetch characters',
        req
      );
    }

    sendSuccess(res, { players }, req);
  } catch (error) {
    console.error('Error in GET /players-v3/world/:worldSlug:', error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      'Internal server error',
      req
    );
  }
});

export default router;
