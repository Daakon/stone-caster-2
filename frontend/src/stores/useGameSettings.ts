
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface GameSettingsState {
    zenMode: boolean;
    showVitals: boolean;
    showCast: boolean;
    sidebarMode: 'collapsed' | 'icons' | 'full';

    // Actions
    toggleZenMode: () => void;
    toggleVitals: () => void;
    toggleCast: () => void;
    setSidebarMode: (mode: 'collapsed' | 'icons' | 'full') => void;
}

export const useGameSettings = create<GameSettingsState>()(
    persist(
        (set) => ({
            zenMode: false,
            showVitals: true,
            showCast: true,
            sidebarMode: 'icons',

            toggleZenMode: () => set((state) => ({ zenMode: !state.zenMode })),
            toggleVitals: () => set((state) => ({ showVitals: !state.showVitals })),
            toggleCast: () => set((state) => ({ showCast: !state.showCast })),
            setSidebarMode: (mode) => set({ sidebarMode: mode }),
        }),
        {
            name: 'stonecaster-ui-settings',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
