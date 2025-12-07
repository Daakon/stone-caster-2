/**
 * Step 3: Elements
 * Roster view for managing entities (characters, NPCs) in the story
 * 
 * Features:
 * - Display staged entities as cards
 * - Add entities via EntityManagerModal
 * - Remove entities from roster
 */

import React, { useState, useEffect } from 'react';
import { Plus, X, User } from 'lucide-react';
import { useStoryDraftStore } from '../store/useStoryDraftStore';
import { EntityManagerModal } from './EntityManagerModal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { EntityTemplate } from '@/types/chimera-domain';
import { getStatLabel } from '../utils/ruleset-interpreter';

export function Step3_Elements() {
  const draft = useStoryDraftStore((state) => state.draft);
  const stageEntity = useStoryDraftStore((state) => state.stageEntity);
  const unstageEntity = useStoryDraftStore((state) => state.unstageEntity);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [localEntities, setLocalEntities] = useState<EntityTemplate[]>([]);

  const stagedEntityIds = draft?.staged_entity_ids || [];

  // Sync local entities with staged IDs
  useEffect(() => {
    // In a real app, we'd fetch entities by ID from the backend
    // For now, we maintain local state and sync IDs to store
    setLocalEntities((prev) =>
      prev.filter((entity) => stagedEntityIds.includes(entity.entity_id || ''))
    );
  }, [stagedEntityIds]);

  // Handle entity selection from library
  const handleSelectEntity = (entity: EntityTemplate) => {
    if (!entity.entity_id) return;

    // Add to local state if not already present
    setLocalEntities((prev) => {
      if (prev.some((e) => e.entity_id === entity.entity_id)) {
        return prev;
      }
      return [...prev, entity];
    });

    // Stage in store
    stageEntity(entity.entity_id);
  };

  // Handle entity creation
  const handleCreateEntity = (entity: EntityTemplate) => {
    if (!entity.entity_id) return;

    // Add to local state
    setLocalEntities((prev) => [...prev, entity]);

    // Stage in store
    stageEntity(entity.entity_id);
  };

  // Handle entity removal
  const handleRemoveEntity = (entityId: string) => {
    // Remove from local state
    setLocalEntities((prev) => prev.filter((e) => e.entity_id !== entityId));

    // Unstage from store
    unstageEntity(entityId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Elements</h2>
        <p className="text-muted-foreground">
          Recruit entities to populate your world. Add player characters, NPCs, and other important figures.
        </p>
      </div>

      {/* Empty State */}
      {localEntities.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">The world is empty</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Start building your cast by recruiting your first entity.
            </p>
            <Button
              onClick={() => setIsModalOpen(true)}
              className="min-h-[44px] min-w-[160px]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Recruit Entity
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Roster Grid */}
      {localEntities.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Roster ({localEntities.length})
            </h3>
            <Button
              onClick={() => setIsModalOpen(true)}
              variant="outline"
              className="min-h-[44px]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Recruit Entity
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {localEntities.map((entity) => (
              <Card key={entity.entity_id} className="relative min-h-[180px]">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {entity.name}
                        {entity.is_player && (
                          <Badge variant="default" className="text-xs">
                            Player
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {entity.personality.core_traits.length > 0
                          ? entity.personality.core_traits[0]
                          : 'No traits defined'}
                      </CardDescription>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveEntity(entity.entity_id || '')}
                      className="rounded-full hover:bg-muted p-1.5 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                      aria-label={`Remove ${entity.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {/* Stats Preview */}
                  {Object.keys(entity.stats).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(entity.stats)
                        .slice(0, 3)
                        .map(([key, value]) => (
                          <Badge key={key} variant="outline" className="text-xs">
                            {getStatLabel(key)}: {value}
                          </Badge>
                        ))}
                      {Object.keys(entity.stats).length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{Object.keys(entity.stats).length - 3} more
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Role Badge */}
                  <div className="mt-3 pt-3 border-t">
                    <Badge variant="secondary" className="text-xs">
                      {entity.is_player ? 'Player Character' : 'NPC'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Entity Manager Modal */}
      <EntityManagerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleSelectEntity}
        onCreate={handleCreateEntity}
      />
    </div>
  );
}
