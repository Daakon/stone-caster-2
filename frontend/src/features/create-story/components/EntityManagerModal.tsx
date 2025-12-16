/**
 * Entity Manager Modal
 * Dialog for selecting or creating entities
 * 
 * Features:
 * - Library tab: Browse and select existing entities
 * - Forge tab: Create new entities with dynamic stats
 */

import React, { useState, useMemo } from 'react';
import { Search, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MOCK_USER_ENTITIES } from '../data/mock-library';
import { useStoryDraftStore } from '../store/useStoryDraftStore';
import { getRequiredStatFields, getStatLabel } from '../utils/ruleset-interpreter';
import type { EntityTemplate } from '@/types/chimera-domain';
import { cn } from '@/lib/utils';

interface EntityManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (entity: EntityTemplate) => void;
  onCreate: (entity: EntityTemplate) => void;
}

export function EntityManagerModal({
  isOpen,
  onClose,
  onSelect,
  onCreate,
}: EntityManagerModalProps) {
  const draft = useStoryDraftStore((state) => state.draft);
  const rulesetKeys = draft?.metadata.ruleset_keys || [];

  // Library tab state
  const [searchQuery, setSearchQuery] = useState('');

  // Forge tab state
  const [entityName, setEntityName] = useState('');
  const [isPlayer, setIsPlayer] = useState(false);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [coreTrait, setCoreTrait] = useState('');
  const [mood, setMood] = useState('');

  // Get required stat fields based on selected rulesets
  const requiredStatFields = useMemo(() => getRequiredStatFields(rulesetKeys), [rulesetKeys]);

  // Initialize stats with default values (50) for required fields
  React.useEffect(() => {
    if (requiredStatFields.length > 0) {
      const initialStats: Record<string, number> = {};
      requiredStatFields.forEach((field) => {
        if (!(field in stats)) {
          initialStats[field] = 50;
        }
      });
      if (Object.keys(initialStats).length > 0) {
        setStats((prev) => ({ ...prev, ...initialStats }));
      }
    }
  }, [requiredStatFields]);

  // Filter entities by search query
  const filteredEntities = useMemo(() => {
    if (!searchQuery.trim()) return MOCK_USER_ENTITIES;
    const query = searchQuery.toLowerCase();
    return MOCK_USER_ENTITIES.filter((entity) =>
      entity.name.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Handle stat slider change
  const handleStatChange = (field: string, value: number[]) => {
    setStats((prev) => ({ ...prev, [field]: value[0] }));
  };

  // Handle entity creation
  const handleCreate = () => {
    if (!entityName.trim()) return;

    const newEntity: EntityTemplate = {
      entity_id: `entity-${Date.now()}`,
      name: entityName.trim(),
      is_player: isPlayer,
      stats: { ...stats },
      personality: {
        core_traits: coreTrait ? [coreTrait.trim()] : [],
        core_values: [],
        quirks: mood ? [mood.trim()] : [],
      },
    };

    onCreate(newEntity);
    
    // Reset form
    setEntityName('');
    setIsPlayer(false);
    setStats({});
    setCoreTrait('');
    setMood('');
    onClose();
  };

  // Handle entity selection
  const handleSelect = (entity: EntityTemplate) => {
    onSelect(entity);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Recruit Entity</DialogTitle>
          <DialogDescription>
            Select an existing entity from your library or forge a new one.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="library" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="library" className="min-h-[44px]">
              Library
            </TabsTrigger>
            <TabsTrigger value="forge" className="min-h-[44px]">
              The Forge
            </TabsTrigger>
          </TabsList>

          {/* Library Tab */}
          <TabsContent value="library" className="space-y-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search entities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 min-h-[44px]"
                aria-label="Search entities"
              />
            </div>

            {filteredEntities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No entities found matching "{searchQuery}"</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto">
                {filteredEntities.map((entity) => (
                  <Card
                    key={entity.entity_id}
                    className="cursor-pointer hover:shadow-md transition-shadow min-h-[100px]"
                    onClick={() => handleSelect(entity)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelect(entity);
                      }
                    }}
                  >
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
                            {entity.personality.core_traits.slice(0, 2).join(', ')}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(entity.stats).slice(0, 3).map(([key, value]) => (
                          <Badge key={key} variant="outline" className="text-xs">
                            {getStatLabel(key)}: {value}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Forge Tab */}
          <TabsContent value="forge" className="space-y-4 mt-4">
            <div className="space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="entity-name">Name</Label>
                <Input
                  id="entity-name"
                  type="text"
                  placeholder="Enter entity name..."
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                  className="min-h-[44px]"
                  aria-label="Entity name"
                />
              </div>

              {/* Is Player Toggle */}
              <div className="flex items-center justify-between p-4 border rounded-lg min-h-[44px]">
                <div className="space-y-0.5">
                  <Label htmlFor="is-player" className="text-base">
                    Is Player Character?
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Toggle if this entity is a player character
                  </p>
                </div>
                <Switch
                  id="is-player"
                  checked={isPlayer}
                  onCheckedChange={setIsPlayer}
                  aria-label="Is player character"
                />
              </div>

              {/* Dynamic Stats */}
              {requiredStatFields.length > 0 && (
                <div className="space-y-4">
                  <Label className="text-base">Stats</Label>
                  {requiredStatFields.map((field) => (
                    <div key={field} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={`stat-${field}`} className="text-sm">
                          {getStatLabel(field)}
                        </Label>
                        <span className="text-sm font-medium">
                          {stats[field] ?? 50}
                        </span>
                      </div>
                      <Slider
                        id={`stat-${field}`}
                        min={0}
                        max={100}
                        step={1}
                        value={[stats[field] ?? 50]}
                        onValueChange={(value) => handleStatChange(field, value)}
                        className="w-full"
                        aria-label={`${getStatLabel(field)} slider`}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Personality */}
              <div className="space-y-4">
                <Label className="text-base">Personality</Label>
                
                <div className="space-y-2">
                  <Label htmlFor="core-trait" className="text-sm">
                    Core Trait
                  </Label>
                  <Input
                    id="core-trait"
                    type="text"
                    placeholder="e.g., Brave, Cunning, Wise"
                    value={coreTrait}
                    onChange={(e) => setCoreTrait(e.target.value)}
                    className="min-h-[44px]"
                    aria-label="Core trait"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mood" className="text-sm">
                    Mood / Quirk
                  </Label>
                  <Input
                    id="mood"
                    type="text"
                    placeholder="e.g., Taps fingers when thinking"
                    value={mood}
                    onChange={(e) => setMood(e.target.value)}
                    className="min-h-[44px]"
                    aria-label="Mood or quirk"
                  />
                </div>
              </div>

              {/* Create Button */}
              <Button
                onClick={handleCreate}
                disabled={!entityName.trim()}
                className="w-full min-h-[44px]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add to Story
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
