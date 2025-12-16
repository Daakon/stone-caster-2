/**
 * Mock Playstyles / Themes
 * These determine the default rulesets (forces) applied in Step 2.
 */

import { BookOpen, Swords, Heart, VenetianMask } from 'lucide-react';
import React from 'react';

export interface PlaystyleDefinition {
    id: string;
    name: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    default_ruleset_keys: string[];
}

export const PLAYSTYLES: PlaystyleDefinition[] = [
    {
        id: 'playstyle-rpg',
        name: 'Tactical RPG',
        description: 'Crunchy mechanics, combat focus, and stat blocks.',
        icon: Swords,
        default_ruleset_keys: [
            'foundation-d100-5-pillars',
            'expansion-vitality-stamina',
            'expansion-advanced-combat'
        ],
    },
    {
        id: 'playstyle-narrative',
        name: 'Narrative Story',
        description: 'Rules-lite, focus on story flow and characters.',
        icon: BookOpen,
        default_ruleset_keys: [
            'foundation-d100-lite',
            'expansion-npc-personalities',
            'foundation-world-cycle-time-bands'
        ],
    },
    {
        id: 'playstyle-social',
        name: 'Social Intrigue',
        description: 'Politics, manipulation, and secrets.',
        icon: VenetianMask,
        default_ruleset_keys: [
            'foundation-d100-5-pillars',
            'flavor-social-intrigue',
            'expansion-npc-quirks'
        ],
    },
    {
        id: 'playstyle-romance',
        name: 'Romance & Relationships',
        description: 'Focus on bonds, emotions, and interpersonal drama.',
        icon: Heart,
        default_ruleset_keys: [
            'foundation-d100-lite',
            'expansion-npc-personalities',
            'expansion-npc-quirks'
        ],
    },
];
