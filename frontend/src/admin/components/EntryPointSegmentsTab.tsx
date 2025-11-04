/**
 * Entry Point Segments Tab Component
 * Phase 3: Inline CRUD for prompt segments scoped to entry points
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import { segmentsService, type PromptSegment, type CreateSegmentData, type UpdateSegmentData } from '@/services/admin.segments';

interface EntryPointSegmentsTabProps {
  entryPointId: string;
}

export function EntryPointSegmentsTab({ entryPointId }: EntryPointSegmentsTabProps) {
  const [segments, setSegments] = useState<PromptSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSegment, setEditingSegment] = useState<PromptSegment | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [scope, setScope] = useState<'entry' | 'entry_start'>('entry');

  useEffect(() => {
    loadSegments();
  }, [entryPointId]);

  const loadSegments = async () => {
    try {
      setLoading(true);
      const data = await segmentsService.getEntrySegments(entryPointId);
      setSegments(data);
    } catch (error) {
      toast.error('Failed to load segments');
      console.error('Error loading segments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSegment = async (data: CreateSegmentData) => {
    try {
      const newSegment = await segmentsService.createSegment({
        ...data,
        ref_id: entryPointId
      });
      setSegments(prev => [...prev, newSegment]);
      toast.success('Segment created successfully');
      setIsDialogOpen(false);
    } catch (error) {
      toast.error('Failed to create segment');
      console.error('Error creating segment:', error);
    }
  };

  const handleUpdateSegment = async (id: string, data: UpdateSegmentData) => {
    try {
      const updatedSegment = await segmentsService.updateSegment(id, data);
      setSegments(prev => prev.map(s => s.id === id ? updatedSegment : s));
      toast.success('Segment updated successfully');
      setIsDialogOpen(false);
    } catch (error) {
      toast.error('Failed to update segment');
      console.error('Error updating segment:', error);
    }
  };

  const handleDeleteSegment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this segment?')) {
      return;
    }

    try {
      await segmentsService.deleteSegment(id);
      setSegments(prev => prev.filter(s => s.id !== id));
      toast.success('Segment deleted successfully');
    } catch (error) {
      toast.error('Failed to delete segment');
      console.error('Error deleting segment:', error);
    }
  };

  const handleToggleActive = async (id: string) => {
    try {
      const updatedSegment = await segmentsService.toggleSegmentActive(id);
      setSegments(prev => prev.map(s => s.id === id ? updatedSegment : s));
      toast.success(`Segment ${updatedSegment.active ? 'activated' : 'deactivated'}`);
    } catch (error) {
      toast.error('Failed to toggle segment');
      console.error('Error toggling segment:', error);
    }
  };

  const openCreateDialog = (selectedScope: 'entry' | 'entry_start') => {
    setScope(selectedScope);
    setEditingSegment(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (segment: PromptSegment) => {
    setScope(segment.scope);
    setEditingSegment(segment);
    setIsDialogOpen(true);
  };

  const groupedSegments = segments.reduce((acc, segment) => {
    if (!acc[segment.scope]) {
      acc[segment.scope] = [];
    }
    acc[segment.scope].push(segment);
    return acc;
  }, {} as Record<string, PromptSegment[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Prompt Segments</h2>
          <p className="text-muted-foreground">
            Manage prompt segments for this entry point
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => openCreateDialog('entry')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Entry Segment
          </Button>
          <Button onClick={() => openCreateDialog('entry_start')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Entry Start Segment
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-muted-foreground">Loading segments...</div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedSegments).map(([scope, scopeSegments]) => (
            <Card key={scope}>
              <CardHeader>
                <CardTitle className="capitalize">{scope.replace('_', ' ')} Segments</CardTitle>
                <CardDescription>
                  {scopeSegments.length} segment{scopeSegments.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Content</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scopeSegments.map((segment) => (
                      <TableRow key={segment.id}>
                        <TableCell>
                          <div className="max-w-md">
                            <div className="font-medium text-sm">
                              {segment.content.substring(0, 100)}
                              {segment.content.length > 100 && '...'}
                            </div>
                            {segment.metadata.kind && (
                              <Badge variant="outline" className="mt-1">
                                {segment.metadata.kind}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{segment.version}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {segment.active ? (
                              <ToggleRight className="h-4 w-4 text-green-500" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-gray-400" />
                            )}
                            <span className="text-sm">
                              {segment.active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(segment.updated_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(segment)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(segment.id)}
                            >
                              {segment.active ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSegment(segment.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}

          {segments.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <div className="text-center">
                  <h3 className="text-lg font-medium">No segments yet</h3>
                  <p className="text-muted-foreground">
                    Create your first prompt segment to get started
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Segment Dialog */}
      <SegmentDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        segment={editingSegment}
        scope={scope}
        onSave={editingSegment ? handleUpdateSegment : handleCreateSegment}
      />
    </div>
  );
}

interface SegmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  segment: PromptSegment | null;
  scope: 'entry' | 'entry_start';
  onSave: (id: string, data: UpdateSegmentData) => Promise<void> | ((data: CreateSegmentData) => Promise<void>);
}

function SegmentDialog({ isOpen, onClose, segment, scope, onSave }: SegmentDialogProps) {
  const [content, setContent] = useState(segment?.content || '');
  const [version, setVersion] = useState(segment?.version || '1.0.0');
  const [active, setActive] = useState(segment?.active ?? true);
  const [metadata, setMetadata] = useState(segment?.metadata || {});
  const [metadataJson, setMetadataJson] = useState(JSON.stringify(metadata, null, 2));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);

      const segmentData = {
        scope,
        content,
        version,
        active,
        metadata: JSON.parse(metadataJson)
      };

      if (segment) {
        await (onSave as (id: string, data: UpdateSegmentData) => Promise<void>)(segment.id, segmentData);
      } else {
        await (onSave as (data: CreateSegmentData) => Promise<void>)(segmentData);
      }
    } catch (error) {
      toast.error('Failed to save segment');
      console.error('Error saving segment:', error);
    } finally {
      setSaving(false);
    }
  };

  const validateMetadata = (json: string) => {
    try {
      JSON.parse(json);
      return true;
    } catch {
      return false;
    }
  };

  const isValidMetadata = validateMetadata(metadataJson);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {segment ? 'Edit Segment' : 'Create Segment'}
          </DialogTitle>
          <DialogDescription>
            {scope === 'entry' ? 'Main entry point prompt' : 'Entry start prompt'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter the prompt content..."
              rows={6}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="active">Active</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={active}
                  onCheckedChange={setActive}
                />
                <Label htmlFor="active">{active ? 'Active' : 'Inactive'}</Label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="metadata">Metadata (JSON)</Label>
            <Textarea
              id="metadata"
              value={metadataJson}
              onChange={(e) => setMetadataJson(e.target.value)}
              placeholder='{"kind": "main", "tier": "standard", "locale": "en-US"}'
              rows={4}
              className={!isValidMetadata ? 'border-red-500' : ''}
            />
            {!isValidMetadata && (
              <p className="text-sm text-red-500">Invalid JSON format</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !isValidMetadata}>
            {saving ? 'Saving...' : segment ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}













