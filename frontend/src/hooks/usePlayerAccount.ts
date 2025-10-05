import { useState, useEffect } from 'react';
import { playerAccountService } from '../services/player/PlayerAccountService';
import { useAuthStore } from '../store/auth';
import type { PlayerProfile, PlayerCharacter, PlayerSave } from 'shared';

export function usePlayerAccount() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [characters, setCharacters] = useState<PlayerCharacter[]>([]);
  const [saves, setSaves] = useState<PlayerSave[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setCharacters([]);
      setSaves([]);
      setLoading(false);
      return;
    }

    const loadPlayerData = async () => {
      setLoading(true);
      try {
        const [profileData, charactersData, savesData] = await Promise.all([
          playerAccountService.getProfile(),
          playerAccountService.getCharacters(),
          playerAccountService.getSaves()
        ]);

        setProfile(profileData);
        setCharacters(charactersData);
        setSaves(savesData);
      } catch (error) {
        console.error('[usePlayerAccount] Error loading player data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPlayerData();
  }, [user]);

  const refreshProfile = async () => {
    if (!user) return;
    
    try {
      const profileData = await playerAccountService.getProfile();
      setProfile(profileData);
    } catch (error) {
      console.error('[usePlayerAccount] Error refreshing profile:', error);
    }
  };

  const refreshCharacters = async () => {
    if (!user) return;
    
    try {
      const charactersData = await playerAccountService.getCharacters();
      setCharacters(charactersData);
    } catch (error) {
      console.error('[usePlayerAccount] Error refreshing characters:', error);
    }
  };

  const refreshSaves = async () => {
    if (!user) return;
    
    try {
      const savesData = await playerAccountService.getSaves();
      setSaves(savesData);
    } catch (error) {
      console.error('[usePlayerAccount] Error refreshing saves:', error);
    }
  };

  return {
    profile,
    characters,
    saves,
    loading,
    refreshProfile,
    refreshCharacters,
    refreshSaves,
    // Direct service methods
    updateProfile: playerAccountService.updateProfile.bind(playerAccountService),
    createCharacter: playerAccountService.createCharacter.bind(playerAccountService),
    updateCharacter: playerAccountService.updateCharacter.bind(playerAccountService),
    deleteCharacter: playerAccountService.deleteCharacter.bind(playerAccountService),
    createSave: playerAccountService.createSave.bind(playerAccountService),
    updateSave: playerAccountService.updateSave.bind(playerAccountService),
    deleteSave: playerAccountService.deleteSave.bind(playerAccountService),
    getGuestAccountSummary: playerAccountService.getGuestAccountSummary.bind(playerAccountService)
  };
}