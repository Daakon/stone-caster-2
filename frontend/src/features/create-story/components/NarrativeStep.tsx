import React from 'react';
import { useStoryDraftStore } from '../store/useStoryDraftStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clapperboard, Text, Users, Sparkles } from 'lucide-react';

export function NarrativeStep() {
    const draft = useStoryDraftStore((state) => state.draft);
    const setGenesisConfig = useStoryDraftStore((state) => state.setGenesisConfig);

    if (!draft) return null;

    const { genesis_config } = draft;

    const handleGenesisChange = (field: keyof NonNullable<typeof draft.genesis_config>, value: any) => {
        setGenesisConfig({ [field]: value });
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8 pb-20">
            <div>
                <h2 className="text-2xl font-bold mb-2">The Director's Slate</h2>
                <p className="text-muted-foreground">
                    Define the opening scene and narrative style. This tells the AI how to begin the story.
                </p>
            </div>

            <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-4">
                    <CardTitle className="text-base">Opening Scene</CardTitle>
                    <CardDescription>Direct the initial moment of the story</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">

                    {/* Narrative Style */}
                    <div className="space-y-2">
                        <Label htmlFor="narrative_style">Narrative Style</Label>
                        <Select
                            value={genesis_config?.narrative_style || ''}
                            onValueChange={(value) => handleGenesisChange('narrative_style', value)}
                        >
                            <SelectTrigger id="narrative_style" className="bg-background">
                                <SelectValue placeholder="Select a tone..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Standard">Standard Adventure</SelectItem>
                                <SelectItem value="Gritty">Gritty Realism</SelectItem>
                                <SelectItem value="High Fantasy">High Fantasy</SelectItem>
                                <SelectItem value="Dark Horror">Dark Horror</SelectItem>
                                <SelectItem value="Cyberpunk">Cyberpunk / Sci-Fi</SelectItem>
                                <SelectItem value="Humorous">Humorous / Lighthearted</SelectItem>
                                <SelectItem value="Mystery">Noir / Mystery</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Setting */}
                    <div className="space-y-2">
                        <Label htmlFor="set_design" className="flex items-center gap-2">
                            <Sparkles className="h-3 w-3" /> The Set
                        </Label>
                        <Textarea
                            id="set_design"
                            placeholder="Visuals, smells, lighting, atmosphere..."
                            className="min-h-[100px] bg-background resize-none"
                            value={genesis_config?.set_design || ''}
                            onChange={(e) => handleGenesisChange('set_design', e.target.value)}
                        />
                    </div>

                    {/* Cast */}
                    <div className="space-y-2">
                        <Label htmlFor="initial_cast" className="flex items-center gap-2">
                            <Users className="h-3 w-3" /> The Cast
                        </Label>
                        <Textarea
                            id="initial_cast"
                            placeholder="Who is here? List NPCs, allies, or antagonists present in this scene."
                            className="min-h-[80px] bg-background resize-none"
                            value={genesis_config?.initial_cast || ''}
                            onChange={(e) => handleGenesisChange('initial_cast', e.target.value)}
                        />
                        <p className="text-[10px] text-muted-foreground">Names and brief roles of characters starting in the scene.</p>
                    </div>

                    {/* Hook */}
                    <div className="space-y-2">
                        <Label htmlFor="opening_action" className="flex items-center gap-2">
                            <Text className="h-3 w-3" /> The Hook
                        </Label>
                        <Textarea
                            id="opening_action"
                            placeholder="The Inciting Action. What is happening RIGHT NOW?"
                            className="min-h-[100px] bg-background resize-none"
                            value={genesis_config?.opening_action || ''}
                            onChange={(e) => handleGenesisChange('opening_action', e.target.value)}
                        />
                    </div>

                </CardContent>
            </Card>
        </div>
    );
}
