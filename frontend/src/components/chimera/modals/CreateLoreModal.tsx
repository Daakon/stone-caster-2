/**
 * Create Lore Entry Modal
 * Phase 2: Creator Tools - Frontend
 * Modal for creating new lore entries (Pure RAG system)
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { chimeraLoreEntriesService } from '@/services/chimera.lore-entries';
import { chimeraStoriesService } from '@/services/chimera.stories';
import { ComplexAssetSelector } from '@/components/chimera/ComplexAssetSelector';

const MAX_ENTRY_TEXT_LENGTH = 1000;

interface CreateLoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  storyId: string;
  onSuccess?: () => void;
}

export function CreateLoreModal({ isOpen, onClose, storyId, onSuccess }: CreateLoreModalProps) {
  const [displayName, setDisplayName] = useState('');
  const [entryText, setEntryText] = useState('');
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch story to get world_id
  const { data: story, isLoading: isLoadingStory } = useQuery({
    queryKey: ['chimera-story', storyId],
    queryFn: () => chimeraStoriesService.getStory(storyId),
    enabled: isOpen && !!storyId,
  });

  // Set selected world from story when it loads
  useEffect(() => {
    if (story?.world_id && !selectedWorldId) {
      setSelectedWorldId(story.world_id);
    }
  }, [story?.world_id, selectedWorldId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Use selected world ID (from story or manually selected)
    const worldId = selectedWorldId || story?.world_id;
    if (!worldId || typeof worldId !== 'string' || worldId.trim() === '') {
      toast.error('Please select a world for this lore entry.');
      return;
    }

    const trimmedDisplayName = displayName.trim();
    const trimmedEntryText = entryText.trim();

    if (!trimmedDisplayName) {
      toast.error('Display name is required');
      return;
    }

    if (!trimmedEntryText) {
      toast.error('Entry text is required');
      return;
    }

    if (trimmedEntryText.length > MAX_ENTRY_TEXT_LENGTH) {
      toast.error(`Entry text must be ${MAX_ENTRY_TEXT_LENGTH} characters or less`);
      return;
    }

    setIsSubmitting(true);
    try {
      const requestBody = {
        world_id: worldId.trim(),
        display_name: trimmedDisplayName,
        entry_text: trimmedEntryText,
      };

      // Debug logging
      console.log('[CreateLoreModal] Submitting lore entry:', requestBody);

      await chimeraLoreEntriesService.createLoreEntry(worldId.trim(), {
        display_name: trimmedDisplayName,
        entry_text: trimmedEntryText,
      });

      toast.success('Lore entry created successfully');
      setDisplayName('');
      setEntryText('');
      setSelectedWorldId(null);
      onClose();
      onSuccess?.();
    } catch (error) {
      console.error('Error creating lore entry:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create lore entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setDisplayName('');
      setEntryText('');
      setSelectedWorldId(null);
      onClose();
    }
  };

  const handleWorldChange = (worldIds: string[]) => {
    setSelectedWorldId(worldIds[0] || null);
  };

  // Determine the world ID to use (selected or from story)
  const effectiveWorldId = selectedWorldId || story?.world_id || null;

  const remainingChars = MAX_ENTRY_TEXT_LENGTH - entryText.length;
  const isNearLimit = remainingChars < 100;

  const isLoading = isLoadingStory;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>New Lore Entry</DialogTitle>
          <DialogDescription>
            Create a new lore entry for this world. This will be used by the AI for narrative generation in stories set in this world.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>World *</Label>
            <ComplexAssetSelector
              assetType="world"
              selectedIds={effectiveWorldId ? [effectiveWorldId] : []}
              onSelectionChange={handleWorldChange}
              mode="single"
              emptyMessage="No worlds available. Create one first!"
              itemLabel="world"
              onCreateNew={() => {
                onClose();
                window.open('/dashboard/worlds/new', '_blank');
              }}
              createNewLabel="Create New World"
            />
            {story?.world_id && (
              <p className="text-xs text-muted-foreground">
                Using world from story: {story.world?.display_name || story.world_id}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name *</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Ancient History of Eldoria"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="entry-text">Entry Text</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-full p-1 hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    aria-label="Help: Entry Text"
                  >
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-2">
                    <p className="font-semibold text-sm">Drifter Tip</p>
                    <p className="text-sm text-muted-foreground">
                      This is the &quot;fact sheet&quot;. Keep it clear, factual, and focused on one topic. This is
                      exactly what the AI will read!
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <Textarea
              id="entry-text"
              value={entryText}
              onChange={(e) => setEntryText(e.target.value)}
              placeholder="Enter the lore content that will be vectorized for RAG search..."
              className="min-h-[200px] font-mono text-sm"
              disabled={isSubmitting}
              required
              maxLength={MAX_ENTRY_TEXT_LENGTH}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {remainingChars} character{remainingChars !== 1 ? 's' : ''} remaining
              </span>
              {isNearLimit && (
                <span className={remainingChars < 0 ? 'text-destructive' : 'text-yellow-600'}>
                  {remainingChars < 0 ? 'Over limit!' : 'Approaching limit'}
                </span>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !displayName.trim() || !entryText.trim() || !effectiveWorldId}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Lore Entry'
              )}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

