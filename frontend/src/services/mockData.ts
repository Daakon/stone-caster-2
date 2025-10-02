import worldsData from '../mock/worlds.json';
import adventuresData from '../mock/adventures.json';
import charactersData from '../mock/characters.json';
import walletData from '../mock/wallet.json';
import limitsData from '../mock/limits.json';
import inviteData from '../mock/invite.json';

// Types for our mock data
export interface World {
  id: string;
  title: string;
  tagline: string;
  cover: string;
  tags: string[];
  description: string;
  rules: WorldRule[];
  differentiators: Differentiator[];
}

export interface WorldRule {
  id: string;
  name: string;
  description: string;
  type: 'meter';
  min: number;
  max: number;
  current: number;
}

export interface Differentiator {
  id: string;
  type: string;
  title: string;
  description: string;
}

export interface Adventure {
  id: string;
  worldId: string;
  title: string;
  excerpt: string;
  cover: string;
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  stoneCost: number;
  length?: 'short' | 'medium' | 'epic';
  description: string;
  scenarios: string[];
}

export interface Character {
  id: string;
  worldId: string;
  name: string;
  class?: string;
  avatar: string;
  backstory?: string;
  worldSpecificData: Record<string, any>;
  skills?: {
    magic: number;
    intelligence: number;
    charisma: number;
    strength: number;
    dexterity: number;
    constitution: number;
  };
  createdAt: string;
}

export interface Wallet {
  balance: number;
  regenRate: number;
  nextRegen?: string;
  dailyAllowance?: number;
  lastTransaction?: {
    type: string;
    amount: number;
    reason: string;
    timestamp: string;
  };
  history: Array<{
    id: string;
    type: string;
    amount: number;
    reason: string;
    timestamp: string;
  }>;
}

export interface Limits {
  [key: string]: {
    maxGames: number;
    maxCharacters: number;
    dailyStoneAllowance: number;
    features: {
      canCreateCharacters: boolean;
      canStartAdventures: boolean;
      canAccessGameplay: boolean;
      canPurchaseStones: boolean;
      canAccessPremiumAdventures?: boolean;
      canCreateCustomCharacters?: boolean;
    };
  };
}

export interface InviteStatus {
  invited: boolean;
  inviteCode?: string;
  invitedAt?: string;
  invitedBy?: string;
}

// Mock data service
class MockDataService {
  private worlds: World[] = worldsData as World[];
  private adventures: Adventure[] = adventuresData as Adventure[];
  private characters: Character[] = charactersData as Character[];
  private wallet: Wallet = walletData as Wallet;
  private limits: Limits = limitsData as Limits;
  private invite: InviteStatus = inviteData as InviteStatus;

  // Worlds
  getWorlds(): World[] {
    return this.worlds;
  }

  getWorldById(id: string): World | undefined {
    return this.worlds.find(world => world.id === id);
  }

  getWorldsByTag(tag: string): World[] {
    return this.worlds.filter(world => world.tags.includes(tag));
  }

  // Adventures
  getAdventures(): Adventure[] {
    return this.adventures;
  }

  getAdventureById(id: string): Adventure | undefined {
    return this.adventures.find(adventure => adventure.id === id);
  }

  getAdventuresByWorld(worldId: string): Adventure[] {
    return this.adventures.filter(adventure => adventure.worldId === worldId);
  }

  getAdventuresByTag(tag: string): Adventure[] {
    return this.adventures.filter(adventure => adventure.tags.includes(tag));
  }

  searchAdventures(query: string): Adventure[] {
    const lowercaseQuery = query.toLowerCase();
    return this.adventures.filter(adventure => 
      adventure.title.toLowerCase().includes(lowercaseQuery) ||
      adventure.excerpt.toLowerCase().includes(lowercaseQuery) ||
      adventure.description.toLowerCase().includes(lowercaseQuery) ||
      adventure.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    );
  }

  // Characters
  getCharacters(): Character[] {
    return this.characters;
  }

  getAllCharacters(): Character[] {
    return this.characters;
  }

  getAllAdventures(): Adventure[] {
    return this.adventures;
  }

  getCharactersByWorld(worldId: string): Character[] {
    return this.characters.filter(character => character.worldId === worldId);
  }

  getCharacterById(id: string): Character | undefined {
    return this.characters.find(character => character.id === id);
  }

  createCharacter(character: Omit<Character, 'id' | 'createdAt'>): Character {
    const newCharacter: Character = {
      ...character,
      id: `${character.worldId}-char-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    this.characters.push(newCharacter);
    return newCharacter;
  }

  // Wallet
  getWallet(): Wallet {
    return this.wallet;
  }

  spendStones(amount: number, reason: string): boolean {
    if (this.wallet.balance >= amount) {
      this.wallet.balance -= amount;
      this.wallet.lastTransaction = {
        type: 'spend',
        amount,
        reason,
        timestamp: new Date().toISOString()
      };
      this.wallet.history.unshift({
        id: `tx-${Date.now()}`,
        type: 'spend',
        amount,
        reason,
        timestamp: new Date().toISOString()
      });
      return true;
    }
    return false;
  }

  earnStones(amount: number, reason: string): void {
    this.wallet.balance += amount;
    this.wallet.lastTransaction = {
      type: 'earn',
      amount,
      reason,
      timestamp: new Date().toISOString()
    };
    this.wallet.history.unshift({
      id: `tx-${Date.now()}`,
      type: 'earn',
      amount,
      reason,
      timestamp: new Date().toISOString()
    });
  }

  // Limits
  getLimits(): Limits {
    return this.limits;
  }

  getLimitsByTier(tier: 'guest' | 'free' | 'premium'): any {
    return this.limits[tier];
  }

  getCurrentTier(): 'guest' | 'free' | 'premium' {
    // For mock purposes, return 'free' as the current tier
    return 'free';
  }

  // Invite status
  getInviteStatus(): InviteStatus {
    return this.invite;
  }

  setInviteStatus(invited: boolean): void {
    this.invite.invited = invited;
  }

  // Game state (for demo purposes)
  private gameState: Record<string, any> = {};

  // Character creation schemas
  private schemas: Record<string, any> = {};

  getGameState(gameId: string): any {
    return this.gameState[gameId] || {
      worldRules: {},
      history: [],
      currentTurn: 0
    };
  }

  updateGameState(gameId: string, updates: any): void {
    this.gameState[gameId] = {
      ...this.getGameState(gameId),
      ...updates
    };
  }

  addGameHistory(gameId: string, entry: any): void {
    const state = this.getGameState(gameId);
    state.history.unshift({
      id: `history-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...entry
    });
    this.updateGameState(gameId, state);
  }

  // Character creation schemas
  async loadCharacterSchema(worldId: string): Promise<any> {
    if (this.schemas[worldId]) {
      return this.schemas[worldId];
    }

    try {
      const schema = await import(`../mock/schemas/${worldId}.json`);
      this.schemas[worldId] = schema.default;
      return schema.default;
    } catch (error) {
      console.warn(`No character schema found for world: ${worldId}`);
      return null;
    }
  }

  getCharacterSchema(worldId: string): any {
    return this.schemas[worldId] || null;
  }
}

export const mockDataService = new MockDataService();
