import { MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import type { ChimeraEntityV2 } from '@/types/chimera-v2';
import { getPrimaryImageUrl } from '@/types/chimera-v2';
import { getDeterministicGradient } from '@/utils/visuals';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface EntityCardProps {
    data: ChimeraEntityV2;
    onEdit?: () => void;
}

export function EntityCard({ data, onEdit }: EntityCardProps) {
    const imageUrl = getPrimaryImageUrl(data.images);
    const backgroundStyle = imageUrl
        ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
        : { background: getDeterministicGradient(data.id) };

    return (
        <Card
            className="group overflow-hidden border-stone-800 bg-stone-900 transition-all hover:border-stone-600 flex flex-row h-32"
        >
            {/* Visual - Square Aspect Ratio on Left */}
            <div className="w-32 h-32 shrink-0 relative" style={backgroundStyle}>
                {!imageUrl && (
                    <div className="absolute inset-0 flex items-center justify-center text-white/20 text-2xl font-bold uppercase">
                        {(data.display_name || '?').slice(0, 2)}
                    </div>
                )}
            </div>

            {/* Content */}
            <CardContent className="p-4 flex flex-col justify-between w-full">
                <div>
                    <div className="flex justify-between items-start">
                        <h3
                            className="font-bold text-white line-clamp-1 cursor-pointer hover:underline"
                            onClick={onEdit}
                        >
                            {data.display_name}
                        </h3>
                    </div>
                    <div className="mt-1">
                        <Badge variant="outline" className="text-[10px] border-stone-700 text-stone-400 capitalize">
                            {data.entity_type}
                        </Badge>
                    </div>
                </div>

                <div className="flex justify-between items-end">
                    <div className="flex gap-2 items-center">
                        {data.archetype_handle && (
                            <span className="text-xs text-stone-500 font-mono">{data.archetype_handle}</span>
                        )}
                        <Badge variant={data.status === 'ready' ? 'default' : 'secondary'} className="text-[10px] uppercase">
                            {data.status || 'Draft'}
                        </Badge>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-stone-400 hover:text-white -mr-2">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-stone-900 border-stone-800">
                            <DropdownMenuItem onClick={onEdit} className="text-stone-300 focus:bg-stone-800 focus:text-white cursor-pointer">
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-500 focus:bg-stone-800 focus:text-red-400 cursor-pointer">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardContent>
        </Card>
    );
}
