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
}

export function StoryCard({ data, onClick }: StoryCardProps) {
    // Stories in V2 might not have images directly on the root object effectively, 
    // often deriving context from the world. We'll use a gradient fallback for now.
    const backgroundStyle = { background: getDeterministicGradient(data.world_id || data.id) };

    return (
        <Card
            className="group overflow-hidden border-stone-800 bg-stone-900 cursor-pointer hover:border-stone-600 transition-all flex flex-col"
            onClick={onClick}
        >
            <div className="h-32 relative w-full" style={backgroundStyle}>
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />

                <div className="absolute bottom-3 left-3 right-3 text-white">
                    <h3 className="font-bold text-lg leading-tight line-clamp-2 drop-shadow-md">{data.display_name}</h3>
                    {data.world_display_name && (
                        <p className="text-xs text-stone-200 mt-1 drop-shadow-md">Based on {data.world_display_name}</p>
                    )}
                </div>

                <div className="absolute top-3 right-3">
                    <Badge variant={data.status === 'published' ? 'default' : 'secondary'} className="text-[10px] uppercase shadow-sm">
                        {data.status || 'Draft'}
                    </Badge>
                </div>
            </div>

            <CardContent className="p-4 flex flex-col gap-3">
                {/* Fake Progress Bar Stub */}
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-stone-500">
                        <span>Progress</span>
                        <span>{data.status === 'published' ? '100%' : '30%'}</span>
                    </div>
                    <div className="h-1.5 w-full bg-stone-800 rounded-full overflow-hidden">
                        <div
                            className={cn("h-full bg-primary rounded-full", data.status === 'published' ? 'w-full' : 'w-[30%]')}
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
