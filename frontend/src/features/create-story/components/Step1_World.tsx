/**
 * Step 1: World
 * Genre/preset selection for the story
 * 
 * Features:
 * - Grid of world preset cards
 * - Info modal for preset details
 * - Auto-populates ruleset_keys from preset
 * - Confirmation dialog when changing world
 */

import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { useStoryDraftStore } from '../store/useStoryDraftStore';
import { WORLD_PRESETS } from '../data/mock-world-presets';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { cn } from '@/lib/utils';
import { AVAILABLE_RULESETS } from '../data/mock-rulesets';

export function Step1_World() {
  const draft = useStoryDraftStore((state) => state.draft);
  const updateMetadata = useStoryDraftStore((state) => state.updateMetadata);
  const selectedPresetId = draft?.metadata.world_preset_id;
  const [selectedPresetForModal, setSelectedPresetForModal] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingPresetId, setPendingPresetId] = useState<string | null>(null);

  const handleSelectPreset = (presetId: string) => {
    // If a preset is already selected and user is changing it, show confirmation
    if (selectedPresetId && selectedPresetId !== presetId && draft?.metadata.ruleset_keys.length > 0) {
      setPendingPresetId(presetId);
      setShowConfirmDialog(true);
      return;
    }

    // Apply preset immediately
    applyPreset(presetId);
  };

  const applyPreset = (presetId: string) => {
    const preset = WORLD_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    updateMetadata({
      world_preset_id: presetId,
      title: preset.title,
      summary: preset.description,
      genre_tags: [preset.genre_tag],
      ruleset_keys: preset.default_ruleset_keys,
      safety_filters: ['pg13'], // Default safety filter
    });
  };

  const handleConfirmChange = () => {
    if (pendingPresetId) {
      applyPreset(pendingPresetId);
      setPendingPresetId(null);
    }
    setShowConfirmDialog(false);
  };

  const handleCancelChange = () => {
    setPendingPresetId(null);
    setShowConfirmDialog(false);
  };

  const selectedPreset = selectedPresetId
    ? WORLD_PRESETS.find((p) => p.id === selectedPresetId)
    : null;

  const presetForModal = selectedPresetForModal
    ? WORLD_PRESETS.find((p) => p.id === selectedPresetForModal)
    : null;

  return (
    <>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">World</h2>
          <p className="text-muted-foreground">
            Choose a genre preset to start your story. Each preset includes recommended rulesets that you can customize later.
          </p>
        </div>

        {/* Preset Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {WORLD_PRESETS.map((preset) => {
            const Icon = preset.icon;
            const isSelected = selectedPresetId === preset.id;

            return (
              <Card
                key={preset.id}
                className={cn(
                  'cursor-pointer transition-all hover:shadow-md min-h-[160px]',
                  isSelected && 'ring-2 ring-primary ring-offset-2 bg-primary/5'
                )}
                onClick={() => handleSelectPreset(preset.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectPreset(preset.id);
                  }
                }}
                aria-pressed={isSelected}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-lg',
                        isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      )}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{preset.title}</CardTitle>
                        <CardDescription className="mt-1">{preset.description}</CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPresetForModal(preset.id);
                      }}
                      aria-label={`View details for ${preset.title}`}
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {isSelected && (
                    <Badge variant="default" className="text-xs">
                      Selected
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Selected Preset Info */}
        {selectedPreset && (
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-lg">Selected: {selectedPreset.title}</CardTitle>
              <CardDescription>
                {selectedPreset.description_long}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm font-medium">Included Rulesets:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedPreset.default_ruleset_keys.map((rulesetKey) => {
                    const ruleset = AVAILABLE_RULESETS.find((r) => r.id === rulesetKey);
                    return (
                      <Badge key={rulesetKey} variant="outline" className="text-xs">
                        {ruleset?.name || rulesetKey}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Preset Details Modal */}
      <Dialog open={!!presetForModal} onOpenChange={() => setSelectedPresetForModal(null)}>
        {presetForModal && (
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary text-primary-foreground">
                  <presetForModal.icon className="h-6 w-6" />
                </div>
                <DialogTitle className="text-2xl">{presetForModal.title}</DialogTitle>
              </div>
              <DialogDescription className="text-base">
                {presetForModal.description_long}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <p className="text-sm font-medium mb-2">Included Rulesets:</p>
                <div className="space-y-2">
                  {presetForModal.default_ruleset_keys.map((rulesetKey) => {
                    const ruleset = AVAILABLE_RULESETS.find((r) => r.id === rulesetKey);
                    if (!ruleset) return null;
                    return (
                      <Card key={rulesetKey} className="p-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm">{ruleset.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {ruleset.description_short}
                            </p>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => {
                    handleSelectPreset(presetForModal.id);
                    setSelectedPresetForModal(null);
                  }}
                  className="flex-1"
                >
                  Select This Preset
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedPresetForModal(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title="Change World Preset?"
        description="Changing the world preset will reset your Forces (rulesets) selection. You'll need to reconfigure your rulesets after this change."
        confirmText="Change World"
        cancelText="Cancel"
        onConfirm={handleConfirmChange}
        onCancel={handleCancelChange}
      />
    </>
  );
}
