import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Users, AlertCircle } from 'lucide-react';
import { type EntryPoint } from '@/services/admin.entryPoints';
import { type WizardData } from '../EntryWizard';
import { npcsService } from '@/services/admin.npcs';
import { useQuery } from '@tanstack/react-query';
import { useNPCPacks } from '@/hooks/useNPCPacks';
import { CreateNPCDialog } from '@/admin/components/CreateNPCDialog';
import { useWorlds } from '@/hooks/useWorlds';
import { npcBindingsService } from '@/services/admin.npcBindings';
import { entryLinksService } from '@/services/admin.entryLinks';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const npcsSchema = z.object({
  npcIds: z.array(z.string()),
  packIds: z.array(z.string()),
});

type NPCsFormData = z.infer<typeof npcsSchema>;

interface NPCsStepProps {
  entry: EntryPoint;
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  onComplete: (stepData: any) => void;
}

export function NPCsStep({ entry, data, onUpdate, onComplete }: NPCsStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedNPCs, setSelectedNPCs] = useState<string[]>(data.npcIds || []);
  const [selectedPacks, setSelectedPacks] = useState<string[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  
  // Use admin NPCs service to get all NPCs with world_id
  const { data: npcsData, isLoading: npcsLoading } = useQuery({
    queryKey: ['admin-npcs', 'all'],
    queryFn: async () => {
      const result = await npcsService.listNPCs({}, 1, 1000); // Get all NPCs
      return result.data || [];
    },
  });
  const npcs = npcsData || [];
  const { npcPacks, loading: packsLoading } = useNPCPacks();
  const { worlds } = useWorlds();
  
  // Get the selected world ID from entry or wizard data
  const selectedWorldId = data.worldId || entry.world_id || '';
  
  // Get world name for display
  const selectedWorld = worlds?.find((w: { id: string }) => w.id === selectedWorldId);
  const worldName = selectedWorld?.name || 'Unknown World';
  
  const form = useForm<NPCsFormData>({
    resolver: zodResolver(npcsSchema),
    defaultValues: {
      npcIds: data.npcIds || [],
      packIds: [],
    },
  });
  
  const { handleSubmit, setValue, formState: { isValid } } = form;
  
  // Load existing NPC bindings and packs on mount
  useEffect(() => {
    const loadExistingBindings = async () => {
      try {
        // Load NPC bindings
        const bindings = await npcBindingsService.getEntryBindings(entry.id);
        const boundNpcIds = bindings.map(b => b.npc_id);
        if (boundNpcIds.length > 0) {
          setSelectedNPCs(boundNpcIds);
          setValue('npcIds', boundNpcIds);
          onUpdate({ npcIds: boundNpcIds });
        }
        
        // Load NPC pack associations
        try {
          const packLinks = await entryLinksService.getEntryNPCPacks(entry.id);
          const packIds = packLinks.map(link => link.pack_id);
          if (packIds.length > 0) {
            setSelectedPacks(packIds);
            setValue('packIds', packIds);
            onUpdate({ packIds });
          }
        } catch (packError) {
          // If no packs, that's fine
          console.debug('No existing NPC pack associations found:', packError);
        }
      } catch (error) {
        // If bindings don't exist yet, that's fine - just use empty array
        console.debug('No existing NPC bindings found:', error);
      }
    };
    
    loadExistingBindings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id]);
  
  // Sync selected NPCs when wizard data changes (e.g., when world changes and NPCs are cleared)
  useEffect(() => {
    const wizardNpcIds = data.npcIds || [];
    if (JSON.stringify(wizardNpcIds) !== JSON.stringify(selectedNPCs)) {
      setSelectedNPCs(wizardNpcIds);
      setValue('npcIds', wizardNpcIds);
    }
  }, [data.npcIds, setValue]); // Note: selectedNPCs intentionally excluded to avoid loops
  
  // Track previous world ID to detect changes
  const previousWorldIdRef = useRef<string | undefined>(selectedWorldId);
  
  // Clear NPCs when world changes - MUST filter by selected world
  useEffect(() => {
    // If world changed and we have selected NPCs, clear them
    if (previousWorldIdRef.current && previousWorldIdRef.current !== selectedWorldId && selectedNPCs.length > 0) {
      // World changed - clear all NPCs
      setSelectedNPCs([]);
      setValue('npcIds', []);
      onUpdate({ npcIds: [] });
      toast.warning('World changed - all NPCs have been cleared. Please select NPCs from the new world.');
    }
    
    // Update the ref to track current world
    previousWorldIdRef.current = selectedWorldId;
  }, [selectedWorldId, setValue, onUpdate]); // Note: selectedNPCs intentionally excluded to avoid loops
  
  // Filter NPCs by world - STRICT: only show NPCs from the selected world
  const npcsArray = Array.isArray(npcs) ? npcs : [];
  const filteredNPCs = npcsArray.filter(npc => {
    if (!selectedWorldId) {
      // If no world is selected, don't show any NPCs
      return false;
    }
    // STRICT: Only show NPCs that belong to the selected world (must have matching world_id)
    return npc.world_id === selectedWorldId;
  });
  
  // Filter NPC Packs by world - ensure npcPacks is an array
  const packsArray = Array.isArray(npcPacks) ? npcPacks : [];
  const filteredPacks = packsArray.filter(() => {
    if (!selectedWorldId) return true;
    // TODO: Add world filtering logic when pack-world relationship is established
    return true;
  });
  
  const handleNPCToggle = (npcId: string, checked: boolean) => {
    // STRICT: Verify the NPC belongs to the selected world before allowing selection
    if (checked) {
      if (!selectedWorldId) {
        toast.error('Please select a world in the Basics step first');
        return;
      }
      
      const npc = npcsArray.find(n => n.id === npcId);
      if (!npc) {
        toast.error('NPC not found');
        return;
      }
      
      // STRICT: NPC must have a world_id and it must match the selected world
      if (!npc.world_id || npc.world_id !== selectedWorldId) {
        toast.error(`This NPC belongs to a different world and cannot be selected`);
        return;
      }
    }
    
    const newSelection = checked 
      ? [...selectedNPCs, npcId]
      : selectedNPCs.filter(id => id !== npcId);
    
    setSelectedNPCs(newSelection);
    setValue('npcIds', newSelection);
    onUpdate({ npcIds: newSelection });
  };
  
  const handlePackToggle = (packId: string, checked: boolean) => {
    const newSelection = checked 
      ? [...selectedPacks, packId]
      : selectedPacks.filter(id => id !== packId);
    
    setSelectedPacks(newSelection);
    setValue('packIds', newSelection);
  };
  
  const onSubmit = async (formData: NPCsFormData) => {
    setIsSubmitting(true);
    
    try {
      // Save NPC bindings
      const currentBindings = await npcBindingsService.getEntryBindings(entry.id);
      const currentNpcIds = new Set(currentBindings.map(b => b.npc_id));
      const newNpcIds = new Set(formData.npcIds || []);
      
      // Find NPCs to add (in new selection but not in current)
      const npcsToAdd = formData.npcIds?.filter(id => !currentNpcIds.has(id)) || [];
      
      // Find NPCs to remove (in current but not in new selection)
      const npcsToRemove = currentBindings.filter(b => !newNpcIds.has(b.npc_id));
      
      // Create new bindings
      for (const npcId of npcsToAdd) {
        await npcBindingsService.createBinding({
          entry_point_id: entry.id,
          npc_id: npcId,
          role_hint: 'character', // Default role hint
          weight: 1, // Default weight
        });
      }
      
      // Delete removed bindings
      for (const binding of npcsToRemove) {
        await npcBindingsService.deleteBinding(binding.id, entry.id);
      }
      
      // Save NPC pack associations
      // Note: EntryLinksService uses entry_id which should be the same as entry_point_id
      await entryLinksService.updateEntryNPCPacks(entry.id, formData.packIds || []);
      
      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['admin-entry', entry.id] });
      await queryClient.invalidateQueries({ queryKey: ['npc-bindings', entry.id] });
      
      toast.success('NPC bindings and packs saved successfully');
      
      onUpdate({ npcIds: formData.npcIds, packIds: formData.packIds });
      onComplete(formData);
    } catch (error) {
      console.error('Failed to save NPC bindings/packs:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save NPC bindings and packs');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Individual NPCs */}
      {!selectedWorldId ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>World selection required:</strong> Please select a world in the Basics step before selecting NPCs.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Individual NPCs ({worldName})
                </CardTitle>
                <CardDescription>
                  Select NPCs from {worldName} to include in this story
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                New NPC
              </Button>
            </div>
          </CardHeader>
        <CardContent>
          {npcsLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Loading NPCs...</p>
            </div>
          ) : filteredNPCs.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {selectedWorldId 
                  ? `No NPCs found for ${worldName}. Create some NPCs for this world first.`
                  : 'No NPCs found. Please select a world in the Basics step first.'}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Select</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNPCs.map((npc) => {
                    // STRICT: Only NPCs from the selected world are shown, so all should be selectable
                    const belongsToWorld = npc.world_id === selectedWorldId;
                    const isDisabled = !selectedWorldId || !belongsToWorld;
                    
                    return (
                      <TableRow key={npc.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedNPCs.includes(npc.id)}
                            disabled={isDisabled}
                            onCheckedChange={(checked) => 
                              handleNPCToggle(npc.id, checked as boolean)
                            }
                          />
                        </TableCell>
                        <TableCell className="font-medium">{npc.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {npc.description || 'No description'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={npc.status === 'active' ? 'default' : 'secondary'}>
                            {npc.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        </Card>
      )}
      
      {/* NPC Packs */}
      <Card>
        <CardHeader>
          <CardTitle>NPC Packs</CardTitle>
          <CardDescription>
            Select NPC packs to include all NPCs in the pack
          </CardDescription>
        </CardHeader>
        <CardContent>
          {packsLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Loading packs...</p>
            </div>
          ) : filteredPacks.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No NPC packs found. Create some packs first or adjust your filters.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Select</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPacks.map((pack) => (
                    <TableRow key={pack.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedPacks.includes(pack.id)}
                          onCheckedChange={(checked) => 
                            handlePackToggle(pack.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">{pack.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {pack.description || 'No description'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={pack.status === 'active' ? 'default' : 'secondary'}>
                          {pack.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Selection Summary</CardTitle>
          <CardDescription>
            Review your NPC selections
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">Individual NPCs:</span>
              <Badge variant="outline">{selectedNPCs.length} selected</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">NPC Packs:</span>
              <Badge variant="outline">{selectedPacks.length} selected</Badge>
            </div>
            {selectedNPCs.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium mb-1">Selected NPCs:</p>
                <div className="flex gap-1 flex-wrap">
                  {selectedNPCs.map(npcId => {
                    const npc = npcsArray.find(n => n.id === npcId);
                    return (
                      <Badge key={npcId} variant="secondary">
                        {npc?.name || 'Unknown'}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Actions */}
      <div className="flex justify-end">
        <Button 
          type="submit" 
          disabled={!isValid || isSubmitting}
          className="min-w-[120px]"
        >
          {isSubmitting ? 'Saving...' : 'Save & Continue'}
        </Button>
      </div>
      </form>
      <CreateNPCDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        worldId={selectedWorldId}
        onCreated={(npcId) => {
          // Add the newly created NPC to the selection
          const newSelected = [...selectedNPCs, npcId];
          setSelectedNPCs(newSelected);
          setValue('npcIds', newSelected);
          onUpdate({ npcIds: newSelected });
        }}
      />
  </>
  );
}
