import { apiPost } from '@/lib/api';
import type { GameState } from '@shared/types/chimera-runtime';

interface SubmitTurnPayload {
    input: string;
    entity_id?: string;
}

export const activeGameApi = {
    /**
     * Submit a player turn to the backend
     * @param gameId The game state ID
     * @param payload Input text and optional entity ID
     */
    submitTurn: async (gameId: string, payload: SubmitTurnPayload): Promise<GameState> => {
        console.log('[activeGameApi] submitTurn called', { gameId, payload });
        const result = await apiPost<GameState>(`/api/games/${gameId}/turn`, payload);
        console.log('[activeGameApi] submitTurn result', result);

        if (!result.ok) {
            throw new Error(result.error.message || 'Failed to submit turn');
        }

        return result.data!;
    }
};
