/**
 * Entry Point NPCs Tab Component
 * Phase 3: Inline CRUD for NPC bindings to entry points
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { npcBindingsService, type NPCBinding, type NPC, type CreateBindingData, type UpdateBindingData } from '@/services/admin.npcBindings';

interface EntryPointNpcsTabProps {
  entryPointId: string;
  worldId: string;
}

export function EntryPointNpcsTab({ entryPointId, worldId }: EntryPointNpcsTabProps) {
  const [bindings, setBindings] = useState<Array<NPCBinding & { npc_name: string }>>([]);
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBinding, setEditingBinding] = useState<(NPCBinding & { npc_name: string }) | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    loadBindings();
    loadNPCs();
  }, [entryPointId, worldId]);

  const loadBindings = async () => {
    try {
      setLoading(true);
      const data = await npcBindingsService.getEntryBindings(entryPointId);
      setBindings(data);
    } catch (error) {
      toast.error('Failed to load NPC bindings');
    } finally {
      setLoading(false);
    }
  };

  const loadNPCs = async () => {
    try {
      const data = await npcBindingsService.getAvailableNPCs(entryPointId);
      setNpcs(data);
    } catch (error) {
      toast.error('Failed to load NPCs');
    }
  };

  const handleCreateBinding = async (data: CreateBindingData) => {
    try {
      const newBinding = await npcBindingsService.createBinding({
        ...data,
        entry_point_id: entryPointId
      });
      
      // NPC name is already included in the response from the backend
      setBindings(prev => [...prev, newBinding]);
      toast.success('NPC binding created successfully');
      setIsDialogOpen(false);
      
      // Reload available NPCs list since this NPC is no longer available
      await loadNPCs();
    } catch (error) {
      toast.error('Failed to create NPC binding');
    }
  };

  const handleUpdateBinding = async (id: string, data: UpdateBindingData) => {
    try {
      const updatedBinding = await npcBindingsService.updateBinding(id, entryPointId, data);
      
      // Get NPC name for display (it's already included in the response)
      setBindings(prev => prev.map(b => b.id === id ? updatedBinding : b));
      toast.success('NPC binding updated successfully');
      setIsDialogOpen(false);
      
      // Reload available NPCs list since one might have become available
      await loadNPCs();
    } catch (error) {
      toast.error('Failed to update NPC binding');
    }
  };

  const handleDeleteBinding = async (id: string) => {
    if (!confirm('Are you sure you want to delete this NPC binding?')) {
      return;
    }

    try {
      await npcBindingsService.deleteBinding(id, entryPointId);
      setBindings(prev => prev.filter(b => b.id !== id));
      toast.success('NPC binding deleted successfully');
      
      // Reload available NPCs list since this NPC is now available again
      await loadNPCs();
    } catch (error) {
      toast.error('Failed to delete NPC binding');
    }
  };

  const openCreateDialog = () => {
    setEditingBinding(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (binding: NPCBinding & { npc_name: string }) => {
    setEditingBinding(binding);
    setIsDialogOpen(true);
  };

  const getAvailableNPCs = () => {
    const boundNpcIds = bindings.map(b => b.npc_id);
    return npcs.filter(npc => !boundNpcIds.includes(npc.id) || editingBinding?.npc_id === npc.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">NPC Bindings</h2>
          <p className="text-muted-foreground">
            Manage NPCs associated with this entry point
          </p>
        </div>
        <Button onClick={openCreateDialog} disabled={getAvailableNPCs().length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Add NPC Binding
        </Button>
      </div>

      {getAvailableNPCs().length === 0 && npcs.length > 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <div className="text-center">
              <h3 className="text-lg font-medium">All NPCs are bound</h3>
              <p className="text-muted-foreground">
                All available NPCs in this world are already bound to this entry point
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {npcs.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <div className="text-center">
              <h3 className="text-lg font-medium">No NPCs available</h3>
              <p className="text-muted-foreground">
                No NPCs are available in this world yet
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-muted-foreground">Loading NPC bindings...</div>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>NPC Bindings ({bindings.length})</CardTitle>
            <CardDescription>
              NPCs that will appear in this entry point
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bindings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <div className="text-center">
                  <h3 className="text-lg font-medium">No NPC bindings yet</h3>
                  <p className="text-muted-foreground">
                    Add NPCs to make them available in this entry point
                  </p>
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NPC</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bindings.map((binding) => (
                    <TableRow key={binding.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{binding.npc_name}</div>
                          <div className="text-sm text-muted-foreground">
                            ID: {binding.npc_id}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{binding.role_hint}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{binding.weight}</Badge>
                      </TableCell>
                      <TableCell>
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
                            onClick={() => handleDeleteBinding(binding.id)}
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
            )}
          </CardContent>
        </Card>
      )}

      {/* Binding Dialog */}
      <BindingDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        binding={editingBinding}
        npcs={getAvailableNPCs()}
        onSave={editingBinding ? handleUpdateBinding : handleCreateBinding}
      />
    </div>
  );
}

interface BindingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  binding: (NPCBinding & { npc_name: string }) | null;
  npcs: NPC[];
  onSave: (id: string, data: UpdateBindingData) => Promise<void> | ((data: CreateBindingData) => Promise<void>);
}

function BindingDialog({ isOpen, onClose, binding, npcs, onSave }: BindingDialogProps) {
  const [npcId, setNpcId] = useState(binding?.npc_id || '');
  const [roleHint, setRoleHint] = useState(binding?.role_hint || '');
  const [weight, setWeight] = useState(binding?.weight || 1);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);

      const bindingData = {
        npc_id: npcId,
        role_hint: roleHint,
        weight: weight
      };

      if (binding) {
        await (onSave as (id: string, data: UpdateBindingData) => Promise<void>)(binding.id, bindingData);
      } else {
        await (onSave as (data: CreateBindingData) => Promise<void>)(bindingData);
      }
    } catch (error) {
      toast.error('Failed to save NPC binding');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {binding ? 'Edit NPC Binding' : 'Add NPC Binding'}
          </DialogTitle>
          <DialogDescription>
            Configure how this NPC appears in the entry point
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="npc">NPC</Label>
            <Select value={npcId} onValueChange={setNpcId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an NPC" />
              </SelectTrigger>
              <SelectContent>
                {npcs.map(npc => (
                  <SelectItem key={npc.id} value={npc.id}>
                    {npc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role Hint</Label>
            <Input
              id="role"
              value={roleHint}
              onChange={(e) => setRoleHint(e.target.value)}
              placeholder="e.g., quest_giver, merchant, ally"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="weight">Weight</Label>
            <Input
              id="weight"
              type="number"
              value={weight}
              onChange={(e) => setWeight(parseInt(e.target.value) || 1)}
              min="1"
              max="10"
            />
            <p className="text-sm text-muted-foreground">
              Higher weight means this NPC is more likely to appear (1-10)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !npcId || !roleHint}>
            {saving ? 'Saving...' : binding ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

