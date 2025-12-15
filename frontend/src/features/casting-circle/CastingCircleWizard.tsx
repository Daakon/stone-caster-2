import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStoryDraftStore } from './stores/useStoryDraftStore';
import { WorldStone } from './steps/WorldStone';
import { ForcesStone } from './steps/ForcesStone';
import { toast } from 'sonner';

export function CastingCircleWizard() {
    const { id, step } = useParams<{ id: string; step?: string }>();
    const navigate = useNavigate();

    // Default to 'world' if no step provided
    const activeStep = step || 'world';

    const handleTabChange = (value: string) => {
        if (id) {
            navigate(`/stories/${id}/compose/${value}`);
        }
    };

    const initializeDraft = useStoryDraftStore((state) => state.initializeDraft);
    const hydrateDraft = useStoryDraftStore((state) => state.hydrateDraft);
    const isLoading = useStoryDraftStore((state) => state.isLoading);
    const error = useStoryDraftStore((state) => state.error);
    const storyId = useStoryDraftStore((state) => state.storyId);

    // Initial load logic
    useEffect(() => {
        const load = async () => {
            if (id) {
                // ID in URL: Fetch existing draft
                try {
                    await hydrateDraft(id);
                } catch (err) {
                    toast.error('Failed to load story draft');
                    navigate('/dashboard/creations'); // Fallback
                }
            } else {
                // No ID: Create new draft
                try {
                    const newId = await initializeDraft();
                    // Replace URL without reloading
                    navigate(`/stories/${newId}/compose/world`, { replace: true });
                } catch (err) {
                    toast.error('Failed to start new story');
                }
            }
        };

        // Only run if storyId doesn't match URL ID (or if strictly mounting)
        // To prevent loops, we check strict conditions
        if (id && storyId !== id) {
            load();
        } else if (!id && !storyId) {
            load();
        }
    }, [id, storyId, initializeDraft, hydrateDraft, navigate]);

    if (isLoading && !storyId) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <p className="text-destructive font-medium">{error}</p>
                <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 px-4 h-full flex flex-col">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Casting Circle</h1>
                <p className="text-muted-foreground">Weave your story from the threads of the Chimera.</p>
            </div>

            <Tabs value={activeStep} onValueChange={handleTabChange} className="flex-1 flex flex-col">
                <TabsList className="grid w-full grid-cols-5 mb-8">
                    <TabsTrigger value="world">World</TabsTrigger>
                    <TabsTrigger value="forces" disabled={!useStoryDraftStore.getState().draft?.world_id}>Forces</TabsTrigger>
                    <TabsTrigger value="elements" disabled>Elements</TabsTrigger>
                    <TabsTrigger value="lore" disabled>Lore</TabsTrigger>
                    <TabsTrigger value="bind" disabled>Bind</TabsTrigger>
                </TabsList>

                <div className="flex-1 min-h-0 bg-card rounded-xl border p-6 overflow-y-auto">
                    <TabsContent value="world" className="mt-0 h-full">
                        <WorldStone />
                    </TabsContent>
                    <TabsContent value="forces" className="mt-0 h-full">
                        <ForcesStone />
                    </TabsContent>
                    <TabsContent value="elements">Elements Content</TabsContent>
                    <TabsContent value="lore">Lore Content</TabsContent>
                    <TabsContent value="bind">Bind Content</TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
