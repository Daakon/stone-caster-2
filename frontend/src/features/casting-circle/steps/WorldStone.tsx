import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, Globe, Users, Check, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useStoryDraftStore } from '@/features/casting-circle/stores/useStoryDraftStore';
import { chimeraWorldsService } from '@/services/chimera.worlds';
import type { ChimeraWorld } from '@/services/chimera.worlds';

const GENRES = ['Fantasy', 'Sci-Fi', 'Horror', 'Modern'] as const;

export function WorldStone() {
    const { draft, setWorld } = useStoryDraftStore();
    const selectedWorldId = draft?.world_id;

    // State for filtering
    const [selectedTab, setSelectedTab] = useState<'my-worlds' | 'official'>('official');
    const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

    // Fetch My Worlds
    const { data: myWorlds, isLoading: loadingMyWorlds } = useQuery({
        queryKey: ['chimera-my-worlds'],
        queryFn: () => chimeraWorldsService.getMyWorlds(),
    });

    // Fetch Official/Public Worlds
    const { data: officialWorlds, isLoading: loadingOfficialWorlds } = useQuery({
        queryKey: ['chimera-official-worlds'],
        queryFn: () => chimeraWorldsService.getSelectableWorlds(), // This returns public + owned usually, but let's assume filtering or focused endpoint
    });

    // Derive displayed worlds based on Tab and Genre
    const displayedWorlds = useMemo(() => {
        let source: ChimeraWorld[] = [];

        if (selectedTab === 'my-worlds') {
            source = myWorlds || [];
        } else {
            // Official/Public Tab
            // Filter out worlds that are also in 'myWorlds' to avoid duplication
            if (officialWorlds) {
                const myWorldIds = new Set((myWorlds || []).map(w => w.id));
                source = officialWorlds.filter(w => !myWorldIds.has(w.id));
            }
        }

        // Filter by Genre if selected
        if (selectedGenre && source.length > 0) {
            return source.filter(w => {
                // Check if tags or genre metadata matches
                const tags = w.tags || [];
                return tags.some(t => t.tag_name?.toLowerCase() === selectedGenre.toLowerCase());
            });
        }
        return source;
    }, [selectedTab, selectedGenre, myWorlds, officialWorlds]);

    const handleWorldSelect = async (worldId: string) => {
        if (selectedWorldId === worldId) return;
        await setWorld(worldId);
    };

    const isLoading = loadingMyWorlds || loadingOfficialWorlds;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold">Anchoring World</h2>
                        <p className="text-muted-foreground">Select the reality where your story takes place.</p>
                    </div>

                    {/* Genre Filter */}
                    <div className="flex gap-2 flex-wrap">
                        {GENRES.map(genre => (
                            <Badge
                                key={genre}
                                variant={selectedGenre === genre ? "default" : "outline"}
                                className={cn(
                                    "cursor-pointer px-3 py-1 hover:bg-primary/20 transition-colors",
                                    selectedGenre === genre && "bg-primary text-primary-foreground hover:bg-primary"
                                )}
                                onClick={() => setSelectedGenre(prev => prev === genre ? null : genre)}
                            >
                                {genre}
                            </Badge>
                        ))}
                    </div>
                </div>
            </div>

            <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 max-w-[400px]">
                    <TabsTrigger value="official" className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        Official & Public
                    </TabsTrigger>
                    <TabsTrigger value="my-worlds" className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        My Worlds
                    </TabsTrigger>
                </TabsList>

                {isLoading ? (
                    <div className="flex items-center justify-center h-64 border rounded-xl bg-muted/10">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {displayedWorlds.length === 0 ? (
                            <div className="col-span-full text-center py-12 border-2 border-dashed border-muted rounded-xl">
                                <h3 className="text-lg font-medium">No Worlds Found</h3>
                                <p className="text-muted-foreground mt-2">
                                    {selectedTab === 'my-worlds'
                                        ? "You haven't created any worlds yet."
                                        : "No matching official worlds found."}
                                </p>
                            </div>
                        ) : (
                            displayedWorlds.map((world) => {
                                const isSelected = selectedWorldId === world.id;

                                return (
                                    <Card
                                        key={world.id}
                                        className={cn(
                                            "cursor-pointer transition-all duration-300 hover:shadow-md relative overflow-hidden group border-2 h-full",
                                            isSelected
                                                ? "border-emerald-500 bg-emerald-950/10 shadow-[0_0_20px_rgba(16,185,129,0.2)] scale-[1.02]"
                                                : "border-border/50 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 hover:scale-[1.01] hover:border-stone-600 bg-black/40"
                                        )}
                                        onClick={() => handleWorldSelect(world.id)}
                                    >
                                        {isSelected && (
                                            <div className="absolute top-3 right-3 z-20 bg-emerald-500 text-white rounded-full p-1 shadow-lg animate-in zoom-in spin-in-12 duration-300">
                                                <Check className="w-5 h-5" strokeWidth={3} />
                                            </div>
                                        )}
                                        <CardHeader>
                                            <div className="flex justify-between items-start gap-2">
                                                <CardTitle className="text-lg leading-tight">{world.display_name}</CardTitle>
                                            </div>
                                            {world.tags && world.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {world.tags.slice(0, 3).map(t => (
                                                        <Badge key={t.id} variant="secondary" className="text-[10px] px-1.5 h-5">
                                                            {t.tag_name}
                                                        </Badge>
                                                    ))}
                                                    {world.tags.length > 3 && (
                                                        <span className="text-[10px] text-muted-foreground px-1">+{world.tags.length - 3}</span>
                                                    )}
                                                </div>
                                            )}
                                        </CardHeader>
                                        <CardContent>
                                            <CardDescription className="line-clamp-3">
                                                {world.description_short || "No description provided."}
                                            </CardDescription>
                                        </CardContent>
                                    </Card>
                                );
                            })
                        )}
                    </div>
                )}
            </Tabs>
        </div>
    );
}
