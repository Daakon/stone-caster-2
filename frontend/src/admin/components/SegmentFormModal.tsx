/**
 * Segment Form Modal Component
 * Phase 4: Create/edit prompt segments with validation and duplicate detection
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { segmentsService, type PromptSegment, type CreateSegmentData, type UpdateSegmentData } from '@/services/admin.segments';
import { refsService, type RefItem } from '@/services/admin.refs';
import { SegmentMetadataEditor } from './SegmentMetadataEditor';
import { RefIdPicker } from './RefIdPicker';
import { useAppRoles } from '@/admin/routeGuard';

const segmentSchema = z.object({
  scope: z.enum(['core', 'ruleset', 'world', 'entry', 'entry_start', 'npc', 'game_state', 'player', 'rng', 'input']),
  ref_id: z.string().optional(),
  content: z.string().min(1, 'Content is required'),
  version: z.string().min(1, 'Version is required'),
  active: z.boolean(),
  metadata: z.record(z.any())
});

type SegmentFormData = z.infer<typeof segmentSchema>;

interface SegmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  segment?: PromptSegment | null;
  onSave: () => void;
}

export function SegmentFormModal({ isOpen, onClose, segment, onSave }: SegmentFormModalProps) {
  const { isCreator, isModerator, isAdmin } = useAppRoles();
  const [loading, setLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [refKind, setRefKind] = useState<'world' | 'ruleset' | 'entry' | 'npc' | 'none'>('none');
  const [selectedRefId, setSelectedRefId] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<SegmentFormData>({
    resolver: zodResolver(segmentSchema),
    defaultValues: {
      scope: segment?.scope || 'core',
      ref_id: segment?.ref_id || '',
      content: segment?.content || '',
      version: segment?.version || '1.0.0',
      active: segment?.active ?? true,
      metadata: segment?.metadata || {}
    }
  });

  const watchedScope = watch('scope');
  const watchedContent = watch('content');

  // Update ref kind when scope changes
  useEffect(() => {
    const scopeToRefKind = {
      core: 'none',
      ruleset: 'ruleset',
      world: 'world',
      entry: 'entry',
      entry_start: 'entry',
      npc: 'npc',
      game_state: 'none',
      player: 'none',
      rng: 'none',
      input: 'none'
    };

    const newRefKind = scopeToRefKind[watchedScope] || 'none';
    setRefKind(newRefKind);
    
    if (newRefKind === 'none') {
      setValue('ref_id', '');
      setSelectedRefId('');
    }
  }, [watchedScope, setValue]);

  // Check for duplicates when content changes
  useEffect(() => {
    if (watchedContent && watchedContent.length > 10) {
      checkForDuplicates();
    }
  }, [watchedContent]);

  const checkForDuplicates = async () => {
    try {
      const contentHash = segmentsService.computeContentHash(watchedContent);
      const duplicates = await segmentsService.findNearDuplicates({
        scope: watchedScope,
        refId: selectedRefId || undefined,
        contentHash,
        excludeId: segment?.id
      });

      setDuplicates(duplicates);
      setShowDuplicateWarning(duplicates.length > 0);
    } catch (error) {
      console.error('Error checking duplicates:', error);
    }
  };

  const handleRefIdChange = (refId: string) => {
    setSelectedRefId(refId);
    setValue('ref_id', refId);
  };

  const onSubmit = async (data: SegmentFormData) => {
    try {
      setLoading(true);

      if (segment) {
        await segmentsService.updateSegment(segment.id, data as UpdateSegmentData);
        toast.success('Segment updated successfully');
      } else {
        await segmentsService.createSegment(data as CreateSegmentData);
        toast.success('Segment created successfully');
      }

      onSave();
    } catch (error) {
      toast.error('Failed to save segment');
      console.error('Error saving segment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    setDuplicates([]);
    setShowDuplicateWarning(false);
    setRefKind('none');
    setSelectedRefId('');
    onClose();
  };

  const getScopeDescription = (scope: string) => {
    const descriptions = {
      core: 'System-wide prompts available everywhere',
      ruleset: 'Ruleset-specific prompts',
      world: 'World-level prompts for all content in a world',
      entry: 'Entry point main prompts',
      entry_start: 'Entry point start prompts',
      npc: 'NPC-specific prompts',
      game_state: 'Game state prompts',
      player: 'Player-specific prompts',
      rng: 'Random number generation prompts',
      input: 'Input processing prompts'
    };

    return descriptions[scope as keyof typeof descriptions] || '';
  };

  const isRefIdRequired = () => {
    return ['ruleset', 'world', 'entry', 'entry_start', 'npc'].includes(watchedScope);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {segment ? 'Edit Segment' : 'Create Segment'}
          </DialogTitle>
          <DialogDescription>
            {getScopeDescription(watchedScope)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Duplicate Warning */}
          {showDuplicateWarning && duplicates.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">Possible duplicate content detected:</p>
                  <div className="space-y-1">
                    {duplicates.slice(0, 3).map((dup, index) => (
                      <div key={index} className="text-sm text-muted-foreground">
                        • {dup.content.substring(0, 100)}...
                      </div>
                    ))}
                  </div>
                  <p className="text-sm">Continue anyway?</p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Scope */}
              <div className="space-y-2">
                <Label htmlFor="scope">Scope *</Label>
                <Select
                  value={watchedScope}
                  onValueChange={(value) => setValue('scope', value as any)}
                  disabled={!!segment} // Lock scope after creation
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="core">Core</SelectItem>
                    <SelectItem value="ruleset">Ruleset</SelectItem>
                    <SelectItem value="world">World</SelectItem>
                    <SelectItem value="entry">Entry</SelectItem>
                    <SelectItem value="entry_start">Entry Start</SelectItem>
                    <SelectItem value="npc">NPC</SelectItem>
                    <SelectItem value="game_state">Game State</SelectItem>
                    <SelectItem value="player">Player</SelectItem>
                    <SelectItem value="rng">RNG</SelectItem>
                    <SelectItem value="input">Input</SelectItem>
                  </SelectContent>
                </Select>
                {errors.scope && (
                  <p className="text-sm text-red-500">{errors.scope.message}</p>
                )}
              </div>

              {/* Reference ID */}
              {refKind !== 'none' && (
                <div className="space-y-2">
                  <Label htmlFor="ref_id">Reference *</Label>
                  <RefIdPicker
                    refKind={refKind}
                    value={selectedRefId}
                    onChange={handleRefIdChange}
                    required={isRefIdRequired()}
                  />
                  {errors.ref_id && (
                    <p className="text-sm text-red-500">{errors.ref_id.message}</p>
                  )}
                </div>
              )}

              {/* Version */}
              <div className="space-y-2">
                <Label htmlFor="version">Version *</Label>
                <Input
                  id="version"
                  {...register('version')}
                  placeholder="1.0.0"
                />
                {errors.version && (
                  <p className="text-sm text-red-500">{errors.version.message}</p>
                )}
              </div>

              {/* Active */}
              <div className="space-y-2">
                <Label htmlFor="active">Active</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={watch('active')}
                    onCheckedChange={(checked) => setValue('active', checked)}
                  />
                  <Label htmlFor="active">
                    {watch('active') ? 'Active' : 'Inactive'}
                  </Label>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Content */}
              <div className="space-y-2">
                <Label htmlFor="content">Content *</Label>
                <Textarea
                  id="content"
                  {...register('content')}
                  placeholder="Enter prompt content..."
                  rows={8}
                  className="font-mono text-sm"
                />
                {errors.content && (
                  <p className="text-sm text-red-500">{errors.content.message}</p>
                )}
              </div>

              {/* Metadata */}
              <div className="space-y-2">
                <Label htmlFor="metadata">Metadata</Label>
                <SegmentMetadataEditor
                  value={watch('metadata')}
                  onChange={(metadata) => setValue('metadata', metadata)}
                  scope={watchedScope}
                />
              </div>
            </div>
          </div>

          {/* Role-based restrictions */}
          {isCreator && !['entry', 'entry_start'].includes(watchedScope) && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                As a creator, you can only create segments for entry and entry_start scopes. 
                Other scopes require moderator or admin permissions.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : segment ? 'Update Segment' : 'Create Segment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
