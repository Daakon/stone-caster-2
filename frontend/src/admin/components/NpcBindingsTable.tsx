/**
 * NPC Bindings Table Component
 * Phase 6: Table for managing NPC bindings to entry points
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Edit, Trash2, Link, AlertTriangle, Globe, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { npcBindingsService, type NPCBinding } from '@/services/admin.npcBindings';

interface NpcBindingsTableProps {
  npcId: string;
  bindings: NPCBinding[];
  onBindingChange: () => void;
  canEdit: boolean;
}

export default function NpcBindingsTable({ npcId, bindings, onBindingChange, canEdit }: NpcBindingsTableProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingBinding, setEditingBinding] = useState<NPCBinding | null>(null);
  const [entryPoints, setEntryPoints] = useState<Array<{ id: string; title: string; type: string; world_id: string }>>([]);
  const [formData, setFormData] = useState({
    entry_point_id: '',
    role_hint: '',
    weight: 1
  });

  useEffect(() => {
    loadEntryPoints();
  }, [npcId]);

  const loadEntryPoints = async () => {
    try {
      const entryPointsData = await npcBindingsService.getEntryPointsForNPC(npcId);
      setEntryPoints(entryPointsData);
    } catch (error) {
      console.error('Error loading entry points:', error);
    }
  };

  const handleCreateBinding = async () => {
    try {
      await npcBindingsService.createNPCBinding({
        entry_point_id: formData.entry_point_id,
        npc_id: npcId,
        role_hint: formData.role_hint,
        weight: formData.weight
      });
      
      toast.success('Binding created successfully');
      setIsCreateDialogOpen(false);
      resetForm();
      onBindingChange();
    } catch (error) {
      toast.error('Failed to create binding');
      console.error('Error creating binding:', error);
    }
  };

  const handleUpdateBinding = async () => {
    if (!editingBinding) return;

    try {
      await npcBindingsService.updateNPCBinding(editingBinding.id, {
        role_hint: formData.role_hint,
        weight: formData.weight
      });
      
      toast.success('Binding updated successfully');
      setIsEditDialogOpen(false);
      setEditingBinding(null);
      resetForm();
      onBindingChange();
    } catch (error) {
      toast.error('Failed to update binding');
      console.error('Error updating binding:', error);
    }
  };

  const handleDeleteBinding = async (binding: NPCBinding) => {
    if (!confirm('Are you sure you want to delete this binding?')) return;

    try {
      await npcBindingsService.deleteNPCBinding(binding.id);
      toast.success('Binding deleted successfully');
      onBindingChange();
    } catch (error) {
      toast.error('Failed to delete binding');
      console.error('Error deleting binding:', error);
    }
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = (binding: NPCBinding) => {
    setEditingBinding(binding);
    setFormData({
      entry_point_id: binding.entry_point_id,
      role_hint: binding.role_hint,
      weight: binding.weight
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      entry_point_id: '',
      role_hint: '',
      weight: 1
    });
  };

  const getEntryPointTitle = (entryPointId: string) => {
    const entryPoint = entryPoints.find(ep => ep.id === entryPointId);
    return entryPoint ? `${entryPoint.title} (${entryPoint.type})` : 'Unknown Entry Point';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>NPC Bindings</CardTitle>
            <CardDescription>
              Manage NPC associations with entry points
            </CardDescription>
          </div>
          {canEdit && (
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Binding
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {bindings.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entry Point</TableHead>
                <TableHead>Role Hint</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>World</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bindings.map((binding) => (
                <TableRow key={binding.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{binding.entry_point_title}</div>
                        <div className="text-sm text-muted-foreground">
                          {binding.entry_point_type}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{binding.role_hint}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">{binding.weight}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{binding.world_id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {canEdit && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(binding)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteBinding(binding)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Link className="h-12 w-12 mx-auto mb-4" />
            <p>No bindings yet</p>
            <p className="text-sm">Add bindings to associate this NPC with entry points</p>
          </div>
        )}
      </CardContent>

      {/* Create Binding Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Binding</DialogTitle>
            <DialogDescription>
              Associate this NPC with an entry point
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="entry-point">Entry Point</Label>
              <Select
                value={formData.entry_point_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, entry_point_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select entry point" />
                </SelectTrigger>
                <SelectContent>
                  {entryPoints.map((entryPoint) => (
                    <SelectItem key={entryPoint.id} value={entryPoint.id}>
                      {entryPoint.title} ({entryPoint.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-hint">Role Hint</Label>
              <Input
                id="role-hint"
                value={formData.role_hint}
                onChange={(e) => setFormData(prev => ({ ...prev, role_hint: e.target.value }))}
                placeholder="e.g., Mentor, Guide, Companion"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">Weight</Label>
              <Input
                id="weight"
                type="number"
                min="1"
                max="10"
                value={formData.weight}
                onChange={(e) => setFormData(prev => ({ ...prev, weight: parseInt(e.target.value) || 1 }))}
              />
              <p className="text-xs text-muted-foreground">
                Higher weight means more prominent role (1-10)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBinding} disabled={!formData.entry_point_id || !formData.role_hint}>
              Create Binding
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Binding Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Binding</DialogTitle>
            <DialogDescription>
              Update binding details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Entry Point</Label>
              <div className="p-3 bg-muted rounded-md">
                <div className="font-medium">{getEntryPointTitle(formData.entry_point_id)}</div>
                <div className="text-sm text-muted-foreground">Cannot be changed</div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role-hint">Role Hint</Label>
              <Input
                id="edit-role-hint"
                value={formData.role_hint}
                onChange={(e) => setFormData(prev => ({ ...prev, role_hint: e.target.value }))}
                placeholder="e.g., Mentor, Guide, Companion"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-weight">Weight</Label>
              <Input
                id="edit-weight"
                type="number"
                min="1"
                max="10"
                value={formData.weight}
                onChange={(e) => setFormData(prev => ({ ...prev, weight: parseInt(e.target.value) || 1 }))}
              />
              <p className="text-xs text-muted-foreground">
                Higher weight means more prominent role (1-10)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateBinding} disabled={!formData.role_hint}>
              Update Binding
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}


