import { MoreHorizontal, Edit, Trash2, Clock } from 'lucide-react';
import type { ChimeraWorldV2 } from '@/types/chimera-v2';
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

interface WorldCardProps {
    data: ChimeraWorldV2;
    onEdit?: () => void;
}

export function WorldCard({ data, onEdit }: WorldCardProps) {
    const imageUrl = getPrimaryImageUrl(data.images);
    const backgroundStyle = imageUrl
        ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
        : { background: getDeterministicGradient(data.id) };

    return (
        <Card
            className="group overflow-hidden border-stone-800 bg-stone-900 transition-all hover:border-stone-600 flex flex-col h-full"
        >
            <div className="aspect-video relative w-full shrink-0" style={backgroundStyle}>
                {!imageUrl && (
                    <div className="absolute inset-0 flex items-center justify-center text-white/20 text-4xl font-bold uppercase tracking-widest">
                        {data.display_name.slice(0, 2)}
                    </div>
                )}
            </div>

            <CardContent className="p-4 flex flex-col grow justify-between">
                <div>
                    <div className="flex justify-between items-start mb-2">
                        <h3
                            className="font-bold text-lg text-white line-clamp-1 cursor-pointer hover:underline"
                            onClick={onEdit}
                        >
                            {data.display_name}
                        </h3>
                    </div>

                    <div className="flex items-center justify-between text-stone-500 text-xs mt-2">
                        <div className="flex items-center gap-2">
                            <Badge variant={data.status === 'published' ? 'default' : 'secondary'} className="uppercase text-[10px]">
                                {data.status}
                            </Badge>
                            <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{new Date(data.updated_at).toLocaleDateString()}</span>
                            </div>
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-400 hover:text-white -mr-2">
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
                </div>
            </CardContent>
        </Card>
    );
}
