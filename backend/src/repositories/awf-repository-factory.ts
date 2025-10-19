/**
 * Repository Factory for AWF (Adventure World Format) bundle system
 * Phase 1: Data Model - Centralized repository management
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { CoreContractsRepository } from './awf-core-contracts-repository.js';
import { CoreRulesetsRepository } from './awf-core-rulesets-repository.js';
import { NPCRepository } from './awf-npc-repository.js';
import { WorldsRepository } from './awf-worlds-repository.js';
import { AdventuresRepository } from './awf-adventures-repository.js';
import { AdventureStartsRepository } from './awf-adventure-starts-repository.js';
import { SessionsRepository } from './awf-sessions-repository.js';
import { GameStatesRepository } from './awf-game-states-repository.js';
import { InjectionMapRepository } from './awf-injection-map-repository.js';

export interface RepositoryFactoryOptions {
  supabase: SupabaseClient;
}

export class AWFRepositoryFactory {
  private supabase: SupabaseClient;
  private coreContractsRepo: CoreContractsRepository | null = null;
  private coreRulesetsRepo: CoreRulesetsRepository | null = null;
  private npcRepo: NPCRepository | null = null;
  private worldsRepo: WorldsRepository | null = null;
  private adventuresRepo: AdventuresRepository | null = null;
  private adventureStartsRepo: AdventureStartsRepository | null = null;
  private sessionsRepo: SessionsRepository | null = null;
  private gameStatesRepo: GameStatesRepository | null = null;
  private injectionMapRepo: InjectionMapRepository | null = null;

  constructor(options: RepositoryFactoryOptions) {
    this.supabase = options.supabase;
  }

  getCoreContractsRepository(): CoreContractsRepository {
    if (!this.coreContractsRepo) {
      this.coreContractsRepo = new CoreContractsRepository({ supabase: this.supabase });
    }
    return this.coreContractsRepo;
  }

  getCoreRulesetsRepository(): CoreRulesetsRepository {
    if (!this.coreRulesetsRepo) {
      this.coreRulesetsRepo = new CoreRulesetsRepository(this.supabase);
    }
    return this.coreRulesetsRepo;
  }

  getNPCRepository(): NPCRepository {
    if (!this.npcRepo) {
      this.npcRepo = new NPCRepository({ supabase: this.supabase });
    }
    return this.npcRepo;
  }

  getWorldsRepository(): WorldsRepository {
    if (!this.worldsRepo) {
      this.worldsRepo = new WorldsRepository({ supabase: this.supabase });
    }
    return this.worldsRepo;
  }

  getAdventuresRepository(): AdventuresRepository {
    if (!this.adventuresRepo) {
      this.adventuresRepo = new AdventuresRepository({ supabase: this.supabase });
    }
    return this.adventuresRepo;
  }

  getAdventureStartsRepository(): AdventureStartsRepository {
    if (!this.adventureStartsRepo) {
      this.adventureStartsRepo = new AdventureStartsRepository({ supabase: this.supabase });
    }
    return this.adventureStartsRepo;
  }

  getSessionsRepository(): SessionsRepository {
    if (!this.sessionsRepo) {
      this.sessionsRepo = new SessionsRepository({ supabase: this.supabase });
    }
    return this.sessionsRepo;
  }

  getGameStatesRepository(): GameStatesRepository {
    if (!this.gameStatesRepo) {
      this.gameStatesRepo = new GameStatesRepository({ supabase: this.supabase });
    }
    return this.gameStatesRepo;
  }

  getInjectionMapRepository(): InjectionMapRepository {
    if (!this.injectionMapRepo) {
      this.injectionMapRepo = new InjectionMapRepository({ supabase: this.supabase });
    }
    return this.injectionMapRepo;
  }

  // Convenience method to get all repositories
  getAllRepositories() {
    return {
      coreContracts: this.getCoreContractsRepository(),
      coreRulesets: this.getCoreRulesetsRepository(),
      npcs: this.getNPCRepository(),
      worlds: this.getWorldsRepository(),
      adventures: this.getAdventuresRepository(),
      adventureStarts: this.getAdventureStartsRepository(),
      sessions: this.getSessionsRepository(),
      gameStates: this.getGameStatesRepository(),
      injectionMap: this.getInjectionMapRepository(),
    };
  }
}


