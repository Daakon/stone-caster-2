
import { useStoryDraftStore } from '../stores/useStoryDraftStore';
import { LoreManager } from '@/features/dashboard/components/editors/config/LoreManager';
import { BookOpen, Info } from 'lucide-react';

export function LoreStone() {
    const { draft } = useStoryDraftStore();

    if (!draft) return null;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20 h-full flex flex-col">
            {/* Header Section */}
            <div className="shrink-0">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <BookOpen className="w-6 h-6 text-indigo-400" />
                    Story Lore & Secrets
                </h2>
                <p className="text-muted-foreground mt-1">
                    Define specific context, plot hooks, and secrets for this adventure.
                    <br />
                    <span className="text-xs opacity-70">This lore is visible only to the AI Narrator for this story instance.</span>
                </p>
            </div>

            {/* Lore Manager */}
            <div className="flex-1 bg-card border rounded-xl overflow-hidden p-6 shadow-sm">
                <LoreManager
                    worldId={draft.world_id}
                    context={{ type: 'story', id: draft.id }}
                    contextType="story"
                />
            </div>
        </div>
    );
}
