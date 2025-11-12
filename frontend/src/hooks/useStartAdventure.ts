import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createGame, createCharacterFromPremade } from '../lib/api';
import { ApiErrorCode } from '@shared';
import { useAdventureTelemetry } from './useAdventureTelemetry';

interface StartAdventureOptions {
  adventureSlug: string;
  characterType: 'premade' | 'existing' | 'new';
  characterId?: string;
  premadeData?: {
    worldSlug: string;
    archetypeKey: string;
    displayName: string;
  };
}

interface StartAdventureResult {
  success: boolean;
  gameId?: string;
  error?: {
    code: ApiErrorCode;
    message?: string;
  };
  shouldResume?: boolean;
  existingGameId?: string;
}

export function useStartAdventure() {
  const [isStarting, setIsStarting] = useState(false);
  const navigate = useNavigate();
  const telemetry = useAdventureTelemetry();

  const startAdventure = useCallback(async (options: StartAdventureOptions): Promise<StartAdventureResult> => {
    const { adventureSlug, characterType, characterId, premadeData } = options;
    const startTime = Date.now();
    
    setIsStarting(true);

    try {
      let finalCharacterId = characterId;

      // If it's a premade character, create it first
      if (characterType === 'premade' && premadeData) {
        const characterResult = await createCharacterFromPremade(
          premadeData.worldSlug,
          premadeData.archetypeKey,
          premadeData.displayName
        );
        
        if (!characterResult.ok) {
          await telemetry.trackErrorShown(characterResult.error.code as ApiErrorCode, characterType, adventureSlug);
          return {
            success: false,
            error: {
              code: characterResult.error.code as ApiErrorCode,
              message: characterResult.error.message,
            },
          };
        }
        
        finalCharacterId = characterResult.data.id;
        await telemetry.trackCharacterSelected(characterType, finalCharacterId, adventureSlug);
      } else if (characterType === 'existing' && characterId) {
        await telemetry.trackCharacterSelected(characterType, characterId, adventureSlug);
      }

      // Create the game
      const gameResult = await createGame(adventureSlug, finalCharacterId);
      
      if (!gameResult.ok) {
        
        // Check if this is a conflict (character already active)
        if (gameResult.error.code === ApiErrorCode.CONFLICT) {
          await telemetry.trackErrorShown(gameResult.error.code as ApiErrorCode, characterType, adventureSlug);
          return {
            success: false,
            error: {
              code: gameResult.error.code as ApiErrorCode,
              message: gameResult.error.message,
            },
            shouldResume: true,
            existingGameId: (gameResult as any).existingGameId,
          };
        }
        
        await telemetry.trackErrorShown(gameResult.error.code as ApiErrorCode, characterType, adventureSlug);
        return {
          success: false,
          error: {
            code: gameResult.error.code as ApiErrorCode,
            message: gameResult.error.message,
          },
        };
      }

      const game = gameResult.data;
      const duration = Date.now() - startTime;

      // Track successful start
      await telemetry.trackAdventureStarted(
        characterType,
        finalCharacterId!,
        adventureSlug,
        duration
      );

      // Navigate to the game
      navigate(`/play/${game.id}`);

      return {
        success: true,
        gameId: game.id,
      };

    } catch (error) {
      await telemetry.trackErrorShown(ApiErrorCode.INTERNAL_ERROR, characterType, adventureSlug);
      
      return {
        success: false,
        error: {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to start adventure. Please try again.',
        },
      };
    } finally {
      setIsStarting(false);
    }
  }, [navigate]); // Removed telemetry from dependencies

  const resumeAdventure = useCallback(async (gameId: string) => {
    try {
      await telemetry.trackAdventureResumed('', '', gameId);
      navigate(`/play/${gameId}`);
    } catch (error) {
    }
  }, [navigate]); // Removed telemetry from dependencies

  return {
    startAdventure,
    resumeAdventure,
    isStarting,
  };
}
