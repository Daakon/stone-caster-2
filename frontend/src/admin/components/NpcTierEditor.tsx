/**
 * NPC Tier Editor Component
 * Phase 6: Tiered segments editor with CRUD operations
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Edit, Trash2, Copy, ArrowUp, ArrowDown, AlertTriangle, FileText, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { npcSegmentsService, type NPCSegment } from '@/services/admin.npcSegments';

interface NpcTierEditorProps {
  npcId: string;
  segments: Record<number, NPCSegment[]>;
  onSegmentChange: () => void;
  canEdit: boolean;
}

const tierColors = {
  0: 'bg-gray-100 text-gray-800',
  1: 'bg-blue-100 text-blue-800',
  2: 'bg-green-100 text-green-800',
  3: 'bg-purple-100 text-purple-800'
};

const tierLabels = {
  0: 'Baseline',
  1: 'Familiar',
  2: 'Close',
  3: 'Intimate'
};

export default function NpcTierEditor({ npcId, segments, onSegmentChange, canEdit }: NpcTierEditorProps) {
  const [editingSegment, setEditingSegment] = useState<NPCSegment | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<number>(0);
  const [formData, setFormData] = useState({
    content: '',
    version: '1.0.0',
    active: true,
    locale: '',
    kind: 'baseline'
  });

  const handleCreateSegment = async () => {
    try {
      await npcSegmentsService.createNPCSegment({
        ref_id: npcId,
        content: formData.content,
        metadata: {
          tier: selectedTier,
          locale: formData.locale || undefined,
          kind: formData.kind
        },
        version: formData.version,
        active: formData.active
      });
      
      toast.success('Segment created successfully');
      setIsCreateDialogOpen(false);
      resetForm();
      onSegmentChange();
    } catch (error) {
      toast.error('Failed to create segment');
      console.error('Error creating segment:', error);
    }
  };

  const handleUpdateSegment = async () => {
    if (!editingSegment) return;

    try {
      await npcSegmentsService.updateNPCSegment(editingSegment.id, {
        content: formData.content,
        metadata: {
          tier: selectedTier,
          locale: formData.locale || undefined,
          kind: formData.kind
        },
        version: formData.version,
        active: formData.active
      });
      
      toast.success('Segment updated successfully');
      setIsEditDialogOpen(false);
      setEditingSegment(null);
      resetForm();
      onSegmentChange();
    } catch (error) {
      toast.error('Failed to update segment');
      console.error('Error updating segment:', error);
    }
  };

  const handleDeleteSegment = async (segment: NPCSegment) => {
    if (!confirm('Are you sure you want to delete this segment?')) return;

    try {
      await npcSegmentsService.deleteNPCSegment(segment.id);
      toast.success('Segment deleted successfully');
      onSegmentChange();
    } catch (error) {
      toast.error('Failed to delete segment');
      console.error('Error deleting segment:', error);
    }
  };

  const handleCloneSegment = async (segment: NPCSegment, newLocale: string) => {
    try {
      await npcSegmentsService.cloneSegmentToLocale(segment.id, newLocale);
      toast.success('Segment cloned successfully');
      onSegmentChange();
    } catch (error) {
      toast.error('Failed to clone segment');
      console.error('Error cloning segment:', error);
    }
  };

  const handleChangeTier = async (segment: NPCSegment, newTier: number) => {
    try {
      await npcSegmentsService.changeSegmentTier(segment.id, newTier);
      toast.success('Segment tier changed successfully');
      onSegmentChange();
    } catch (error) {
      toast.error('Failed to change segment tier');
      console.error('Error changing tier:', error);
    }
  };

  const openCreateDialog = (tier: number) => {
    setSelectedTier(tier);
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = (segment: NPCSegment) => {
    setEditingSegment(segment);
    setSelectedTier(segment.metadata.tier);
    setFormData({
      content: segment.content,
      version: segment.version,
      active: segment.active,
      locale: segment.metadata.locale || '',
      kind: segment.metadata.kind || 'baseline'
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      content: '',
      version: '1.0.0',
      active: true,
      locale: '',
      kind: 'baseline'
    });
  };

  const getLocaleBadge = (locale?: string) => {
    if (!locale) return null;
    return (
      <Badge variant="outline" className="text-xs">
        <Globe className="h-3 w-3 mr-1" />
        {locale}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Tier 0 - Baseline */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Badge className={tierColors[0]}>Tier 0</Badge>
                {tierLabels[0]}
              </CardTitle>
              <CardDescription>
                Basic character information and core traits
              </CardDescription>
            </div>
            {canEdit && (
              <Button
                size="sm"
                onClick={() => openCreateDialog(0)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Segment
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {segments[0].map((segment) => (
              <div key={segment.id} className="p-3 border rounded-md">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={segment.active ? 'default' : 'secondary'}>
                        {segment.active ? 'Active' : 'Inactive'}
                      </Badge>
                      {getLocaleBadge(segment.metadata.locale)}
                      <span className="text-xs text-muted-foreground">
                        v{segment.version}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{segment.content}</p>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1 ml-4">
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
                        onClick={() => handleDeleteSegment(segment)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {segments[0].length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4" />
                <p>No baseline segments yet</p>
                <p className="text-sm">Add segments to define basic character traits</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tier 1 - Familiar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Badge className={tierColors[1]}>Tier 1</Badge>
                {tierLabels[1]}
              </CardTitle>
              <CardDescription>
                Familiar relationship details and interactions
              </CardDescription>
            </div>
            {canEdit && (
              <Button
                size="sm"
                onClick={() => openCreateDialog(1)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Segment
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {segments[1].map((segment) => (
              <div key={segment.id} className="p-3 border rounded-md">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={segment.active ? 'default' : 'secondary'}>
                        {segment.active ? 'Active' : 'Inactive'}
                      </Badge>
                      {getLocaleBadge(segment.metadata.locale)}
                      <span className="text-xs text-muted-foreground">
                        v{segment.version}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{segment.content}</p>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1 ml-4">
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
                        onClick={() => handleDeleteSegment(segment)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {segments[1].length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4" />
                <p>No familiar segments yet</p>
                <p className="text-sm">Add segments for familiar relationship details</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tier 2 - Close */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Badge className={tierColors[2]}>Tier 2</Badge>
                {tierLabels[2]}
              </CardTitle>
              <CardDescription>
                Close relationship insights and personal details
              </CardDescription>
            </div>
            {canEdit && (
              <Button
                size="sm"
                onClick={() => openCreateDialog(2)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Segment
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {segments[2].map((segment) => (
              <div key={segment.id} className="p-3 border rounded-md">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={segment.active ? 'default' : 'secondary'}>
                        {segment.active ? 'Active' : 'Inactive'}
                      </Badge>
                      {getLocaleBadge(segment.metadata.locale)}
                      <span className="text-xs text-muted-foreground">
                        v{segment.version}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{segment.content}</p>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1 ml-4">
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
                        onClick={() => handleDeleteSegment(segment)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {segments[2].length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4" />
                <p>No close segments yet</p>
                <p className="text-sm">Add segments for close relationship insights</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tier 3 - Intimate */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Badge className={tierColors[3]}>Tier 3</Badge>
                {tierLabels[3]}
              </CardTitle>
              <CardDescription>
                Intimate relationship secrets and deep connections
              </CardDescription>
            </div>
            {canEdit && (
              <Button
                size="sm"
                onClick={() => openCreateDialog(3)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Segment
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {segments[3].map((segment) => (
              <div key={segment.id} className="p-3 border rounded-md">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={segment.active ? 'default' : 'secondary'}>
                        {segment.active ? 'Active' : 'Inactive'}
                      </Badge>
                      {getLocaleBadge(segment.metadata.locale)}
                      <span className="text-xs text-muted-foreground">
                        v{segment.version}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{segment.content}</p>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1 ml-4">
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
                        onClick={() => handleDeleteSegment(segment)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {segments[3].length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4" />
                <p>No intimate segments yet</p>
                <p className="text-sm">Add segments for intimate relationship details</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create Segment Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Segment</DialogTitle>
            <DialogDescription>
              Add a new segment for tier {selectedTier}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                rows={4}
                placeholder="Enter segment content..."
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="version">Version</Label>
                <Input
                  id="version"
                  value={formData.version}
                  onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                  placeholder="1.0.0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="locale">Locale (optional)</Label>
                <Input
                  id="locale"
                  value={formData.locale}
                  onChange={(e) => setFormData(prev => ({ ...prev, locale: e.target.value }))}
                  placeholder="en, es, fr..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kind">Kind</Label>
              <Select
                value={formData.kind}
                onValueChange={(value) => setFormData(prev => ({ ...prev, kind: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baseline">Baseline</SelectItem>
                  <SelectItem value="behavior">Behavior</SelectItem>
                  <SelectItem value="secret">Secret</SelectItem>
                  <SelectItem value="dialogue">Dialogue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSegment} disabled={!formData.content.trim()}>
              Create Segment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Segment Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Segment</DialogTitle>
            <DialogDescription>
              Update segment details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-content">Content</Label>
              <Textarea
                id="edit-content"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                rows={4}
                placeholder="Enter segment content..."
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-version">Version</Label>
                <Input
                  id="edit-version"
                  value={formData.version}
                  onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                  placeholder="1.0.0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-locale">Locale (optional)</Label>
                <Input
                  id="edit-locale"
                  value={formData.locale}
                  onChange={(e) => setFormData(prev => ({ ...prev, locale: e.target.value }))}
                  placeholder="en, es, fr..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-kind">Kind</Label>
              <Select
                value={formData.kind}
                onValueChange={(value) => setFormData(prev => ({ ...prev, kind: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baseline">Baseline</SelectItem>
                  <SelectItem value="behavior">Behavior</SelectItem>
                  <SelectItem value="secret">Secret</SelectItem>
                  <SelectItem value="dialogue">Dialogue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSegment} disabled={!formData.content.trim()}>
              Update Segment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
