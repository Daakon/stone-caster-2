/**
 * Phase 18: Party Linter
 * Validates party data for common authoring mistakes
 */

import { z } from 'zod';
import { partyEngine } from '../src/party/party-engine.js';

// Types
export interface LintResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    companions: number;
    party_states: number;
    formations: number;
  };
}

export interface LintOptions {
  checkCaps: boolean;
  checkFormations: boolean;
  checkReferences: boolean;
  checkSkills: boolean;
  checkRecruitment: boolean;
}

// Schemas
const CompanionSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  traits: z.array(z.string()),
  recruitment_conditions: z.object({
    trust_min: z.number().min(0),
    quests_completed: z.array(z.string()),
    world_events: z.array(z.string()),
  }),
  join_banter: z.string(),
  leave_banter: z.string(),
  party_rules: z.object({
    refuses_hard_difficulty: z.boolean(),
    trust_threshold: z.number().min(0),
    preferred_intent: z.string(),
  }),
  equipment_slots: z.record(z.string(), z.string().nullable()),
  skill_baselines: z.record(z.string(), z.number().min(0).max(100)),
});

const PartyStateSchema = z.object({
  leader: z.string(),
  companions: z.array(z.string()),
  reserve: z.array(z.string()),
  marching_order: z.array(z.string()),
  intents: z.record(z.string(), z.string()),
});

export class PartyLinter {
  private companions: Map<string, any> = new Map();
  private partyStates: Map<string, any> = new Map();
  private errors: string[] = [];
  private warnings: string[] = [];

