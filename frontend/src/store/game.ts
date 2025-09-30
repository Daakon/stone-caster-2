import { create } from 'zustand';
import type { Character, GameSave } from 'shared';

interface GameState {
  currentCharacter: Character | null;
  currentGame: GameSave | null;
  setCurrentCharacter: (character: Character | null) => void;
  setCurrentGame: (game: GameSave | null) => void;
  clearGame: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  currentCharacter: null,
  currentGame: null,
  
  setCurrentCharacter: (character) => set({ currentCharacter: character }),
  setCurrentGame: (game) => set({ currentGame: game }),
  clearGame: () => set({ currentCharacter: null, currentGame: null }),
}));
