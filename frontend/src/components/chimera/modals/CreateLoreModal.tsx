/**
 * Create Lore Entry Modal
 * Phase 2: Creator Tools - Frontend
 * Modal for creating new lore entries (Pure RAG system)
 */

import { useState } from 'react';
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName.trim()) {
      toast.error('Display name is required');
      return;
    }

    if (!entryText.trim()) {
      toast.error('Entry text is required');
      return;
    }

    if (entryText.length > MAX_ENTRY_TEXT_LENGTH) {
      toast.error(`Entry text must be ${MAX_ENTRY_TEXT_LENGTH} characters or less`);
      return;
    }

    setIsSubmitting(true);
    try {
      await chimeraLoreEntriesService.createLoreEntry(storyId, {
        display_name: displayName.trim(),
        entry_text: entryText.trim(),
      });

      toast.success('Lore entry created successfully');
      setDisplayName('');
      setEntryText('');
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
      onClose();
    }
  };

  const remainingChars = MAX_ENTRY_TEXT_LENGTH - entryText.length;
  const isNearLimit = remainingChars < 100;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>New Lore Entry</DialogTitle>
          <DialogDescription>
            Create a new lore entry for this story. This will be used by the AI for narrative generation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name</Label>
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
            <Button type="submit" disabled={isSubmitting || !displayName.trim() || !entryText.trim()}>
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
      </DialogContent>
    </Dialog>
  );
}

