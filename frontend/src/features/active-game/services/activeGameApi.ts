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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    submitTurn: async (gameId: string, payload: SubmitTurnPayload): Promise<{ turn: any; delta: any; new_logs?: any[] }> => {
        console.log('[activeGameApi] submitTurn called', { gameId, payload });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await apiPost<{ turn: any; delta: any; new_logs?: any[] }>(`/api/games/${gameId}/turn`, payload);
        console.log('[activeGameApi] submitTurn result', result);

        if (!result.ok) {
            throw new Error(result.error.message || 'Failed to submit turn');
        }

        return result.data!;
    }
};
