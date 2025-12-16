import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStoryDraftStore } from './stores/useStoryDraftStore';
import { updateStoryDraft } from '@/services/chimera-api';
import { WorldStone } from './steps/WorldStone';
import { ForcesStone } from './steps/ForcesStone';
import { ElementsStone } from './steps/ElementsStone';
import { LoreStone } from './steps/LoreStone';
import { BindStone } from './steps/BindStone';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function CastingCircleWizard() {
    const { id, step } = useParams<{ id: string; step?: string }>();
    const navigate = useNavigate();
    const [isFinalizing, setIsFinalizing] = useState(false);

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
    const draft = useStoryDraftStore((state) => state.draft);

    const handleFinalize = async () => {
        if (!draft || !draft.id) return;

        setIsFinalizing(true);
        try {
            // Extract primary image URL if available
            let primaryImageUrl = draft.primary_image_url;

            if (draft.images && draft.images.length > 0) {
                const firstImage = draft.images[0];
                // Check if it's an AssetRef (has url property)
                if ('url' in firstImage) {
                    primaryImageUrl = firstImage.url;
                }
                // Note: File objects are skipped for now as we require Asset Upload service integration
            }

            await updateStoryDraft(draft.id, {
                title: draft.title,
                description: draft.description,
                image_url: primaryImageUrl,
                status: 'bound'
            });

            toast.success("Story successfully bound. Ready for compilation.");
            navigate(`/dashboard/creations?tab=stories`);

        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Failed to bind fate.");
        } finally {
            setIsFinalizing(false);
        }
    };

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

    const coverImage = draft?.primary_image_url || ((draft?.images && draft.images.length > 0 && 'url' in draft.images[0]) ? (draft.images[0] as any).url : null);

    return (
        <div className="container mx-auto py-8 px-4 h-full flex flex-col">
            <div className="mb-8 relative rounded-xl overflow-hidden border border-stone-800 bg-stone-900/50">
                {coverImage && (
                    <div className="absolute inset-0 z-0">
                        <img src={coverImage} alt="Story Cover" className="w-full h-full object-cover opacity-30 mask-image-gradient-b" />
                        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 to-transparent" />
                    </div>
                )}

                <div className="relative z-10 p-8">
                    <h1 className="text-3xl font-bold tracking-tight drop-shadow-md text-stone-100">
                        {draft?.title || "Casting Circle"}
                    </h1>
                    <p className="text-stone-400 drop-shadow-sm mt-2 max-w-2xl">
                        {draft?.description || "Weave your story from the threads of the Chimera."}
                    </p>
                </div>
            </div>

            <Tabs value={activeStep} onValueChange={handleTabChange} className="flex-1 flex flex-col">
                <TabsList className="grid w-full grid-cols-5 mb-8">
                    <TabsTrigger value="world">World</TabsTrigger>
                    <TabsTrigger value="forces" disabled={!draft?.world_id}>Forces</TabsTrigger>
                    <TabsTrigger value="elements" disabled={!draft?.world_id}>Elements</TabsTrigger>
                    <TabsTrigger value="lore" disabled={!draft?.world_id}>Lore</TabsTrigger>
                    <TabsTrigger value="bind" disabled={!draft?.title || draft.title.length === 0}>Bind</TabsTrigger>
                </TabsList>

                <div className="flex-1 min-h-0 bg-card rounded-xl border p-6 overflow-y-auto">
                    <TabsContent value="world" className="mt-0 h-full">
                        <WorldStone />
                    </TabsContent>
                    <TabsContent value="forces" className="mt-0 h-full">
                        <ForcesStone />
                    </TabsContent>
                    <TabsContent value="elements" className="mt-0 h-full">
                        <ElementsStone />
                    </TabsContent>
                    <TabsContent value="lore" className="mt-0 h-full">
                        <LoreStone />
                    </TabsContent>
                    <TabsContent value="bind" className="mt-0 h-full">
                        <BindStone />
                    </TabsContent>
                </div>
            </Tabs>

            {/* Sticky Footer */}
            <div className="fixed bottom-0 left-0 right-0 p-4 border-t bg-stone-950/80 backdrop-blur-md flex justify-between items-center z-50 animate-in slide-in-from-bottom-5">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        onClick={() => {
                            const steps = ['world', 'forces', 'elements', 'lore', 'bind'];
                            const currentIndex = steps.indexOf(activeStep);
                            if (currentIndex > 0) handleTabChange(steps[currentIndex - 1]);
                        }}
                        disabled={activeStep === 'world' || isFinalizing}
                        className="border-stone-700 hover:bg-stone-900"
                    >
                        Back
                    </Button>
                </div>

                <div className="flex gap-2">
                    <Button variant="ghost" className="text-stone-500 hover:text-stone-300" disabled={isFinalizing}>Save Draft</Button> {/* Auto-save handles most, manual save for peace of mind */}

                    {(() => {
                        const steps = ['world', 'forces', 'elements', 'lore', 'bind'];
                        const currentIndex = steps.indexOf(activeStep);
                        const isLastStep = currentIndex === steps.length - 1;
                        const nextStep = steps[currentIndex + 1];

                        // Validation Logic
                        let canProceed = false;

                        if (activeStep === 'world') {
                            canProceed = !!draft?.world_id;
                        } else if (activeStep === 'forces') {
                            canProceed = true;
                        } else if (activeStep === 'elements') {
                            canProceed = true;
                        } else if (activeStep === 'lore') {
                            canProceed = true;
                        } else if (activeStep === 'bind') {
                            canProceed = !!draft?.title && draft.title.length > 0;
                        } else {
                            canProceed = true;
                        }

                        return (
                            <Button
                                onClick={() => {
                                    if (isLastStep) {
                                        handleFinalize();
                                    } else {
                                        handleTabChange(nextStep);
                                    }
                                }}
                                disabled={!canProceed || isFinalizing}
                                className={cn(
                                    "gap-2 min-w-[120px] transition-all",
                                    isLastStep ? "bg-amber-600 hover:bg-amber-700 hover:shadow-[0_0_15px_rgba(245,158,11,0.5)] border-amber-500/50" : ""
                                )}
                            >
                                {isFinalizing ? <Loader2 className="w-4 h-4 animate-spin" /> :
                                    isLastStep ? "Bind Fate" : <span className="flex items-center">Next: {nextStep.charAt(0).toUpperCase() + nextStep.slice(1)} <ArrowRight className="ml-2 h-4 w-4" /></span>}
                            </Button>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}
