import type { CharacterCreationConfig, WorldCharacterConfig } from '../types';

// Default character creation configuration
export const DEFAULT_CHARACTER_CREATION_CONFIG: CharacterCreationConfig = {
  skillBudget: 20, // 20 points to allocate
  traitCount: {
    min: 2,
    max: 4
  },
  kitThresholds: {
    combat: 60,
    stealth: 60,
    social: 60,
    lore: 60,
    survival: 60,
    medicine: 60,
    craft: 60
  }
};

// Skill allocation constants
export const SKILL_CONSTANTS = {
  MIN: 0,
  BASELINE: 50,
  MAX: 100
} as const;

// World-specific character creation configurations
export const WORLD_CONFIGS: Record<string, WorldCharacterConfig> = {
  mystika: {
    availableRaces: [
      'Human',
      'Elf', 
      'Shifter'
    ],
    essenceOptions: [
      'Life',
      'Death', 
      'Order',
      'Chaos'
    ],
    traitCatalog: [
      // Personality traits
      { id: 'empathetic', label: 'Empathetic', category: 'personality', description: 'Quick to understand others\' feelings' },
      { id: 'pragmatic', label: 'Pragmatic', category: 'personality', description: 'Focused on practical solutions' },
      { id: 'curious', label: 'Curious', category: 'personality', description: 'Driven to learn and explore' },
      { id: 'cautious', label: 'Cautious', category: 'personality', description: 'Careful and methodical approach' },
      { id: 'bold', label: 'Bold', category: 'personality', description: 'Willing to take risks' },
      { id: 'loyal', label: 'Loyal', category: 'personality', description: 'Devoted to friends and causes' },
      
      // Combat mindset
      { id: 'tactical', label: 'Tactical', category: 'combat', description: 'Thinks several moves ahead' },
      { id: 'aggressive', label: 'Aggressive', category: 'combat', description: 'Prefers direct confrontation' },
      { id: 'defensive', label: 'Defensive', category: 'combat', description: 'Focuses on protection and survival' },
      { id: 'opportunistic', label: 'Opportunistic', category: 'combat', description: 'Strikes when advantage presents itself' },
      
      // Social tone
      { id: 'diplomatic', label: 'Diplomatic', category: 'social', description: 'Skilled at negotiation and compromise' },
      { id: 'intimidating', label: 'Intimidating', category: 'social', description: 'Commands respect through presence' },
      { id: 'charming', label: 'Charming', category: 'social', description: 'Naturally likable and persuasive' },
      { id: 'mysterious', label: 'Mysterious', category: 'social', description: 'Keeps others guessing' },
      { id: 'honest', label: 'Honest', category: 'social', description: 'Values truth and transparency' },
      { id: 'secretive', label: 'Secretive', category: 'social', description: 'Guards information carefully' },
      
      // Survival traits
      { id: 'resourceful', label: 'Resourceful', category: 'survival', description: 'Makes the most of available materials' },
      { id: 'adaptable', label: 'Adaptable', category: 'survival', description: 'Quick to adjust to new situations' },
      { id: 'persistent', label: 'Persistent', category: 'survival', description: 'Never gives up easily' },
      { id: 'observant', label: 'Observant', category: 'survival', description: 'Notices important details' }
    ],
    eligibleKits: [
      {
        id: 'scout_kit',
        label: 'Scout Kit',
        items: ['Light armor', 'Short bow', 'Quiver of arrows', 'Climbing gear', 'Rations (3 days)'],
        requirements: { stealth: 60 }
      },
      {
        id: 'warrior_kit', 
        label: 'Warrior Kit',
        items: ['Heavy armor', 'Sword', 'Shield', 'Healing potion', 'Rations (3 days)'],
        requirements: { combat: 60 }
      },
      {
        id: 'field_medic_kit',
        label: 'Field Medic Kit', 
        items: ['Medical supplies', 'Healing herbs', 'Bandages', 'Antiseptic', 'Rations (3 days)'],
        requirements: { medicine: 60 }
      },
      {
        id: 'scholar_kit',
        label: 'Scholar Kit',
        items: ['Books and scrolls', 'Writing materials', 'Magnifying glass', 'Rations (3 days)'],
        requirements: { lore: 60 }
      },
      {
        id: 'survivalist_kit',
        label: 'Survivalist Kit',
        items: ['Hunting gear', 'Trapping supplies', 'Water purification', 'Rations (3 days)'],
        requirements: { survival: 60 }
      },
      {
        id: 'craftsman_kit',
        label: 'Craftsman Kit',
        items: ['Tools', 'Raw materials', 'Repair supplies', 'Rations (3 days)'],
        requirements: { craft: 60 }
      },
      {
        id: 'diplomat_kit',
        label: 'Diplomat Kit',
        items: ['Fine clothing', 'Official documents', 'Gifts', 'Rations (3 days)'],
        requirements: { social: 60 }
      }
    ]
  },
  
  aetherium: {
    availableRaces: [
      'Human',
      'Enhanced Human',
      'Neural Hybrid'
    ],
    essenceOptions: [
      'Data',
      'Consciousness',
      'Network',
      'Void'
    ],
    traitCatalog: [
      // Cyberpunk traits
      { id: 'analytical', label: 'Analytical', category: 'mind', description: 'Thinks logically and processes information systematically' },
      { id: 'charismatic', label: 'Charismatic', category: 'social', description: 'Natural leader who can influence others' },
      { id: 'rebellious', label: 'Rebellious', category: 'personality', description: 'Questions authority and fights for freedom' },
      { id: 'ambitious', label: 'Ambitious', category: 'personality', description: 'Driven to achieve power and success' },
      { id: 'empathetic', label: 'Empathetic', category: 'social', description: 'Understands and cares about others\' emotions' },
      { id: 'calculating', label: 'Calculating', category: 'mind', description: 'Makes decisions based on careful analysis' },
      { id: 'idealistic', label: 'Idealistic', category: 'personality', description: 'Believes in higher principles and causes' },
      { id: 'pragmatic', label: 'Pragmatic', category: 'personality', description: 'Focuses on practical solutions and results' }
    ],
    eligibleKits: [
      {
        id: 'neural_hacker_kit',
        label: 'Neural Hacker Kit',
        items: ['Neural interface', 'Data chips', 'Encryption tools', 'Energy bars'],
        requirements: { lore: 60 }
      },
      {
        id: 'corporate_agent_kit',
        label: 'Corporate Agent Kit',
        items: ['Business suit', 'Corporate ID', 'Communication device', 'Credits'],
        requirements: { social: 60 }
      },
      {
        id: 'underground_runner_kit',
        label: 'Underground Runner Kit',
        items: ['Stealth gear', 'Weapon', 'Hacker tools', 'Underground contacts'],
        requirements: { stealth: 60 }
      }
    ]
  },
  
  voidreach: {
    availableRaces: [
      'Human',
      'Enhanced Human',
      'Alien Hybrid'
    ],
    essenceOptions: [
      'Exploration',
      'Discovery',
      'Diplomacy',
      'Survival'
    ],
    traitCatalog: [
      // Space exploration traits
      { id: 'curious', label: 'Curious', category: 'personality', description: 'Driven to discover and understand new things' },
      { id: 'cautious', label: 'Cautious', category: 'personality', description: 'Careful and methodical in approach' },
      { id: 'brave', label: 'Brave', category: 'personality', description: 'Willing to take risks for the mission' },
      { id: 'diplomatic', label: 'Diplomatic', category: 'social', description: 'Skilled at negotiation and conflict resolution' },
      { id: 'analytical', label: 'Analytical', category: 'mind', description: 'Thinks logically and systematically' },
      { id: 'empathetic', label: 'Empathetic', category: 'social', description: 'Understands and relates to others\' perspectives' },
      { id: 'determined', label: 'Determined', category: 'personality', description: 'Persistent in achieving goals' },
      { id: 'adaptable', label: 'Adaptable', category: 'personality', description: 'Quick to adjust to new situations' }
    ],
    eligibleKits: [
      {
        id: 'explorer_kit',
        label: 'Explorer Kit',
        items: ['Space suit', 'Scanner', 'Sample containers', 'Emergency rations'],
        requirements: { survival: 60 }
      },
      {
        id: 'diplomat_kit',
        label: 'Diplomat Kit',
        items: ['Formal attire', 'Translation device', 'Cultural database', 'Gift items'],
        requirements: { social: 60 }
      },
      {
        id: 'scientist_kit',
        label: 'Scientist Kit',
        items: ['Research equipment', 'Analysis tools', 'Data recorder', 'Specimen containers'],
        requirements: { lore: 60 }
      }
    ]
  },
  
  whispercross: {
    availableRaces: [
      'Human',
      'Nature Touched',
      'Spirit Walker'
    ],
    essenceOptions: [
      'Nature',
      'Spirit',
      'Harmony',
      'Wisdom'
    ],
    traitCatalog: [
      // Nature-focused traits
      { id: 'peaceful', label: 'Peaceful', category: 'personality', description: 'Seeks harmony and avoids conflict' },
      { id: 'wise', label: 'Wise', category: 'mind', description: 'Possesses deep understanding and insight' },
      { id: 'gentle', label: 'Gentle', category: 'personality', description: 'Kind and caring towards all living things' },
      { id: 'patient', label: 'Patient', category: 'personality', description: 'Willing to wait for the right moment' },
      { id: 'intuitive', label: 'Intuitive', category: 'mind', description: 'Trusts inner wisdom and feelings' },
      { id: 'protective', label: 'Protective', category: 'personality', description: 'Defends the glade and its inhabitants' },
      { id: 'mystical', label: 'Mystical', category: 'mind', description: 'Connected to deeper spiritual truths' },
      { id: 'nurturing', label: 'Nurturing', category: 'personality', description: 'Cares for and helps others grow' }
    ],
    eligibleKits: [
      {
        id: 'nature_guardian_kit',
        label: 'Nature Guardian Kit',
        items: ['Sacred herbs', 'Protection amulet', 'Nature\'s blessing', 'Healing salve'],
        requirements: { survival: 60 }
      },
      {
        id: 'whisper_listener_kit',
        label: 'Whisper Listener Kit',
        items: ['Ancient scrolls', 'Spirit stones', 'Wisdom crystals', 'Sacred water'],
        requirements: { lore: 60 }
      },
      {
        id: 'grove_keeper_kit',
        label: 'Grove Keeper Kit',
        items: ['Garden tools', 'Seed packets', 'Growth enhancers', 'Nature\'s gifts'],
        requirements: { craft: 60 }
      }
    ]
  }
};