  /**
   * Lint party data
   */
  async lint(options: LintOptions = {
    checkCaps: true,
    checkFormations: true,
    checkReferences: true,
    checkSkills: true,
    checkRecruitment: true,
  }): Promise<LintResult> {
    this.errors = [];
    this.warnings = [];

    // Load data (this would integrate with database)
    await this.loadData();

    // Run checks
    if (options.checkCaps) {
      this.checkPartyCaps();
    }

    if (options.checkFormations) {
      this.checkFormations();
    }

    if (options.checkReferences) {
      this.checkReferences();
    }

    if (options.checkSkills) {
      this.checkSkills();
    }

    if (options.checkRecruitment) {
      this.checkRecruitment();
    }

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      stats: {
        companions: this.companions.size,
        party_states: this.partyStates.size,
        formations: this.partyStates.size,
      },
    };
  }

  /**
   * Load data from database
   */
  private async loadData(): Promise<void> {
    // This would integrate with database
    // For now, use mock data
    this.companions.set('npc.kiera', {
      id: 'npc.kiera',
      name: 'Kiera',
      role: 'herbalist',
      traits: ['healing', 'nature', 'wise'],
      recruitment_conditions: {
        trust_min: 30,
        quests_completed: ['quest.herbal_garden'],
        world_events: [],
      },
      join_banter: 'banter.kiera.join',
      leave_banter: 'banter.kiera.leave',
      party_rules: {
        refuses_hard_difficulty: true,
        trust_threshold: 50,
        preferred_intent: 'support',
      },
      equipment_slots: {
        main_hand: null,
        off_hand: null,
        armor: null,
        accessory: null,
      },
      skill_baselines: {
        healing: 60,
        nature: 70,
        survival: 45,
      },
    });

    this.companions.set('npc.talan', {
      id: 'npc.talan',
      name: 'Talan',
      role: 'scout',
      traits: ['stealth', 'agile', 'observant'],
      recruitment_conditions: {
        trust_min: 20,
        quests_completed: [],
        world_events: ['event.forest_clearing'],
      },
      join_banter: 'banter.talan.join',
      leave_banter: 'banter.talan.leave',
      party_rules: {
        refuses_hard_difficulty: false,
        trust_threshold: 30,
        preferred_intent: 'scout',
      },
      equipment_slots: {
        main_hand: null,
        off_hand: null,
        armor: null,
        accessory: null,
      },
      skill_baselines: {
        stealth: 65,
        perception: 70,
        agility: 55,
      },
    });

    this.partyStates.set('game_state_1', {
      leader: 'player',
      companions: ['npc.kiera', 'npc.talan'],
      reserve: [],
      marching_order: ['player', 'npc.kiera', 'npc.talan'],
      intents: {
        'npc.kiera': 'support',
        'npc.talan': 'scout',
      },
    });
  }

  /**
   * Check party capacity limits
   */
  private checkPartyCaps(): void {
    for (const [gameStateId, partyState] of this.partyStates) {
      // Check active companions
      if (partyState.companions.length > 4) {
        this.errors.push(`Game state ${gameStateId}: Too many active companions (${partyState.companions.length} > 4)`);
      }

      // Check reserve companions
      if (partyState.reserve.length > 6) {
        this.errors.push(`Game state ${gameStateId}: Too many reserve companions (${partyState.reserve.length} > 6)`);
      }

      // Check total party size
      const totalSize = partyState.companions.length + partyState.reserve.length;
      if (totalSize > 10) {
        this.errors.push(`Game state ${gameStateId}: Total party size too large (${totalSize} > 10)`);
      }
    }
  }

  /**
   * Check formation validity
   */
  private checkFormations(): void {
    for (const [gameStateId, partyState] of this.partyStates) {
      // Check if leader is in marching order
      if (!partyState.marching_order.includes(partyState.leader)) {
        this.errors.push(`Game state ${gameStateId}: Leader not in marching order`);
      }

      // Check if all active companions are in marching order
      for (const companion of partyState.companions) {
        if (!partyState.marching_order.includes(companion)) {
          this.errors.push(`Game state ${gameStateId}: Companion ${companion} not in marching order`);
        }
      }

      // Check if marching order contains only valid members
      const validMembers = [partyState.leader, ...partyState.companions];
      for (const member of partyState.marching_order) {
        if (!validMembers.includes(member)) {
          this.errors.push(`Game state ${gameStateId}: Invalid member in marching order: ${member}`);
        }
      }

      // Check for duplicates in marching order
      const uniqueMembers = new Set(partyState.marching_order);
      if (uniqueMembers.size !== partyState.marching_order.length) {
        this.errors.push(`Game state ${gameStateId}: Duplicate members in marching order`);
      }
    }
  }

  /**
   * Check references to companions
   */
  private checkReferences(): void {
    for (const [gameStateId, partyState] of this.partyStates) {
      // Check companion references
      for (const companion of partyState.companions) {
        if (!this.companions.has(companion)) {
          this.errors.push(`Game state ${gameStateId}: Unknown companion reference: ${companion}`);
        }
      }

      for (const companion of partyState.reserve) {
        if (!this.companions.has(companion)) {
          this.errors.push(`Game state ${gameStateId}: Unknown reserve companion reference: ${companion}`);
        }
      }

      // Check intent references
      for (const [npcId, intent] of Object.entries(partyState.intents)) {
        if (!this.companions.has(npcId)) {
          this.errors.push(`Game state ${gameStateId}: Intent for unknown companion: ${npcId}`);
        }

        const validIntents = ['support', 'guard', 'scout', 'assist_skill', 'harass', 'heal'];
        if (!validIntents.includes(intent)) {
          this.errors.push(`Game state ${gameStateId}: Invalid intent for ${npcId}: ${intent}`);
        }
      }
    }
  }

  /**
   * Check skill baselines
   */
  private checkSkills(): void {
    for (const [companionId, companion] of this.companions) {
      // Check skill baselines are within valid range
      for (const [skill, value] of Object.entries(companion.skill_baselines)) {
        if (value < 0 || value > 100) {
          this.errors.push(`Companion ${companionId}: Invalid skill baseline for ${skill}: ${value} (must be 0-100)`);
        }
      }

      // Check for missing essential skills
      const essentialSkills = ['healing', 'stealth', 'combat', 'survival'];
      for (const skill of essentialSkills) {
        if (!companion.skill_baselines[skill]) {
          this.warnings.push(`Companion ${companionId}: Missing essential skill baseline: ${skill}`);
        }
      }
    }
  }

  /**
   * Check recruitment conditions
   */
  private checkRecruitment(): void {
    for (const [companionId, companion] of this.companions) {
      // Check trust minimum is reasonable
      if (companion.recruitment_conditions.trust_min > 100) {
        this.errors.push(`Companion ${companionId}: Trust minimum too high: ${companion.recruitment_conditions.trust_min}`);
      }

      // Check quest references
      for (const quest of companion.recruitment_conditions.quests_completed) {
        if (!quest.startsWith('quest.')) {
          this.warnings.push(`Companion ${companionId}: Quest reference should start with 'quest.': ${quest}`);
        }
      }

      // Check world event references
      for (const event of companion.recruitment_conditions.world_events) {
        if (!event.startsWith('event.')) {
          this.warnings.push(`Companion ${companionId}: World event reference should start with 'event.': ${event}`);
        }
      }

      // Check banter references
      if (!companion.join_banter.startsWith('banter.')) {
        this.warnings.push(`Companion ${companionId}: Join banter should start with 'banter.': ${companion.join_banter}`);
      }

      if (!companion.leave_banter.startsWith('banter.')) {
        this.warnings.push(`Companion ${companionId}: Leave banter should start with 'banter.': ${companion.leave_banter}`);
      }

      // Check party rules
      if (companion.party_rules.trust_threshold > 100) {
        this.errors.push(`Companion ${companionId}: Trust threshold too high: ${companion.party_rules.trust_threshold}`);
      }

      const validIntents = ['support', 'guard', 'scout', 'assist_skill', 'harass', 'heal'];
      if (!validIntents.includes(companion.party_rules.preferred_intent)) {
        this.errors.push(`Companion ${companionId}: Invalid preferred intent: ${companion.party_rules.preferred_intent}`);
      }
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const linter = new PartyLinter();
  const options: LintOptions = {
    checkCaps: true,
    checkFormations: true,
    checkReferences: true,
    checkSkills: true,
    checkRecruitment: true,
  };

  linter.lint(options).then(result => {
    console.log('Party Lint Results:');
    console.log(`Valid: ${result.valid}`);
    console.log(`Errors: ${result.errors.length}`);
    console.log(`Warnings: ${result.warnings.length}`);
    console.log(`Stats: ${JSON.stringify(result.stats, null, 2)}`);

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach(error => console.log(`  - ${error}`));
    }

    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      result.warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    process.exit(result.valid ? 0 : 1);
  }).catch(error => {
    console.error('Lint failed:', error);
    process.exit(1);
  });
}

export { PartyLinter };


