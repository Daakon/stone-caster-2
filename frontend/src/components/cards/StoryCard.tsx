import React from 'react';
import { Play, Trash2 } from 'lucide-react';
import { CardBase } from '@/components/ui/card-base';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
// Note: CompiledStory type might differ, checking usage context. 
// For now using partial shape or generic props.

interface StoryCardProps {
    title: string;
    worldName?: string;
    lastPlayed?: string | Date;
    coverImage?: string;
    onClick: () => void;
    onDelete?: () => void;
}

export function StoryCard({ title, worldName, lastPlayed, coverImage, onClick, onDelete }: StoryCardProps) {
    return (
        <CardBase
            onClick={onClick}
            className="flex flex-col h-[280px] p-0 group overflow-hidden border-stone-800 bg-stone-900"
        >
            {/* Cover Image Area */}
            <div className="h-[160px] w-full bg-stone-800 relative overflow-hidden">
                {coverImage ? (
                    <img src={coverImage} alt={title} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-stone-800 via-stone-900 to-black" />
                )}

                {/* Play Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
                    <div className="h-12 w-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-md shadow-xl">
                        <Play className="h-5 w-5 text-white ml-1" />
                    </div>
                </div>

                {/* World Label Badge */}
                {worldName && (
                    <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/60 backdrop-blur-sm border border-white/10 text-[10px] uppercase tracking-wider font-semibold text-stone-300">
                        {worldName}
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4 flex flex-col flex-grow relative">
                <h3 className="font-bold text-lg text-white line-clamp-1 mb-1">{title}</h3>

                <div className="mt-auto flex items-end justify-between">
                    <span className="text-xs text-stone-500">
                        {lastPlayed ? `Last played ${new Date(lastPlayed).toLocaleDateString()}` : 'New Story'}
                    </span>

                    {onDelete && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 -mr-2 text-stone-600 hover:text-red-400 hover:bg-red-950/20"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
        </CardBase>
    );
}
