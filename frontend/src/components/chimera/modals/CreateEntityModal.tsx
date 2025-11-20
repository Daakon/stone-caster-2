/**
 * Create Entity Modal
 * Phase 2: Creator Tools - Frontend
 * Modal for creating new entity templates and linking them to stories
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { chimeraEntitiesService } from '@/services/chimera.entities';
import { chimeraStoriesService } from '@/services/chimera.stories';

type EntityType = 'NPC' | 'ITEM' | 'LOCATION';

interface CreateEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  storyId: string;
  onSuccess?: () => void;
}

export function CreateEntityModal({ isOpen, onClose, storyId, onSuccess }: CreateEntityModalProps) {
  const [name, setName] = useState('');
  const [entityType, setEntityType] = useState<EntityType>('NPC');
  const [dataJson, setDataJson] = useState('{}');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateJson = (jsonString: string): boolean => {
    try {
      JSON.parse(jsonString);
      setJsonError(null);
      return true;
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'Invalid JSON');
      return false;
    }
  };

  const handleJsonBlur = () => {
    if (dataJson.trim()) {
      validateJson(dataJson);
    } else {
      setJsonError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    if (!dataJson.trim()) {
      toast.error('Data JSON is required');
      return;
    }

    if (!validateJson(dataJson)) {
      toast.error('Please fix JSON errors before submitting');
      return;
    }

    setIsSubmitting(true);
    try {
      // Parse the JSON to ensure it's valid
      const parsedData = JSON.parse(dataJson);

      // Step 1: Create the entity template
      const entity = await chimeraEntitiesService.createEntityTemplate({
        display_name: name.trim(),
        description_short: null,
        entity_type: entityType,
        base_state_json: parsedData,
      });

      // Step 2: Link the entity to the story
      await chimeraStoriesService.linkEntityToStory(storyId, entity.id);

      toast.success('Entity created and linked to story successfully');
      setName('');
      setEntityType('NPC');
      setDataJson('{}');
      setJsonError(null);
      onClose();
      onSuccess?.();
    } catch (error) {
      console.error('Error creating entity:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create entity');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setName('');
      setEntityType('NPC');
      setDataJson('{}');
      setJsonError(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>New Element</DialogTitle>
          <DialogDescription>
            Create a new entity template and link it to this story. The JSON data will be validated by the compiler.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="entity-name">Name</Label>
            <Input
              id="entity-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Ancient Sword of Power"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="entity-type">Type</Label>
            <Select value={entityType} onValueChange={(value) => setEntityType(value as EntityType)} disabled={isSubmitting}>
              <SelectTrigger id="entity-type">
                <SelectValue placeholder="Select entity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NPC">Character</SelectItem>
                <SelectItem value="ITEM">Item</SelectItem>
                <SelectItem value="LOCATION">Location</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="entity-data">Data (JSON)</Label>
            <Textarea
              id="entity-data"
              value={dataJson}
              onChange={(e) => {
                setDataJson(e.target.value);
                // Clear error on change, validate on blur
                if (jsonError) {
                  setJsonError(null);
                }
              }}
              onBlur={handleJsonBlur}
              placeholder='{"name": "Example", "properties": {}}'
              className="min-h-[250px] font-mono text-sm"
              disabled={isSubmitting}
              required
            />
            {jsonError && (
              <p className="text-sm text-destructive" role="alert">
                JSON Error: {jsonError}
              </p>
            )}
            {!jsonError && dataJson.trim() && (
              <p className="text-sm text-muted-foreground">Valid JSON</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !name.trim() || !dataJson.trim() || !!jsonError}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Element'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