// Default world configuration for Mystika (backward compatibility)
export const MYSTIKA_WORLD_CONFIG: WorldCharacterConfig = WORLD_CONFIGS.mystika;

// Helper function to get world configuration
export function getWorldConfig(worldSlug: string): WorldCharacterConfig {
  return WORLD_CONFIGS[worldSlug] || WORLD_CONFIGS.mystika;
}

// Helper function to get eligible kits based on skills
export function getEligibleKits(skills: Record<string, number>, worldConfig: WorldCharacterConfig) {
  return worldConfig.eligibleKits.filter(kit => {
    return Object.entries(kit.requirements).every(([skill, threshold]) => {
      return (skills[skill] || 0) >= threshold;
    });
  });
}

// Skill level terminology
export const SKILL_LEVELS = {
  0: 'None',
  10: 'Novice',
  20: 'Poor',
  30: 'Below Average',
  40: 'Below Average',
  50: 'Average',
  60: 'Above Average',
  70: 'Good',
  80: 'Exceptional',
  90: 'Master',
  100: 'Legendary'
} as const;

// Get skill level description
export function getSkillLevel(skill: number): string {
  const level = Math.floor(skill / 10) * 10;
  return SKILL_LEVELS[level as keyof typeof SKILL_LEVELS] || 'Unknown';
}

