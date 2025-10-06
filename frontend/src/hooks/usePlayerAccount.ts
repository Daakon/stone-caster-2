import { useState, useEffect } from 'react';
import { playerAccountService } from '../services/player/PlayerAccountService';
import { authService } from '../services/auth/AuthService';
import { useAuthStore } from '../store/auth';
import type { PlayerProfile, PlayerCharacter, PlayerSave } from '@shared';
import type { ProfileDTO } from '@shared/types/dto';

function toPlayerProfile(profile: ProfileDTO | null): PlayerProfile | null {
  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    email: profile.email,
    preferences: profile.preferences ?? {},
    lastSeenAt: profile.lastSeen,
  };
}

export function usePlayerAccount() {
  const { user, profile: authProfile } = useAuthStore();
  const [profile, setProfile] = useState<PlayerProfile | null>(toPlayerProfile(authProfile));
  const [characters, setCharacters] = useState<PlayerCharacter[]>([]);
  const [saves, setSaves] = useState<PlayerSave[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setProfile(toPlayerProfile(authProfile));
  }, [authProfile]);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setCharacters([]);
      setSaves([]);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const loadPlayerData = async () => {
      setLoading(true);
      try {
        const [charactersData, savesData] = await Promise.all([
          playerAccountService.getCharacters(),
          playerAccountService.getSaves()
        ]);

        if (!isMounted) {
          return;
        }

        setCharacters(charactersData);
        setSaves(savesData);
      } catch (error) {
        if (isMounted) {
          console.error('[usePlayerAccount] Error loading player data:', error);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadPlayerData();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const refreshProfile = async () => {
    if (!user) {
      return;
    }

    try {
      const updatedProfile = await authService.refreshProfile();
      if (updatedProfile) {
        setProfile(toPlayerProfile(updatedProfile));
      }
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
