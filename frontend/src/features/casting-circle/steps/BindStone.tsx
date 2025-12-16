import { useState, useEffect } from 'react';
import { useStoryDraftStore } from '../stores/useStoryDraftStore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ImageUploader } from '@/components/forms/shared/ImageUploader';
import { type PendingImage } from '@/components/forms/shared/ImageUploader';
import { BookMarked, Sparkles } from 'lucide-react';
import type { ChimeraAssetRef } from '@/types/chimera-v2';

export function BindStone() {
    const { draft, setDraftData } = useStoryDraftStore();

    // Local state for image upload (PendingImage[] is flexible)
    // We map draft.images to initial value
    const [images, setImages] = useState<PendingImage[]>([]);

    useEffect(() => {
        if (draft && draft.images) {
            // Filter out any potential non-matching types if needed, or cast
            setImages(draft.images as PendingImage[]);
        }
    }, [draft?.images]);

    const handleImagesChange = (newImages: PendingImage[]) => {
        setImages(newImages);
        // We update the draft store immediately with the files/refs
        // The persistence logic (uploading files) will happen on "Bind Fate" (Wizard save)
        setDraftData({ images: newImages as any }); // Cast compatible for draft store which might expect simplified structure
    };

    if (!draft) return null;

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20 max-w-3xl mx-auto">
            {/* Header */}
            <div className="text-center space-y-2 mb-8">
                <div className="inline-flex items-center justify-center p-3 rounded-full bg-amber-500/10 mb-2">
                    <Sparkles className="w-6 h-6 text-amber-500" />
                </div>
                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 to-amber-500">
                    Bind Your Fate
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                    Give your adventure a name and a face before weaving it into reality.
                </p>
            </div>

            <div className="bg-card border rounded-xl p-8 shadow-md space-y-6">

                {/* Title */}
                <div className="space-y-2">
                    <Label htmlFor="title" className="text-lg">Story Title</Label>
                    <Input
                        id="title"
                        value={draft.title || ''}
                        onChange={(e) => setDraftData({ title: e.target.value })}
                        placeholder="e.g. The Shadow Over Stone Caster"
                        className="text-xl h-12 bg-stone-950/50 border-stone-800 focus:border-amber-500/50"
                        maxLength={100}
                    />
                </div>

                {/* Description */}
                <div className="space-y-2">
                    <Label htmlFor="description">Short Description (Optional)</Label>
                    <Textarea
                        id="description"
                        value={draft.description || ''}
                        onChange={(e) => setDraftData({ description: e.target.value })}
                        placeholder="A brief summary of the adventure..."
                        className="min-h-[100px] bg-stone-950/50 border-stone-800 focus:border-amber-500/50 resize-none"
                        maxLength={500}
                    />
                </div>

                {/* Cover Image */}
                <div className="space-y-2">
                    <Label>Cover Image</Label>
                    <ImageUploader
                        value={images}
                        onChange={handleImagesChange}
                        label="Upload a cover image or select from your assets"
                        maxSizeMB={5}
                        preferredCategory="art"
                        className="bg-stone-950/30 p-4 rounded-lg border border-stone-800/50"
                    />
                    <p className="text-xs text-muted-foreground ml-1">
                        The first image will be used as the story cover.
                    </p>
                </div>
            </div>
        </div>
    );
}
