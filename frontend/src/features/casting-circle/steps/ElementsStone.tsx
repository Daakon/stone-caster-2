
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useStoryDraftStore } from '../stores/useStoryDraftStore';
import { chimeraEntitiesService } from '@/services/chimera.entities';
import type { SelectableEntity } from '@/services/chimera.entities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Users, Shield, MapPin, Package, Search, Sparkles, Filter, CheckCircle2, Globe, Hammer } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export function ElementsStone() {
    const { draft, setDraftData } = useStoryDraftStore();
    const worldId = draft?.world_id;
    const castIds = draft?.cast_ids || [];

    const [searchQuery, setSearchQuery] = useState('');
    const [activeSourceTab, setActiveSourceTab] = useState<string>('official');
    const [activeTypeFilter, setActiveTypeFilter] = useState<string>('all');

    // Query 1: World Entities (Official & Public + My World Entities)
    const { data: worldEntities, isLoading: loadingWorld } = useQuery({
        queryKey: ['chimera-world-entities', worldId],
        queryFn: () => worldId ? chimeraEntitiesService.getWorldEntities(worldId) : Promise.resolve([]),
        enabled: !!worldId,
    });

    // Query 2: My Entities (Global "My Creations")
    const { data: myEntities, isLoading: loadingMine } = useQuery({
        queryKey: ['chimera-my-entities'],
        queryFn: () => chimeraEntitiesService.getMyEntities(),
    });

    const isLoading = loadingWorld || loadingMine;

    // Toggle Handler
    const handleCastToggle = (id: string) => {
        const newCast = castIds.includes(id)
            ? castIds.filter((cid: string) => cid !== id)
            : [...castIds, id];

        setDraftData({ cast_ids: newCast });
    };

    // Filter Logic
    // We need to identify "My Entities" IDs to filter them OUT of the "Official" tab
    const myEntityIds = new Set((myEntities || []).map(e => e.id));

    let displayEntities: SelectableEntity[] = [];

    if (activeSourceTab === 'official') {
        // Show World Entities that are NOT in "My Creations"
        // (i.e., Official content or other people's Public content)
        // Note: worldEntities includes "My Entities in this World". We filter those out here to avoid duplication with "My Creations" tab.
        displayEntities = (worldEntities || []).filter(e => !myEntityIds.has(e.id));
    } else {
        // Show All "My Creations"
        // We cast ChimeraEntity to SelectableEntity compatibility (they share core fields)
        displayEntities = (myEntities || []) as unknown as SelectableEntity[];
    }

    // Apply Search and Type Filters
    const filteredEntities = displayEntities.filter(entity => {
        const matchesSearch = (entity.display_name || '').toLowerCase().includes(searchQuery.toLowerCase());
        // SelectableEntity has entity_type. MyEntities (ChimeraEntity) has kind. We cast to unknown above so accessing kind is unsafe unless we cast back or check field existence.
        // But simply checking entity_type is safer for SelectableEntity.
        const type = entity.entity_type || (entity as any).kind || 'unknown';
        const matchesType = activeTypeFilter === 'all' || type.toLowerCase() === activeTypeFilter.toLowerCase();
        return matchesSearch && matchesType;
    });

    // Helper for Icons
    const getTypeIcon = (type: string) => {
        switch ((type || '').toLowerCase()) {
            case 'npc': return <User className="w-4 h-4" />;
            case 'location': return <MapPin className="w-4 h-4" />;
            case 'item': return <Package className="w-4 h-4" />;
            case 'faction': return <Shield className="w-4 h-4" />;
            default: return <Sparkles className="w-4 h-4" />;
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20 h-full flex flex-col">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Users className="w-6 h-6 text-indigo-400" />
                        Story Elements
                    </h2>
                    <p className="text-muted-foreground">Select the cast, locations, and artifacts for this adventure.</p>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative w-full md:w-[250px]">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search assets..."
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Source Source Tabs (Official vs Mine) */}
            <Tabs defaultValue="official" value={activeSourceTab} onValueChange={setActiveSourceTab} className="w-full shrink-0">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="official" className="gap-2">
                        <Globe className="w-4 h-4" />
                        Official & Public
                    </TabsTrigger>
                    <TabsTrigger value="mine" className="gap-2">
                        <Hammer className="w-4 h-4" />
                        My Creations
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            {/* Type Filter Pills (Toolbar) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 shrink-0 no-scrollbar">
                {[
                    { id: 'all', label: 'All', icon: null },
                    { id: 'npc', label: 'NPCs', icon: User },
                    { id: 'location', label: 'Locations', icon: MapPin },
                    { id: 'item', label: 'Items', icon: Package },
                    { id: 'faction', label: 'Factions', icon: Shield },
                ].map(filter => {
                    const Icon = filter.icon;
                    const isActive = activeTypeFilter === filter.id;
                    return (
                        <button
                            key={filter.id}
                            onClick={() => setActiveTypeFilter(filter.id)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                                isActive
                                    ? "bg-indigo-500 text-white border-indigo-600 shadow-sm"
                                    : "bg-card hover:bg-muted text-muted-foreground border-border"
                            )}
                        >
                            {Icon && <Icon className="w-3 h-3" />}
                            {filter.label}
                        </button>
                    );
                })}
            </div>

            {/* Results Grid */}
            <ScrollArea className="flex-1 -mx-2 px-2">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                        <p>Loading assets...</p>
                    </div>
                ) : filteredEntities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-xl h-64 bg-muted/20">
                        <Filter className="w-12 h-12 text-muted-foreground/30 mb-4" />
                        <p className="text-muted-foreground font-medium">No assets found in this category.</p>
                        <p className="text-xs text-muted-foreground mt-1">Try switching tabs or adjusting filters.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
                        {filteredEntities.map((entity) => {
                            const isSelected = castIds.includes(entity.id);
                            // Fallback for types if mapped differently
                            const type = entity.entity_type || (entity as any).kind || 'unknown';

                            return (
                                <Card
                                    key={entity.id}
                                    className={cn(
                                        "cursor-pointer transition-all duration-200 group relative overflow-hidden",
                                        isSelected
                                            ? "border-indigo-500 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500"
                                            : "border-border/60 hover:border-indigo-500/50 hover:bg-accent/50"
                                    )}
                                    onClick={() => handleCastToggle(entity.id)}
                                >
                                    {isSelected && (
                                        <div className="absolute top-2 right-2 z-10 text-indigo-500 animate-in zoom-in duration-200">
                                            <CheckCircle2 className="w-5 h-5 fill-indigo-500/20" />
                                        </div>
                                    )}

                                    <CardContent className="p-4 flex flex-row items-center gap-4">
                                        <div className={cn(
                                            "w-12 h-12 rounded-lg flex items-center justify-center shrink-0 border bg-background/50",
                                            isSelected ? "border-indigo-500/50" : "border-border"
                                        )}>
                                            {getTypeIcon(type)}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h4 className={cn(
                                                "font-medium truncate transition-colors",
                                                isSelected ? "text-indigo-400" : "text-foreground group-hover:text-indigo-400"
                                            )}>
                                                {entity.display_name || "Unnamed"}
                                            </h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 capitalize bg-secondary/50">
                                                    {type.toLowerCase()}
                                                </Badge>
                                            </div>
                                        </div>
                                    </CardContent>

                                    {isSelected && <div className="absolute inset-0 bg-indigo-500/5 pointer-events-none" />}
                                </Card>
                            );
                        })}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
