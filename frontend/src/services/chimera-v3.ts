/**
 * Chimera V3 API Client
 * Phase 14: Frontend services for Game Engine V3
 */

import { apiFetch, apiPost } from '@/lib/api';

export interface FormHint {
    key: string;
    control: 'slider' | 'dropdown' | 'text' | 'number' | 'checkbox';
    label: string;
    min?: number;
    max?: number;
    options?: string[] | { label: string; value: any }[];
    default?: any;
    description?: string;
}

export interface SetupConfig {
    storyTitle: string;
    fields: Record<string, FormHint[]>;
}

export interface StartGameResponse {
    success: boolean;
    instanceId: string;
    initialState: any;
}

export const ChimeraV3 = {
    /**
     * Get the Form Configuration (Sliders, Dropdowns) for Character Creation
     * GET /api/chimera/v3/game/setup/:storyId
     */
    getSetupConfig: async (storyId: string): Promise<SetupConfig> => {
        const result = await apiFetch<SetupConfig>(`/api/chimera/v3/game/setup/${storyId}`);
        if (!result.ok) {
            throw new Error(result.error.message || 'Failed to fetch setup config');
        }
        return result.data!;
    },

    /**
     * Start the Game with the selected Character Data
     * POST /api/chimera/v3/game/start
     */
    startGame: async (storyId: string, characterData: Record<string, unknown>): Promise<StartGameResponse> => {
        const result = await apiPost<StartGameResponse>('/api/chimera/v3/game/start', {
            compiledStoryId: storyId,
            characterData
        });

        if (!result.ok) {
            throw new Error(result.error.message || 'Failed to start game');
        }
        return result.data!;
    }
};