// Calculate cost to increase/decrease a skill
export function getSkillCost(currentValue: number, newValue: number): number {
  if (newValue === currentValue) return 0;
  
  let cost = 0;
  const direction = newValue > currentValue ? 1 : -1;
  const start = direction > 0 ? currentValue : newValue;
  const end = direction > 0 ? newValue : currentValue;
  
  for (let i = start; i < end; i++) {
    if (i < 30) {
      cost += 3; // Below 30: 3 points per level
    } else if (i < 50) {
      cost += 1; // 30-49: 1 point per level
    } else if (i < 60) {
      cost += 1; // 50-59: 1 point per level
    } else if (i < 70) {
      cost += 2; // 60-69: 2 points per level
    } else if (i < 80) {
      cost += 2; // 70-79: 2 points per level
    } else {
      cost += 3; // 80+: 3 points per level
    }
  }
  
  return cost * direction;
}

// Helper function to validate skill budget with new system
export function validateSkillBudget(skills: Record<string, number>, budget: number = 20): boolean {
  const totalCost = Object.values(skills).reduce((sum, value) => {
    return sum + getSkillCost(50, value); // Cost from baseline 50
  }, 0);
  return totalCost <= budget;
}

// Helper function to get remaining skill points with new system
export function getRemainingSkillPoints(skills: Record<string, number>, budget: number = 20): number {
  const totalCost = Object.values(skills).reduce((sum, value) => {
    return sum + getSkillCost(50, value); // Cost from baseline 50
  }, 0);
  return budget - totalCost;
}
