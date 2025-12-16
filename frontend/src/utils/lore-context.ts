import type { ChimeraLoreType } from '@/types/chimera-v2';

export type LoreContextType = 'world' | 'npc' | 'item' | 'location';

interface LoreOption {
    value: ChimeraLoreType;
    label: string;
    color: string;
}

const LORE_DEFINITIONS: Record<ChimeraLoreType, { label: string; color: string }> = {
    'general': { label: 'General', color: 'bg-stone-500' },
    'history': { label: 'History', color: 'bg-amber-600' },
    'geography': { label: 'Geography', color: 'bg-emerald-700' },
    'culture': { label: 'Culture', color: 'bg-orange-600' },
    'religion': { label: 'Religion', color: 'bg-violet-600' },
    'faction': { label: 'Faction', color: 'bg-red-700' },
    'magic': { label: 'Magic', color: 'bg-indigo-600' },
    'rumor': { label: 'Rumor', color: 'bg-rose-600' },
    'backstory': { label: 'Backstory', color: 'bg-zinc-600' },
    'memory': { label: 'Memory', color: 'bg-cyan-700' },
    'secret': { label: 'Secret', color: 'bg-slate-800' },
    'relationship': { label: 'Relationship', color: 'bg-pink-600' },
    'habit': { label: 'Habit', color: 'bg-lime-700' },
    'origin': { label: 'Origin', color: 'bg-amber-700' },
    'creator': { label: 'Creator', color: 'bg-blue-700' },
    'curse': { label: 'Curse', color: 'bg-purple-900' },
    'legend': { label: 'Legend', color: 'bg-yellow-600' },
    'mechanic': { label: 'Mechanic', color: 'bg-blue-600' },
    'hazard': { label: 'Hazard', color: 'bg-red-600' },
    'treasure': { label: 'Treasure', color: 'bg-yellow-500' },
    'inhabitants': { label: 'Inhabitants', color: 'bg-green-600' },
};

const CONTEXT_MAPPINGS: Record<LoreContextType, ChimeraLoreType[]> = {
    'world': ['history', 'geography', 'culture', 'religion', 'faction', 'magic', 'rumor'],
    'npc': ['backstory', 'memory', 'secret', 'relationship', 'habit', 'rumor'],
    'item': ['origin', 'creator', 'curse', 'legend', 'mechanic'],
    'location': ['history', 'hazard', 'treasure', 'inhabitants', 'rumor'],
};

export function getLoreTypesForContext(context: LoreContextType): LoreOption[] {
    const allowedTypes = CONTEXT_MAPPINGS[context] || ['general'];

    return allowedTypes.map(type => ({
        value: type,
        label: LORE_DEFINITIONS[type]?.label || type,
        color: LORE_DEFINITIONS[type]?.color || 'bg-stone-500'
    }));
}

export function getLoreTypeColor(type: ChimeraLoreType | string): string {
    return LORE_DEFINITIONS[type as ChimeraLoreType]?.color || 'bg-stone-500';
}
