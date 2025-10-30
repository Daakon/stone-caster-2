/**
 * AWF Games Fixtures - Phase 1
 * Seed fixtures for games with proper state_snapshot.meta
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface GameFixture {
  id: string;
  user_id?: string;
  cookie_group_id?: string;
  world_slug: string;
  state_snapshot: {
    meta: {
      world_ref: string;
      adventure_ref: string;
      scenario_ref?: string;
      ruleset_ref: string;
      locale: string;
    };
    hot: Record<string, any>;
    warm: Record<string, any>;
    cold: Record<string, any>;
  };
  turn_count: number;
  status: 'active' | 'completed' | 'paused' | 'abandoned';
}

const gameFixtures: GameFixture[] = [
  {
    id: 'game-mystika-tutorial-001',
    user_id: 'user-123',
    world_slug: 'mystika',
    state_snapshot: {
      meta: {
        world_ref: 'world.mystika@1.0.0',
        adventure_ref: 'adv.mystika-tutorial@1.0.0',
        scenario_ref: 'scenario.inn_last_ember@1.0.0',
        ruleset_ref: 'ruleset.core.default@1.0.0',
        locale: 'en-US'
      },
      hot: {
        scene: 'inn_common_room',
        time: { ticks: 0, band: 'Dawn' },
        objectives: [
          { id: 'learn_magic', title: 'Learn basic magic', completed: false }
        ],
        flags: { tutorial_mode: true }
      },
      warm: {
        episodic: [
          { key: 'arrival', note: 'Arrived at the Last Ember Inn', turn: 0 }
        ],
        pins: [],
        relationships: {},
        tags: { tutorial: true }
      },
      cold: {
        character_background: 'Aspiring mage from the countryside',
        world_knowledge: ['Mystika is a land of magic and mystery']
      }
    },
    turn_count: 0,
    status: 'active'
  },
  {
    id: 'game-whispercross-haunted-001',
    cookie_group_id: 'cookie-group-456',
    world_slug: 'whispercross',
    state_snapshot: {
      meta: {
        world_ref: 'world.whispercross@1.0.0',
        adventure_ref: 'adv.whispercross-haunted-town@1.0.0',
        scenario_ref: 'scenario.haunted_investigation@1.0.0',
        ruleset_ref: 'ruleset.core.default@1.0.0',
        locale: 'en-US'
      },
      hot: {
        scene: 'town_square',
        time: { ticks: 15, band: 'Evening' },
        objectives: [
          { id: 'investigate_haunting', title: 'Investigate the haunting', completed: false },
          { id: 'find_evidence', title: 'Find evidence of supernatural activity', completed: false }
        ],
        flags: { investigation_started: true, locals_helpful: false }
      },
      warm: {
        episodic: [
          { key: 'arrival', note: 'Arrived in Whispercross', turn: 0 },
          { key: 'first_sighting', note: 'Saw a ghostly figure in the town square', turn: 5 }
        ],
        pins: ['old_man_warning', 'abandoned_house'],
        relationships: {
          'npc.mayor': { trust: 30, fear: 20 },
          'npc.old_man': { trust: 60, fear: 10 }
        },
        tags: { supernatural: true, investigation: true }
      },
      cold: {
        character_background: 'Paranormal investigator',
        world_knowledge: ['Whispercross is known for supernatural occurrences']
      }
    },
    turn_count: 3,
    status: 'active'
  },
  {
    id: 'game-aetherium-space-001',
    user_id: 'user-789',
    world_slug: 'aetherium',
    state_snapshot: {
      meta: {
        world_ref: 'world.aetherium@1.0.0',
        adventure_ref: 'adv.aetherium-space-station@1.0.0',
        scenario_ref: 'scenario.station_alpha@1.0.0',
        ruleset_ref: 'ruleset.core.default@1.0.0',
        locale: 'en-US'
      },
      hot: {
        scene: 'station_docking_bay',
        time: { ticks: 0, band: 'Dawn' },
        objectives: [
          { id: 'explore_station', title: 'Explore the abandoned space station', completed: false },
          { id: 'find_survivors', title: 'Look for any survivors', completed: false }
        ],
        flags: { docking_complete: true, life_support_active: true }
      },
      warm: {
        episodic: [
          { key: 'docking', note: 'Successfully docked at Station Alpha', turn: 0 }
        ],
        pins: ['engineering_section', 'command_center'],
        relationships: {},
        tags: { sci_fi: true, exploration: true }
      },
      cold: {
        character_background: 'Space explorer and engineer',
        world_knowledge: ['Aetherium system is known for advanced technology']
      }
    },
    turn_count: 0,
    status: 'active'
  }
];

async function seedGameFixtures(): Promise<void> {
  console.log('🌱 Seeding AWF Games Fixtures...');
  
  try {
    // Check if games already exist
    const { data: existingGames, error: checkError } = await supabase
      .from('games')
      .select('id')
      .in('id', gameFixtures.map(g => g.id));
    
    if (checkError) {
      throw new Error(`Failed to check existing games: ${checkError.message}`);
    }
    
    const existingIds = new Set(existingGames?.map(g => g.id) || []);
    const newFixtures = gameFixtures.filter(g => !existingIds.has(g.id));
    
    if (newFixtures.length === 0) {
      console.log('✅ All game fixtures already exist');
      return;
    }
    
    console.log(`📝 Creating ${newFixtures.length} new game fixtures...`);
    
    // Insert new game fixtures
    const { data, error } = await supabase
      .from('games')
      .insert(newFixtures)
      .select();
    
    if (error) {
      throw new Error(`Failed to insert game fixtures: ${error.message}`);
    }
    
    console.log(`✅ Successfully created ${data?.length || 0} game fixtures`);
    
    // Log created fixtures
    for (const fixture of newFixtures) {
      console.log(`  - ${fixture.id}: ${fixture.state_snapshot.meta.world_ref} + ${fixture.state_snapshot.meta.adventure_ref}`);
    }
    
  } catch (error) {
    console.error('❌ Failed to seed game fixtures:', error);
    throw error;
  }
}

async function validateGameFixtures(): Promise<void> {
  console.log('🔍 Validating game fixtures...');
  
  try {
    const { data: games, error } = await supabase
      .from('games')
      .select('id, state_snapshot')
      .in('id', gameFixtures.map(g => g.id));
    
    if (error) {
      throw new Error(`Failed to validate games: ${error.message}`);
    }
    
    const validationResults = games?.map(game => {
      const meta = game.state_snapshot?.meta;
      const hasWorldRef = !!meta?.world_ref;
      const hasAdventureRef = !!meta?.adventure_ref;
      const hasRulesetRef = !!meta?.ruleset_ref;
      const hasLocale = !!meta?.locale;
      
      return {
        id: game.id,
        valid: hasWorldRef && hasAdventureRef && hasRulesetRef && hasLocale,
        missing: [
          !hasWorldRef && 'world_ref',
          !hasAdventureRef && 'adventure_ref',
          !hasRulesetRef && 'ruleset_ref',
          !hasLocale && 'locale'
        ].filter(Boolean)
      };
    }) || [];
    
    const invalidGames = validationResults.filter(r => !r.valid);
    
    if (invalidGames.length > 0) {
      console.error('❌ Invalid game fixtures found:');
      for (const game of invalidGames) {
        console.error(`  - ${game.id}: missing ${game.missing.join(', ')}`);
      }
      throw new Error('Game fixture validation failed');
    }
    
    console.log('✅ All game fixtures are valid');
    
  } catch (error) {
    console.error('❌ Game fixture validation failed:', error);
    throw error;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const validateOnly = args.includes('--validate');
  
  if (validateOnly) {
    validateGameFixtures()
      .then(() => {
        console.log('✅ Validation complete');
        process.exit(0);
      })
      .catch(error => {
        console.error('❌ Validation failed:', error);
        process.exit(1);
      });
  } else {
    seedGameFixtures()
      .then(() => validateGameFixtures())
      .then(() => {
        console.log('✅ Seeding complete');
        process.exit(0);
      })
      .catch(error => {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
      });
  }
}

export { seedGameFixtures, validateGameFixtures, gameFixtures };














