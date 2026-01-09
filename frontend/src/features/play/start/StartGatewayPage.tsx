
import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCompiledStory, getMyCharacters } from '@/api/chimera-client';
import { CharacterSelector } from './components/CharacterSelector';
import { LEGACY_PREMADES, mapPremadeToTemplate } from './data/premades';
import CharacterCreatorWizard from '../create/CharacterCreatorWizard';
import { mergeCharacterSchema } from './utils/schemaMerger';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { apiPost } from '@/lib/api';
import { SchemaDebug } from '@/components/debug/SchemaDebug';
import type { RulesetDefinition } from '@shared/types/chimera-authoring';

// DEBUG FLAGS
const DEBUG_SCHEMA_ENGINE = false;

type ViewMode = 'SELECTION' | 'CREATION';
type Tab = 'MY_CHARACTERS' | 'PREMADES';

export default function StartGatewayPage() {
    const { storyId } = useParams<{ storyId: string }>();
    const navigate = useNavigate();

    const [viewMode, setViewMode] = useState<ViewMode>('SELECTION');
    const [selectedTab, setSelectedTab] = useState<Tab>('MY_CHARACTERS');

    // 1. Fetch Compiled Story - MUST be called before any conditional returns
    const { data: storyData, isLoading: storyLoading, error: storyError } = useQuery({
        queryKey: ['chimera-story', storyId],
        queryFn: () => getCompiledStory(storyId!) as Promise<any>,
        enabled: !!storyId
    });

    const story = storyData?.data;

    // 2. Fetch User Characters - MUST be called before any conditional returns
    // Extract worldId safely (may be undefined initially)
    const worldId = story?.snapshot_world?.id;

    const { data: charactersData, isLoading: charsLoading } = useQuery({
        queryKey: ['my-characters', worldId],
        queryFn: () => getMyCharacters(worldId) as Promise<any>,
        enabled: !!story
    });

    const characters = charactersData?.data || [];

    // Merge Schema - MUST be called before any conditional returns
    const mergedSchema = useMemo(() => {
        if (!story) return null;
        return mergeCharacterSchema(story);
    }, [story]);

    const handleSelectCharacter = async (char: any) => {
        // Start game with existing character
        try {
            toast.info("Starting session...");
            const res = await apiPost<{ id: string }>('/api/chimera/game/init', {
                storyId,
                characterId: char.id,
                // Adding dummy playerInput to satisfy backend Zod schema
                playerInput: {
                    identity: { name: char.name },
                    input_type: 'system_start',
                    content: 'Initialize Narrative'
                }
            });

            if (res.ok) {
                navigate(`/play/${res.data.id}`);
            } else {
                toast.error("Failed to start session", { description: res.error.message });
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to start session");
        }
    };

    const handleSelectPremade = (premade: any) => {
        // Hydrate Wizard with premade template
        // For now, we might just jump to Creation Mode WITH pre-filled data?
        // Or if Quick Start, we create immediately?
        // Prompt says "Quick Start: Grid of Premades".
        // Let's assume Quick Start means instant creation or Pre-filled Wizard.
        // I'll go to Creation Mode and pass the template.
        // But for this MVP step, I'll just Auto-Create to show "Quick Start" speed.

        const template = mapPremadeToTemplate(premade);
        // Start Auto-Creation
        // Actually, let's just use the Wizard but pre-fill it.
        // But Wizard refactor in Step 4 doesn't mention pre-fill props yet.
        // Let's just log for now and maybe switch to creation.
        // TODO: Pass premade template to V2 Forge via state or query param
        toast.info(`Selected ${premade.name} - Opening Forge...`);
        navigate(`/play/create/${storyId}`);
    };

    if (storyLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Loading Story Gateway...</span>
            </div>
        );
    }

    if (storyError || !story) {
        const is404 = (storyError as any)?.status === 404 || (storyError as any)?.response?.status === 404;
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4">
                <AlertTriangle className="h-8 w-8 text-destructive" />
                <h1 className="text-xl font-bold">Failed to load story</h1>
                <p className="text-muted-foreground max-w-md text-center">
                    {is404 ? "This story hasn't been compiled yet. Go to the Story Editor and click 'Compile' to make it playable." : "An unexpected error occurred."}
                </p>
                <div className="flex gap-2">
                    <Button onClick={() => navigate('/stories')}>Back to Stories</Button>
                    {is404 && (
                        <Button variant="outline" onClick={() => navigate(`/stories/${storyId}`)}>
                            Go to Editor
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    if (DEBUG_SCHEMA_ENGINE && story) {
        // Validation: Ensure we are passing correct types.
        // story.snapshot_world should map to WorldDefinition
        // story.config_engine.active_rulesets should map to RulesetDefinition[] if available
        const world = story.snapshot_world as any;
        const rulesets = (story.config_engine?.active_rulesets || []) as RulesetDefinition[];

        return <SchemaDebug world={world} rulesets={rulesets} />;
    }

    if (viewMode === 'CREATION' && mergedSchema) {
        return (
            <CharacterCreatorWizard
                storyId={storyId!}
                mergedSchema={mergedSchema}
                activeRulesets={story.config_engine?.active_rulesets || []}
                onCancel={() => setViewMode('SELECTION')}
            />
        );
    }

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-5xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => navigate('/stories')}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{story.display_name}</h1>
                        <p className="text-muted-foreground">
                            {story.world?.display_name ? `Adventures in ${story.world.display_name}` : 'Ready to begin?'}
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as Tab)} className="w-full">
                    <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
                        <TabsTrigger value="MY_CHARACTERS">My Library</TabsTrigger>
                        <TabsTrigger value="PREMADES">Quick Start</TabsTrigger>
                    </TabsList>

                    <TabsContent value="MY_CHARACTERS" className="mt-0">
                        <CharacterSelector
                            characters={characters}
                            premades={[]}
                            selectedTab="MY_CHARACTERS"
                            onSelectCharacter={handleSelectCharacter}
                            onSelectPremade={() => { }}
                            onCreateNew={() => navigate(`/play/create/${storyId}`)}
                        />
                    </TabsContent>

                    <TabsContent value="PREMADES" className="mt-0">
                        <CharacterSelector
                            characters={[]}
                            premades={LEGACY_PREMADES}
                            selectedTab="PREMADES"
                            onSelectCharacter={() => { }}
                            onSelectPremade={handleSelectPremade}
                            onCreateNew={() => navigate(`/play/create/${storyId}`)}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
