import React, { useState, useMemo, useEffect } from 'react';
import { Info, Check, Plus } from 'lucide-react';
import { useStoryDraftStore } from '../store/useStoryDraftStore';
import { WORLD_PRESETS } from '../data/mock-world-presets';
import { MOCK_WORLDS } from '../data/mock-worlds';
import { worldsService, useWorlds } from '@/services/authoring/worlds.service';
import { CreateWorldModal } from './CreateWorldModal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { cn } from '@/lib/utils';
import type { WorldDefinition } from '@/types/chimera-domain';

export function Step1_World() {
  const draft = useStoryDraftStore((state) => state.draft);
  const updateMetadata = useStoryDraftStore((state) => state.updateMetadata);

  const selectedPresetId = draft?.metadata.world_preset_id;
  const selectedWorldId = draft?.metadata.world_id;

  const [selectedGenreId, setSelectedGenreId] = useState<string | null>(selectedPresetId || null);
  const [worldForModal, setSelectedWorldForModal] = useState<any | null>(null);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingWorldId, setPendingWorldId] = useState<string | null>(null);

  // Derive Genre Tag for API Filter
  const selectedGenreTag = useMemo(() => {
    return WORLD_PRESETS.find(p => p.id === selectedGenreId)?.genre_tag;
  }, [selectedGenreId]);

  // Fetch Worlds using React Query (Real API)
  const { data: worlds = [], isLoading, error } = useWorlds(selectedGenreTag);

  // Verification Log
  console.log('WorldStone Render:', { genre: selectedGenreTag, count: worlds.length, isLoading });

  // Use fetched worlds
  const filteredWorlds = worlds;

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // (Removed manual useEffect fetch)


  const handleSelectGenre = (genreId: string) => {
    setSelectedGenreId(genreId === selectedGenreId ? null : genreId);
  };

  const handleSelectWorld = (worldId: string) => {
    if (selectedWorldId && selectedWorldId !== worldId) {
      setPendingWorldId(worldId);
      setShowConfirmDialog(true);
      return;
    }
    applyWorld(worldId);
  };

  const applyWorld = (worldId: string) => {
    const world = availableWorlds.find((w) => w.id === worldId || w.world_id === worldId);
    if (!world) return;
    const idToUse = world.world_id || world.id;

    updateMetadata({
      world_id: idToUse,
      world_preset_id: selectedGenreId || undefined,
      title: world.name || world.title,
      summary: world.summary,
      genre_tags: world.genre_tags,
    });
  };

  const handleConfirmChange = () => {
    if (pendingWorldId) {
      applyWorld(pendingWorldId);
      setPendingWorldId(null);
    }
    setShowConfirmDialog(false);
  };

  const handleWorldCreated = (newWorld: WorldDefinition) => {
    setAvailableWorlds(prev => [newWorld as any, ...prev]);
    if (newWorld.world_id) {
      applyWorld(newWorld.world_id);
    }
  };

  return (
    <>
      <div className="space-y-8 pb-20">
        <div>
          <h2 className="text-2xl font-bold mb-2">Select a World</h2>
          <p className="text-muted-foreground">
            Choose a setting for your story. Filter by genre to find the perfect match,
            or create your own from scratch.
          </p>
        </div>

        {/* Genre Filters */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {WORLD_PRESETS.map((preset) => {
            const Icon = preset.icon;
            const isSelected = selectedGenreId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handleSelectGenre(preset.id)}
                className={cn(
                  "flex flex-col items-center justify-center p-3 rounded-xl border transition-all hover:bg-muted/50 h-[100px]",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card"
                )}
              >
                <Icon className={cn("h-6 w-6 mb-2", isSelected ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("text-xs font-medium text-center", isSelected ? "text-foreground" : "text-muted-foreground")}>
                  {preset.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* World Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* Create New Card */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="group relative flex flex-col items-center justify-center min-h-[200px] rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30 transition-all text-center p-6"
          >
            <div className="h-12 w-12 rounded-full bg-muted group-hover:bg-primary/10 flex items-center justify-center mb-4 transition-colors">
              <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
            </div>
            <h3 className="font-semibold text-lg text-foreground mb-1">Create New World</h3>
            <p className="text-sm text-muted-foreground max-w-[200px]">
              Forge a new realm from scratch
            </p>
          </button>

          {filteredWorlds.map((world) => {
            const wId = world.id || world.world_id;
            const isSelected = selectedWorldId === wId;

            return (
              <Card
                key={wId}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md relative overflow-hidden group",
                  isSelected ? "ring-2 ring-primary ring-offset-2" : "hover:border-primary/50"
                )}
                onClick={() => handleSelectWorld(wId)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-lg">{world.name || world.title}</CardTitle>
                    {isSelected && <div className="h-5 w-5 bg-primary rounded-full flex items-center justify-center"><Check className="h-3 w-3 text-primary-foreground" /></div>}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(world.genre_tags || []).slice(0, 3).map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[10px] h-5 px-1.5">{tag}</Badge>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="line-clamp-3 mb-4">
                    {world.summary}
                  </CardDescription>

                  <div className="flex items-center justify-between mt-auto pt-2">
                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      {world.tags ? world.tags.length : 0} traits
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedWorldForModal(world);
                      }}
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Create World Modal */}
      <CreateWorldModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onWorldCreated={handleWorldCreated}
      />

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleConfirmChange}
        title="Switch World?"
        description="Changing the world will reset any rulesets you haven't saved. Are you sure?"
        confirmText="Switch World"
      />
    </>
  );
}
