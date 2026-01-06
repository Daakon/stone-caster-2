import { GameStateBundle, MechanicalState } from '../../domain/game-state.types';

export interface IGameStateRepository {
    /**
     * Persist the initial state bundle for a new game session.
     */
    createState(storyId: string, state: GameStateBundle, userId: string): Promise<string>;

    /**
     * Load ONLY the mechanical state (efficient fetch).
     * Used by the Engine to resolve actions without loading narrative bloat.
     */
    loadMechanical(storyId: string): Promise<MechanicalState>;

    /**
     * Update an existing game state.
     */
    updateState(gameStateId: string, state: GameStateBundle): Promise<void>;
}
