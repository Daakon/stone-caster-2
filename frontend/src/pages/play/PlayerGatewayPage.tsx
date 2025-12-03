/**
 * Player Gateway Page
 * Phase 4: Flexible Player Character Gateway UX
 * 
 * Central hub for selecting or creating a player character before launching the game
 * Shows existing characters for the world and quick start options
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Plus, Play, Zap, User } from 'lucide-react';
import { toast } from 'sonner';
import { chimeraPlayService } from '@/services/chimera.play';
import { apiFetch } from '@/lib/api';
import { chimeraStoriesService } from '@/services/chimera.stories';

interface PlayerEntity {
  id: string;
  display_name: string;
  description_short: string | null;
  base_state_json: Record<string, unknown>;
  created_at: string;
  is_system_asset?: boolean;
  world_id?: string | null;
  is_quick_start_template?: boolean;
}

export default function PlayerGatewayPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const [startingWithEntity, setStartingWithEntity] = useState<string | null>(null);

  // Fetch story to get world info
  const { data: story } = useQuery({
    queryKey: ['story', storyId],
    queryFn: () => chimeraStoriesService.getStory(storyId!),
    enabled: !!storyId,
  });

  // Fetch existing player entities for this world (via story)
  const { data: playerEntities, isLoading, error } = useQuery({
    queryKey: ['player-entities', storyId],
    queryFn: async () => {
      if (!storyId) throw new Error('Story ID is required');
      const result = await apiFetch<PlayerEntity[]>(`/api/v2/play/${storyId}/player-entities`);
      if (!result.ok) {
        throw new Error(result.error.message || 'Failed to fetch player entities');
      }
      return result.data || [];
    },
    enabled: !!storyId,
    staleTime: 30 * 1000, // 30 seconds
  });

  const handleCreateNew = () => {
    navigate(`/create-character/${storyId}`);
  };


  const handleSelectEntity = async (entityId: string) => {
    if (!storyId) return;

    setStartingWithEntity(entityId);
    try {
      const gameState = await chimeraPlayService.startWithEntity(storyId, entityId);
      navigate(`/play/${gameState.id}`);
    } catch (error) {
      console.error('Error starting with entity:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to start game with selected character'
      );
    } finally {
      setStartingWithEntity(null);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              <p>Failed to load player gateway</p>
              <p className="text-sm text-muted-foreground mt-2">
                {error instanceof Error ? error.message : 'Unknown error'}
              </p>
              <Button
                onClick={() => navigate(-1)}
                variant="outline"
                className="mt-4"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const worldName = story?.world?.display_name || 'this world';

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Choose Your Character</h1>
            <p className="text-muted-foreground mt-2">
              Select an existing character or create a new one for {worldName}
            </p>
          </div>
        </div>

        {/* Character Cards Grid */}
        <div className="space-y-6">
          {/* Section 1: Select Existing Character (User-owned) */}
          {playerEntities && playerEntities.filter((e) => !e.is_system_asset).length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Your Characters</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {playerEntities
                  .filter((entity) => !entity.is_system_asset)
                  .map((entity) => (
                    <Card
                      key={entity.id}
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => handleSelectEntity(entity.id)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">{entity.display_name}</h3>
                              {entity.description_short && (
                                <p className="text-sm text-muted-foreground">{entity.description_short}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectEntity(entity.id);
                          }}
                          disabled={startingWithEntity === entity.id}
                          className="w-full"
                          variant="outline"
                        >
                          {startingWithEntity === entity.id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Starting...
                            </>
                          ) : (
                            <>
                              <Play className="mr-2 h-4 w-4" />
                              Play as {entity.display_name}
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}

          {/* Section 2: Quick Start (System Assets / Premade Characters) */}
          {playerEntities && playerEntities.filter((e) => e.is_system_asset && e.is_quick_start_template).length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Quick Start Characters</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Select a premade character to start immediately
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {playerEntities
                  .filter((entity) => entity.is_system_asset && entity.is_quick_start_template)
                  .map((entity) => (
                    <Card
                      key={entity.id}
                      className="cursor-pointer hover:border-primary transition-colors border-dashed"
                      onClick={() => handleSelectEntity(entity.id)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                              <Zap className="h-6 w-6 text-secondary-foreground" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">{entity.display_name}</h3>
                              {entity.description_short && (
                                <p className="text-sm text-muted-foreground">{entity.description_short}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectEntity(entity.id);
                          }}
                          disabled={startingWithEntity === entity.id}
                          className="w-full"
                          variant="secondary"
                        >
                          {startingWithEntity === entity.id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Starting...
                            </>
                          ) : (
                            <>
                              <Zap className="mr-2 h-4 w-4" />
                              Quick Start as {entity.display_name}
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}

          {/* Section 3: Create New Character */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Create New Character</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card
                className="cursor-pointer hover:border-primary transition-colors border-dashed"
                onClick={handleCreateNew}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Plus className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Create New</h3>
                        <p className="text-sm text-muted-foreground">
                          Custom character creation
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateNew();
                    }}
                    className="w-full"
                    variant="default"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Character
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
