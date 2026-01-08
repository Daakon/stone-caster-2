import { useState } from 'react';
import { Users, X, Swords, Crown, Ghost } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet';

interface BaseEntity {
    id: string;
    type?: string;
    name: string;
    description?: string;
    [key: string]: any;
}

interface CastTrayProps {
    entities: Record<string, BaseEntity>;
    currentUserId?: string; // To filter out player
}

const getEntityIcon = (entity: BaseEntity) => {
    // Simple heuristic for icon
    const type = (entity.type || '').toLowerCase();
    if (type.includes('boss') || type.includes('villain')) return <Crown className="w-4 h-4 text-yellow-500" />;
    if (type.includes('enemy') || type.includes('monster')) return <Swords className="w-4 h-4 text-red-500" />;
    if (type.includes('npc') || type.includes('ally')) return <Users className="w-4 h-4 text-blue-400" />;
    return <Ghost className="w-4 h-4 text-muted-foreground" />;
};

export function CastTray({ entities, currentUserId }: CastTrayProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    // 1. Filter Entities
    // Convert object to array and filter out player
    const castList = Object.values(entities || {}).filter(e => {
        // If currentUserId is provided, filter exactly match
        if (currentUserId && e.id === currentUserId) return false;
        // Fallback heuristic: check if type is 'player'
        if ((e.type || '').toLowerCase() === 'player') return false;
        return true;
    });

    if (castList.length === 0) return null;

    // Desktop: Sliding Panel logic is custom or handled by layout. 
    // Requirement says: "Slide-in panel from Right (Desktop) or Bottom Sheet (Mobile)."
    // Let's implement the internal logic here.

    const renderCastList = () => (
        <div className="space-y-3 p-1">
            {castList.map(entity => (
                <div key={entity.id} className="group flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/10">
                    {/* Avatar / Icon Placeholder */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 font-bold text-xs">
                        {(entity.name || '?')[0]}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                                {entity.name}
                                {(entity.properties?.archetype || entity.archetype) &&
                                    <span className="text-xs text-muted-foreground ml-1 font-normal">
                                        - {entity.properties?.archetype || entity.archetype}
                                    </span>
                                }
                            </span>
                            {getEntityIcon(entity)}
                        </div>
                        {entity.description && (
                            <p className="text-[10px] text-muted-foreground truncate opacity-70 group-hover:opacity-100 transition-opacity">
                                {entity.description}
                            </p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <>
            {/* Desktop: Fixed Right Sidebar Toggle & Panel */}
            <div className="hidden md:block">
                {/* Collapsed State (Always visible trigger) */}
                <div
                    className={cn(
                        "transition-all duration-300 pointer-events-auto",
                        isExpanded ? "opacity-0 pointer-events-none" : "opacity-100"
                    )}
                >
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-10 w-10 rounded-full border-border/40 bg-background/50 backdrop-blur hover:bg-background/80 shadow-sm"
                                    onClick={() => setIsExpanded(true)}
                                >
                                    <Users className="h-5 w-5 text-muted-foreground" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                                <p>Cast ({castList.length})</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {/* Quick Avatar Stack (Max 3) */}
                    <div className="mt-2 flex flex-col -space-y-2 items-center pointer-events-none">
                        {castList.slice(0, 3).map((e, i) => (
                            <div
                                key={e.id}
                                className="w-8 h-8 rounded-full ring-2 ring-black bg-slate-800 flex items-center justify-center text-[10px] font-bold z-[3-i]"
                            >
                                {(e.name || '?')[0]}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Expanded State (Slide-in Panel) */}
                <div
                    className={cn(
                        "fixed top-0 right-0 bottom-0 w-80 bg-background/90 backdrop-blur-md border-l border-white/10 shadow-2xl z-50 transition-transform duration-500 ease-in-out transform flex flex-col pointer-events-auto",
                        isExpanded ? "translate-x-0" : "translate-x-full"
                    )}
                >
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                        <h2 className="font-serif font-bold tracking-wide">Nearby Cast</h2>
                        <Button variant="ghost" size="icon" onClick={() => setIsExpanded(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    <ScrollArea className="flex-1 p-4">
                        {renderCastList()}
                    </ScrollArea>
                </div>
            </div>

            {/* Mobile: Floating Action Button -> Drawer */}
            <div className="md:hidden pointer-events-auto">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-12 w-12 rounded-full border-border/40 bg-background/50 backdrop-blur shadow-lg"
                        >
                            <Users className="h-6 w-6" />
                            {castList.length > 0 && (
                                <span className="absolute top-0 right-0 h-3 w-3 bg-primary rounded-full border-2 border-background" />
                            )}
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-[80vh] rounded-t-xl bg-background/95 backdrop-blur-xl">
                        <div className="h-full flex flex-col gap-4">
                            <div className="flex items-center gap-2 border-b pb-4">
                                <Users className="h-5 w-5" />
                                <SheetTitle className="font-serif font-bold text-lg">Nearby Cast</SheetTitle>
                                <span className="ml-auto text-xs font-mono bg-white/10 px-2 py-1 rounded">
                                    {castList.length} Entities
                                </span>
                            </div>
                            <SheetDescription className="sr-only">
                                A list of all characters and entities currently nearby in the scene.
                            </SheetDescription>
                            <ScrollArea className="flex-1 -mx-4 px-4">
                                {renderCastList()}
                            </ScrollArea>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </>
    );
}
