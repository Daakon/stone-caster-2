/**
 * Mock World Presets
 * Genre/preset templates for quick world creation
 * 
 * Each preset includes default ruleset keys and genre tags
 */

import React from 'react';
import { Sword, Skull, Cpu, Ghost } from 'lucide-react';

export interface WorldPreset {
  id: string;
  title: string;
  description: string;
  description_long: string;
  iconName: 'sword' | 'skull' | 'cpu' | 'ghost';
  default_ruleset_keys: string[];
  genre_tag: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const WORLD_PRESETS: WorldPreset[] = [
  {
    id: 'preset-high-fantasy',
    title: 'High Fantasy',
    description: 'Classic adventure with magic and heroes',
    description_long: 'A traditional high fantasy setting with powerful magic, legendary heroes, and epic quests. Perfect for classic D&D-style adventures with wizards, dragons, and enchanted artifacts.',
    iconName: 'sword',
    icon: Sword,
    default_ruleset_keys: ['foundation-d100-5-pillars', 'flavor-magic-system'],
    genre_tag: 'fantasy',
  },
  {
    id: 'preset-grim-dark',
    title: 'Grim Dark',
    description: 'Low magic, high lethality survival',
    description_long: 'A brutal, unforgiving world where death is always near. Low magic, scarce resources, and harsh survival mechanics. Every decision matters, and mistakes are costly.',
    iconName: 'skull',
    icon: Skull,
    default_ruleset_keys: ['foundation-d100-lite', 'expansion-vitality-stamina', 'expansion-hardcore-survival'],
    genre_tag: 'grimdark',
  },
  {
    id: 'preset-cyber-sprawl',
    title: 'Cyber Sprawl',
    description: 'High tech, low life in the urban sprawl',
    description_long: 'A neon-lit cyberpunk world of corporate intrigue, cybernetics, and street-level crime. Technology and humanity collide in sprawling megacities where information is power.',
    iconName: 'cpu',
    icon: Cpu,
    default_ruleset_keys: ['foundation-d100-5-pillars', 'flavor-stealth-system', 'flavor-social-intrigue'],
    genre_tag: 'cyberpunk',
  },
  {
    id: 'preset-cosmic-horror',
    title: 'Cosmic Horror',
    description: 'Unknowable terrors beyond comprehension',
    description_long: 'A world where ancient, incomprehensible entities lurk in the shadows. Sanity is fragile, knowledge is dangerous, and the truth of reality is too terrible to bear.',
    iconName: 'ghost',
    icon: Ghost,
    default_ruleset_keys: ['foundation-d100-lite', 'expansion-npc-personalities', 'flavor-social-intrigue'],
    genre_tag: 'horror',
  },
];
