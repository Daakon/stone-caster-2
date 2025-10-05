import type { ProfileDTO } from './dto';

export enum AuthState {
  GUEST = 'guest',
  COOKIED = 'cookied', 
  AUTHENTICATED = 'authenticated'
}

export interface AuthUser {
  state: AuthState;
  id: string; // Always available - guest cookie ID, cookied ID, or auth user ID
  key?: string; // JWT token for authenticated users
  email?: string; // Only for authenticated users
  displayName?: string; // Only for authenticated users
  profile?: ProfileDTO; // Hydrated profile when available
}

export interface AuthContext {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  linkGuestAccount: () => Promise<void>;
}

export interface PlayerProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
  preferences: Record<string, any>;
  lastSeenAt: string;
}

export interface PlayerCharacter {
  id: string;
  name: string;
  worldId: string;
  level: number;
  // ... other character properties
}

export interface PlayerSave {
  id: string;
  characterId: string;
  gameData: any;
  lastPlayed: string;
  // ... other save properties
}

