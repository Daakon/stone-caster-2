import React from 'react';
// Force refresh
import type { ChimeraStoryV2 } from '@/types/chimera-v2';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlayCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getDeterministicGradient } from '@/utils/visuals';

interface StoryCardProps {
    data: ChimeraStoryV2;
    onClick?: () => void;
    onEdit?: () => void;
}

export function StoryCard({ data, onClick, onEdit }: StoryCardProps) {
    // Priority: Explicit primary_image_url > First image in images array > Gradient Fallback
    const imageUrl = data.primary_image_url || (data.images && data.images.length > 0 ? data.images[0].url : null);

    // Background style: Image if available, otherwise deterministic gradient
    const backgroundStyle = imageUrl
        ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
        : { background: getDeterministicGradient(data.world_id || data.id) };

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        onEdit?.();
    };

    return (
        <Card
            className="group overflow-hidden border-stone-800 bg-stone-900 cursor-pointer hover:border-stone-600 transition-all flex flex-col h-full"
            onClick={onClick}
        >
            <div className="h-32 relative w-full shrink-0" style={backgroundStyle}>
                <div className={cn("absolute inset-0 transition-colors", imageUrl ? "bg-black/40 group-hover:bg-black/30" : "bg-black/20 group-hover:bg-black/40")} />

                <div className="absolute bottom-3 left-3 right-3 text-white z-10">
                    <h3 className="font-bold text-lg leading-tight line-clamp-2 drop-shadow-md">{data.display_name}</h3>
                    {data.world_display_name && (
                        <p className="text-xs text-stone-200 mt-1 drop-shadow-md opacity-90">Based on {data.world_display_name}</p>
                    )}
                </div>

                <div className="absolute top-3 right-3 flex gap-2 z-20">
                    {onEdit && data.status !== 'compiled' && (
                        <button
                            onClick={handleEdit}
                            className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-stone-300 hover:text-white transition-colors opacity-0 group-hover:opacity-100 backdrop-blur-sm"
                            title="Edit Story"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                        </button>
                    )}
                    <Badge variant={data.status === 'published' ? 'default' : 'secondary'} className="text-[10px] uppercase shadow-sm">
                        {data.status || 'Draft'}
                    </Badge>
                </div>
            </div>

            <CardContent className="p-4 flex flex-col gap-3 flex-1">
                {/* Progress Bar (Mock for now, can be real later) */}
                <div className="space-y-1 mt-auto">
                    <div className="flex justify-between text-xs text-stone-500">
                        <span>Progress</span>
                        <span>{data.status === 'compiled' ? '100%' : 'Drafting'}</span>
                    </div>
                    <div className="h-1.5 w-full bg-stone-800 rounded-full overflow-hidden">
                        <div
                            className={cn("h-full bg-primary rounded-full", data.status === 'compiled' ? 'w-full' : 'w-[40%]')}
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between text-xs text-stone-500 pt-2 border-t border-stone-800">
                    <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(data.updated_at).toLocaleDateString()}</span>
                    </div>
                    <PlayCircle className="w-4 h-4 text-stone-400 group-hover:text-primary transition-colors" />
                </div>
            </CardContent>
        </Card>
    );
}
