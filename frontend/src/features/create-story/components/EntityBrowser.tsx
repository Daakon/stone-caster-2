import React, { useState, useMemo } from 'react';
import { Search, Filter, Plus, User, MapPin, Box, LayoutGrid, LayoutList } from 'lucide-react';
import { useStoryDraftStore } from '../store/useStoryDraftStore';
import { entitiesService, useEntities } from '@/services/authoring/entities.service';
import { EntityCard } from './EntityCard';
import { CreateEntityModal } from './CreateEntityModal';
import type { EntityTemplate } from '@/types/chimera-domain';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

export function EntityBrowser() {
    const draft = useStoryDraftStore((state) => state.draft);
    const stageEntity = useStoryDraftStore((state) => state.stageEntity);
    const unstageEntity = useStoryDraftStore((state) => state.unstageEntity);

    const worldId = draft?.metadata.world_id;
    const stagedIds = draft?.staged_entity_ids || [];

    // Local State for Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'my' | 'system'>('my');
    const [typeFilter, setTypeFilter] = useState<'all' | 'npc' | 'item' | 'location'>('all');
    const [selectedEntity, setSelectedEntity] = useState<EntityTemplate | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Fetch Entities using React Query Hook (prevents infinite loops)
    const { data: entities = [], isLoading, refetch } = useEntities({
        world_id: worldId,
        source: activeTab,
        query: searchQuery,
        kind: typeFilter === 'all' ? undefined : [typeFilter],
    });

    // Verification Log
    console.log('ElementsStone Render:', { isLoading, count: entities.length, filters: { typeFilter, searchQuery } });

    // Handle Selection
    const handleSelect = (entity: EntityTemplate) => {
        setSelectedEntity(entity);
    };

    const handleToggleStage = (entity: EntityTemplate) => {
        if (!entity.entity_id) return;
        if (stagedIds.includes(entity.entity_id)) {
            unstageEntity(entity.entity_id);
        } else {
            stageEntity(entity.entity_id);
        }
    };

    const handleEntityCreated = (newEntity: EntityTemplate) => {
        refetch(); // Refresh list to show new entity
        handleToggleStage(newEntity); // Auto-stage created entity
        setSelectedEntity(newEntity);
    };

    return (
        <div className="flex h-[calc(100vh-200px)] min-h-[500px] border rounded-lg overflow-hidden bg-background">

            {/* LEFT: Browser / List */}
            <div className={cn("flex flex-col border-r transition-all duration-300", selectedEntity ? "w-full md:w-1/2 lg:w-2/3 hidden md:flex" : "w-full")}>

                {/* Toolbar */}
                <div className="p-4 border-b space-y-4">
                    <div className="flex items-center justify-between">
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-[200px]">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="my">My Creations</TabsTrigger>
                                <TabsTrigger value="system">System</TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <Button onClick={() => setIsCreateModalOpen(true)} size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Create New
                        </Button>
                    </div>

                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search entities..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        {/* Type Filter Icons */}
                        <div className="flex border rounded-md overflow-hidden bg-muted/50">
                            <button onClick={() => setTypeFilter('all')} className={cn("px-3 py-2 hover:bg-muted transition", typeFilter === 'all' && "bg-background shadow-sm")}><LayoutGrid className="h-4 w-4" /></button>
                            <button onClick={() => setTypeFilter('npc')} className={cn("px-3 py-2 hover:bg-muted transition", typeFilter === 'npc' && "bg-background shadow-sm")}><User className="h-4 w-4" /></button>
                            <button onClick={() => setTypeFilter('item')} className={cn("px-3 py-2 hover:bg-muted transition", typeFilter === 'item' && "bg-background shadow-sm")}><Box className="h-4 w-4" /></button>
                            <button onClick={() => setTypeFilter('location')} className={cn("px-3 py-2 hover:bg-muted transition", typeFilter === 'location' && "bg-background shadow-sm")}><MapPin className="h-4 w-4" /></button>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <ScrollArea className="flex-1 bg-muted/10">
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {isLoading ? (
                            <div className="col-span-full py-10 text-center text-muted-foreground">Loading...</div>
                        ) : entities.length === 0 ? (
                            <div className="col-span-full py-10 text-center text-muted-foreground flex flex-col items-center">
                                <Box className="h-10 w-10 mb-2 opacity-20" />
                                No entities found for this world. Create one to get started.
                            </div>
                        ) : (
                            entities.map(entity => (
                                <EntityCard
                                    key={entity.entity_id}
                                    entity={entity}
                                    isSelected={selectedEntity?.entity_id === entity.entity_id}
                                    isStaged={stagedIds.includes(entity.entity_id || '')}
                                    onToggleStage={handleToggleStage}
                                    onClick={handleSelect}
                                />
                            ))
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* RIGHT: Detail View (Desktop) / Sheet (Mobile handled via logic?) */}
            {/* For MVP simplicity, implementing desktop split view. Mobile users tap to see this full screen or in a sheet. */}
            {/* We'll use a Sheet for mobile if screen is small, but for now standard div that is conditionally shown */}

            {selectedEntity && (
                <div className="w-full md:w-1/2 lg:w-1/3 bg-card p-0 flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="p-4 border-b flex items-center justify-between">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedEntity(null)} className="md:hidden">Back</Button>
                        <div className="flex gap-2">
                            <Button
                                variant={stagedIds.includes(selectedEntity.entity_id || '') ? "destructive" : "default"}
                                size="sm"
                                onClick={() => handleToggleStage(selectedEntity)}
                            >
                                {stagedIds.includes(selectedEntity.entity_id || '') ? "Remove from Story" : "Add to Story"}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setSelectedEntity(null)} className="hidden md:flex"><Plus className="h-4 w-4 rotate-45" /></Button>
                        </div>
                    </div>

                    <ScrollArea className="flex-1 p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 rounded-full bg-primary/10 text-primary">
                                {selectedEntity.kind === 'npc' && <User className="h-8 w-8" />}
                                {selectedEntity.kind === 'location' && <MapPin className="h-8 w-8" />}
                                {selectedEntity.kind === 'item' && <Box className="h-8 w-8" />}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">{selectedEntity.name}</h2>
                                <div className="flex gap-2 mt-1">
                                    <Badge variant="outline">{selectedEntity.kind.toUpperCase()}</Badge>
                                    {selectedEntity.is_player && <Badge>Player Character</Badge>}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {selectedEntity.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {selectedEntity.tags.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                                </div>
                            )}

                            <div className="space-y-2">
                                <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Description</h4>
                                <p className="text-sm leading-relaxed text-foreground/80">
                                    No description provided.
                                </p>
                            </div>

                            <Separator />

                            <div className="space-y-2">
                                <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Raw Data</h4>
                                <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-[200px]">
                                    {JSON.stringify(selectedEntity, null, 2)}
                                </pre>
                            </div>
                        </div>
                    </ScrollArea>
                </div>
            )}

            <CreateEntityModal
                open={isCreateModalOpen}
                onOpenChange={setIsCreateModalOpen}
                worldId={worldId}
                onEntityCreated={handleEntityCreated}
            />
        </div>
    );
}
