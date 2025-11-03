/**
 * TurnDTO response shaping utilities
 * Conditionally includes debug fields based on admin status
 */

import type { Request } from 'express';
import type { TurnDTO, TurnDTOWithDebug } from '@shared';
import { allowDebug } from '../middleware/auth-admin.js';

/**
 * Shape TurnDTO for response - conditionally adds debug fields
 * @param turnDTO Base TurnDTO (no debug fields)
 * @param req Express request (for debug check)
 * @param debugData Optional debug data to attach
 * @returns TurnDTO or TurnDTOWithDebug based on admin status
 */
export async function shapeTurnDTOForResponse(
  turnDTO: TurnDTO,
  req: Request,
  debugData?: {
    prompt?: string;
    rawAi?: unknown;
  }
): Promise<TurnDTO | TurnDTOWithDebug> {
  const canDebug = await allowDebug(req);
  
  if (!canDebug || !debugData) {
    // Return base DTO without debug fields
    return turnDTO;
  }

  // Add debug fields for admin
  const withDebug: TurnDTOWithDebug = {
    ...turnDTO,
    debug: {
      prompt: debugData.prompt,
      rawAi: debugData.rawAi,
    },
  };

  return withDebug;
}

