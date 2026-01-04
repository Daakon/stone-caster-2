import React, { useEffect, useState } from 'react';
import { useStoryDraftStore } from '../stores/useStoryDraftStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clapperboard, Text, Users, Sparkles, Star, Plus, Trash2, User, Mic } from 'lucide-react';
import type { GenesisConfig } from '@/types/chimera-domain';
// Fetch specific entities by ID to support Public entities
import { getEntity } from '@/services/chimera-api';

interface StarEntity {
    id: string;
    name: string;
    role?: string;
}

export function NarrativeStone() {
    const draft = useStoryDraftStore((state) => state.draft);
    const setDraftData = useStoryDraftStore((state) => state.setDraftData);

    const [localConfig, setLocalConfig] = useState<GenesisConfig>({
        pacing: 'balanced',
        narrator_tone: 'Standard',
        perspective: 'second_person',
        set_design: '',
        opening_action: '',
        cast_members: [],
        cast_extras: []
    });

    const [availableStars, setAvailableStars] = useState<StarEntity[]>([]);

    // Hydrate local state from draft
    useEffect(() => {
        if (draft?.genesis_config) {
            setLocalConfig({
                pacing: draft.genesis_config.pacing || 'balanced',
                narrator_tone: draft.genesis_config.narrator_tone || 'Standard',
                perspective: draft.genesis_config.perspective || 'second_person',
                set_design: draft.genesis_config.set_design || '',
                opening_action: draft.genesis_config.opening_action || '',
                cast_members: draft.genesis_config.cast_members || [],
                cast_extras: draft.genesis_config.cast_extras || []
            });
        }
    }, [draft?.genesis_config]);

    // Fetched Cache to prevent duplicates
    const fetchedIdsRef = React.useRef<Set<string>>(new Set());
    const [isLoadingStars, setIsLoadingStars] = useState(false);

    // Fetch Stars (Entities in Draft)
    useEffect(() => {
        const fetchStars = async () => {
            if (!draft?.entity_ids || draft.entity_ids.length === 0) {
                // Only clear if we actually have NO entities
                // setAvailableStars([]); 
                return;
            }

            // Identify IDs we haven't fetched yet
            const newIds = draft.entity_ids.filter(id => !fetchedIdsRef.current.has(id));

            if (newIds.length === 0) return; // Nothing new to fetch

            setIsLoadingStars(true);

            // Mark as fetching immediately to prevent race conditions
            newIds.forEach(id => fetchedIdsRef.current.add(id));

            try {
                // TODO: Replace with bulk fetch endpoint /api/v2/chimera/entities?ids=...
                const promises = newIds.map(id => getEntity(id));
                const results = await Promise.allSettled(promises);

                const newStars: StarEntity[] = [];

                results.forEach(result => {
                    if (result.status === 'fulfilled' && result.value) {
                        const ent = result.value as any;

                        // Filter: ONLY show NPCs
                        const type = ent.entity_type || ent.type || 'NPC';
                        if (type === 'NPC') {
                            newStars.push({
                                id: ent.id,
                                name: ent.display_name || ent.name || ent.properties?.name || 'Unknown Entity',
                                role: type
                            });
                        }
                    } else {
                        // If failed, remove from cache so we can retry later? 
                        // Or keep it to prevent spamming errors. Keeping for now.
                        console.warn('[NarrativeStone] Failed to fetch star:', result);
                    }
                });

                setAvailableStars(prev => {
                    // Merge and Deduplicate
                    const existingIds = new Set(prev.map(s => s.id));
                    const uniqueNew = newStars.filter(s => !existingIds.has(s.id));
                    return [...prev, ...uniqueNew];
                });
            } catch (err) {
                console.error("Failed to fetch stars", err);
            } finally {
                setIsLoadingStars(false);
            }
        };

        // Simple debounce/check
        const timeoutId = setTimeout(fetchStars, 100);
        return () => clearTimeout(timeoutId);
    }, [draft?.entity_ids]); // This dependency is fine if we check cache inside

    const handleGenesisChange = (field: keyof GenesisConfig, value: any) => {
        const updated = { ...localConfig, [field]: value };
        setLocalConfig(updated);

        // Update store
        setDraftData({
            genesis_config: updated
        });
    };

    const toggleStar = (starId: string) => {
        const current = localConfig.cast_members || [];
        const updated = current.includes(starId)
            ? current.filter(id => id !== starId)
            : [...current, starId];
        handleGenesisChange('cast_members', updated);
    };

    if (!draft) return null;

    return (
        <div className="max-w-3xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className="text-2xl font-bold mb-2">The Director's Slate</h2>
                <p className="text-muted-foreground">
                    Define the opening scene and storytelling voice.
                </p>
            </div>

            {/* A. Game Master Persona (The Narrator) */}
            <Card className="border-stone-800 bg-stone-900/50 backdrop-blur-sm">
                <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                        <User className="w-4 h-4 text-emerald-500" />
                        Game Master Persona
                    </CardTitle>
                    <CardDescription>Configure the storytelling voice.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Tone */}
                    <div className="space-y-3">
                        <Label className="text-stone-300">Tone</Label>
                        <div className="flex flex-wrap gap-2">
                            {['Standard', 'Gritty', 'Epic', 'Dark', 'Lighthearted', 'Mystery'].map((tone) => (
                                <button
                                    key={tone}
                                    type="button"
                                    onClick={() => handleGenesisChange('narrator_tone', tone)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${localConfig.narrator_tone === tone
                                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_10px_-3px_rgba(16,185,129,0.3)]'
                                        : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700 hover:text-stone-300'
                                        }`}
                                >
                                    {tone}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Pacing */}
                        <div className="space-y-3">
                            <Label className="text-stone-300">Pacing</Label>
                            <div className="space-y-2">
                                {['concise', 'balanced', 'descriptive'].map((pacing) => (
                                    <div
                                        key={pacing}
                                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${localConfig.pacing === pacing ? 'bg-emerald-950/30 border-emerald-500/50' : 'bg-stone-950 border-stone-800 hover:border-stone-700'}`}
                                        onClick={() => handleGenesisChange('pacing', pacing)}
                                    >
                                        <div className="text-sm font-medium text-stone-200 capitalize">{pacing}</div>
                                        <div className="text-[10px] text-stone-500">
                                            {pacing === 'concise' && "Fast. Action-focused."}
                                            {pacing === 'balanced' && "Standard RPG flow."}
                                            {pacing === 'descriptive' && "Rich atmosphere."}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Perspective */}
                        <div className="space-y-3">
                            <Label className="text-stone-300">Perspective</Label>
                            <div className="space-y-2">
                                <div
                                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${localConfig.perspective === 'second_person' ? 'bg-emerald-950/30 border-emerald-500/50' : 'bg-stone-950 border-stone-800 hover:border-stone-700'}`}
                                    onClick={() => handleGenesisChange('perspective', 'second_person')}
                                >
                                    <div className="text-sm font-medium text-stone-200">Second Person</div>
                                    <div className="text-[10px] text-stone-500">"You see...", "You do..." (Default)</div>
                                </div>
                                <div
                                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${localConfig.perspective === 'third_person' ? 'bg-emerald-950/30 border-emerald-500/50' : 'bg-stone-950 border-stone-800 hover:border-stone-700'}`}
                                    onClick={() => handleGenesisChange('perspective', 'third_person')}
                                >
                                    <div className="text-sm font-medium text-stone-200">Third Person</div>
                                    <div className="text-[10px] text-stone-500">"[Name] sees...", "He/She does..."</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* B. The Scene & The Cast */}
            <Card className="border-stone-800 bg-stone-900/50 backdrop-blur-sm">
                <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Clapperboard className="w-4 h-4 text-emerald-500" />
                        Opening Scene
                    </CardTitle>
                    <CardDescription>Set the stage and choose the actors.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    {/* SECTION 1: THE SET */}
                    <div className="space-y-2">
                        <Label htmlFor="set_design" className="flex items-center gap-2 text-stone-200">
                            <Sparkles className="h-3 w-3 text-amber-500" /> 1. The Set
                        </Label>
                        <Textarea
                            id="set_design"
                            placeholder="Visuals, smells, lighting, atmosphere..."
                            className="min-h-[100px] bg-stone-950 border-stone-800 resize-none focus:border-emerald-500/50 text-sm"
                            value={localConfig.set_design}
                            onChange={(e) => handleGenesisChange('set_design', e.target.value)}
                        />
                    </div>

                    {/* SECTION 2: THE HOOK */}
                    <div className="space-y-2">
                        <Label htmlFor="opening_action" className="flex items-center gap-2 text-stone-200">
                            <Mic className="h-3 w-3 text-red-500" /> 2. The Hook
                        </Label>
                        <Textarea
                            id="opening_action"
                            placeholder="The Inciting Action. What is happening RIGHT NOW?"
                            className="min-h-[80px] bg-stone-950 border-stone-800 resize-none focus:border-emerald-500/50 text-sm"
                            value={localConfig.opening_action}
                            onChange={(e) => handleGenesisChange('opening_action', e.target.value)}
                        />
                    </div>

                    <div className="border-t border-stone-800 my-6" />

                    {/* SECTION 3: THE CAST */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-blue-500" />
                            <h3 className="text-sm font-semibold text-stone-200">3. Characters in this Scene</h3>
                        </div>
                        <p className="text-xs text-stone-500 -mt-4 pl-6">
                            Select existing NPCs or create temporary extras for this specific moment.
                        </p>

                        {/* Stars (Rich Mini-Cards) */}
                        <div className="space-y-3 pl-2 border-l-2 border-stone-800/50">
                            <Label className="text-xs text-stone-400 uppercase tracking-wider font-semibold">Key NPCs (Stars)</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {availableStars.length > 0 ? (
                                    availableStars.map(star => {
                                        const isSelected = localConfig.cast_members?.includes(star.id);
                                        return (
                                            <div
                                                key={star.id}
                                                onClick={() => toggleStar(star.id)}
                                                className={`
                                                    cursor-pointer relative p-3 rounded-lg border transition-all text-left
                                                    ${isSelected
                                                        ? 'bg-purple-950/20 border-purple-500/50 shadow-[0_0_10px_-4px_rgba(168,85,247,0.5)]'
                                                        : 'bg-stone-950 border-stone-800 hover:border-stone-700 hover:bg-stone-900'}
                                                `}
                                            >
                                                <div className="font-semibold text-sm text-stone-200 truncate">{star.name}</div>
                                                <div className="text-[10px] text-stone-500 uppercase tracking-wide truncate">{star.role || 'NPC'}</div>
                                                {isSelected && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-purple-500" />}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="col-span-full text-xs text-stone-500 italic py-2">
                                        No NPCs found in roster. Add them in 'Elements' step.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Extras (Builder 2.0) */}
                        <div className="space-y-3 pl-2 border-l-2 border-stone-800/50">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs text-stone-400 uppercase tracking-wider font-semibold">Background Extras</Label>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                                    onClick={() => {
                                        const newExtra = {
                                            id: crypto.randomUUID(),
                                            name: '',
                                            visual_alias: '',
                                            archetype: '',
                                            race: '',
                                            attire: '',
                                            quirk: ''
                                        };
                                        const updatedExtras = [...localConfig.cast_extras, newExtra];
                                        handleGenesisChange('cast_extras', updatedExtras);
                                    }}
                                >
                                    <Plus className="h-3 w-3 mr-1" /> Add Extra
                                </Button>
                            </div>

                            <div className="space-y-4">
                                {localConfig.cast_extras.map((extra, index) => (
                                    <div key={extra.id} className="relative p-4 rounded-lg border border-stone-800 bg-stone-950/30 space-y-4 animate-in fade-in slide-in-from-left-2 group">
                                        {/* Row 1: Identity */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pr-8">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] text-stone-400 font-medium">First Impression <span className="text-stone-600">(Visible)</span></Label>
                                                <Input
                                                    placeholder="e.g. A Slumped Guard"
                                                    className="bg-stone-950 border-stone-800 focus:border-emerald-500/50 h-8 text-sm"
                                                    value={extra.visual_alias}
                                                    onChange={(e) => {
                                                        const updatedExtras = [...localConfig.cast_extras];
                                                        updatedExtras[index] = { ...extra, visual_alias: e.target.value };
                                                        handleGenesisChange('cast_extras', updatedExtras);
                                                    }}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] text-stone-400 font-medium">True Name <span className="text-stone-600">(Hidden)</span></Label>
                                                <Input
                                                    placeholder="Auto-generated if blank"
                                                    className="bg-stone-950 border-stone-800 focus:border-emerald-500/50 h-8 text-sm"
                                                    value={extra.name}
                                                    onChange={(e) => {
                                                        const updatedExtras = [...localConfig.cast_extras];
                                                        updatedExtras[index] = { ...extra, name: e.target.value };
                                                        handleGenesisChange('cast_extras', updatedExtras);
                                                    }}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] text-stone-400 font-medium">Role Template</Label>
                                                <Input
                                                    placeholder="e.g. Guard"
                                                    className="bg-stone-950 border-stone-800 focus:border-emerald-500/50 h-8 text-sm"
                                                    value={extra.archetype}
                                                    onChange={(e) => {
                                                        const updatedExtras = [...localConfig.cast_extras];
                                                        updatedExtras[index] = { ...extra, archetype: e.target.value };
                                                        handleGenesisChange('cast_extras', updatedExtras);
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {/* Row 2: Visual Properties */}
                                        <div className="space-y-2">
                                            <Label className="text-[10px] text-stone-500 font-semibold tracking-wider uppercase">Defining Traits (Optional - Fill to guide AI)</Label>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <Input
                                                    placeholder="Race: e.g. Orc"
                                                    className="bg-stone-950 border-stone-800 focus:border-emerald-500/50 h-8 text-xs"
                                                    value={extra.race}
                                                    onChange={(e) => {
                                                        const updatedExtras = [...localConfig.cast_extras];
                                                        updatedExtras[index] = { ...extra, race: e.target.value };
                                                        handleGenesisChange('cast_extras', updatedExtras);
                                                    }}
                                                />
                                                <Input
                                                    placeholder="Attire: e.g. Rusted Mail"
                                                    className="bg-stone-950 border-stone-800 focus:border-emerald-500/50 h-8 text-xs"
                                                    value={extra.attire}
                                                    onChange={(e) => {
                                                        const updatedExtras = [...localConfig.cast_extras];
                                                        updatedExtras[index] = { ...extra, attire: e.target.value };
                                                        handleGenesisChange('cast_extras', updatedExtras);
                                                    }}
                                                />
                                                <Input
                                                    placeholder="Quirk: e.g. Twitching"
                                                    className="bg-stone-950 border-stone-800 focus:border-emerald-500/50 h-8 text-xs"
                                                    value={extra.quirk}
                                                    onChange={(e) => {
                                                        const updatedExtras = [...localConfig.cast_extras];
                                                        updatedExtras[index] = { ...extra, quirk: e.target.value };
                                                        handleGenesisChange('cast_extras', updatedExtras);
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {/* Row 3: Live Preview */}
                                        {(extra.visual_alias || extra.race || extra.attire || extra.quirk) && (
                                            <div className="text-[11px] text-stone-500 italic bg-stone-950/50 p-2 rounded border border-stone-800/50">
                                                Preview: "You see <strong>{extra.visual_alias || 'an unknown figure'}</strong>. Closer inspection reveals a <strong>{extra.race || '<AI Generated>'}</strong> wearing <strong>{extra.attire || '<AI Generated>'}</strong> who is <strong>{extra.quirk || '<AI Generated>'}</strong>."
                                            </div>
                                        )}

                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="absolute top-2 right-2 h-6 w-6 text-stone-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => {
                                                const updatedExtras = localConfig.cast_extras.filter(x => x.id !== extra.id);
                                                handleGenesisChange('cast_extras', updatedExtras);
                                            }}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                                {localConfig.cast_extras.length === 0 && (
                                    <div className="text-center py-6 text-xs text-stone-600 italic border border-dashed border-stone-800 rounded-lg">
                                        No extras defined. Use extras to add life to the background (Guards, Patrons, Merchants).
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
